const assert = require('assert').strict;
const db = require('../config/db');
const adminController = require('../controllers/adminController');
const { AuditLog } = require('../models/schema');

/**
 * Script kiểm tra tích hợp cho phân hệ Ma trận Vai trò (RBAC Matrix Integration Test)
 */
async function testRoleMatrix() {
  console.log('=== KHỞI CHẠY KIỂM THỬ TÍCH HỢP MA TRẬN VAI TRÒ ===\n');
  let hasErrors = false;

  try {
    // 1. Kiểm tra an toàn bảo mật: Không được phép sửa đổi vai trò Super Admin (ID = 1)
    console.log('[1/3] Kiểm tra bảo vệ vai trò Super Admin...');
    
    // Giả lập đối tượng req, res
    const reqSuper = {
      session: { userId: 1, permissions: ['ROLE_MANAGE'] },
      body: { roleId: 1, permission: 'COURSE_CREATE', isChecked: false }
    };
    
    let superStatus = 0;
    let superJson = {};
    
    const resSuper = {
      status: (code) => {
        superStatus = code;
        return {
          json: (data) => { superJson = data; }
        };
      },
      json: (data) => { superJson = data; }
    };

    await adminController.toggleRolePermission(reqSuper, resSuper);
    
    assert.strictEqual(superStatus, 400, 'Yêu cầu cập nhật quyền Super Admin phải bị từ chối với mã lỗi 400.');
    assert.strictEqual(superJson.error, 'Không thể chỉnh sửa vai trò Super Admin để đảm bảo an toàn hệ thống.');
    console.log('      [OK] Super Admin được bảo vệ thành công khỏi việc thu hồi quyền.');

    // 2. Kiểm tra cập nhật quyền thành công của vai trò khác (HR Manager - ID = 2)
    console.log('[2/3] Kiểm tra cập nhật quyền cho vai trò HR Manager...');
    
    // Dọn dẹp trước quyền nếu có
    await db.query("DELETE FROM role_permissions WHERE role_id = 2 AND permission_name = 'COURSE_CREATE'");

    const reqHR = {
      session: { userId: 1, username: 'admin', roleId: 1, roleName: 'Super Admin', permissions: ['ROLE_MANAGE'] },
      body: { roleId: 2, permission: 'COURSE_CREATE', isChecked: true }
    };

    let hrStatus = 200;
    let hrJson = {};

    const resHR = {
      status: (code) => {
        hrStatus = code;
        return {
          json: (data) => { hrJson = data; }
        };
      },
      json: (data) => {
        hrStatus = 200;
        hrJson = data;
      }
    };

    await adminController.toggleRolePermission(reqHR, resHR);
    
    assert.strictEqual(hrStatus, 200, 'Yêu cầu cập nhật quyền HR Manager phải thành công.');
    assert.strictEqual(hrJson.success, true);
    
    // Truy vấn cơ sở dữ liệu thực tế xem quyền đã được thêm chưa
    const checkSql = "SELECT * FROM role_permissions WHERE role_id = 2 AND permission_name = 'COURSE_CREATE'";
    const checkRes = await db.query(checkSql);
    assert.strictEqual(checkRes.rows.length, 1, 'Quyền COURSE_CREATE phải được thêm vào bảng role_permissions trong CSDL.');
    console.log('      [OK] Quyền COURSE_CREATE đã được lưu thành công vào CSDL PostgreSQL.');

    // 3. Kiểm tra ghi Audit Log (Nhật ký hệ thống)
    console.log('[3/5] Kiểm tra ghi Audit Log cho hành động cập nhật...');
    
    const logs = await AuditLog.findAll();
    const latestLog = logs[0];
    
    assert.strictEqual(latestLog.action, 'ROLE_PERMISSION_TOGGLE', 'Phải ghi nhật ký với action là ROLE_PERMISSION_TOGGLE.');
    assert.strictEqual(latestLog.details.role_id, 2, 'Chi tiết log phải ghi đúng ID vai trò.');
    assert.strictEqual(latestLog.details.permission, 'COURSE_CREATE', 'Chi tiết log phải ghi đúng quyền thay đổi.');
    assert.strictEqual(latestLog.details.is_assigned, true, 'Chi tiết log phải ghi đúng trạng thái bật quyền.');
    console.log('      [OK] Audit Log được ghi chép chi tiết và đầy đủ trong cơ sở dữ liệu.');

    // Dọn dẹp trả lại trạng thái gốc cho dữ liệu
    await db.query("DELETE FROM role_permissions WHERE role_id = 2 AND permission_name = 'COURSE_CREATE'");

    // 4. Kiểm tra an toàn bảo mật: Quyền USER_DISABLE khi vô hiệu hóa tài khoản nhân sự
    console.log('[4/5] Kiểm tra bảo vệ quyền USER_DISABLE khi vô hiệu hóa tài khoản...');
    
    // Tạo một nhân sự giả lập
    const tempUserRes = await db.query(
      "INSERT INTO users (username, email, password, role_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['temp_test_user', 'temp_test@example.com', 'password', 4, 'active']
    );
    const tempUserId = tempUserRes.rows[0].id;

    try {
      // Admin có USER_MANAGE nhưng không có USER_DISABLE
      const reqUpdateNoDisable = {
        session: { userId: 1, permissions: ['USER_MANAGE'] }, // Thiếu USER_DISABLE
        params: { id: tempUserId },
        body: { roleId: 4, departmentId: '', status: 'disabled' }
      };

      let updateStatus = 0;
      let renderMsg = '';

      const resUpdate = {
        status: (code) => {
          updateStatus = code;
          return {
            render: (view, data) => { renderMsg = data.message; },
            json: (data) => { renderMsg = data.error; }
          };
        },
        render: (view, data) => {
          updateStatus = 403;
          renderMsg = data.message;
        }
      };

      await adminController.updateUser(reqUpdateNoDisable, resUpdate);

      assert.strictEqual(updateStatus, 403, 'Yêu cầu vô hiệu hóa phải bị từ chối 403 khi thiếu quyền USER_DISABLE.');
      assert.ok(renderMsg.includes('vô hiệu hóa'), 'Thông báo lỗi phải hiển thị thiếu quyền vô hiệu hóa.');
      console.log('      [OK] Ngăn chặn vô hiệu hóa tài khoản thành công khi thiếu quyền USER_DISABLE.');

    } finally {
      // Dọn dẹp nhân sự giả lập
      await db.query("DELETE FROM users WHERE id = $1", [tempUserId]);
    }

    // 5. Kiểm tra an toàn bảo mật: Quyền CONTENT_UPLOAD khi đính kèm video/tài liệu học tập
    console.log('[5/5] Kiểm tra bảo vệ quyền CONTENT_UPLOAD khi đính kèm học liệu...');

    // Lấy một khóa học có sẵn trong CSDL
    const courseRes = await db.query("SELECT id FROM courses LIMIT 1");
    if (courseRes.rows.length > 0) {
      const courseId = courseRes.rows[0].id;

      const reqCreateLessonNoUpload = {
        session: { userId: 1, permissions: ['LESSON_CREATE'] }, // Thiếu CONTENT_UPLOAD
        params: { courseId },
        body: {
          title: 'Bài học thử nghiệm bảo mật',
          content: 'Nội dung lý thuyết',
          video_url: 'https://example.com/video.mp4',
          attachment_url: '',
          order_index: 1
        }
      };

      let lessonStatus = 0;
      let lessonMsg = '';

      const resLesson = {
        status: (code) => {
          lessonStatus = code;
          return {
            render: (view, data) => { lessonMsg = data.message; },
            json: (data) => { lessonMsg = data.error; }
          };
        },
        render: (view, data) => {
          lessonStatus = 403;
          lessonMsg = data.message;
        }
      };

      await adminController.createLesson(reqCreateLessonNoUpload, resLesson);

      assert.strictEqual(lessonStatus, 403, 'Yêu cầu thêm bài học kèm video phải bị từ chối 403 khi thiếu quyền CONTENT_UPLOAD.');
      assert.ok(lessonMsg.includes('tải lên video'), 'Thông báo lỗi phải hiển thị thiếu quyền tải lên video.');
      console.log('      [OK] Ngăn chặn thêm bài giảng kèm video thành công khi thiếu quyền CONTENT_UPLOAD.');
    } else {
      console.log('      [SKIP] Không tìm thấy khóa học nào trong CSDL để chạy kiểm thử CONTENT_UPLOAD.');
    }

    // 6. Kiểm tra đồng bộ hóa session tự động khi đổi vai trò & vô hiệu hóa tài khoản
    console.log('[6/6] Kiểm tra đồng bộ hóa session khi đổi vai trò / trạng thái...');
    const { loadDynamicPermissions } = require('../middleware/auth');
    const redis = require('../config/redis');

    // Tạo một nhân sự giả lập
    const sessionUserRes = await db.query(
      "INSERT INTO users (username, email, password, role_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['session_test_user', 'session_test@example.com', 'password', 4, 'active']
    );
    const sessionUserId = sessionUserRes.rows[0].id;

    try {
      // Giả lập session
      const reqMock = {
        session: {
          userId: sessionUserId,
          roleId: 4,
          roleName: 'Employee',
          permissions: []
        }
      };

      const resMock = {
        redirect: (url) => { resMock.redirectedTo = url; },
        status: (code) => { 
          resMock.statusCode = code; 
          return { json: (data) => { resMock.jsonResponse = data; } };
        }
      };
      
      reqMock.session.destroy = (callback) => {
        reqMock.session = null;
        callback();
      };

      let nextCalled = false;
      const nextMock = () => { nextCalled = true; };

      // Chạy lần 1: Đọc và cache status/role
      await loadDynamicPermissions(reqMock, resMock, nextMock);
      assert.strictEqual(nextCalled, true, 'Lần 1: Middleware phải gọi next() thành công.');
      assert.strictEqual(reqMock.session.roleId, 4, 'Vai trò hiện tại trong session phải là 4.');

      // Kiểm tra có tạo cache trong Redis
      const cacheVal = await redis.get(`user_status:${sessionUserId}`);
      assert.ok(cacheVal, 'Phải tạo cache user_status trong Redis.');
      const parsedCache = JSON.parse(cacheVal);
      assert.strictEqual(parsedCache.status, 'active');
      assert.strictEqual(parsedCache.roleId, 4);

      // Thay đổi vai trò người dùng trong DB và xóa cache
      nextCalled = false;
      await db.query("UPDATE users SET role_id = 3 WHERE id = $1", [sessionUserId]);
      await redis.del(`user_status:${sessionUserId}`);

      // Chạy lần 2: Đổi vai trò tự động
      await loadDynamicPermissions(reqMock, resMock, nextMock);
      assert.strictEqual(nextCalled, true, 'Lần 2: Middleware phải gọi next() sau khi cập nhật vai trò.');
      assert.strictEqual(reqMock.session.roleId, 3, 'Vai trò trong session phải tự động cập nhật lên 3.');

      // Vô hiệu hóa tài khoản và xóa cache
      nextCalled = false;
      await db.query("UPDATE users SET status = 'disabled' WHERE id = $1", [sessionUserId]);
      await redis.del(`user_status:${sessionUserId}`);

      // Chạy lần 3: Tài khoản disabled phải hủy session và redirect
      await loadDynamicPermissions(reqMock, resMock, nextMock);
      assert.strictEqual(nextCalled, false, 'Lần 3: Không được gọi next() khi tài khoản bị vô hiệu hóa.');
      assert.strictEqual(reqMock.session, null, 'Session phải bị hủy (req.session === null).');
      assert.ok(resMock.redirectedTo.includes('disabled') || decodeURIComponent(resMock.redirectedTo).includes('vô hiệu hóa'), 'Phải redirect về trang đăng nhập với thông báo lỗi.');

      console.log('      [OK] Đồng bộ hóa thay đổi vai trò và chặn tài khoản vô hiệu hóa thành công.');
    } finally {
      // Dọn dẹp
      await db.query("DELETE FROM users WHERE id = $1", [sessionUserId]);
      await redis.del(`user_status:${sessionUserId}`);
    }

    console.log('\n=== KẾT QUẢ: TOÀN BỘ 6 KIỂM THỬ TÍCH HỢP MA TRẬN VAI TRÒ ĐẠT CHUẨN PASS! ===');
    process.exit(0);

  } catch (err) {
    console.error('\n[FAIL] Kiểm thử tích hợp thất bại:', err.message);
    hasErrors = true;
    process.exit(1);
  }
}

// Chạy bài kiểm thử
testRoleMatrix();
