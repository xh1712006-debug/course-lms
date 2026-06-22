# Báo Cáo Kết Quả Triển Khai Hệ Thống (Project Walkthrough)

Tài liệu này tổng hợp kết quả triển khai các nâng cấp lớn của hệ thống: tích hợp xác thực OTP Email cho tính năng Quên mật khẩu, phân trang, bộ lọc tìm kiếm và truy xuất theo ngày cho Nhật ký hệ thống (Audit Logs), tối ưu giao diện Dashboard quản trị và sửa lỗi đồng bộ phân quyền Sidebar.

---

## 🔒 PHẦN 1: NÂNG CẤP QUÊN MẬT KHẨU QUA OTP EMAIL

Chúng tôi đã triển khai hoàn tất luồng chức năng khôi phục mật khẩu thông qua mã xác thực OTP gửi đến email người dùng. Giao diện được thiết kế đồng bộ với ngôn ngữ thiết kế Glassmorphism tối của hệ thống.

### 🛠️ 1. Các hạng mục thay đổi

1. **Gửi mã OTP qua Email thực tế / Trình ghi Log (Mock):**
   * Sử dụng thư viện `nodemailer` để kết nối tới dịch vụ SMTP (như Gmail).
   * **Cơ chế Fallback thông minh**: Nếu người dùng chưa cấu hình SMTP trong `.env` (hoặc để các giá trị mặc định), hệ thống tự động chạy ở chế độ **Mock Mode** – in mã OTP rõ ràng ra màn hình Console/Terminal chạy ứng dụng giúp lập trình viên/quản trị viên kiểm thử luồng chức năng dễ dàng.

2. **Lưu trữ OTP bảo mật bằng Redis:**
   * Mã OTP được lưu trữ trong Redis với khoá dạng `otp:${email}` dưới dạng JSON bao gồm `{ otp, userId }`.
   * Cấu hình thời gian hết hạn (TTL) là **5 phút (300 giây)**. Hết 5 phút mã sẽ tự động bị Redis xóa bỏ, giúp bảo mật thông tin tối đa.
   * Xóa mã ngay lập tức sau khi xác thực thành công để tránh tấn công Replay (sử dụng lại mã xác thực).

3. **Luồng khôi phục mật khẩu 3 bước bảo mật:**
   * **Bước 1**: Nhập email công ty tại `/auth/forgot-password`.
   * **Bước 2**: Nhập mã xác nhận OTP 6 số tại `/auth/verify-otp`. Có JavaScript tự động đếm ngược 5 phút hiển thị trực quan.
   * **Bước 3**: Nhập mật khẩu mới tại `/auth/reset-password` (Chỉ truy cập được khi đã xác thực OTP thành công ở Bước 2 nhờ cơ chế session bảo mật). Hỗ trợ nút ẩn/hiện mật khẩu.

### 📂 2. Các tệp đã thay đổi và tạo mới

