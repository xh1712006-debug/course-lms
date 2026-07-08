const assert = require('assert').strict;
const db = require('../config/db');
const redis = require('../config/redis');
const courseController = require('../controllers/courseController');
const { User, AuditLog } = require('../models/schema');

/**
 * Kịch bản kiểm thử tích hợp cho bộ chức năng Học viên (Learner Suite Integration Test)
 */
async function testLearnerSuite() {
  console.log('=== KHỞI CHẠY KIỂM THỬ TÍCH HỢP BỘ CHỨC NĂNG HỌC VIÊN ===\n');
  let hasErrors = false;

  // Lấy hoặc tạo tài khoản nhân viên mock để chạy test
  let testUserId = null;
  const username = 'learner_suite_test_user';
  const email = 'learner_suite_test@company.com';
  
  try {
    // 1. Dọn dẹp nếu đã tồn tại và tạo tài khoản mới
    await db.query('DELETE FROM users WHERE email = $1', [email]);
    const passwordHash = 'password123'; // Không mã hóa mật khẩu
    
    // Tạo user với role Employee (role_id = 4)
    const newUser = await User.create(username, email, passwordHash, 4, null);
    testUserId = newUser.id;
    console.log(`[OK] Đã tạo tài khoản test thành công với ID: ${testUserId}`);

    // 2. Kiểm thử getMyPaths
    console.log('\n[1/4] Kiểm tra trang Lộ trình của tôi (/my-paths)...');
    const reqPaths = {
      session: {
        userId: testUserId,
        permissions: ['PATH_VIEW'],
        isImpersonating: false
      }
    };
    
    let renderedView = '';
    let renderedData = null;
    
    const resPaths = {
      render: (view, data) => {
        renderedView = view;
        renderedData = data;
      }
    };

    await courseController.getMyPaths(reqPaths, resPaths);
    assert.strictEqual(renderedView, 'courses/my-paths');
    assert.ok(renderedData.paths);
    assert.ok(Array.isArray(renderedData.paths));
    console.log('      [OK] Render thành công trang courses/my-paths.');
    // 3. Kiểm thử getMyDeadlines
    console.log('\n[2/4] Kiểm tra trang Lịch học & Deadline (/my-deadlines)...');
    const reqDeadlines = {
      session: {
        userId: testUserId,
        permissions: ['PROGRESS_TRACK'],
        isImpersonating: false
      }
    };
    
    const resDeadlines = {
      render: (view, data) => {
        renderedView = view;
        renderedData = data;
      }
    };

    await courseController.getMyDeadlines(reqDeadlines, resDeadlines);
    assert.strictEqual(renderedView, 'courses/my-deadlines');
    assert.ok(renderedData.deadlines);
    console.log('      [OK] Render thành công trang courses/my-deadlines.');

    // 4. Kiểm thử getSettings
    console.log('\n[3/4] Kiểm tra trang Cài đặt tài khoản (/settings)...');
    const reqSettings = {
      session: {
        userId: testUserId,
        permissions: ['SETTINGS_VIEW'],
        isImpersonating: false
      },
      query: {
        success: 'Thành công!',
        error: null
      }
    };
    
    const resSettings = {
      render: (view, data) => {
        renderedView = view;
        renderedData = data;
      }
    };

    await courseController.getSettings(reqSettings, resSettings);
    assert.strictEqual(renderedView, 'courses/settings');
    assert.ok(renderedData.userDetails);
    assert.strictEqual(renderedData.userDetails.username, username);
    assert.strictEqual(renderedData.success, 'Thành công!');
    console.log('      [OK] Render thành công trang courses/settings.');

    // 5. Kiểm thử postChangePassword (Đổi mật khẩu)
    console.log('\n[4/4] Kiểm tra thay đổi mật khẩu an toàn...');
    
    // Trường hợp 1: Sai mật khẩu cũ
    const reqChangePwWrong = {
      session: { userId: testUserId },
      body: {
        oldPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      },
      ip: '127.0.0.1'
    };
    
    let redirectedUrl = '';
    const resChangePw = {
      redirect: (url) => {
        redirectedUrl = url;
      }
    };
    
    await courseController.postChangePassword(reqChangePwWrong, resChangePw);
    assert.ok(redirectedUrl.includes('error'), 'Phải trả về lỗi khi mật khẩu cũ sai.');
    assert.ok(decodeURIComponent(redirectedUrl).includes('chính xác'), 'Nội dung lỗi chứa thông báo không chính xác.');
    console.log('      [OK] Từ chối đổi mật khẩu thành công khi sai mật khẩu cũ.');

    // Trường hợp 2: Đổi mật khẩu đúng
    const reqChangePwRight = {
      session: { userId: testUserId },
      body: {
        oldPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      },
      ip: '127.0.0.1'
    };
    
    await courseController.postChangePassword(reqChangePwRight, resChangePw);
    assert.ok(redirectedUrl.includes('success'), 'Phải trả về success khi mật khẩu đúng.');
    
    // Kiểm tra DB cập nhật password và lưu log
    const userRes = await db.query('SELECT password FROM users WHERE id = $1', [testUserId]);
    const newPasswordInDb = userRes.rows[0].password;
    assert.strictEqual(newPasswordInDb, 'newpassword123', 'Mật khẩu mới phải lưu ở dạng plain text.');
    
    const logs = await AuditLog.findAll();
    const latestLog = logs[0];
    assert.strictEqual(latestLog.action, 'PASSWORD_RESET_SUCCESS', 'Phải lưu hành động PASSWORD_RESET_SUCCESS vào Audit Log.');
    console.log('      [OK] Thay đổi mật khẩu thành công, lưu mật khẩu dạng plain text và ghi log bảo mật.');

  } catch (err) {
    console.error('\n[FAIL] Kiểm thử bộ chức năng Học viên thất bại:', err);
    hasErrors = true;
  } finally {
    // Dọn dẹp tài khoản test
    if (testUserId) {
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
      console.log('\n[INFO] Đã dọn dẹp tài khoản kiểm thử.');
    }
    
    if (hasErrors) {
      process.exit(1);
    } else {
      console.log('\n=== KẾT QUẢ: TOÀN BỘ KIỂM THỬ BỘ CHỨC NĂNG HỌC VIÊN ĐẠT CHUẨN PASS! ===');
      process.exit(0);
    }
  }
}

// Chạy test
testLearnerSuite();
