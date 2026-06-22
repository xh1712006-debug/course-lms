const nodemailer = require('nodemailer');
require('dotenv').config();

// Đọc cấu hình từ .env
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || `"Hệ thống LMS" <${smtpUser}>`;

// Kiểm tra xem cấu hình SMTP đã được thiết lập thực tế chưa
const isConfigured = smtpUser && smtpPass && 
                    smtpUser !== 'your_email@gmail.com' && 
                    smtpPass !== 'your_app_password' &&
                    smtpPass !== 'your_google_app_password' &&
                    smtpUser !== 'your_mailtrap_username' &&
                    smtpPass !== 'your_mailtrap_password';

let transporter = null;

if (isConfigured) {
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        // Đảm bảo không lỗi chứng chỉ khi chạy localhost
        rejectUnauthorized: false
      }
    });
    console.log('[Email Service] Đã cấu hình và kết nối thành công tới máy chủ SMTP.');
  } catch (err) {
    console.error('[Email Service] Lỗi khởi tạo SMTP transporter:', err);
  }
} else {
  console.warn('[Email Service] Cấu hình SMTP trống hoặc ở chế độ mặc định. Sử dụng chế độ MOCK (In mã OTP ra Terminal).');
}

/**
 * Hàm gửi Email chứa mã OTP
 * @param {string} toEmail - Email nhận mã
 * @param {string} username - Tên tài khoản
 * @param {string} otp - Mã OTP 6 chữ số
 */
async function sendOTPEmail(toEmail, username, otp) {
  const mailSubject = `[LMS] Mã xác thực OTP đặt lại mật khẩu cho tài khoản ${username}`;
  
  // HTML Template phong cách Darkmode Glassmorphism sang trọng
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          background-color: #0b0f19;
          color: #f3f4f6;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 580px;
          margin: 40px auto;
          padding: 20px;
        }
        .card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 35px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 22px;
          font-weight: 850;
          color: #818cf8;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0;
        }
        .title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 15px 0 5px 0;
          text-align: center;
        }
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.3), transparent);
          margin: 20px 0;
        }
        .greeting {
          font-size: 15px;
          line-height: 1.6;
          color: #d1d5db;
        }
        .otp-container {
          background: rgba(129, 140, 248, 0.1);
          border: 1px solid rgba(129, 140, 248, 0.2);
          border-radius: 12px;
          padding: 20px 10px;
          text-align: center;
          margin: 30px 0;
        }
        .otp-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 38px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #a5b4fc;
          margin: 0;
        }
        .info-box {
          font-size: 13px;
          line-height: 1.6;
          color: #9ca3af;
          background: rgba(255, 255, 255, 0.02);
          border-left: 3px solid #818cf8;
          padding: 12px 15px;
          border-radius: 4px;
          margin-bottom: 25px;
        }
        .footer {
          text-align: center;
          font-size: 11px;
          color: #6b7280;
          margin-top: 35px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1 class="logo">Internal LMS</h1>
            <h2 class="title">Yêu cầu cấp mã xác thực OTP</h2>
          </div>
          <div class="divider"></div>
          
          <p class="greeting">Xin chào <strong>${username}</strong>,</p>
          <p class="greeting">Hệ thống đã nhận được yêu cầu xác thực để cấp lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP gồm 6 chữ số dưới đây:</p>
          
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
          </div>
          
          <div class="info-box">
            • Mã xác nhận này có giá trị trong vòng <strong>5 phút</strong>.<br>
            • Tuyệt đối không tiết lộ mã OTP này cho người khác để tránh mất tài khoản.<br>
            • Nếu bạn không yêu cầu hành động này, vui lòng đổi mật khẩu ngay hoặc liên hệ quản trị viên.
          </div>
          
          <p class="greeting" style="margin-top:20px;">Trân trọng,<br>Ban quản trị hệ thống đào tạo nội bộ LMS</p>
          
          <div class="footer">
            Đây là email được gửi tự động từ máy chủ LMS. Vui lòng không phản hồi lại thư này.<br>
            &copy; 2026 Internal LMS Platform. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  if (isConfigured && transporter) {
    try {
      await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject: mailSubject,
        html: htmlContent
      });
      console.log(`[Email Service] Đã gửi thư chứa OTP thành công tới email: ${toEmail}`);
      return true;
    } catch (err) {
      console.error(`[Email Service] Gửi email thất bại tới ${toEmail}:`, err);
      // Fallback khi gửi thực tế bị lỗi, in ra log để dev kiểm tra
      console.log(`\n------------------------------------------------------------`);
      console.log(`[FALLBACK LOG] Gửi mã OTP tới email: ${toEmail}`);
      console.log(`Tên tài khoản: ${username}`);
      console.log(`Mã OTP của bạn là: ${otp}`);
      console.log(`------------------------------------------------------------\n`);
      return false;
    }
  } else {
    // Chế độ Mock: in ra terminal
    console.log(`\n------------------------------------------------------------`);
    console.log(`[MOCK EMAIL LOG] Gửi mã OTP tới email: ${toEmail}`);
    console.log(`Tên tài khoản: ${username}`);
    console.log(`Mã OTP của bạn là: ${otp}`);
    console.log(`------------------------------------------------------------\n`);
    return true;
  }
}

module.exports = {
  sendOTPEmail
};
