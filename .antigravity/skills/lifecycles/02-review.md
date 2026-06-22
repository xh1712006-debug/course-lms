# Kỹ năng Kiểm chứng khoa học & Rà soát (Review Skill - Scientific Version)

Tài liệu này quy định quy trình tự rà soát (Self-review) mã nguồn và thuật toán khoa học trước khi tiến hành chạy thử nghiệm đánh giá mô hình.

## 1. Quy trình Tự Rà soát (Scientific Review Checklist)
Trước khi bàn giao hoặc chuyển sang bước thử nghiệm, Agent bắt buộc phải kiểm tra:

- **Tính Đúng đắn Toán học & Logic**:
  - Mã nguồn đã cài đặt đúng các công thức toán học và cấu trúc mô hình quy định trong đặc tả thực nghiệm chưa?
  - Kích thước ma trận (matrix shapes/dimensions) đã được kiểm tra khớp nhau giữa các lớp chưa?
- **Độ ổn định số học (Numerical Stability)**:
  - Có nguy cơ xảy ra lỗi tràn số (overflow), biến mất/bùng nổ gradient (vanishing/exploding gradients), hay chia cho 0 không?
  - Đã có các cơ chế phòng ngừa (ví dụ: gradient clipping, log-sum-exp trick, epsilon bổ trợ) chưa?
- **Chú thích (Comments) & Giải thích**:
  - Tất cả chú thích công thức phức tạp phải sử dụng **Tiếng Việt** ngắn gọn, dễ hiểu để các nghiên cứu viên khác có thể đọc hiểu.
- **An toàn Dữ liệu (Data Confidentiality)**:
  - Đảm bảo tuyệt đối không có dữ liệu nội bộ nhạy cảm, mật khẩu hoặc API key được lưu trực tiếp trong code (hardcoded secrets).
  - Đảm bảo các hàm ghi log không in ra dữ liệu thô nhạy cảm của khách hàng hay công ty.
- **Chuẩn bị Đồng bộ Đặc tả**:
  - Ghi nhận những tham số mới, cấu trúc dữ liệu mới phát sinh trong code để chuẩn bị cập nhật vào tài liệu đặc tả (chỉ cập nhật chính thức sau khi code vượt qua kiểm thử thành công ở bước Test).

## 2. Giao tiếp và Tương tác (Human-in-the-Loop)
- **Báo cáo thay đổi toán học**: Tóm tắt ngắn gọn các quyết định thiết kế mô hình toán, lý do tối ưu hóa thuật toán và các thay đổi so với phiên bản trước.
- **Tạo Walkthrough**: Cập nhật hoặc tạo file `walkthrough.md` trong thư mục báo cáo để ghi nhận kết quả rà soát chi tiết.
