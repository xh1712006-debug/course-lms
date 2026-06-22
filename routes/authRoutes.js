const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Điều hướng Đăng nhập
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// Điều hướng Đăng ký (Đã tắt public - chỉ admin tạo)
router.get('/register', (req, res) => res.redirect('/auth/login'));
router.post('/register', (req, res) => res.redirect('/auth/login'));

// Điều hướng Quên mật khẩu
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);

// Điều hướng Xác thực OTP
router.get('/verify-otp', authController.getVerifyOtp);
router.post('/verify-otp', authController.postVerifyOtp);

// Điều hướng Thiết lập mật khẩu mới
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

// Điều hướng Đăng xuất
router.get('/logout', authController.logout);

// Điều hướng Đóng vai (Impersonate)
router.post('/impersonate', authController.impersonateUser);
router.get('/impersonate/stop', authController.stopImpersonating);

module.exports = router;
