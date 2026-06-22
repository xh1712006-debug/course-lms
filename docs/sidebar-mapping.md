# Bảng Ánh Xạ Sidebar & Chức Năng Hệ Thống (LMS Sidebar & Feature Map)

Tài liệu này đặc tả mối quan hệ giữa các mục hiển thị trên thanh điều hướng bên trái (Sidebar) và các định tuyến (Routes), hàm xử lý (Controller) trong mã nguồn dự án LMS.

---

## 📊 1. Ánh Xạ Sidebar và Chức Năng Hệ Thống

### 🗺️ Nhóm Học Tập (Phân quyền động theo vai trò)
Mục này hiện đã được phân quyền. Học viên chỉ nhìn thấy các liên kết tương ứng khi vai trò của họ được tích quyền hạn trong ma trận phân quyền.

| Mục Sidebar | Link điều hướng | Định tuyến (Route) | Hàm xử lý (Controller) | Quyền hạn yêu cầu | Mô tả chức năng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Trang chủ (Dashboard)** | `/dashboard` | `GET /dashboard` | `courseController.getDashboard` | *Không yêu cầu* | Trang tổng quan tiến độ học tập, bài kiểm tra của học viên và gợi ý lộ trình học. |
| **Lộ trình của tôi** | `/my-paths` | `GET /my-paths` | `courseController.getMyPaths` | `PATH_VIEW` | Hiển thị danh sách các lộ trình học tập được chỉ định (bắt buộc/tự nguyện) cùng phần trăm tiến độ. |
| **Kho khóa học** | `/courses` | `GET /courses` | `courseController.getCourses` | `COURSE_ENROLL_REQUEST` | Thư viện toàn bộ các khóa học đang xuất bản để học viên chủ động đăng ký học. |
| **Lịch sử & Thành tựu** | `/my-history` | `GET /my-history` | `courseController.getMyHistory` | `HISTORY_VIEW` | Xem lịch sử điểm kiểm tra, đánh giá của giáo viên và tải chứng chỉ hoàn thành (PDF). |
| **Lịch học & Deadline** | `/my-deadlines` | `GET /my-deadlines` | `courseController.getMyDeadlines` | `PROGRESS_TRACK` | Quản lý thời hạn hoàn thành các khóa học bắt buộc (tính 30 ngày từ ngày đăng ký). |

### ⚙️ Nhóm Quản Trị L&D (Chỉ hiển thị khi có đặc quyền kiểm tra qua RBAC)
Hiển thị động dựa trên mảng permissions của phiên làm việc (Session).

