const assert = require('assert').strict;
const db = require('../config/db');
const redis = require('../config/redis');
const assessmentController = require('../controllers/assessmentController');
const { User, Assessment, AssessmentAssignment, AssessmentQuestion } = require('../models/schema');

async function testAssessmentSchedule() {
  console.log('=== KHỞI CHẠY KIỂM THỬ TÍCH HỢP LÊN LỊCH THI BÀI KIỂM TRA ===\n');
  let hasErrors = false;
  let testUserId = null;
  let testAssessmentId = null;

  try {
    // 1. Tạo tài khoản nhân viên test
    const username = 'test_schedule_user';
    const email = 'test_schedule_user@company.com';
    await db.query('DELETE FROM users WHERE email = $1', [email]);
    
    const passwordHash = 'password123'; // Không mã hóa mật khẩu
    
    const newUser = await User.create(username, email, passwordHash, 4, null);
    testUserId = newUser.id;
    console.log(`[1/6] Tạo tài khoản test thành công. ID: ${testUserId}`);

    // 2. Tạo bài kiểm tra test
    const assessment = await Assessment.create(
      'Bài kiểm tra năng lực Golang',
      'Đánh giá kỹ năng lập trình Golang cơ bản',
      [], // courseIds
      1, // questionCount
      30, // durationMinutes
      80, // passingScore
      1 // createdBy (Super Admin)
    );
    testAssessmentId = assessment.id;
    console.log(`[2/6] Tạo bài kiểm tra test thành công. ID: ${testAssessmentId}`);

    // Tạo câu hỏi test cho bài kiểm tra
    await AssessmentQuestion.createBulk(testAssessmentId, [
      {
        question_text: 'Golang là ngôn ngữ gì?',
        options: ['Biên dịch', 'Thông dịch', 'Lai'],
        correct_answer: 'Biên dịch'
      }
    ]);
    // Xuất bản bài kiểm tra
    await Assessment.publish(testAssessmentId);
    console.log(`      Đã tạo câu hỏi và xuất bản bài kiểm tra.`);

    // 3. Test API postAssign (Phân phối bài kiểm tra với start_time và deadline)
    console.log('\n[3/6] Kiểm tra API phân phối bài kiểm tra (postAssign)...');
    const startTimeStr = new Date(Date.now() + 3600000).toISOString(); // 1 tiếng sau
    const deadlineStr = new Date(Date.now() + 7200000).toISOString(); // 2 tiếng sau

    const reqAssign = {
      session: { userId: 1 },
      body: {
        assessmentId: testAssessmentId,
        targetType: 'user',
        targetIds: [testUserId],
        startTime: startTimeStr,
        deadline: deadlineStr
      },
      ip: '127.0.0.1'
    };

    let statusCalled = null;
    let jsonResponse = null;
    const resAssign = {
      status: (code) => {
        statusCalled = code;
        return resAssign;
      },
      json: (data) => {
        jsonResponse = data;
      }
    };

    await assessmentController.postAssign(reqAssign, resAssign);
    assert.ok(jsonResponse, 'Phải có phản hồi JSON.');
    assert.strictEqual(jsonResponse.success, true, 'Giao bài kiểm tra phải thành công.');
    
    // Kiểm tra DB xem assignment có start_time và deadline chuẩn xác không
    const checkAssignmentRes = await db.query(
      'SELECT start_time, deadline FROM assessment_assignments WHERE assessment_id = $1 AND target_type = $2 AND target_id = $3',
      [testAssessmentId, 'user', testUserId]
    );
    assert.strictEqual(checkAssignmentRes.rows.length, 1, 'Phải tìm thấy bản ghi phân phối.');
    const row = checkAssignmentRes.rows[0];
    assert.ok(row.start_time, 'start_time không được rỗng.');
    assert.ok(row.deadline, 'deadline không được rỗng.');
    console.log('      [OK] Phân phối bài kiểm tra và lưu start_time thành công.');

    // 4. Test chặn vào làm bài trước giờ mở đề (start_time tương lai)
    console.log('\n[4/6] Kiểm tra chặn vào làm bài trước giờ mở đề (getTake)...');
    const reqTakeBefore = {
      params: { id: testAssessmentId.toString() },
      session: {
        userId: testUserId,
        departmentId: null
      }
    };

    let renderView = '';
    let renderData = null;
    let responseStatus = 200;

    const resTakeBefore = {
      status: (code) => {
        responseStatus = code;
        return resTakeBefore;
      },
      render: (view, data) => {
        renderView = view;
        renderData = data;
      }
    };

    await assessmentController.getTake(reqTakeBefore, resTakeBefore);
    assert.strictEqual(responseStatus, 403, 'Trạng thái phản hồi phải là 403.');
    assert.strictEqual(renderView, 'error', 'Phải render trang lỗi.');
    assert.ok(renderData.message.includes('chưa mở'), 'Thông báo phải chứa chữ "chưa mở".');
    console.log('      [OK] Chặn thành công học viên làm bài trước giờ mở đề.');

    // 5. Test chặn vào làm bài sau giờ hết hạn (deadline quá khứ)
    console.log('\n[5/6] Kiểm tra chặn vào làm bài sau khi hết hạn...');
    // Cập nhật lại thời gian trong DB cho bài test: start_time = 2 tiếng trước, deadline = 1 tiếng trước
    await db.query(
      'UPDATE assessment_assignments SET start_time = $1, deadline = $2 WHERE assessment_id = $3 AND target_type = $4 AND target_id = $5',
      [new Date(Date.now() - 7200000), new Date(Date.now() - 3600000), testAssessmentId, 'user', testUserId]
    );

    responseStatus = 200;
    renderView = '';
    renderData = null;

    await assessmentController.getTake(reqTakeBefore, resTakeBefore);
    assert.strictEqual(responseStatus, 403, 'Trạng thái phản hồi phải là 403 khi hết hạn.');
    assert.strictEqual(renderView, 'error', 'Phải render trang lỗi khi hết hạn.');
    assert.ok(renderData.message.includes('hết hạn'), 'Thông báo phải chứa chữ "hết hạn".');
    console.log('      [OK] Chặn thành công học viên làm bài sau khi hết hạn.');

    // 6. Test cho phép vào làm bài khi thời gian mở hợp lệ
    console.log('\n[6/6] Kiểm tra cho phép làm bài khi thời gian hợp lệ...');
    // Cập nhật lại thời gian trong DB: start_time = 1 tiếng trước, deadline = 1 tiếng sau
    await db.query(
      'UPDATE assessment_assignments SET start_time = $1, deadline = $2 WHERE assessment_id = $3 AND target_type = $4 AND target_id = $5',
      [new Date(Date.now() - 3600000), new Date(Date.now() + 3600000), testAssessmentId, 'user', testUserId]
    );

    responseStatus = 200;
    renderView = '';
    renderData = null;

    await assessmentController.getTake(reqTakeBefore, resTakeBefore);
    assert.strictEqual(responseStatus, 200, 'Trạng thái phản hồi phải là 200.');
    assert.strictEqual(renderView, 'courses/take-assessment', 'Phải render trang take-assessment.');
    assert.ok(renderData.assessment, 'Phải truyền đối tượng assessment.');
    assert.ok(renderData.questions, 'Phải truyền đối tượng questions.');
    console.log('      [OK] Cho phép học viên vào làm bài thành công.');

  } catch (err) {
    console.error('\n[FAIL] Kiểm thử tích hợp lên lịch thi thất bại:', err);
    hasErrors = true;
  } finally {
    console.log('\nDọn dẹp dữ liệu kiểm thử...');
    try {
      if (testAssessmentId) {
        await db.query('DELETE FROM assessment_assignments WHERE assessment_id = $1', [testAssessmentId]);
        await db.query('DELETE FROM assessment_questions WHERE assessment_id = $1', [testAssessmentId]);
        await db.query('DELETE FROM assessments WHERE id = $1', [testAssessmentId]);
      }
      if (testUserId) {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
      }
    } catch (cleanErr) {
      console.error('Lỗi dọn dẹp:', cleanErr);
    }

    if (hasErrors) {
      process.exit(1);
    } else {
      console.log('\n=== KẾT QUẢ: TOÀN BỘ KIỂM THỬ LÊN LỊCH THI ĐÃ ĐẠT CHUẨN PASS! ===');
      process.exit(0);
    }
  }
}

testAssessmentSchedule();
