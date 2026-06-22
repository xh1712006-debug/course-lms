# Kỹ năng Thử nghiệm & Đánh giá (Test Skill - Scientific Version)

Tài liệu này định nghĩa quy chuẩn chạy kiểm thử (Unit test) và đánh giá mô hình khoa học để đảm bảo tính ổn định toán học, độ chính xác thuật toán và tính tái lập trước khi tích hợp vào nhánh chính.

## 1. Viết Ca Kiểm thử Toán học (Mathematical Unit Tests)
- **Kiểm thử logic toán**: Viết các ca kiểm thử kiểm tra các hàm toán học biệt lập (ví dụ: kiểm tra giá trị đầu ra của hàm kích hoạt, hàm tính loss với các đầu vào cơ bản).
- **Kiểm tra trường hợp biên (Boundary Cases)**: Thử nghiệm với các đầu vào cực đoan (ví dụ: ma trận toàn số 0, ma trận chứa giá trị NaN/Inf, hoặc kích thước ma trận cực lớn) để đảm bảo code không bị crash.
- **Cô lập dữ liệu (Mocking Datasets)**:
  - Khi kiểm thử các pipeline xử lý, sử dụng tập dữ liệu giả lập (mock dataset) có kích thước nhỏ thay vì chạy trực tiếp trên toàn bộ cơ sở dữ liệu thực để tối ưu thời gian.

## 2. Huấn luyện thử nghiệm & Đánh giá hiệu năng (Model Validation)
- **Chạy thực nghiệm**: Thực thi các lệnh huấn luyện/đánh giá mô hình trên môi trường kiểm thử.
- **Đánh giá chỉ số hiệu năng (Metrics evaluation)**:
  - Đối chiếu kết quả thực tế (Accuracy, Precision, Recall, F1-score, Loss...) với các chỉ số mục tiêu đề ra trong tệp đặc tả thực nghiệm.
  - Đảm bảo tính tái lập (Reproducibility): Chạy lại thực nghiệm tối thiểu 2 lần với cùng một `random_seed` để đảm bảo sai số kết quả nằm trong phạm vi cho phép (ví dụ: `< 0.1%`).
- **Xử lý khi không đạt mục tiêu**:
  - Nếu mô hình không hội tụ hoặc kết quả không đạt mục tiêu tối thiểu, Agent phải quay lại bước **Generate** để điều chỉnh siêu tham số, tối ưu lại cấu trúc mô hình hoặc tiền xử lý dữ liệu.

## 3. Cổng kiểm soát Đồng bộ (Doc-Code Sync Gate)
- **Chỉ thực hiện sau khi tất cả các bài test đã PASS và chỉ số mô hình đạt yêu cầu.**
- **Hành động**: Agent tự động điền các thông tin thực tế gồm: Danh sách siêu tham số tối ưu (Hyperparameters), kết quả các chỉ số hiệu năng cụ thể thu được, và các biểu đồ huấn luyện (nếu có) vào tệp đặc tả thực nghiệm cụ thể (ví dụ: `docs/features/01-resnet-image-classification.md`).
