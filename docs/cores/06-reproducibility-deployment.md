# Hướng dẫn Đảm bảo Tính Tái lập & Triển khai (Reproducibility & Deployment Specification)

Tài liệu này hướng dẫn cách khóa phiên bản môi trường, cấu hình seed để tái lập kết quả thử nghiệm 100%, và cách thức đóng gói mô hình khoa học để chuyển giao nội bộ.

## 1. Đảm bảo Tính Tái lập (Reproducibility Standards)

Để kết quả nghiên cứu khoa học có thể được kiểm chứng độc lập bởi bất kỳ thành viên nào trong công ty, bắt buộc phải:
- **Thiết lập Random Seed toàn cục**: Đảm bảo tất cả các nguồn sinh số ngẫu nhiên đều được gán cùng một giá trị seed cố định trước khi thực hiện bất kỳ phép toán nào:
  ```python
  import numpy as np
  import torch
  import random

  def set_seed(seed=42):
      random.seed(seed)
      np.random.seed(seed)
      torch.manual_seed(seed)
      if torch.cuda.is_available():
          torch.cuda.manual_seed_all(seed)
  ```
- **Lưu cấu hình thực nghiệm**: Lưu tất cả các siêu tham số huấn luyện vào tệp cấu hình (YAML hoặc JSON) đi kèm với tệp đặc tả thực nghiệm.

## 2. Quản lý Môi trường phát triển (Environment Lock)
- **Quản lý Thư viện**: Sử dụng **Conda (environment.yml)** hoặc **Poetry (pyproject.toml)** để khóa cứng phiên bản của tất cả các thư viện tính toán khoa học (như PyTorch, NumPy, Pandas, Scikit-learn). Tuyệt đối không cài đặt thư viện tự do không ghi nhận phiên bản.
- **Đóng gói Docker**: Đối với các mô hình phức tạp có phụ thuộc sâu vào driver GPU (CUDA), sử dụng Docker container chuẩn hóa dựa trên nền tảng image chính thức từ NVIDIA (ví dụ: `nvidia/cuda:11.8.0-runtime-ubuntu22.04`).

## 3. Triển khai & Đóng gói nội bộ (Model Serialization)
- **Lưu trữ trọng số mô hình**: Xuất mô hình đã huấn luyện thành định dạng tuần tự hóa tiêu chuẩn:
  - **PyTorch**: Định dạng `.pt` hoặc `.pth` chứa cả kiến trúc mạng và trọng số.
  - **Định dạng chung**: Khuyến nghị chuyển đổi sang **ONNX (`.onnx`)** để tối ưu hóa tốc độ suy luận và cho phép triển khai đa nền tảng.
- **Quản lý phiên bản mô hình (Model Registry)**: Đặt tên tệp trọng số lưu trữ theo cấu trúc: `model_[tên_mô_hình]_[độ_chính_xác]_[ngày_xuất].onnx` (ví dụ: `model_resnet50_acc93.2_20260616.onnx`).
