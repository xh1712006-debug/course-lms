# Đặc tả Thực nghiệm: [Tên Thử nghiệm / Tác vụ]

> [!NOTE]
> Nghiên cứu viên điền các thông tin trong **Mục 1** và **Mục 2** trước khi bắt đầu code. AI Agent sẽ đọc các mục này để triển khai, chạy huấn luyện, và tự động điền kết quả vào **Mục 3**.

---

## 1. Mục tiêu & Giả thuyết Khoa học (Goal & Hypothesis)

- **Mục đích**: [Mô tả chi tiết những gì thực nghiệm này muốn kiểm chứng hoặc tính năng toán học muốn bổ sung].
- **Giả thuyết khoa học**: [Ví dụ: Áp dụng Dropout tỉ lệ 0.3 sẽ giúp giải quyết hiện tượng quá khớp (overfitting) của mô hình trên tập dữ liệu X].

## 2. Thiết lập Thực nghiệm (Experiment Setup)

- **Bộ dữ liệu đầu vào (Dataset)**: [Tên và phiên bản tập dữ liệu, ví dụ: customer_churn_v1.2]
- **Thuật toán / Kiến trúc mô hình**: [Mô tả kiến trúc mạng hoặc phương pháp thuật toán sử dụng]
- **Siêu tham số dự kiến (Expected Hyperparameters)**:
  - `learning_rate`: [ví dụ: 0.001]
  - `batch_size`: [ví dụ: 32]
  - `epochs`: [ví dụ: 100]
  - [Các tham số khác]: ...
- **Chỉ số Hiệu năng Mục tiêu (Target Metrics)**:
  - [Chỉ số 1 (ví dụ: Accuracy >= 90%)]
  - [Chỉ số 2 (ví dụ: Loss <= 0.15)]

---

## 3. Nhật ký Kết quả Thực nghiệm (Experiment Logs - AI Auto-filled)

*AI Agent tự động cập nhật phần này sau khi thực hiện huấn luyện và kiểm thử mô hình thành công.*

- **Trạng thái thực thi**: [Thành công / Thất bại]
- **Thời gian chạy (Runtime)**: [Tổng thời gian huấn luyện và đánh giá]
- **Siêu tham số thực tế tối ưu**:
  - `learning_rate`: [Giá trị]
  - `batch_size`: [Giá trị]
  - `epochs`: [Giá trị]
- **Chỉ số hiệu năng đạt được (Actual Metrics)**:
  - **Loss**: [Giá trị]
  - **Accuracy**: [Giá trị]
  - **F1-score**: [Giá trị]
  - [Các chỉ số khác]: ...
- **Nhận xét của AI về sự hội tụ**: [Mô tả ngắn gọn về quá trình giảm loss, hiện tượng overfitting/underfitting nếu có]

---

## 4. Kết luận & Khuyến nghị (Conclusion & Recommendations)

*Được thảo luận và ghi nhận bởi Nghiên cứu viên và AI.*

- **Kết luận giả thuyết**: [Đạt mục tiêu / Không đạt mục tiêu. Giải thích lý do nếu không đạt].
- **Hướng phát triển tiếp theo**: [Đề xuất hướng cải tiến, thay đổi kiến trúc hoặc dữ liệu cho các thực nghiệm sau].
