# Đặc tả Luồng xử lý Dữ liệu (Data Pipeline Specification)

Tài liệu này đặc tả quy trình thu thập, tiền xử lý và lưu trữ dữ liệu phục vụ cho các thực nghiệm khoa học của công ty.

## 1. Nguồn Dữ liệu (Data Sources)

Dữ liệu đầu vào cho các mô hình nghiên cứu bao gồm:
- **Cơ sở dữ liệu nội bộ**: Dữ liệu vận hành hoặc cảm biến lịch sử được kết nối an toàn.
- **Tệp dữ liệu tĩnh (Static Files)**: Định dạng `.csv`, `.parquet`, `.h5` (HDF5) được lưu trữ tại máy chủ lưu trữ dữ liệu nội bộ.
- **API nội bộ**: Các dịch vụ cung cấp dữ liệu thời gian thực được xác thực bảo mật.

## 2. Quy trình Tiền xử lý Dữ liệu (Preprocessing Pipeline)

Mọi tập dữ liệu trước khi đưa vào huấn luyện mô hình phải đi qua các bước tiền xử lý chuẩn hóa sau:

```mermaid
graph LR
    A[Dữ liệu Thô] --> B[Làm sạch & Khử nhiễu]
    B --> C[Xử lý Giá trị khuyết - Missing Values]
    C --> D[Chuẩn hóa - Scaling/Normalization]
    D --> E[Lọc Đặc trưng - Feature Selection]
    E --> F[Tập Dữ liệu Chuẩn hóa]
```

### Chi tiết các bước:
1. **Làm sạch & Khử nhiễu**: Loại bỏ các bản ghi không hợp lệ hoặc các ngoại lệ (outliers) toán học dựa trên phân tích phân phối (Z-score hoặc IQR).
2. **Xử lý giá trị khuyết**: Sử dụng các phương pháp nội suy (interpolation) hoặc điền giá trị trung bình/trung vị tùy thuộc vào kiểu dữ liệu.
3. **Chuẩn hóa (Normalization)**: Áp dụng MinMax Scaling hoặc Standard Scaling để đưa dữ liệu về cùng một miền giá trị, đảm bảo tốc độ hội tụ của thuật toán tối ưu.

## 3. Định dạng Lưu trữ Dữ liệu (Storage Specifications)
- **Dữ liệu huấn luyện**: Khuyến nghị lưu trữ dưới dạng **Apache Parquet** để tối ưu hóa bộ nhớ và tốc độ đọc/ghi ma trận.
- **Lưu trữ nhị phân**: Đối với các tập dữ liệu ma trận đa chiều lớn (ảnh, tín hiệu), sử dụng định dạng **HDF5 (`.h5`)** hoặc định dạng nén tương đương.
- **Quy tắc đặt tên file**: `[tên_tập_dữ_liệu]_[phiên_bản]_YYYYMMDD.parquet` (ví dụ: `sales_forecast_v1.0_20260616.parquet`).
