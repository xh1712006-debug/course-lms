# Hệ thống Quản lý Học tập Nội bộ Doanh nghiệp (Company LMS) 🚀🏢

Chào mừng bạn đến với **CompanyLMS** – một nền tảng quản lý học tập (LMS) nội bộ hiện đại, bảo mật và hiệu năng cao dành cho doanh nghiệp. Hệ thống được xây dựng theo mô hình **MVC** (Model-View-Controller) chuẩn hóa, tích hợp cơ cấu tổ chức sơ đồ phòng ban tương tác trực quan, phân quyền chặt chẽ và trợ lý AI thông minh.

---

## 🌟 Tính năng nổi bật

### 1. Sơ đồ tổ chức & Quản lý phòng ban (Org Chart & Departments)
* **Sơ đồ cây dạng thư mục tương tác:** Thiết kế cấu trúc thư mục phân cấp đệ quy vô hạn cấp độ. Tự động thu gọn mặc định, hỗ trợ đóng/mở từng thư mục bằng một click hoặc mở rộng/thu gọn toàn bộ.
* **Bộ lọc sơ đồ thông minh:** Ô tìm kiếm tự động định vị phòng ban khớp từ khóa, tự động mở rộng đường dẫn từ gốc và làm nổi bật kết quả.
* **Bảng danh sách tối ưu hóa:** Tích hợp bộ lọc nhanh tức thì ở client-side, cuộn độc lập với thanh cuộn cách điệu màu Cyan và tiêu đề cố định (Sticky Headers) khi cuộn danh sách dài.
* **Tự động chuẩn hóa danh xưng:** Định dạng chuẩn hóa chữ viết thường/hoa và các từ chuyên ngành (`UI/UX`, `DevOps`, `R&D`, `AI`, `HR`).

### 2. Quản lý tài khoản & Phân trang tối ưu (Users & Pagination)
* **Phân trang Server-side:** Hiển thị 20 tài khoản mỗi trang giúp giảm tải lượng dữ liệu truyền tải và tăng tốc độ phản hồi của cơ sở dữ liệu.
* **Bộ lọc và tìm kiếm:** Tìm kiếm theo tên/email và lọc theo phòng ban trực thuộc trên toàn hệ thống (giữ nguyên tham số truy vấn khi chuyển trang).
* **Sắp xếp thời gian thực:** Tài khoản mới tạo luôn được đẩy lên đầu tiên (`ORDER BY id DESC`) giúp dễ dàng theo dõi.
* **Tách biệt luồng nghiệp vụ:** Dropdown gán lộ trình khóa học vẫn tải đầy đủ danh sách rút gọn của người dùng hoạt động thay vì bị giới hạn phân trang.

### 3. Phân quyền ma trận & Nhật ký bảo mật (RBAC & Audit logs)
* **Hệ thống phân quyền Role-Based Access Control (RBAC):** Quản lý quyền hạn chặt chẽ (Super Admin, HR Manager, Instructor, Employee) và bảo vệ an toàn các tác vụ nhạy cảm.
* **Đồng bộ hóa Session bằng Redis:** Khi vai trò hoặc quyền hạn của một tài khoản thay đổi, hệ thống sẽ đồng bộ hóa quyền tức thì và cập nhật nóng session thông qua Redis Cache.
* **Nhật ký hệ thống (Audit Logs):** Ghi chép tự động mọi hành động chỉnh sửa, nâng quyền, thêm/xóa tài khoản để phục vụ công tác thanh tra bảo mật.

### 4. Lộ trình đào tạo & Đánh giá tự động (Courses & Quizzes)
* **Khóa học & Bài giảng:** Hỗ trợ bài học đa phương tiện (Văn bản, Video trực tuyến).
* **Ngân hàng câu hỏi & Đề thi:** Trắc nghiệm tự động chấm điểm tức thì, ghi nhận lịch sử và kết quả học tập chi tiết.
* **Lộ trình học tập cá nhân hóa (Learning Paths):** Quản trị viên HR gán lộ trình học bắt buộc theo phòng ban.
* **Chứng chỉ kỹ thuật số:** Tự động cấp chứng chỉ PDF/HTML có mã số xác thực khi học viên hoàn thành khóa học đạt chuẩn.

### 5. Trợ lý học tập AI (Gemini AI Assistant)
* Tích hợp chatbot hỗ trợ học tập trực tiếp bằng Google Gemini AI API, giúp giải đáp thắc mắc bài học và gợi ý câu hỏi ôn tập theo ngữ cảnh cho học viên.

---

## 🛠️ Công nghệ sử dụng

