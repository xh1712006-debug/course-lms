const express = require('express');
const session = require('express-session');
const { RedisStore } = require('connect-redis');
const redisClient = require('./config/redis');
const http = require('http');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initSocket } = require('./config/socket');
const { loadDynamicPermissions } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.io Server kết nối thời gian thực
initSocket(server);

// Cấu hình View Engine (EJS MVC)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cấu hình tài nguyên tĩnh công khai (CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware phân tích dữ liệu yêu cầu gửi lên (URL Encoded và JSON)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Cấu hình quản lý phiên làm việc (Session) sử dụng Redis làm Session Store để đồng bộ dữ liệu và tăng hiệu suất
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'lms_secret_session_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 1 ngày hoạt động
  }
}));

app.use(loadDynamicPermissions);

// Middleware toàn cục để truyền biến session vào EJS layout dễ dàng
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username,
    roleId: req.session.roleId,
    roleName: req.session.roleName,
    departmentId: req.session.departmentId,
    permissions: req.session.permissions,
    isImpersonating: req.session.isImpersonating || false,
    originalUsername: req.session.originalUsername,
    isManager: req.session.isManager || false,
    managedDepts: req.session.managedDepts || []
  } : null;
  next();
});

// Định tuyến Trang chủ (Chuyển hướng đến Trang học tập Dashboard)
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Đăng ký các bộ định tuyến phân hệ
app.use('/auth', authRoutes);
app.use('/', courseRoutes);
app.use('/', aiRoutes);
app.use('/', adminRoutes);

// Middleware xử lý lỗi 404 (Không tìm thấy trang)
app.use((req, res, next) => {
  res.status(404).render('error', { 
    message: 'Không tìm thấy trang yêu cầu.', 
    user: res.locals.user 
  });
});

// Middleware xử lý lỗi hệ thống 500
app.use((err, req, res, next) => {
  console.error('[System Error]', err);
  res.status(500).render('error', { 
    message: 'Hệ thống gặp sự cố đột ngột. Vui lòng quay lại sau.', 
    user: res.locals.user 
  });
});

// Khởi chạy Máy chủ
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`[LMS MVC] Máy chủ đang chạy tại: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
