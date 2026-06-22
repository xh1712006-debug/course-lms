const redis = require('../config/redis');
const { User } = require('../models/schema');

/**
 * Middleware kiểm tra trạng thái đăng nhập của người dùng
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // Chưa đăng nhập, chuyển hướng về trang login
  res.redirect('/auth/login');
}

/**
 * Middleware kiểm tra quyền hạn thao tác (RBAC)
 * @param {string} permission - Tên quyền hạn cần kiểm tra (ví dụ: 'COURSE_CREATE')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (req.session && req.session.permissions && req.session.permissions.includes(permission)) {
      return next();
    }
    // Không đủ quyền hạn
    res.status(403).render('error', { 
      message: `Bạn không có quyền truy cập chức năng này (Yêu cầu quyền: ${permission}).` 
    });
  };
}

/**
 * Middleware tải danh sách quyền hạn động theo thời gian thực (Real-time Dynamic RBAC)
 */
async function loadDynamicPermissions(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      const userId = req.session.userId;
      const userStatusKey = `user_status:${userId}`;
      
      // Lấy trạng thái và role của user từ Redis cache
      let userData = await redis.get(userStatusKey);
      
      if (!userData) {
        // Truy vấn DB nếu không có trong cache
        const dbUser = await User.findById(userId);
        if (!dbUser) {
          // Người dùng không tồn tại nữa, hủy session
          return req.session.destroy(() => {
            if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
              res.status(401).json({ error: 'Tài khoản không tồn tại.' });
            } else {
              res.redirect('/auth/login?error=' + encodeURIComponent('Tài khoản của bạn đã bị xóa khỏi hệ thống.'));
            }
          });
        }
        userData = JSON.stringify({
          status: dbUser.status,
          roleId: dbUser.role_id,
          roleName: dbUser.role_name
        });
        // Lưu vào Redis cache trong 5 phút (300 giây) để tránh truy vấn DB liên tục
        await redis.set(userStatusKey, userData, 'EX', 300);
      }
      
      const { status, roleId, roleName } = JSON.parse(userData);
      
      // 1. Kiểm tra tài khoản bị vô hiệu hóa
      if (status === 'disabled') {
        return req.session.destroy(() => {
          if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
            res.status(401).json({ error: 'Tài khoản của bạn đã bị vô hiệu hóa.' });
          } else {
            res.redirect('/auth/login?error=' + encodeURIComponent('Tài khoản của bạn đã bị vô hiệu hóa.'));
          }
        });
      }
      
      // 2. Kiểm tra nếu vai trò thay đổi so với session cũ
      if (req.session.roleId !== roleId) {
        req.session.roleId = roleId;
        req.session.roleName = roleName;
        // Xóa quyền cũ trong session để tải lại quyền của vai trò mới
        delete req.session.permissions;
      }
      
      // 3. Tải danh sách quyền hạn động theo vai trò hiện tại
      const cacheKey = `role_permissions:${roleId}`;
      const permissions = await redis.getOrSet(cacheKey, async () => {
        return await User.getPermissions(roleId);
      }, 3600); // cache 1 giờ
      
      req.session.permissions = permissions || [];
    } catch (err) {
      console.error('[RBAC Middleware] Lỗi tải quyền hạn động:', err);
      req.session.permissions = req.session.permissions || [];
    }
  }
  next();
}

module.exports = {
  isAuthenticated,
  requirePermission,
  loadDynamicPermissions
};

