# Mẫu Đặc Tả Yêu Cầu Nghiên Cứu Khoa Học & Thuật Toán (Scientific Research & Algorithm Specification)

**Dự án**: [Tên Dự Án Nghiên Cứu Khoa Học Của Bạn]

---

## 1. Giới thiệu (Introduction)

### 1.1 Mục đích (Purpose)
Tài liệu này đặc tả toàn bộ các yêu cầu nghiên cứu, phương pháp thuật toán, nguồn dữ liệu đầu vào và các tiêu chuẩn đánh giá mô hình cho dự án [Tên Dự Án]. Tài liệu này làm cơ sở định hướng cho AI Agent triển khai các thực nghiệm khoa học một cách chính xác và bảo mật.

### 1.2 Phạm vi Nghiên cứu (Research Scope)
*   **Trong phạm vi nghiên cứu (In-Scope)**:
    *   [Mô tả các thuật toán hoặc mô hình dự kiến sẽ phát triển và thử nghiệm].
    *   [Ví dụ: Phát triển mạng neural CNN phân loại ảnh, tối ưu hóa siêu tham số, phân tích độ nhạy].
*   **Ngoài phạm vi nghiên cứu (Out-of-Scope)**:
    *   [Mô tả các phần việc hoặc mô hình không được thực hiện trong giai đoạn này].
    *   [Ví dụ: Không tích hợp mô hình lên ứng dụng di động bên ngoài, không huấn luyện mô hình vượt quá 50 triệu tham số].

### 1.3 Thuật ngữ & Viết tắt (Definitions & Acronyms)
*   **PII**: Personally Identifiable Information (Thông tin định danh cá nhân).
*   **MSE**: Mean Squared Error (Sai số bình phương trung bình).
*   **CNN**: Convolutional Neural Network (Mạng neural tích chập).
*   **[Thêm các thuật ngữ khoa học đặc thù tại đây]**.

---

## 2. Mô tả Tổng quan (Overall Description)

### 2.1 Bối cảnh Dự án (Project Perspective)
[Mô tả vị trí của nghiên cứu này trong hệ thống giải pháp của công ty, nó giao tiếp hay kế thừa kết quả từ các nghiên cứu/dữ liệu nào khác].

### 2.2 Đối tượng Sử dụng (User Classes & Characteristics)
*   **Nghiên cứu viên dữ liệu (Data Scientist)**: Triển khai thực nghiệm, huấn luyện mô hình và đánh giá chỉ số.
*   **Chuyên gia Phân tích Nghiệp vụ (Business Analyst)**: Sử dụng các trực quan hóa dữ liệu để lập báo cáo đề xuất kinh doanh.
*   **[Thêm các nhóm đối tượng sử dụng khác tại đây]**.

### 2.3 Ràng buộc & Phụ thuộc (Constraints & Dependencies)
*   **Ràng buộc**: [Ví dụ: Mô hình phải được triển khai bằng PyTorch LTS, chạy trên hạ tầng GPU nội bộ NVIDIA RTX 4090].
*   **Phụ thuộc**: [Ví dụ: Phụ thuộc vào tiến độ cung cấp dữ liệu đã gán nhãn sạch từ bộ phận vận hành].

---

## 3. Yêu cầu Tài nguyên Dữ liệu & Tính toán (Data & Computing Requirements)

### 3.1 Nguồn Dữ liệu và Tiền xử lý (Datasets)
[Mô tả các tập dữ liệu sử dụng, yêu cầu khử định danh và các bước tiền xử lý bắt buộc].

### 3.2 Yêu cầu Phần cứng / Tính toán (Hardware/Computing Interfaces)
[Liệt kê yêu cầu về GPU, CPU, dung lượng RAM tối thiểu để chạy thực nghiệm].

### 3.3 Yêu cầu Thư viện & Framework (Software Interfaces)
[Liệt kê các phiên bản thư viện cần thiết như Python 3.10+, PyTorch 2.1, NumPy 1.24...].

---

## 4. Yêu cầu Thuật toán & Thực nghiệm (Algorithm & Experiment Requirements)

[Danh sách các bài toán/nhiệm vụ nghiên cứu cụ thể. Mỗi nhiệm vụ đi kèm một mã định danh giúp Agent dễ dàng bám sát và ghi nhận tiến trình].

### 4.1 Phân hệ Xử lý Dữ liệu (Data Pipeline Tasks)
*   `[RS-DATA-01]`: Khử định danh hoàn toàn trường dữ liệu khách hàng (PII) trước khi đưa vào huấn luyện.
*   `[RS-DATA-02]`: Triển khai kỹ năng xử lý dữ liệu khuyết bằng phương pháp nội suy chuỗi thời gian.

### 4.2 Phân hệ Thuật toán & Mô hình (Algorithm & Modeling Tasks)
*   `[RS-ALGO-01]`: Thiết kế mô hình CNN cơ bản có chèn các lớp Batch Normalization để tăng tốc hội tụ.
*   `[RS-ALGO-02]`: Tối ưu hóa siêu tham số learning rate bằng thuật toán Adam Optimizer.

---

## 5. Yêu cầu Phi chức năng (Non-functional Requirements)

### 5.1 Bảo mật dữ liệu nội bộ (Security & Confidentiality)
*   Tuyệt đối không đẩy mã nguồn hay dữ liệu lên repository công khai.
*   Tất cả dữ liệu ghi log phải được khử định danh.

### 5.2 Tính tái lập kết quả (Reproducibility)
*   Mô hình bắt buộc phải cấu hình random seed cố định.
*   Kết quả chạy lại thực nghiệm phải có độ lệch chỉ số nhỏ hơn 0.5%.

### 5.3 Độ ổn định số học (Numerical Stability)
*   Thuật toán tính toán phải được phòng ngừa lỗi tràn số (overflow/underflow) hoặc chia cho 0.
