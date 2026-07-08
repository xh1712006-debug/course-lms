// Khởi tạo kết nối Socket.io Client nếu người dùng đã đăng nhập
let socket = null;

if (window.currentUser && window.currentUser.id) {
  // Gửi kèm userId và username qua query parameter để server nhận diện
  socket = io({
    query: {
      userId: window.currentUser.id,
      username: window.currentUser.username
    }
  });

  // 1. Lắng nghe cập nhật số lượng người trực tuyến
  socket.on('online_count_update', ({ count }) => {
    const counterEl = document.getElementById('online-counter');
    if (counterEl) {
      counterEl.textContent = count;
    }
  });

  // 2. Tự động gia nhập phòng thảo luận khi đang ở màn hình bài học
  const commentForm = document.getElementById('comment-form');
  const lessonIdField = document.getElementById('lesson-id-field');
  
  if (commentForm && lessonIdField) {
    const lessonId = lessonIdField.value;
    
    // Tham gia phòng bài học
    socket.emit('join_lesson', { lessonId });

    // Lắng nghe bình luận mới từ người dùng khác gửi đến cùng phòng
    socket.on('receive_comment', ({ content, user, created_at }) => {
      appendCommentToContainer(user, content, created_at);
    });
  }

  // 3. Lắng nghe thông báo đẩy khi HR giao khóa học bắt buộc mới
  socket.on('course_assigned_notification', ({ courseId, targetType, targetId }) => {
    // Nếu chỉ định trực tiếp cho user hiện tại, hiển thị thông báo
    if (targetType === 'user' && targetId === window.currentUser.id) {
      showToastNotification('Bạn vừa được bộ phận HR giao thêm một khóa học bắt buộc mới. Vui lòng vào trang cá nhân kiểm tra.');
    }
  });

  // 4. Lắng nghe thông báo thay đổi quyền hạn theo thời gian thực
  socket.on('permission_changed', ({ message }) => {
    showPermissionChangedToast(message);
  });
}

// Hàm gửi bình luận thảo luận bài học qua Socket
function handleSendComment(e) {
  e.preventDefault();
  const inputEl = document.getElementById('comment-input-field');
  const lessonId = document.getElementById('lesson-id-field').value;
  const content = inputEl.value.trim();

  if (!content || !socket) return;

  // 1. Lưu bình luận vào PostgreSQL database thông qua API gọi chìm
  // Ở đây chúng ta có thể thực hiện cuộc gọi REST API lưu dữ liệu:
  fetch(`/courses/${lessonId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  })
  .then(res => res.json())
  .then(savedComment => {
    // 2. Phát bình luận cho toàn phòng bài học qua WebSocket
    socket.emit('send_comment', {
      lessonId,
      content: savedComment.content,
      user: savedComment.username
    });
    
    inputEl.value = '';
  })
  .catch(err => {
    console.error('Lỗi lưu bình luận:', err);
    // Nếu lỗi API, vẫn gửi tạm socket để thảo luận
    socket.emit('send_comment', {
      lessonId,
      content,
      user: window.currentUser.username
    });
    inputEl.value = '';
  });
}

// Hàm chèn bình luận động vào giao diện
function appendCommentToContainer(username, content, time) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const isSelf = window.currentUser && (username === window.currentUser.username);
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${isSelf ? 'self' : 'other'}`;
  
  // Thiết lập phong cách bong bóng tin nhắn trùng với EJS
  msgDiv.style.display = 'flex';
  msgDiv.style.flexDirection = 'column';
  msgDiv.style.maxWidth = '75%';
  msgDiv.style.padding = '0.75rem 1rem';
  msgDiv.style.borderRadius = '14px';
  msgDiv.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
  msgDiv.style.transition = 'all 0.2s ease';
  
  if (isSelf) {
    msgDiv.style.alignSelf = 'flex-end';
    msgDiv.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
    msgDiv.style.color = '#ffffff';
    msgDiv.style.borderBottomRightRadius = '4px';
  } else {
    msgDiv.style.alignSelf = 'flex-start';
    msgDiv.style.background = '#ffffff';
    msgDiv.style.color = '#0f172a';
    msgDiv.style.borderBottomLeftRadius = '4px';
    msgDiv.style.border = '1px solid #e2e8f0';
  }

  if (!isSelf) {
    const senderDiv = document.createElement('div');
    senderDiv.className = 'chat-msg-sender';
    senderDiv.style.fontWeight = '800';
    senderDiv.style.fontSize = '0.78rem';
    senderDiv.style.color = '#4f46e5';
    senderDiv.style.marginBottom = '0.25rem';
    senderDiv.textContent = username;
    msgDiv.appendChild(senderDiv);
  }

  const textDiv = document.createElement('div');
  textDiv.className = 'chat-msg-text';
  textDiv.style.fontSize = '0.92rem';
  textDiv.style.lineHeight = '1.45';
  textDiv.style.wordBreak = 'break-word';
  textDiv.textContent = content;
  msgDiv.appendChild(textDiv);

  // Thêm nhãn mốc thời gian
  const timeDiv = document.createElement('div');
  timeDiv.className = 'chat-msg-time';
  timeDiv.style.fontSize = '0.68rem';
  timeDiv.style.textAlign = 'right';
  timeDiv.style.marginTop = '0.35rem';
  timeDiv.style.opacity = '0.75';
  timeDiv.style.color = isSelf ? 'rgba(255,255,255,0.85)' : '#64748b';
  
  timeDiv.textContent = formatChatTime(time || new Date());
  msgDiv.appendChild(timeDiv);

  container.appendChild(msgDiv);
  
  // Tự động cuộn xuống cuối khung chat
  container.scrollTop = container.scrollHeight;
}

// Hàm format thời gian hiển thị trong khung chat
function formatChatTime(dateVal) {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  const now = new Date();
  const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return timeStr;
  } else {
    const dateStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return timeStr + ' ' + dateStr;
  }
}