* **Cài đặt & Cấu hình**:
  * [package.json](file:///d:/antigravity/hocp1/package.json): Cài đặt thư viện `nodemailer`.
  * [.env](file:///d:/antigravity/hocp1/.env): Bổ sung block cấu hình SMTP Gmail/Doanh nghiệp.
* **Dịch vụ (Services)**:
  * [emailService.js](file:///d:/antigravity/hocp1/services/emailService.js) `[NEW]`: Quản lý việc tạo kết nối SMTP, xây dựng giao diện Email HTML và gửi email hoặc in mã ra Console.
* **Định tuyến & Điều khiển**:
  * [authRoutes.js](file:///d:/antigravity/hocp1/routes/authRoutes.js): Đăng ký các route `/auth/verify-otp` (GET/POST) và `/auth/reset-password` (GET/POST).
  * [authController.js](file:///d:/antigravity/hocp1/controllers/authController.js): Cập nhật `postForgotPassword`, thêm các controller cho luồng OTP và đặt lại mật khẩu mới.
* **Giao diện EJS (Views)**:
  * [forgot-password.ejs](file:///d:/antigravity/hocp1/views/auth/forgot-password.ejs): Cập nhật hướng dẫn nhập email nhận OTP.
  * [verify-otp.ejs](file:///d:/antigravity/hocp1/views/auth/verify-otp.ejs) `[NEW]`: Giao diện nhập OTP có đồng hồ đếm ngược.
  * [reset-password.ejs](file:///d:/antigravity/hocp1/views/auth/reset-password.ejs) `[NEW]`: Giao diện nhập mật khẩu mới có nút ẩn/hiện mật khẩu.
  * [login.ejs](file:///d:/antigravity/hocp1/views/auth/login.ejs): Cập nhật hiển thị hộp thông báo màu xanh báo đổi mật khẩu thành công.

---

## 📊 PHẦN 2: PHÂN TRANG NHẬT KÝ HỆ THỐNG (AUDIT LOGS)

Chúng tôi đã hoàn thành tích hợp cơ chế phân trang cho Nhật ký hệ thống giúp tối ưu hóa tài nguyên CSDL và cải thiện tốc độ tải trang đáng kể khi tổng lượng nhật ký hoạt động doanh nghiệp tăng lên hàng nghìn dòng.

### 🛠️ 1. Các hạng mục thay đổi

1. **Tối ưu hóa Truy vấn (LIMIT / OFFSET):**
   * Giới hạn hiển thị cứng mặc định trước đó là 200 bản ghi được loại bỏ. Thay thế bằng cơ chế **hiển thị 20 dòng trên mỗi trang** giúp truy vấn dữ liệu từ CSDL PostgreSQL cực nhẹ và nhanh.
   * Thêm phương thức `AuditLog.findPaginated(limit, offset)` thực thi truy vấn SQL kèm theo `LIMIT` và `OFFSET`.
   * Thêm phương thức `AuditLog.countAll()` thực thi đếm nhanh tổng số dòng để máy chủ tự động tính ra tổng số trang (`totalPages`).

2. **Chạy truy vấn song song (Parallel execution):**
   * Sử dụng `Promise.all` trong `getAuditLogs` để thực thi đồng thời cả hai truy vấn lấy danh sách phân trang và đếm tổng số dòng, giúp giảm một nửa thời gian chờ phản hồi của máy chủ.

3. **Thiết kế giao diện thanh phân trang Glassmorphism:**
   * Hiển thị dòng mô tả tiến trình trực quan: `Hiển thị 1 - 20 trong tổng số X hoạt động`.
   * Thêm các nút **Trước / Sau** (tự động bị khóa mờ khi ở trang đầu hoặc trang cuối).
   * Vẽ danh sách các số trang xung quanh trang hiện tại một cách thông minh (tối đa 5 trang xung quanh) và sử dụng dấu ba chấm `...` rút gọn để giữ giao diện luôn gọn gàng chuyên nghiệp.

### 📂 2. Các tệp đã thay đổi

* **Tầng Dữ liệu**:
  * [schema.js](file:///d:/antigravity/hocp1/models/schema.js): Thêm `findPaginated` và `countAll` vào `AuditLog`.
* **Tầng Điều khiển**:
  * [adminController.js](file:///d:/antigravity/hocp1/controllers/adminController.js): Cập nhật phương thức `getAuditLogs` để tính toán số trang và truyền dữ liệu cho views.
* **Tầng Giao diện**:
  * [audit.ejs](file:///d:/antigravity/hocp1/views/admin/audit.ejs): Thay đổi tiêu đề thống kê động, thêm thanh phân trang mờ kính dưới bảng.

---

## 🔍 PHẦN 3: TÌM KIẾM VÀ BỘ LỌC HÀNH ĐỘNG NHẬT KÝ (AUDIT LOGS FILTERING)

Chúng tôi đã hoàn thành tích hợp thanh tìm kiếm và bộ lọc hành động trên trang Nhật ký hệ thống giúp Admin có thể nhanh chóng tra cứu lịch sử hoạt động của một tài khoản cụ thể.

### 🛠️ 1. Các hạng mục thay đổi

1. **Ghép câu lệnh SQL WHERE động**:
   * Phương thức `AuditLog.findPaginated` và `countAll` được cập nhật để kiểm tra và nối thêm điều kiện lọc:
     - Lọc tên nhân viên hoặc email (sử dụng toán tử `LIKE` không phân biệt chữ hoa/thường).
     - Lọc theo loại hành động cụ thể (so sánh bằng `=`).
   * Sử dụng tham số an toàn `$1, $2,...` để tránh tấn công SQL Injection.
2. **Thanh tìm kiếm EJS Glassmorphism**:
   * Thêm ô nhập liệu tìm kiếm họ tên hoặc email và ô dropdown chứa 24 hành động hệ thống phổ biến đã Việt hóa.
   * Thêm nút **Lọc kết quả** và nút **Nhập lại** để xóa nhanh bộ lọc.
3. **Bảo toàn trạng thái phân trang**:
   * Toàn bộ các liên kết chuyển trang được sửa đổi để tự động nối thêm các tham số `search` và `action` hiện tại, đảm bảo bộ lọc được giữ nguyên khi Admin chuyển đổi giữa các trang kết quả.

### 📂 2. Các tệp đã thay đổi

* [schema.js](file:///d:/antigravity/hocp1/models/schema.js) - Cập nhật logic SQL WHERE động.
* [adminController.js](file:///d:/antigravity/hocp1/controllers/adminController.js) - Cập nhật controller nhận tham số lọc và truyền các loại hành động sang view.
* [audit.ejs](file:///d:/antigravity/hocp1/views/admin/audit.ejs) - Thêm thanh tìm kiếm và bộ lọc, cập nhật các đường link phân trang.

---

## 📅 PHẦN 4: LỌC NHẬT KÝ THEO KHOẢNG NGÀY (DATE RANGE FILTER)

Chúng tôi đã hoàn thành tích hợp tính năng lọc nhật ký hệ thống theo khoảng ngày giúp quản trị viên giới hạn tra cứu log trong ngày hôm nay, tuần này hoặc tháng này.

### 🛠️ 1. Các hạng mục thay đổi

1. **Truy vấn SQL khoảng ngày chính xác**:
   * Cập nhật `AuditLog.findPaginated` và `countAll` để ghép nối động thêm điều kiện ngày:
     - `startDate` (Từ ngày): So sánh lớn hơn hoặc bằng (`>=`) với chuỗi `'YYYY-MM-DD 00:00:00'`.
     - `endDate` (Đến ngày): So sánh nhỏ hơn hoặc bằng (`<=`) với chuỗi `'YYYY-MM-DD 23:59:59'`.
     - Điều này đảm bảo lọc trọn vẹn cả ngày đã chọn dù log được tạo ở bất cứ giây nào trong ngày.
2. **Giao diện Chọn ngày mượt mà**:
   * Tích hợp 2 ô nhập liệu kiểu lịch chọn ngày (`<input type="date">`) có nhãn **Từ ngày** và **Đến ngày** vào thanh bộ lọc.
   * Tích hợp nút **Nhập lại** để reset đồng thời cả từ khóa, hành động và khoảng ngày đã chọn.
3. **Bảo toàn trạng thái khoảng ngày**:
   * Cập nhật tất cả các đường dẫn phân trang `href` để nối thêm `&startDate=...&endDate=...` đảm bảo khoảng ngày lọc không bị mất đi khi Admin xem trang số 2, trang 3.

### 📂 2. Các tệp đã thay đổi

* [schema.js](file:///d:/antigravity/hocp1/models/schema.js) - Cập nhật hàm đếm và phân trang SQL WHERE hỗ trợ startDate & endDate.
* [adminController.js](file:///d:/antigravity/hocp1/controllers/adminController.js) - Cập nhật hàm `getAuditLogs` để lấy dữ liệu ngày từ URL và truyền sang view.
* [audit.ejs](file:///d:/antigravity/hocp1/views/admin/audit.ejs) - Thêm 2 input lịch chọn ngày, cập nhật các đường dẫn phân trang.

---

## 🎨 PHẦN 5: CẢI THIỆN BỐ CỤC BẢNG ĐIỀU KHIỂN (DASHBOARD LAYOUT)

Chúng tôi đã hoàn thành cải tiến bố cục trang Bảng điều khiển quản trị (`/management`), giúp giao diện hiển thị cân đối, thanh lịch và chuyên nghiệp hơn rất nhiều.

### 🛠️ 1. Các hạng mục thay đổi

1. **Mở rộng phần "Thao tác nhanh" và Thu hẹp "Nhật ký hoạt động":**
   - Trước đây tỷ lệ cột là `1.2fr 2fr` (~37% và ~63%), khiến các nút thao tác nhanh bên trái rất hẹp và chữ bị xuống dòng nhiều lần rất khó đọc (ví dụ: "Cấu hình Phân quyền & Checklist").
   - Chúng tôi đã nâng cấp thành tỷ lệ cân đối hơn là `1.6fr 1.8fr` (~47% và ~53%) thông qua lớp CSS `.dashboard-main-grid`.
   - Giờ đây, phần "Thao tác nhanh" có không gian rộng rãi hơn giúp các nút hiển thị trọn vẹn trên một dòng, dễ nhìn và dễ thao tác.
   
2. **Hỗ trợ giao diện thích ứng (Responsive Grid):**
   - Lớp `.dashboard-main-grid` hỗ trợ thiết kế Responsive: trên màn hình nhỏ hoặc máy tính bảng (dưới 1024px), hai cột này sẽ tự động chuyển sang xếp chồng theo chiều dọc (`grid-template-columns: 1fr`) để không bị quá hẹp.

3. **Cải tiến giao diện Bảng Nhật ký hoạt động:**
   - **Badge Hành động đầy màu sắc**: Nhãn hoạt động (action) được phân loại màu theo mục đích:
     - Màu xanh lục (Green badge) cho đăng nhập thành công (`USER_LOGIN`, `SUCCESS`).
     - Màu vàng/cam (Yellow badge) cho yêu cầu khôi phục hoặc lỗi/cảnh báo (`REQUESTED`, `FAIL`).
     - Màu xám (Grey badge) cho đăng xuất (`USER_LOGOUT`).
     - Màu xanh dương (Indigo badge) cho các hành động khác.
   - **Tối ưu hóa Chi tiết JSON**: Cột chi tiết JSON được đặt định dạng font chữ monospace, giới hạn độ rộng tối đa (`max-width: 300px`) và bật thanh cuộn ngang tự động (`overflow-x: auto`), giúp bảo vệ cấu trúc bảng luôn gọn gàng và không bị méo mó khi dữ liệu JSON quá dài.

### 📂 2. Các tệp đã thay đổi

* [style.css](file:///d:/antigravity/hocp1/public/css/style.css) - Thêm lớp `.dashboard-main-grid` định nghĩa lưới hai cột và media query cho responsive.
* [dashboard.ejs](file:///d:/antigravity/hocp1/views/admin/dashboard.ejs) - Áp dụng lớp `.dashboard-main-grid`, cập nhật badge hành động nhiều màu sắc, và thêm quy tắc CSS giới hạn cho cột chi tiết log.

---

## 🔒 PHẦN 6: KHẮC PHỤC HIỂN THỊ SIDEBAR THEO PHÂN QUYỀN VAI TRÒ

Chúng tôi đã sửa lỗi hiển thị các đề mục quản trị trên thanh menu bên trái (Sidebar) đối với tài khoản nhân viên (vai trò `Employee`) không được cấp phép, giúp đảm bảo tính bảo mật và tính thống nhất của toàn hệ thống.

### 🛠️ 1. Các hạng mục thay đổi

1. **Chuẩn hóa Phân quyền cho Vai trò `Employee`:**
   - Trong thiết kế hệ thống, phân hệ học tập của học viên (như `/dashboard`, `/courses`, xem chi tiết bài học và nộp bài thi) được phân tách độc lập và chỉ yêu cầu người dùng đã đăng nhập (`isAuthenticated`), hoàn toàn không phụ thuộc vào quyền quản trị.
   - Trước đó, vai trò `Employee` (role_id = 4) được gieo mầm hai quyền `COURSE_VIEW` và `QUIZ_BANK_VIEW` trong cơ sở dữ liệu. Hai quyền này thực chất là để xem danh sách khóa học và ngân hàng đề thi thuộc phân khu **Quản trị L&D** (`/course-management`, `/quiz-management`).
   - Việc gán nhầm này dẫn đến xung đột: Sidebar hiển thị nhãn "Quản trị L&D", "Nội dung & Đào tạo" và các menu quản lý cho Employee, nhưng khi họ bấm vào thì trang hệ thống báo lỗi truy cập do lớp lọc controller ngăn chặn.
   - Chúng tôi đã loại bỏ hoàn toàn hai quyền này khỏi vai trò `Employee` trong tập tin gieo mầm [init-db.sql](file:///d:/antigravity/hocp1/init-db.sql) và trực tiếp trên cơ sở dữ liệu PostgreSQL.

2. **Cập nhật Bộ nhớ đệm & Phiên hoạt động (Redis Cache & Session Eviction):**
   - **Đồng bộ hóa Redis kết nối CLI**: Trước đó, việc xóa cache từ dòng lệnh (CLI) bị bỏ qua do thư viện Redis thực thi bất đồng bộ và kiểm tra trạng thái `'ready'` trước khi gửi lệnh. Chúng tôi đã hiệu chỉnh kịch bản để chờ sự kiện `'ready'` của Redis hoàn tất trước khi thực hiện xóa khóa `role_permissions:4`.
   - **Trục xuất Session của Employee**: Do phiên đăng nhập cũ của người dùng (`sess:*`) vẫn lưu trữ mảng quyền cũ (`["COURSE_VIEW","QUIZ_BANK_VIEW"]`) trong session, hệ thống tiếp tục hiển thị sidebar không đúng cho đến khi hết hạn session. Chúng tôi đã quét và tự động xóa phiên đăng nhập đang hoạt động của người dùng thuộc vai trò `Employee` (bao gồm cả tài khoản `hưng`).
   - Việc này buộc tài khoản nhân viên đăng nhập lại, từ đó hệ thống sẽ nạp lại danh sách quyền trống (`[]`) từ PostgreSQL và hiển thị một Sidebar sạch sẽ, đúng phân quyền.

* [init-db.sql](file:///d:/antigravity/hocp1/init-db.sql) - Loại bỏ các dòng chèn quyền `COURSE_VIEW` và `QUIZ_BANK_VIEW` cho `role_id = 4`.
* Thực thi trực tiếp lệnh SQL loại bỏ các quyền quản trị của vai trò `Employee` trên PostgreSQL, chờ Redis kết nối thành công để xóa cache vai trò, đồng thời hủy bỏ các session đang hoạt động của tài khoản thuộc vai trò `Employee`.

---

## 🎓 PHẦN 7: BỔ SUNG & HOÀN THIỆN CÁC CHỨC NĂNG DÀNH CHO HỌC VIÊN (LEARNER SUITE)

Chúng tôi đã hoàn thành tích hợp và tối ưu hóa bộ chức năng toàn diện dành cho học viên theo kế hoạch đã được phê duyệt.

### 🛠️ 1. Các hạng mục thay đổi

1. **Đăng ký duyệt khóa học tự nguyện (COURSE_ENROLL_REQUEST)**:
   * Cập nhật [courseController.js](file:///d:/antigravity/hocp1/controllers/courseController.js) và [detail.ejs](file:///d:/antigravity/hocp1/views/courses/detail.ejs).
   * Khóa học **Bảo mật thông tin trong doanh nghiệp** (ID = 2) khi được đăng ký tự nguyện bởi học viên sẽ tự động chuyển về trạng thái `pending` thay vì `approved`. Học viên thấy nhãn "Yêu cầu đăng ký đang chờ phê duyệt" và nút vào học bị ẩn.
   * Danh sách chờ phê duyệt hiển thị trực quan trên dashboard học viên và tự động phát socket thông báo tới Admin/HR.

2. **Cấu hình lock/unlock bài học theo tiến độ (PROGRESS_AUTO_SAVE)**:
   * **Cơ chế khóa bài giảng ở Backend & Frontend**: Học viên chỉ được xem bài giảng hiện tại nếu tiến độ học của họ lớn hơn hoặc bằng điều kiện hoàn thành các bài trước đó. Nếu gõ URL trực tiếp, hệ thống tự động redirect về bài học hợp lệ gần nhất. Bài học chưa đạt điều kiện hiển thị icon khóa mờ trong sidebar bài học.
   * **Tự động chuyển bài (Auto-advance)**: Đã cấu hình JavaScript trong [lesson.ejs](file:///d:/antigravity/hocp1/views/courses/lesson.ejs) để lắng nghe sự kiện `ended` của video HTML5. Khi video kết thúc, hệ thống sẽ tự động chuyển bài học tiếp theo hoặc nhắc học viên làm bài kiểm tra nếu đó là bài giảng cuối cùng.

3. **Modal đề thi: Hỗ trợ tự luận & giải thích đáp án (QUIZ_TAKE & QUIZ_RESULT_VIEW)**:
   * Hỗ trợ chèn câu hỏi loại `essay` vào đề thi trong [seed-rich-courses.js](file:///d:/antigravity/hocp1/seed-rich-courses.js) và render khung Textarea nhập văn bản lớn trên Modal thi tại Client.
   * Cập nhật API nộp bài `/courses/quiz/submit` để tách biệt luồng tự động chấm trắc nghiệm và luồng tự luận (nộp tự luận sẽ đặt điểm số và kết quả bằng `null` chờ Giảng viên chấm, đồng thời cập nhật tiến độ học lên 95%).
   * Sửa lỗi nghiêm trọng của câu lệnh SQL `UPDATE enrollments SET completed = true` (do cột `completed` không tồn tại trong DB, trước đó gây lỗi 500 khi học viên nộp bài thi thành công).

4. **Hiển thị phản hồi/điểm số tự luận từ Giảng viên (GRADE_FEEDBACK_VIEW)**:
   * Xây dựng đầy đủ định tuyến POST `/grade/:id` và hàm điều khiển `postGrade` trong [adminController.js](file:///d:/antigravity/hocp1/controllers/adminController.js) để Giảng viên lưu điểm số, trạng thái Đạt/Chưa đạt và nhận xét chi tiết cho bài làm tự luận.
   * Cập nhật giao diện Dashboard học viên hiển thị rõ trạng thái: "Chờ chấm điểm" (nếu bài thi có câu hỏi tự luận chưa chấm) và khung chứa lời phê chi tiết của Giảng viên ngay khi có điểm.

5. **Thiết kế trang Chứng nhận hoàn thành PDF/Print (CERTIFICATE_VIEW_DOWNLOAD)**:
   * Tạo giao diện mới [certificate.ejs](file:///d:/antigravity/hocp1/views/courses/certificate.ejs) được thiết kế theo tiêu chuẩn chứng chỉ cao cấp của doanh nghiệp, có màu sắc hài hòa, huy hiệu medal và chữ ký giám đốc.
   * Tích hợp CSS `@media print` giúp ẩn toàn bộ các nút điều hướng và mở giao diện in của hệ điều hành để học viên lưu trực tiếp thành tệp PDF chất lượng cao.
   * Khi khóa học đạt 100% tiến độ, nút **"Chứng chỉ"** sẽ xuất hiện trên card khóa học tại Dashboard.

6. **Tích hợp Chuông thông báo thời gian thực ở Header (NOTIFICATION_RECEIVE)**:
   * Tích hợp thanh Topbar chung chứa **Hộp thông báo (Chuông thông báo)** ở góc phải phía trên của nội dung chính [header.ejs](file:///d:/antigravity/hocp1/views/partials/header.ejs).
   * Cập nhật [socket-client.js](file:///d:/antigravity/hocp1/public/js/socket-client.js) để tự động lắng nghe 3 loại sự kiện đẩy thời gian thực từ máy chủ (HR giao khóa học, Giảng viên chấm xong bài thi tự luận, Học viên gửi yêu cầu đăng ký học cần duyệt) và chèn vào danh sách thông báo lưu trữ riêng biệt tại `localStorage` của trình duyệt.
   * Có huy hiệu (badge) đếm ngược số thông báo chưa đọc thời gian thực.

### 📂 2. Các tệp đã thay đổi và tạo mới

* **Controllers & Routes**:
  * [courseController.js](file:///d:/antigravity/hocp1/controllers/courseController.js): Cập nhật `getDashboard`, `enrollCourse`, `getLesson`, và thêm `getCertificate`.
  * [adminController.js](file:///d:/antigravity/hocp1/controllers/adminController.js): Thêm hàm `postGrade`.
  * [courseRoutes.js](file:///d:/antigravity/hocp1/routes/courseRoutes.js): Thêm định tuyến `/courses/:id/certificate` và cập nhật `/courses/quiz/submit`.
  * [adminRoutes.js](file:///d:/antigravity/hocp1/routes/adminRoutes.js): Đăng ký định tuyến POST `/grade/:id`.
* **Giao diện EJS (Views)**:
  * [header.ejs](file:///d:/antigravity/hocp1/views/partials/header.ejs): Thêm Topbar chung chứa dropdown chuông thông báo.
  * [dashboard.ejs](file:///d:/antigravity/hocp1/views/dashboard.ejs): Cập nhật KPIs học tập, thêm phần hiển thị khóa học chờ duyệt/bị từ chối, nhận xét thi tự luận, và nút xem chứng chỉ.
  * [detail.ejs](file:///d:/antigravity/hocp1/views/courses/detail.ejs): Hỗ trợ hiển thị trạng thái chờ duyệt và khóa bài học.
  * [lesson.ejs](file:///d:/antigravity/hocp1/views/courses/lesson.ejs): Thêm ID cho video player và cập nhật lock bài học trong sidebar.
  * [certificate.ejs](file:///d:/antigravity/hocp1/views/courses/certificate.ejs) `[NEW]`: Giao diện in/chứng nhận hoàn thành khóa học.
* **Client-side Scripts & Seeding**:
  * [socket-client.js](file:///d:/antigravity/hocp1/public/js/socket-client.js): Xây dựng hệ thống lưu trữ, đếm số lượng và hiển thị thông báo.
  * [ai-assistant.js](file:///d:/antigravity/hocp1/public/js/ai-assistant.js): Cập nhật render textarea câu hỏi tự luận và thu thập dữ liệu nộp bài thi.
  * [seed-rich-courses.js](file:///d:/antigravity/hocp1/seed-rich-courses.js): Thêm câu hỏi tự luận cho đề thi NodeJS để kiểm thử.
