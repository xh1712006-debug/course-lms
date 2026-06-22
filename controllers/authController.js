const bcrypt = require('bcryptjs');
const { User, AuditLog } = require('../models/schema');
const redisClient = require('../config/redis');
const emailService = require('../services/emailService');

module.exports = {
  // Hiển thị trang đăng nhập
  getLogin: (req, res) => {
    if (req.session && req.session.userId) {
      return res.redirect('/dashboard');
    }
    const successMsg = req.query.success || null;
    const errorMsg = req.query.error || null;
    res.render('auth/login', { error: errorMsg, success: successMsg });
  },

  // Xử lý đăng nhập
  postLogin: async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findByEmail(email);
      if (!user) {
        return res.render('auth/login', { error: 'Email không tồn tại trên hệ thống.' });
      }

      if (user.status === 'disabled') {
        return res.render('auth/login', { error: 'Tài khoản của bạn đã bị vô hiệu hóa.' });
      }

      // Xác thực mật khẩu (Hỗ trợ cả so sánh chuỗi trực tiếp và chuỗi băm để tiện theo dõi)
      const isMatch = (password === user.password) || (user.password.startsWith('$2') && await bcrypt.compare(password, user.password));
      if (!isMatch) {
        return res.render('auth/login', { error: 'Mật khẩu không chính xác.' });
      }

      // Lấy danh sách quyền hạn tương ứng của vai trò
      const permissions = await User.getPermissions(user.role_id);

      // Lưu trữ thông tin đăng nhập vào Session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.roleId = user.role_id;
      req.session.roleName = user.role_name;
      req.session.departmentId = user.department_id;
      req.session.permissions = permissions;

      // Ghi nhận nhật ký đăng nhập (Audit Log)
      await AuditLog.create(user.id, 'USER_LOGIN', { email: user.email }, req.ip);

      console.log(`[Auth] Người dùng ${user.username} đăng nhập thành công. Vai trò: ${user.role_name}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error('[Auth Controller] Lỗi đăng nhập:', err);
      res.render('auth/login', { error: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
  },

  // Xử lý đăng ký (đã tắt - admin tạo tài khoản thay thế)
  getRegister: (req, res) => res.redirect('/auth/login'),
  postRegister: (req, res) => res.redirect('/auth/login'),

  // Hiển thị trang quên mật khẩu
  getForgotPassword: (req, res) => {
    res.render('auth/forgot-password', { error: null, success: null });
  },

  // Xử lý lấy lại mật khẩu - tạo mã OTP và gửi qua email
  postForgotPassword: async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.render('auth/forgot-password', { error: 'Vui lòng nhập email.', success: null });
    }
    try {
      const user = await User.findByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.render('auth/forgot-password', { 
          error: 'Email này không tồn tại trong hệ thống.', 
          success: null 
        });
      }

      if (user.status === 'disabled') {
        return res.render('auth/forgot-password', { 
          error: 'Tài khoản này đã bị vô hiệu hóa. Liên hệ Admin để được hỗ trợ.', 
          success: null 
        });
      }

      // Tạo mã OTP ngẫu nhiên 6 chữ số
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Lưu mã OTP vào Redis với thời gian sống 5 phút (300 giây)
      const redisKey = `otp:${user.email.toLowerCase()}`;
      await redisClient.set(redisKey, { otp, userId: user.id }, 'EX', 300);

      // Gửi email chứa mã OTP
      await emailService.sendOTPEmail(user.email, user.username, otp);

      // Ghi nhận nhật ký hệ thống (Audit Log)
      await AuditLog.create(user.id, 'PASSWORD_RESET_REQUESTED', { email: user.email }, req.ip);

      // Chuyển hướng đến trang xác thực OTP kèm theo email của người dùng
      res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
      console.error('[Auth Controller] Lỗi lấy lại mật khẩu:', err);
      res.render('auth/forgot-password', { 
        error: 'Có lỗi xảy ra, vui lòng thử lại sau.', 
        success: null 
      });
    }
  },

  // Hiển thị trang xác thực OTP
  getVerifyOtp: (req, res) => {
    const email = req.query.email || '';
    const successMsg = email ? `Mã xác thực OTP đã được gửi đến email ${email}. Vui lòng kiểm tra hộp thư!` : null;
    res.render('auth/verify-otp', { email, error: null, success: successMsg });
  },

  // Xử lý xác thực OTP
  postVerifyOtp: async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.render('auth/verify-otp', { email: email || '', error: 'Vui lòng nhập đầy đủ email và mã OTP.', success: null });
    }
    try {
      const redisKey = `otp:${email.trim().toLowerCase()}`;
      const data = await redisClient.get(redisKey);

      if (!data) {
        return res.render('auth/verify-otp', { 
          email, 
          error: 'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu gửi lại mã.', 
          success: null 
        });
      }

      const { otp: storedOtp, userId } = JSON.parse(data);

      if (storedOtp !== otp.trim()) {
        return res.render('auth/verify-otp', { 
          email, 
          error: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.', 
          success: null 
        });
      }

      // Xác thực thành công: Lưu thông tin vào session tạm thời
      req.session.resetPasswordEmail = email.trim().toLowerCase();
      req.session.resetPasswordUserId = userId;

      // Xóa mã OTP trong Redis sau khi đã xác thực xong
      await redisClient.del(redisKey);

      // Chuyển hướng đến trang đặt lại mật khẩu
      res.redirect('/auth/reset-password');
    } catch (err) {
      console.error('[Auth Controller] Lỗi xác thực OTP:', err);
      res.render('auth/verify-otp', { email, error: 'Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại sau.', success: null });
    }
  },

  // Hiển thị trang thiết lập mật khẩu mới
  getResetPassword: (req, res) => {
    if (!req.session.resetPasswordEmail || !req.session.resetPasswordUserId) {
      return res.redirect('/auth/forgot-password');
    }
    res.render('auth/reset-password', { error: null });
  },

  // Xử lý thiết lập mật khẩu mới
  postResetPassword: async (req, res) => {
    if (!req.session.resetPasswordEmail || !req.session.resetPasswordUserId) {
      return res.redirect('/auth/forgot-password');
    }

    const { password, confirmPassword } = req.body;
    const email = req.session.resetPasswordEmail;
    const userId = req.session.resetPasswordUserId;

    if (!password || !confirmPassword) {
      return res.render('auth/reset-password', { error: 'Vui lòng nhập đầy đủ mật khẩu mới.' });
    }

    if (password !== confirmPassword) {
      return res.render('auth/reset-password', { error: 'Mật khẩu xác nhận không khớp.' });
    }

    try {
      // Mã hóa mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Cập nhật cơ sở dữ liệu
      await require('../config/db').query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, userId]
      );

      // Ghi nhận nhật ký hệ thống
      await AuditLog.create(userId, 'PASSWORD_RESET_SUCCESS', { email }, req.ip);

      // Xóa các biến tạm trong session
      delete req.session.resetPasswordEmail;
      delete req.session.resetPasswordUserId;

      // Chuyển hướng về đăng nhập kèm theo thông điệp thành công
      res.redirect('/auth/login?success=' + encodeURIComponent('Đổi mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới.'));
    } catch (err) {
      console.error('[Auth Controller] Lỗi đặt lại mật khẩu:', err);
      res.render('auth/reset-password', { error: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
    }
  },



  // Xử lý đăng xuất
  logout: (req, res) => {
    if (req.session) {
      const userId = req.session.userId;
      // Ghi log đăng xuất trước khi hủy session
      if (userId) {
        AuditLog.create(userId, 'USER_LOGOUT', {}, req.ip).catch(e => console.error(e));
      }
      req.session.destroy((err) => {
        if (err) {
          console.error('[Auth Controller] Lỗi hủy session:', err);
        }
        res.redirect('/auth/login');
      });
    } else {
      res.redirect('/auth/login');
    }
  },

  // Admin đóng vai người dùng khác (Impersonation)
  impersonateUser: async (req, res) => {
    const targetUserId = parseInt(req.body.userId);
    const adminUserId = req.session.userId;

    // Chỉ cho phép nếu tài khoản có quyền USER_IMPERSONATE
    if (!req.session.permissions.includes('USER_IMPERSONATE')) {
      return res.status(403).send('Bạn không có quyền thực hiện hành động này.');
    }

    try {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).send('Không tìm thấy người dùng đích.');
      }

      if (targetUser.id === adminUserId) {
        return res.status(400).send('Bạn không thể đóng vai chính mình.');
      }

      // Sao lưu thông tin Admin gốc vào các trường tạm của session
      req.session.originalUserId = adminUserId;
      req.session.originalUsername = req.session.username;
      req.session.originalRoleId = req.session.roleId;
      req.session.originalRoleName = req.session.roleName;
      req.session.originalPermissions = req.session.permissions;

      // Lấy danh sách quyền của tài khoản đóng vai
      const targetPermissions = await User.getPermissions(targetUser.role_id);

      // Thay thế thông tin session hiện tại bằng thông tin của user đích
      req.session.userId = targetUser.id;
      req.session.username = targetUser.username;
      req.session.roleId = targetUser.role_id;
      req.session.roleName = targetUser.role_name;
      req.session.departmentId = targetUser.department_id;
      req.session.permissions = targetPermissions;

      // Đánh dấu session đang ở trạng thái giả lập
      req.session.isImpersonating = true;

      // Ghi log sự kiện đóng vai
      await AuditLog.create(adminUserId, 'USER_IMPERSONATE_START', { 
        target_user_id: targetUser.id, 
        target_username: targetUser.username 
      }, req.ip);

      console.log(`[Impersonation] Admin đã đóng vai thành công nhân viên: ${targetUser.username}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error('[Auth Controller] Lỗi đóng vai:', err);
      res.status(500).send('Lỗi máy chủ khi thực hiện giả lập.');
    }
  },

  // Thoát khỏi chế độ đóng vai người dùng
  stopImpersonating: async (req, res) => {
    if (!req.session.isImpersonating) {
      return res.redirect('/dashboard');
    }

    const impersonatedUserId = req.session.userId;
    const originalUserId = req.session.originalUserId;

    try {
      // Khôi phục thông tin admin gốc
      req.session.userId = originalUserId;
      req.session.username = req.session.originalUsername;
      req.session.roleId = req.session.originalRoleId;
      req.session.roleName = req.session.originalRoleName;
      req.session.permissions = req.session.originalPermissions;

      // Xóa bỏ các biến tạm
      delete req.session.originalUserId;
      delete req.session.originalUsername;
      delete req.session.originalRoleId;
      delete req.session.originalRoleName;
      delete req.session.originalPermissions;
      delete req.session.isImpersonating;

      // Ghi log kết thúc đóng vai
      await AuditLog.create(originalUserId, 'USER_IMPERSONATE_END', { 
        stopped_impersonating_user_id: impersonatedUserId 
      }, req.ip);

      console.log('[Impersonation] Đã thoát khỏi chế độ đóng vai người dùng.');
      res.redirect('/users');
    } catch (err) {
      console.error('[Auth Controller] Lỗi dừng đóng vai:', err);
      res.status(500).send('Lỗi máy chủ khi dừng giả lập.');
    }
  }
};