// Tạo thông báo đẩy đẹp (Toast Notification)
function showToastNotification(message) {
  const toast = document.createElement('div');
  toast.className = 'glass-card';
  toast.style.position = 'fixed';
  toast.style.bottom = '2rem';
  toast.style.right = '2rem';
  toast.style.zIndex = '9999';
  toast.style.borderLeft = '4px solid #f59e0b';
  toast.style.padding = '1rem 1.5rem';
  toast.style.maxWidth = '320px';
  toast.style.animation = 'slideIn 0.3s ease';
  
  toast.innerHTML = `
    <div style="display: flex; gap: 0.75rem; align-items: start;">
      <i class="fa-solid fa-bell" style="color: #f59e0b; margin-top: 0.2rem;"></i>
      <div>
        <h5 style="font-weight:700; font-size:0.85rem; margin-bottom:0.25rem;">Thông Báo Hệ Thống</h5>
        <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">${message}</p>
      </div>
    </div>
  `;

  document.body.appendChild(toast);

  // Tự biến mất sau 6 giây
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

// ==========================================
// HỆ THỐNG THÔNG BÁO TRỰC TUYẾN (NOTIFICATION CENTER)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Chỉ chạy nếu người dùng đã đăng nhập
  if (!window.currentUser || !window.currentUser.id) return;

  const bellBtn = document.getElementById('notification-bell-btn');
  const dropdown = document.getElementById('notification-dropdown');

  if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        markNotificationsAsRead();
      }
    });

    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Tải danh sách thông báo ban đầu
  loadNotifications();

  // Tích hợp thêm các Socket Listeners đặc thù cho thông báo
  if (socket) {
    // 3.1. Nhận thông báo giao khóa học bắt buộc mới (đè lên logic cũ để lưu vào danh sách)
    socket.off('course_assigned_notification'); // Tắt listener mặc định cũ
    socket.on('course_assigned_notification', ({ courseId, targetType, targetId }) => {
      if (targetType === 'user' && targetId === window.currentUser.id) {
        const msg = 'Bạn vừa được bộ phận HR giao thêm một khóa học bắt buộc mới. Vui lòng kiểm tra trang cá nhân.';
        showToastNotification(msg);
        addNotification('Khóa học mới được giao', msg);
      }
    });

    // 3.1b. Nhận thông báo giao lộ trình đào tạo mới
    socket.on('path_assigned_notification', ({ pathId, userIds, departmentIds }) => {
      const myId = Number(window.currentUser.id);
      const myDeptId = window.currentUser.departmentId ? Number(window.currentUser.departmentId) : null;
      const isAssigned = (userIds && userIds.map(Number).includes(myId)) || 
                         (departmentIds && myDeptId && departmentIds.map(Number).includes(myDeptId));
      if (isAssigned) {
        const msg = 'Bạn vừa được bộ phận HR giao lộ trình đào tạo mới. Vui lòng kiểm tra mục Lộ trình của tôi.';
        showToastNotification(msg);
        addNotification('Lộ trình đào tạo mới được giao', msg);
      }
    });

    // 3.1c. Nhận thông báo khi hoàn thành giao lộ trình chạy nền (dành cho Admin/Trưởng phòng)
    socket.on('path_assign_completed', ({ pathName, assignedCount, success, error }) => {
      if (success) {
        const msg = `Đã hoàn thành gán lộ trình "${pathName}" cho ${assignedCount} nhân sự thành công!`;
        showToastNotification(msg);
        addNotification('Giao lộ trình hoàn thành', msg);
      } else {
        const msg = `Gặp lỗi khi giao lộ trình "${pathName}": ${error}`;
        showToastNotification(msg);
        addNotification('Lỗi giao lộ trình', msg);
      }
    });

    // 3.2. Nhận thông báo chấm điểm tự luận từ Giảng viên
    socket.on('quiz_graded_notification', ({ submissionId, userId, score, isPassed }) => {
      if (userId === parseInt(window.currentUser.id)) {
        const statusText = isPassed ? 'ĐẠT' : 'CHƯA ĐẠT';
        const msg = `Bài thi của bạn đã được chấm điểm! Kết quả: ${score}/100 (${statusText}). Vui lòng vào trang cá nhân xem nhận xét.`;
        showToastNotification(msg);
        addNotification('Kết quả chấm điểm bài thi', msg);
      }
    });

    // 3.3. Nhận thông báo yêu cầu duyệt đăng ký (Dành cho Admin/HR)
    socket.on('enroll_request_notification', ({ userId, username, courseId, courseTitle }) => {
      // Chỉ thông báo cho Admin/HR (những người có element approvals menu hoặc quyền ENROLL_APPROVE)
      const hasApproveMenu = document.querySelector('a[href="/approvals"]');
      if (hasApproveMenu) {
        const msg = `Học viên "${username}" vừa gửi yêu cầu đăng ký tự nguyện khóa học: "${courseTitle}".`;
        showToastNotification(msg);
        addNotification('Yêu cầu phê duyệt học tập', msg);
      }
    });
  }
});

