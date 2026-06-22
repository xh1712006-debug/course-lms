const { Pool } = require('pg');
require('dotenv').config();

// Khởi tạo Connection Pool kết nối tới PostgreSQL
// Sử dụng chuỗi kết nối từ biến môi trường DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Lắng nghe sự kiện kết nối thành công để ghi log hoạt động
pool.on('connect', () => {
  // Ghi log kết nối CSDL thành công (phục vụ mục đích debug nội bộ)
  console.log('[PostgreSQL] Đã kết nối cơ sở dữ liệu thành công.');
});

// Lắng nghe sự kiện lỗi kết nối để xử lý tránh sập ứng dụng
pool.on('error', (err) => {
  console.error('[PostgreSQL] Lỗi kết nối CSDL đột ngột:', err);
});

module.exports = {
  /**
   * Thực thi câu lệnh SQL với các tham số truyền vào (Tránh lỗi SQL Injection)
   * @param {string} text - Câu lệnh SQL (Ví dụ: 'SELECT * FROM users WHERE id = $1')
   * @param {Array} params - Mảng chứa các tham số truyền tương ứng
   * @returns {Promise<object>} - Kết quả trả về của truy vấn
   */
  query: (text, params) => pool.query(text, params),
  pool
};
