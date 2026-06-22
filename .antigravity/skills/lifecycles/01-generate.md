# Kỹ năng Xây dựng mô hình & Viết mã (Generate Skill - Scientific Version)

Tài liệu này định nghĩa tiêu chuẩn và quy trình cho bước **Generate** trong dự án nghiên cứu khoa học. Kỹ năng này hướng dẫn Agent phân tích, thiết kế thuật toán và viết mã nguồn mô hình khoa học chất lượng cao.

## 1. Nghiên cứu & Thiết kế thuật toán (Planning)
Trước khi viết bất kỳ mã nguồn nào, Agent phải:
- **Đọc kỹ Đặc tả Thực nghiệm**: Đối chiếu trực tiếp với tệp đặc tả của thực nghiệm cụ thể (nằm trong `docs/features/`) để hiểu mục tiêu khoa học, công thức toán học và tiêu chuẩn hiệu năng cần đạt.
- **Phân tích Luồng Dữ liệu**: Xem xét tài liệu [01-data-pipeline.md](file:///d:/antigravity/hocp1/docs/cores/01-data-pipeline.md) để hiểu cách dữ liệu được tải, làm sạch và định dạng. Không tự ý tạo ra các cấu trúc dữ liệu không tương thích.
- **Ghi nhận Đặc tả thiếu**: Nếu phát hiện các công thức hoặc tham số mô hình trong tài liệu đặc tả ban đầu bị thiếu, ghi chú lại thông tin để sẵn sàng đồng bộ sau khi mô hình chạy thành công.
- **Xây dựng Kế hoạch**: Đối với thuật toán phức tạp, phải tạo hoặc cập nhật tệp `implementation_plan.md` để người dùng phê duyệt trước khi code.

## 2. Quy tắc Viết mã Khoa học (Scientific Coding Guidelines)
- **Ngôn ngữ Lập trình**:
  - Mã nguồn (biến, hàm, class, module): Sử dụng **Tiếng Anh chuẩn khoa học/kỹ thuật**. Đặt tên biến phản ánh đúng ký hiệu toán học (ví dụ: dùng `weight_matrix` hoặc `W`, `bias` hoặc `b`).
  - Chú thích (Comments) & Giải thích: Sử dụng **Tiếng Việt** (tuân thủ quy tắc tại `comment.md`). Tập trung giải thích ý nghĩa vật lý/khoa học của tham số và công thức toán học tương ứng.
- **Cấu trúc & Hiệu năng**:
  - Tận dụng các thư viện tính toán ma trận tối ưu (ví dụ: NumPy, PyTorch, Pandas trong Python) thay vì viết các vòng lặp thủ công chậm chạp.
  - Sử dụng cơ chế kiểm soát biên và xử lý ngoại lệ số học (ví dụ: tránh chia cho 0 bằng cách cộng một hằng số nhỏ `eps = 1e-8`).
- **An toàn Dữ liệu**:
  - **Tuyệt đối không hardcode đường dẫn dữ liệu cá nhân hay dữ liệu nhạy cảm của công ty.** Sử dụng các biến cấu hình hoặc truyền tham số thông qua dòng lệnh/file cấu hình.
- **Tránh Placeholders**:
  - Không viết code giả hoặc ghi chú `// TODO: implement model`. Mọi logic toán học phải được thực thi hoàn chỉnh.

## 3. Theo dõi Tiến độ
- Sử dụng tệp `task.md` để quản lý các đầu việc. Đánh dấu `[/]` khi bắt đầu triển khai code thuật toán và `[x]` khi hoàn thành.