// Lấy danh sách thông báo từ localStorage
function getLocalNotifications() {
  const key = `user_notifications_${window.currentUser.id}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

// Lưu danh sách thông báo vào localStorage
function saveLocalNotifications(notifications) {
  const key = `user_notifications_${window.currentUser.id}`;
  localStorage.setItem(key, JSON.stringify(notifications));
}

// Tải và hiển thị danh sách thông báo
function loadNotifications() {
  const listEl = document.getElementById('notification-list');
  const badgeEl = document.getElementById('notification-badge');
  if (!listEl) return;

  const notifications = getLocalNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;

  // Cập nhật số lượng huy hiệu chuông
  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount;
    badgeEl.style.display = 'flex';
  } else {
    badgeEl.style.display = 'none';
  }

  if (notifications.length === 0) {
    listEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1.5rem 0; margin: 0;">Không có thông báo mới</p>';
    return;
  }

  let html = '';
  // Hiển thị tối đa 8 thông báo gần nhất, sắp xếp mới nhất lên đầu
  notifications.slice().reverse().slice(0, 8).forEach(n => {
    html += `
      <div style="padding: 0.75rem; border-radius: 8px; background: ${n.read ? 'rgba(255,255,255,0.01)' : 'rgba(99, 102, 241, 0.08)'}; border: 1px solid ${n.read ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.2)'}; font-size: 0.8rem; transition: background 0.3s; text-align: left; margin-bottom: 0.25rem;">
        <div style="font-weight: 700; color: ${n.read ? 'var(--text-muted)' : 'var(--text-accent)'}; display: flex; align-items: center; justify-content: space-between;">
          <span>${n.title}</span>
          <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted);">${n.time}</span>
        </div>
        <p style="color: var(--text-muted); margin-top: 0.25rem; margin-bottom: 0; line-height: 1.4;">${n.content}</p>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

// Thêm thông báo mới
function addNotification(title, content) {
  const notifications = getLocalNotifications();
  const now = new Date();
  const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  
  notifications.push({
    id: Date.now(),
    title,
    content,
    time: timeString,
    read: false
  });
  
  saveLocalNotifications(notifications);
  loadNotifications();
}

