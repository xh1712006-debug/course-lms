# Chiến lược Kiểm chứng & Kiểm thử (Validation & Testing Specification)

Tài liệu này đặc tả quy trình kiểm chứng tính đúng đắn toán học của thuật toán và đánh giá hiệu năng mô hình một cách khoa học.

## 1. Chiến lược Phân chia Dữ liệu (Validation Strategy)

Để đảm bảo mô hình không bị quá khớp (overfitting) và có khả năng tổng quát hóa tốt, dữ liệu được phân chia theo cấu trúc sau:

```text
+-------------------------------------------------------+
|                 Toàn bộ Tập Dữ liệu                   |
+-------------------------------------------------------+
|   Huấn luyện (Train) 70%  |  Validation 15% | Test 15%|
+-------------------------------------------------------+
```

- **Tập Validation**: Dùng để điều chỉnh siêu tham số (Hyperparameter tuning) và chọn cấu hình mô hình tối ưu trong quá trình thử nghiệm.
- **Tập Test**: Dùng để đánh giá hiệu năng cuối cùng. Tập này hoàn toàn độc lập và không được xuất hiện trong quá trình huấn luyện hoặc chọn siêu tham số.
- **Cross-Validation (Kiểm chứng chéo)**: Đối với các tập dữ liệu nhỏ, bắt buộc áp dụng kỹ thuật K-Fold Cross-Validation (với $K=5$ hoặc $K=10$) để báo cáo sai số trung bình ổn định hơn.

## 2. Các Ca Kiểm thử Logic Toán học (Mathematical Edge Cases)

Các unit test phải bao phủ các ca kiểm thử toán học đặc thù để tránh lỗi run-time:
- **Đầu vào toàn số 0 (Zero inputs)**: Đảm bảo thuật toán không bị lỗi chia cho 0.
- **Giá trị khuyết hoặc NaN/Inf**: Đảm bảo lớp tiền xử lý dữ liệu phát hiện và xử lý được dữ liệu lỗi trước khi đẩy vào mô hình.
- **Độ tương thích kích thước (Shape checks)**: Kiểm tra tính đúng đắn của các phép nhân ma trận (ví dụ: đảm bảo ma trận đầu vào nhân được với ma trận trọng số).

## 3. Chỉ số Hiệu năng Mục tiêu (Target Metrics)
Các thực nghiệm phải ghi nhận rõ các chỉ số đánh giá tùy thuộc vào bài toán:
- **Bài toán Phân loại (Classification)**: Accuracy, Precision, Recall, F1-score, AUC-ROC.
- **Bài toán Dự báo (Regression)**: Mean Squared Error (MSE), Root Mean Squared Error (RMSE), Mean Absolute Error (MAE), R-squared ($R^2$).
- **Thời gian xử lý**: Ghi nhận thời gian huấn luyện và thời gian suy luận (Inference time per sample) để tối ưu hiệu năng chạy thực tế.
