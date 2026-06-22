const { Server } = require('socket.io');
const redis = require('./redis');

let io = null;

// Map: userId (string) → Set of socketId để emit đến user cụ thể
const userSocketMap = new Map();

/**
 * Khởi tạo cấu hình Socket.io Server gắn với HTTP Server của Express
 * @param {object} server - Thực thể HTTP Server tạo bởi Express app.listen
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    // Lấy thông tin user đăng nhập truyền lên qua query parameters
    const userId = socket.handshake.query.userId;
    const username = socket.handshake.query.username;

    if (userId) {
      socket.userId = userId;
      socket.username = username || `User ${userId}`;

      // Đăng ký socket vào userSocketMap để có thể emit đến user cụ thể
      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);

      // Thêm ID người dùng vào danh sách online trong Redis Set
      redis.sadd('online_users', userId).then(async () => {
        // Lấy số lượng người dùng online hiện tại
        const count = await redis.scard('online_users');
        io.emit('online_count_update', { count });
        console.log(`[Socket.io] Người dùng ${socket.username} (ID: ${userId}) đã kết nối. Online: ${count}`);
      }).catch(err => {
        console.error('[Socket.io] Lỗi cập nhật danh sách online Redis:', err);
      });
    }

    // Học viên tham gia phòng thảo luận của một bài học cụ thể
    socket.on('join_lesson', ({ lessonId }) => {
      socket.join(`lesson_${lessonId}`);
      console.log(`[Socket.io] ${socket.username} tham gia thảo luận bài học: ${lessonId}`);
    });

    // Học viên rời phòng thảo luận bài học
    socket.on('leave_lesson', ({ lessonId }) => {
      socket.leave(`lesson_${lessonId}`);
      console.log(`[Socket.io] ${socket.username} rời phòng thảo luận bài học: ${lessonId}`);
    });

    // Gửi bình luận thời gian thực cho phòng bài học
    socket.on('send_comment', ({ lessonId, content, user }) => {
      // Phát tin nhắn cho tất cả các client khác đang trong phòng bài học này
      io.to(`lesson_${lessonId}`).emit('receive_comment', {
        content,
        user,
        created_at: new Date()
      });
    });

    // Ngắt kết nối
    socket.on('disconnect', async () => {
      if (socket.userId) {
        // Xóa socketId khỏi userSocketMap
        const sockets = userSocketMap.get(socket.userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSocketMap.delete(socket.userId);
          }
        }

        // Xóa người dùng khỏi danh sách online trên Redis
        await redis.srem('online_users', socket.userId);
        const count = await redis.scard('online_users');
        io.emit('online_count_update', { count });
        console.log(`[Socket.io] Người dùng ${socket.username} đã ngắt kết nối. Online: ${count}`);
      }
    });
  });

  return io;
}

/**
 * Lấy thực thể Socket.io Server đã khởi tạo
 * @returns {object}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io chưa được khởi tạo!');
  }
  return io;
}

/**
 * Emit một sự kiện đến TẤT CẢ các socket của một user cụ thể (kể cả nhiều tab mở)
 * @param {string|number} userId - ID của người dùng đích
 * @param {string} event - Tên sự kiện Socket.io
 * @param {object} data - Dữ liệu kèm theo
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  const userIdStr = String(userId);
  const sockets = userSocketMap.get(userIdStr);
  if (sockets && sockets.size > 0) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(event, data);
    });
    console.log(`[Socket.io] Đã gửi event "${event}" đến user ID: ${userIdStr} (${sockets.size} tab đang mở)`);
  } else {
    console.log(`[Socket.io] User ID: ${userIdStr} không online, bỏ qua event "${event}"`);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  userSocketMap
};
