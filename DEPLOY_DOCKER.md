
# Hướng dẫn Triển khai Hệ thống LMS bằng Docker 🐳🚀

Tài liệu này hướng dẫn chi tiết các bước đóng gói và đưa hệ thống LMS lên chạy trên máy chủ (Server/VPS) thông qua Docker và Docker Compose.

---

## 📋 Yêu cầu hệ thống
Máy chủ của bạn cần cài đặt sẵn:
- **Docker Engine** (v20.10 trở lên)
- **Docker Compose** (v2.0 trở lên)

---

## 🛠️ Các bước triển khai

### Bước 1: Sao chép mã nguồn lên Máy chủ
Sao chép toàn bộ thư mục dự án lên máy chủ của bạn (ví dụ đặt tại `/opt/lms-course`).

### Bước 2: Cấu hình biến môi trường (`.env`)
Tại thư mục gốc của dự án trên máy chủ, sao chép file cấu hình mẫu `.env.example` thành `.env`:
```bash
cp .env.example .env
```

Mở file `.env` vừa tạo và chỉnh sửa các tham số cho phù hợp với môi trường Production của bạn:
- Thay đổi `SESSION_SECRET` thành một chuỗi ký tự ngẫu nhiên dài để bảo mật phiên đăng nhập.
- Cấu hình tài khoản email gửi mã OTP tại `SMTP_USER` và `SMTP_PASS` (nếu dùng Gmail, cần tạo *Mật khẩu ứng dụng - App Password*).
- Bạn có thể giữ nguyên cấu hình kết nối PostgreSQL và Redis mặc định vì Docker Compose sẽ tự động phân giải tên service thành địa chỉ IP tương ứng (`db` và `redis`).

### Bước 3: Khởi động hệ thống bằng Docker Compose
Chạy lệnh sau để Docker tự động tải các image cần thiết, build image cho ứng dụng Node.js (từ `Dockerfile`) và chạy toàn bộ dịch vụ dưới dạng các container chạy ngầm:
```bash
docker-compose up -d --build
```

**Hệ thống bao gồm 3 container:**
1. `lms_db` (PostgreSQL 15): Khởi tạo tự động cấu trúc bảng và tài khoản admin mặc định thông qua file `init-db.sql`.
2. `lms_redis` (Redis 7): Quản lý session đăng nhập và đồng bộ hóa quyền hạn theo thời gian thực.
3. `lms_app` (Node.js App): Chạy ứng dụng LMS Express tại cổng `3000`.

### Bước 4: Nạp dữ liệu mẫu (Seeding)
Sau khi container khởi động thành công, bạn cần nạp các bài học và khóa học mẫu phong phú vào cơ sở dữ liệu bằng cách thực thi script nạp dữ liệu trực tiếp bên trong container `lms_app`:

```bash
# Nạp khóa học mẫu phong phú (Khuyên dùng)
docker-compose exec app node seed-rich-courses.js

# (Tùy chọn) Nạp dữ liệu mô phỏng lớn để thử nghiệm hiệu năng
docker-compose exec app node seed-large-data.js
```

Hệ thống đã sẵn sàng hoạt động tại địa chỉ: `http://<ip-cua-server>:3000`

---

## 🔑 Tài khoản đăng nhập mặc định
Khi hệ thống được khởi tạo, tài khoản quản trị tối cao (Super Admin) mặc định là:
- **Username:** `admin`
- **Email:** `admin@gmail.com`
- **Password:** `admin@123`

> [!WARNING]
> Ngay sau khi đăng nhập thành công lần đầu tiên, hãy đi tới phần quản lý tài khoản để đổi mật khẩu bảo mật cho tài khoản `admin` này.

---

## 📊 Các lệnh quản trị thông dụng

| Lệnh | Mô tả |
|------|-------|
| `docker-compose ps` | Kiểm tra trạng thái hoạt động của các container |
| `docker-compose logs -f app` | Xem log trực tiếp của ứng dụng Node.js |
| `docker-compose logs -f db` | Xem log trực tiếp của cơ sở dữ liệu PostgreSQL |
| `docker-compose restart app` | Khởi động lại container ứng dụng |
| `docker-compose down` | Dừng và xóa toàn bộ container (dữ liệu CSDL và Redis được giữ lại an toàn trong các Docker Volumes) |
| `docker-compose exec app sh` | Mở cửa sổ terminal shell trực tiếp bên trong container ứng dụng |

---

## 🔒 Lưu ý về Bảo mật & Nâng cấp
1. **Duy trì dữ liệu (Persistence):** Cơ sở dữ liệu PostgreSQL được lưu trữ an toàn trong Volume có tên `pgdata` (cấu hình trong `docker-compose.yml`). Dữ liệu sẽ không bị mất đi khi bạn nâng cấp ứng dụng hoặc chạy `docker-compose down`.
2. **Reverse Proxy:** Để chạy ứng dụng chuyên nghiệp có HTTPS (SSL), bạn nên cấu hình một máy chủ **Nginx** hoặc **Caddy** ở bên ngoài làm Reverse Proxy trỏ đến cổng `3000` của container ứng dụng.
