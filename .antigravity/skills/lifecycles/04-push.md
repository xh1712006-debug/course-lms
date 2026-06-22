# Kỹ năng Lưu trữ nội bộ & Ghi nhận kết quả (Push Skill - Scientific Version)

Tài liệu này hướng dẫn quy trình dọn dẹp, lưu trữ mã nguồn và kết quả nghiên cứu khoa học vào hệ thống Git Server nội bộ của công ty một cách an toàn và bảo mật.

## 1. Dọn dẹp & Bảo mật dữ liệu (Cleanup & Security Check)
Trước khi tạo commit, Agent phải đảm bảo:
- **Khử định danh & Dữ liệu nhạy cảm**: Tuyệt đối không commit các file dữ liệu thô nhạy cảm, thông tin cá nhân khách hàng, hoặc tệp log chứa kết quả nội bộ chưa được kiểm duyệt.
- **Kiểm tra `.gitignore`**: Chắc chắn rằng các file `.env`, thư mục chứa dataset nặng, thư mục lưu checkpoints mô hình (`*.pt`, `*.h5`, `*.pkl`) hoặc các kết quả trung gian dung lượng lớn đã được đưa vào `.gitignore`.
- **Loại bỏ file rác**: Xóa các file log tạm, file cấu hình thử nghiệm cục bộ không cần thiết.

## 2. Quy chuẩn Commit & Đẩy mã nguồn nội bộ
- **Quy tắc bảo mật nghiêm ngặt**:
  > [!CAUTION]
  > **Tuyệt đối không đẩy mã nguồn lên các kho lưu trữ công cộng (như GitHub public, GitLab public).** Chỉ được phép push lên Git Server nội bộ của công ty theo địa chỉ IP/Domain được cấu hình trước.
- **Quy chuẩn thông điệp Commit (Tiếng Anh)**:
  - Cấu trúc: `<type>(<scope>): <description>`
  - Loại hình (Type) khoa học:
    - `model`: Thay đổi kiến trúc mô hình toán, lớp mạng.
    - `data`: Thay đổi luồng dữ liệu, tiền xử lý, tăng cường dữ liệu.
    - `feat`: Thêm tính năng mới (phần mềm hỗ trợ/phân tích).
    - `fix`: Sửa lỗi logic thuật toán hoặc code.
    - `docs`: Cập nhật đặc tả khoa học hoặc tài liệu thực nghiệm.
  - Sử dụng tối đa **2 cờ `-m`** để tạo commit sạch:
    - Cờ `-m` thứ nhất: Tiêu đề ngắn gọn theo chuẩn Conventional Commits (ví dụ: `model(resnet): adjust learning rate and add dropout`).
    - Cờ `-m` thứ hai: Mô tả chi tiết kết quả thực nghiệm đạt được (ví dụ: `- accuracy improved to 92.4%\n- solved overfitting on train set`).

## 3. Tạo Báo cáo Kết quả (Walkthrough & Scientific Report)
- **Cập nhật walkthrough.md**: Agent ghi nhận chi tiết kết quả thử nghiệm bao gồm các thông số, biểu đồ mất mát (loss curve) hoặc so sánh các phiên bản mô hình trong tệp `walkthrough.md`.
- **Đóng gói**: Đảm bảo tệp đặc tả thực nghiệm trong `docs/features/` và mã nguồn thực tế đã đồng bộ hoàn toàn trên máy chủ Git nội bộ.
