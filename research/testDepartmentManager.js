const assert = require('assert').strict;
const db = require('../config/db');
const adminController = require('../controllers/adminController');
const courseController = require('../controllers/courseController');
const { Department, User, AuditLog } = require('../models/schema');

async function testDepartmentManager() {
  console.log('=== KHỞI CHẠY KIỂM THỬ TÍCH HỢP TÍNH NĂNG TRƯỞNG PHÒNG BAN ===\n');

  try {
    // 1. Tạo dữ liệu giả lập để kiểm thử
    console.log('[1/5] Khởi tạo dữ liệu giả lập...');
    
    // Tạo 1 phòng ban test
    const deptRes = await db.query(
      "INSERT INTO departments (name) VALUES ($1) RETURNING id",
      ['Phòng Kỹ Thuật Test']
    );
    const testDeptId = deptRes.rows[0].id;
    
    // Tạo 2 nhân sự test
    const user1Res = await db.query(
      "INSERT INTO users (username, email, password, role_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['manager_test_1', 'manager1@example.com', 'password', 4, 'active']
    );
    const testManagerId1 = user1Res.rows[0].id;

    const user2Res = await db.query(
      "INSERT INTO users (username, email, password, role_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      ['manager_test_2', 'manager2@example.com', 'password', 4, 'active']
    );
    const testManagerId2 = user2Res.rows[0].id;

    console.log(`      Tạo thành công phòng ban ID: ${testDeptId}, Manager 1 ID: ${testManagerId1}, Manager 2 ID: ${testManagerId2}`);

    // 2. Kiểm thử tìm kiếm eligible managers
    console.log('[2/5] Kiểm tra truy vấn danh sách Trưởng phòng đủ điều kiện...');
    const eligible = await User.findEligibleManagers();
    const emails = eligible.map(u => u.email);
    assert.ok(emails.includes('manager1@example.com'), 'Danh sách eligible managers phải chứa email của Manager 1.');
    assert.ok(emails.includes('manager2@example.com'), 'Danh sách eligible managers phải chứa email của Manager 2.');
    console.log('      [OK] Lấy danh sách Trưởng phòng hợp lệ thành công.');

    // 3. Kiểm thử gán Trưởng phòng thông qua controller
    console.log('[3/5] Kiểm tra gán Trưởng phòng thông qua adminController...');
    
    const reqAssign = {
      session: { userId: 1, permissions: ['DEPARTMENT_MANAGE'] },
      params: { id: testDeptId },
      body: { managerId: testManagerId1 }
    };
    
    let redirectUrl = '';
    const resAssign = {
      redirect: (url) => { redirectUrl = url; }
    };

    await adminController.assignDepartmentManager(reqAssign, resAssign);
    
    assert.ok(redirectUrl.includes('success'), 'Redirect URL phải chứa thông báo thành công.');
    
    // Kiểm tra DB thực tế
    const checkDeptRes = await db.query("SELECT manager_id FROM departments WHERE id = $1", [testDeptId]);
    assert.strictEqual(checkDeptRes.rows[0].manager_id, testManagerId1, 'Trực tiếp trong DB, manager_id phải là ID của Manager 1.');
    console.log('      [OK] Gán Trưởng phòng ban thành công.');

    // 4. Kiểm tra gán đè Trưởng phòng ban (thay thế)
    console.log('[4/5] Kiểm tra gán thay thế Trưởng phòng ban khác...');
    
    const reqReplace = {
      session: { userId: 1, permissions: ['DEPARTMENT_MANAGE'] },
      params: { id: testDeptId },
      body: { managerId: testManagerId2 }
    };
    
    await adminController.assignDepartmentManager(reqReplace, resAssign);
    
    const checkDeptRes2 = await db.query("SELECT manager_id FROM departments WHERE id = $1", [testDeptId]);
    assert.strictEqual(checkDeptRes2.rows[0].manager_id, testManagerId2, 'DB phải được cập nhật thay thế bằng ID của Manager 2.');
    console.log('      [OK] Thay thế Trưởng phòng ban thành công.');

    // 5. Kiểm tra Audit Log
    console.log('[5/5] Kiểm tra ghi Audit Log...');
    const logs = await AuditLog.findAll();
    const latestLog = logs[0];
    assert.strictEqual(latestLog.action, 'DEPARTMENT_ASSIGN_MANAGER', 'Action log phải là DEPARTMENT_ASSIGN_MANAGER.');
    assert.strictEqual(latestLog.details.department_id, testDeptId, 'ID phòng ban trong log phải khớp.');
    assert.strictEqual(latestLog.details.manager_id, testManagerId2, 'ID Trưởng phòng được gán trong log phải khớp.');
    console.log('      [OK] Audit Log được ghi đầy đủ và chính xác.');

    // Dọn dẹp dữ liệu kiểm thử
    console.log('\nDọn dẹp dữ liệu...');
    await db.query("DELETE FROM departments WHERE id = $1", [testDeptId]);
    await db.query("DELETE FROM users WHERE id IN ($1, $2)", [testManagerId1, testManagerId2]);
    console.log('=== KẾT QUẢ: TOÀN BỘ CÁC BÀI KIỂM THỬ TÍCH HỢP TRƯỞNG PHÒNG BAN ĐÃ ĐẠT CHUẨN PASS! ===');
    process.exit(0);

  } catch (err) {
    console.error('\n[FAIL] Kiểm thử tích hợp thất bại:', err.message);
    // Dọn dẹp khẩn cấp khi lỗi
    try {
      await db.query("DELETE FROM departments WHERE name = 'Phòng Kỹ Thuật Test'");
      await db.query("DELETE FROM users WHERE username IN ('manager_test_1', 'manager_test_2')");
    } catch (_) {}
    process.exit(1);
  }
}

testDepartmentManager();