// Đánh dấu tất cả thông báo đã đọc
function markNotificationsAsRead() {
  const notifications = getLocalNotifications();
  notifications.forEach(n => n.read = true);
  saveLocalNotifications(notifications);
  // Đợi 1 giây rồi cập nhật badge để tạo trải nghiệm mượt mà
  setTimeout(() => {
    loadNotifications();
  }, 1000);
}

// Xóa tất cả thông báo
function clearNotifications(e) {
  if (e) e.stopPropagation();
  saveLocalNotifications([]);
  loadNotifications();
}

// ==========================================
// THÔNG BÁO CẬP NHẬT QUYỀN HẠN THỜI GIAN THỰC
// ==========================================

/**
 * Hiển thị toast thông báo quyền hạn bị thay đổi với đếm ngược tự động reload
 * @param {string} message - Nội dung thông báo từ server
 */
function showPermissionChangedToast(message) {
  // Ngăn hiển thị trùng nếu đã có toast này rồi
  if (document.getElementById('permission-changed-overlay')) return;

  const COUNTDOWN_SEC = 4;

  const overlay = document.createElement('div');
  overlay.id = 'permission-changed-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeInOverlay 0.4s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUpCard  { from { opacity: 0; transform: translateY(24px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes countdownBar { from { width: 100%; } to { width: 0%; } }
      #perm-card { animation: slideUpCard 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
      #perm-progress { animation: countdownBar ${COUNTDOWN_SEC}s linear forwards; }
    </style>

    <div id="perm-card" style="
      background: linear-gradient(135deg, rgba(20,20,35,0.98) 0%, rgba(30,18,60,0.98) 100%);
      border: 1px solid rgba(245, 158, 11, 0.45);
      border-radius: 20px;
      padding: 2.5rem 2.5rem 2rem;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
    ">
      <!-- Icon cảnh báo -->
      <div style="
        width: 72px; height: 72px; margin: 0 auto 1.5rem;
        background: linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.12));
        border: 1.5px solid rgba(245,158,11,0.5);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 0 32px rgba(245,158,11,0.25);
      ">
        <i class="fa-solid fa-shield-halved" style="font-size: 1.8rem; color: #f59e0b;"></i>
      </div>

      <!-- Tiêu đề -->
      <h3 style="
        font-size: 1.15rem; font-weight: 800; letter-spacing: 0.01em;
        color: #fbbf24; margin: 0 0 0.75rem; line-height: 1.3;
      ">Quyền hạn tài khoản đã thay đổi</h3>

      <!-- Nội dung -->
      <p style="
        font-size: 0.875rem; color: rgba(255,255,255,0.72);
        line-height: 1.65; margin: 0 0 1.75rem;
      ">${message}</p>

      <!-- Đếm ngược -->
      <p style="font-size: 0.78rem; color: rgba(255,255,255,0.4); margin: 0 0 1rem;">
        Tự động chuyển về <strong style="color: rgba(255,255,255,0.6);">Trang chủ</strong> sau
        <span id="perm-counter" style="color: #f59e0b; font-weight: 700;">${COUNTDOWN_SEC}</span> giây
      </p>

      <!-- Thanh tiến trình đếm ngược -->
      <div style="
        height: 3px; border-radius: 999px;
        background: rgba(255,255,255,0.08);
        overflow: hidden; margin-bottom: 1.5rem;
      ">
        <div id="perm-progress" style="
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #f59e0b, #ef4444);
        "></div>
      </div>

      <!-- Nút tải ngay -->
      <button onclick="window.location.href='/dashboard'" style="
        display: inline-flex; align-items: center; gap: 0.5rem;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #fff; border: none; border-radius: 10px;
        padding: 0.65rem 1.75rem; font-size: 0.875rem; font-weight: 700;
        cursor: pointer; transition: opacity 0.2s;
        box-shadow: 0 4px 16px rgba(245,158,11,0.35);
      " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
        <i class="fa-solid fa-rotate-right"></i> Tải lại ngay
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Đếm ngược và tự động chuyển hướng
  let remaining = COUNTDOWN_SEC - 1;
  const ticker = setInterval(() => {
    const counterEl = document.getElementById('perm-counter');
    if (counterEl) {
      counterEl.textContent = remaining;
    }
    if (remaining <= 0) {
      clearInterval(ticker);
      window.location.href = '/dashboard';
    }
    remaining--;
  }, 1000);
}