* **Backend core:** Node.js, Express (MVC architecture)
* **Template Engine:** EJS (Embedded JavaScript)
* **Database:** PostgreSQL (Lưu trữ quan hệ dữ liệu người dùng, phòng ban, khóa học, audit logs)
* **Caching & Session:** Redis (Quản lý phiên đăng nhập và đồng bộ hóa quyền hạn)
* **Real-time Engine:** Socket.io (Đồng bộ đổi vai trò và thông báo trực tuyến)
* **AI integration:** Google Generative AI (Gemini API)
* **Security:** bcryptjs (Mã hóa mật khẩu), Session-based Auth với cơ chế bảo vệ CSRF/XSS cơ bản.

---

## 📁 Cấu trúc thư mục chính

```text
├── .antigravity/         # Cấu trúc kỹ năng và quy tắc tương tác AI Agent
├── config/               # Cấu hình kết nối cơ sở dữ liệu (PostgreSQL, Redis, Socket)
├── controllers/          # Bộ điều hướng logic (Auth, Admin, Courses, AI)
├── docs/                 # Tài liệu đặc tả hệ thống và hướng dẫn phát triển
├── middleware/           # Lớp lọc trung gian (Bảo mật quyền hạn, xác thực session)
├── models/               # Định nghĩa các truy vấn SQL và schema dữ liệu
├── public/               # Tài nguyên tĩnh (CSS, JS Client-side, hình ảnh SVG)
├── research/             # Mã nguồn chạy thử nghiệm huấn luyện và các suite test
├── routes/               # Định nghĩa định tuyến đường dẫn API và giao diện Web
├── services/             # Dịch vụ gửi Email, Data Pipeline, kết nối Gemini AI
├── views/                # Thư mục chứa giao diện EJS (được phân chia theo quyền hạn)
├── app.js                # Điểm khởi chạy ứng dụng chính
├── Dockerfile            # Hướng dẫn đóng gói container ứng dụng
├── docker-compose.yml    # Cấu hình container hóa ứng dụng, PostgreSQL và Redis
├── init-db.sql           # Script khởi tạo cấu trúc bảng cơ sở dữ liệu ban đầu
└── package.json          # Quản lý thư viện phụ thuộc và các câu lệnh run script
```

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Chuẩn bị môi trường
Yêu cầu máy tính cài đặt sẵn:
* **Node.js** (Phiên bản v18 trở lên)
* **PostgreSQL** (Phiên bản v14 trở lên)
* **Redis Server**

### 2. Thiết lập cấu hình hệ thống (`.env`)
Tạo một file `.env` tại thư mục gốc của dự án với nội dung cấu hình tương tự như sau:
```env
PORT=3000
SESSION_SECRET=your_super_secret_session_key

# Cấu hình PostgreSQL
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=course_lms
DB_PASSWORD=your_postgres_password
DB_PORT=5432

# Cấu hình Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Cấu hình Google Gemini AI (Tùy chọn cho tính năng Chatbot AI)
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Khởi tạo Cơ sở dữ liệu
Chạy các truy vấn trong file `init-db.sql` trên cơ sở dữ liệu PostgreSQL của bạn để tạo toàn bộ cấu trúc bảng, các khóa ngoại và vai trò mặc định ban đầu.

Sau đó, bạn có thể nạp các khóa học mẫu giàu nội dung bằng câu lệnh:
```bash
node seed-rich-courses.js
```

### 4. Cài đặt thư viện & Khởi chạy cục bộ
```bash
# Cài đặt các package phụ thuộc
npm install

# Chạy ở chế độ phát triển (Tự động tải lại file khi thay đổi code)
npm run dev

# Chạy ở chế độ Production
npm start
```
Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`

### 5. Chạy bằng Docker Compose (Khuyên dùng)
Nếu máy bạn đã cài đặt Docker, bạn có thể khởi chạy toàn bộ dịch vụ (App, PostgreSQL, Redis) chỉ với một câu lệnh:
```bash
docker-compose up --build -d
```

---

## 🧪 Hệ thống Kiểm thử (Tests)

Hệ thống được trang bị bộ kiểm thử tích hợp tự động cho cả logic toán học và phân quyền RBAC.
Để thực thi toàn bộ bài test:
```bash
npm test
```
*Kết quả bao gồm:*
* **Toán học & Pipeline:** Đảm bảo làm sạch dữ liệu PII và xử lý nội suy chuỗi thời gian chính xác.
* **Kiểm thử Ma trận Vai trò:** Đảm bảo vai trò HR Manager cập nhật quyền hạn đồng bộ tức thì lên Redis cache và ghi nhật ký Audit Log đầy đủ.
* **Kiểm thử Học viên:** Kiểm tra hiển thị Lộ trình, Lịch học, Đổi mật khẩu bảo mật và cấu hình học tập cá nhân.
