# Đặc tả Trực quan hóa Dữ liệu & Báo cáo (Visualizations & Dashboard Specification)

Tài liệu này đặc tả các yêu cầu thiết kế đồ thị, trực quan hóa kết quả thực nghiệm và cấu trúc Dashboard phân tích dành cho nghiên cứu viên.

## 1. Yêu cầu vẽ Đồ thị & Biểu đồ (Scientific Plotting Rules)

Khi vẽ đồ thị để lưu kết quả thực nghiệm (ví dụ vào thư mục `docs/walkthroughs/` hoặc báo cáo), bắt buộc phải tuân thủ:
- **Đầy đủ Nhãn (Labels)**: Mọi trục tọa độ phải có nhãn rõ ràng kèm đơn vị đo (ví dụ: `Time (seconds)`, `Accuracy (%)`).
- **Chú giải (Legend)**: Đồ thị chứa nhiều đường/biểu diễn phải có Legend giải thích rõ từng thành phần.
- **Tính tương phản**: Sử dụng bảng màu thân thiện, rõ ràng, dễ phân biệt khi in trắng đen hoặc hiển thị trên màn hình.
- **Tiêu đề (Title)**: Đồ thị phải có tiêu đề tóm tắt nội dung biểu diễn.

## 2. Công nghệ Trực quan hóa (Visualization Tech Stack)
- **Đồ thị tĩnh (Tài liệu/Báo cáo)**: Sử dụng thư viện **Matplotlib** và **Seaborn** trong Python để xuất ảnh dạng sắc nét (Vector PDF hoặc PNG độ phân giải cao >= 300 DPI).
- **Trực quan hóa tương tác (Interactive Plotting)**: Sử dụng **Plotly** hoặc **Bokeh** để tạo các biểu đồ có thể thu phóng, di chuyển và hiển thị thông tin chi tiết khi hover chuột.
- **Dashboard phân tích (Analytical Dashboard)**: Sử dụng **Streamlit** (khuyên dùng vì phát triển nhanh, nhẹ bằng Python) hoặc **Dash** để xây dựng ứng dụng Web nội bộ cho phép tùy chỉnh các siêu tham số và hiển thị kết quả mô hình trực quan thời gian thực.

## 3. Cấu trúc Dashboard mẫu (Dashboard Layout Spec)

Mẫu bố cục Dashboard phân tích khoa học tiêu chuẩn:

```text
+------------------------------------------------------------+
|  Tiêu đề: Dashboard Phân tích Hiệu năng Thuật toán         |
+------------------------------------------------------------+
| [Thanh bên - Sidebar]      | [Mục chính - Main Dashboard]  |
| - Chọn tập dữ liệu         |  - Thống kê tóm tắt (KPIs)    |
| - Chọn mô hình             |  - Biểu đồ Loss/Accuracy      |
| - Tùy chỉnh tham số        |  - Biểu đồ phân phối sai số   |
|   (epochs, learning rate)  |  - Bảng so sánh các phiên bản |
+------------------------------------------------------------+
```
