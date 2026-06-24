const db = require('./db');
const redis = require('./redis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function runTests() {
  console.log('=== KIỂM TRA KẾT NỐI HỆ THỐNG ===\n');
  let hasErrors = false;

  // 1. Kiểm tra PostgreSQL
  try {
    const res = await db.query('SELECT NOW() as current_time');
    console.log('[OK] PostgreSQL kết nối thành công! Giờ hệ thống:', res.rows[0].current_time);
  } catch (err) {
    console.error('[FAIL] Lỗi kết nối PostgreSQL:', err.message);
    hasErrors = true;
  }

  // 2. Kiểm tra Redis
  try {
    const pingResponse = await redis.ping();
    console.log('[OK] Redis kết nối thành công! Trạng thái PING:', pingResponse);
  } catch (err) {
    console.error('[FAIL] Lỗi kết nối Redis:', err.message);
    hasErrors = true;
  }

  // 3. Kiểm tra Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('[WARNING] GEMINI_API_KEY chưa được cấu hình hoặc sử dụng giá trị mặc định. Tính năng AI sẽ không hoạt động.');
  } else {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      const response = await model.generateContent('Hãy trả lời "Hello Connection Test"');
      const text = response.response.text();
      console.log('[OK] Google Gemini API kết nối thành công! Phản hồi kiểm thử:', text.trim());
    } catch (err) {
      console.error('[FAIL] Lỗi gọi Google Gemini API:', err.message);
      console.warn('[WARNING] Vui lòng kiểm tra lại GEMINI_API_KEY hoặc kết nối internet.');
    }
  }

  console.log('\n==================================');
  if (hasErrors) {
    console.error('KẾT QUẢ: Có lỗi xảy ra trong quá trình kiểm tra. Hãy kiểm tra các dịch vụ đang chạy.');
    process.exit(1);
  } else {
    console.log('KẾT QUẢ: Tất cả các dịch vụ kết nối cục bộ đều sẵn sàng!');
    process.exit(0);
  }
}

// Chạy bài test kết nối
runTests();