| Mục Sidebar | Link điều hướng | Định tuyến (Route) | Hàm xử lý (Controller) | Quyền hạn yêu cầu | Mô tả chức năng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bảng điều khiển** | `/management` | `GET /management` | `adminController.getDashboard` | Quyền quản trị bất kỳ | Tổng hợp số liệu L&D của toàn công ty (số học viên, khóa học...). |
| **Quản lý khóa học** | `/course-management` | `GET /course-management` | `adminController.getCourses` | `COURSE_VIEW` | Tạo mới, sửa đổi thông tin khóa học, xóa và xuất bản khóa học. |
| **Bài học & Nội dung** | `/course-management` | *Không có route riêng* | *Dùng chung với Quản lý khóa học* | `LESSON_CREATE`/`MANAGE` | Quản trị viên quản lý danh sách bài học và tài liệu của từng khóa cụ thể. |
| **Đề thi & Câu hỏi** | `/quiz-management` | `GET /quiz-management` | `adminController.getQuizzes` | `QUIZ_BANK_VIEW` | Thiết lập đề thi cuối khóa, thêm mới và xóa câu hỏi trắc nghiệm/tự luận. |
| **Chấm điểm** | `/grade` | `GET /grade` | `adminController.getGradeList` | `QUIZ_GRADE` | Xem danh sách bài thi tự luận chờ chấm, chấm điểm và viết lời nhận xét. |
| **Lộ trình đào tạo** | `/paths` | `GET /paths` | `adminController.getLearningPaths` | `PATH_MANAGE` | Thiết lập lộ trình học tập và gán các khóa học tương ứng vào lộ trình. |
| **Duyệt đăng ký** | `/approvals` | `GET /approvals` | `adminController.getEnrollmentApprovals` | `ENROLL_APPROVE` | Phê duyệt hoặc từ chối các yêu cầu xin học các khóa học tự nguyện từ học viên. |
| **Quản lý nhân sự** | `/users` | `GET /users` | `adminController.getUsers` | `USER_VIEW` | Xem danh sách nhân viên, thay đổi vai trò (Role), gán phòng ban, kích hoạt/khóa tài khoản. |
| **Phòng ban** | `/users` | *Không có route riêng* | *Dùng chung với Quản lý nhân sự* | `DEPARTMENT_MANAGE` | Thêm mới và cấu hình sơ đồ phòng ban trong công ty (nằm bên phải trang `/users`). |
| **Báo cáo thống kê** | `/reports` | `GET /reports` | `adminController.getReports` | `REPORT_VIEW` | Biểu đồ tiến độ học tập trung bình của từng phòng ban, bảng xếp hạng KPI học tập. |
| **Xuất dữ liệu thô** | `/reports/raw` | `GET /reports/raw` | `adminController.getRawReportData` | `REPORT_EXPORT` | Xuất và tải báo cáo chi tiết dưới định dạng JSON/CSV. |
| **Cấu hình phân quyền** | `/permissions` | `GET /permissions` | `adminController.getRoles` | `ROLE_MANAGE` | Bật/tắt các quyền (permissions) chi tiết cho từng vai trò (Role) trong hệ thống. |
| **Nhật ký hệ thống** | `/audit` | `GET /audit` | `adminController.getAuditLogs` | `AUDIT_LOG_VIEW` | Xem nhật ký các thao tác quan trọng (Audit Log) để phục vụ kiểm toán bảo mật. |
| **Thực nghiệm AI** | `/experiments` | `GET /experiments` | `adminController.getExperimentsDashboard` | `ROLE_MANAGE` | Giao diện quản lý các luồng thử nghiệm huấn luyện mô hình, kiểm tra toán học. |

### 🚪 Nhóm Tiện Ích Footer (Hiển thị mặc định cho mọi người dùng)
| Mục Sidebar | Link điều hướng | Định tuyến (Route) | Hàm xử lý (Controller) | Quyền hạn yêu cầu | Mô tả chức năng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cài đặt tài khoản** | `/settings` | `GET /settings` | `courseController.getSettings` | *Không yêu cầu* | Xem thông tin hồ sơ cá nhân và đổi mật khẩu an toàn. |
| **Đăng xuất** | `/auth/logout` | `GET /auth/logout` | `authController.logout` | *Không yêu cầu* | Kết thúc phiên làm việc, xóa session và quay về màn hình đăng nhập. |

---

## ⚙️ 2. Các Chức Năng Chi Tiết (Không Có Sidebar Riêng)

Các chức năng này được gọi gián tiếp thông qua nút bấm tương tác hoặc yêu cầu API từ giao diện người dùng:
1. **Học bài & Thảo luận** (`GET /courses/:courseId/lessons/:lessonId`): Giao diện học bài, xem bài giảng video, tải tài liệu đính kèm và bình luận hỏi đáp.
2. **Nộp bài thi trắc nghiệm/tự luận** (`POST /courses/quiz/submit`): Hệ thống tự động chấm điểm trắc nghiệm tức thì và cập nhật tiến độ học lên 100% khi đạt điểm yêu cầu.
3. **Chứng nhận hoàn thành** (`GET /courses/:id/certificate`): Trang in chứng nhận sang trọng (nhận diện nút tải khi khóa học đạt 100% tiến trình).
4. **Trợ lý học tập AI** (`POST /ai/chat`, `/ai/summarize`, `/ai/quiz`): Chatbot trả lời câu hỏi chuyên sâu của bài học, tóm tắt bài giảng tự động và tạo đề thi thử nhanh bằng AI.
5. **Đóng vai tài khoản (Impersonate)** (`POST /auth/impersonate`): Chỉ dành cho Admin đóng vai một nhân viên cụ thể để kiểm tra thực tế giao diện và quyền hạn của nhân viên đó.
