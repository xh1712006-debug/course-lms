# Hướng dẫn Phát triển cho Antigravity AI - Dự án Khoa học (Nội bộ Công ty)

## Triết lý Cốt lõi

- **Yêu cầu là số 1**: Luôn đối chiếu với [PROJECT_REQUIREMENTS.md](file:///d:/antigravity/hocp1/PROJECT_REQUIREMENTS.md) để nắm bắt giả thuyết khoa học, mục tiêu nghiên cứu và tiêu chuẩn đánh giá.
- **Độ chính xác & Tái lập (Accuracy & Reproducibility)**: Các thuật toán, mô hình và tiền xử lý dữ liệu phải được thiết kế chính xác về mặt toán học và có khả năng tái lập kết quả 100% trên cùng một bộ siêu tham số.
- **Kiến trúc đồng nhất**: Tuân thủ thiết kế kỹ thuật mô hình và phân tách luồng dữ liệu được định nghĩa trong [docs/cores/02-scientific-models.md](file:///d:/antigravity/hocp1/docs/cores/02-scientific-models.md).
- **An toàn Dữ liệu (Data Confidentiality)**: Dữ liệu nghiên cứu của công ty là tài sản tuyệt mật. Tuyệt đối không hardcode API key, không ghi log dữ liệu thô nhạy cảm, và không đẩy lên các kho lưu trữ công cộng.

## Quy tắc & Tiêu chuẩn Dự án

- **Tài liệu chi tiết**: Các hướng dẫn sâu hơn về dữ liệu, mô hình và thử nghiệm được lưu trong thư mục `docs/cores/`.
- **Luật riêng cho Agent**: Các quy định cụ thể về chú thích, bảo mật dữ liệu và kiến trúc thuật toán nằm tại `.antigravity/rules/`:
  - Quy tắc chú thích thuật toán bằng tiếng Việt: [comment.md](file:///d:/antigravity/hocp1/.antigravity/rules/comment.md).
- **Đặc tả thực nghiệm**: Mỗi thử nghiệm hoặc nhiệm vụ mới bắt buộc phải có một tệp đặc tả riêng dựa trên [00-experiment-spec-template.md](file:///d:/antigravity/hocp1/docs/features/00-experiment-spec-template.md) để theo dõi tiến trình và ghi nhận kết quả thực tế.

## Kỹ năng & Lệnh (Skills & Commands)

- **Quy trình Phát triển**: Luôn tuân thủ quy trình 4 bước **Generate - Review - Test - Push** được định nghĩa tại [workflow.md](file:///d:/antigravity/hocp1/.antigravity/skills/workflow.md). Xem chi tiết từng kỹ năng:
  - [Generate Skill (Xây dựng mô hình & Viết mã)](file:///d:/antigravity/hocp1/.antigravity/skills/lifecycles/01-generate.md)
  - [Review Skill (Kiểm chứng khoa học & Rà soát)](file:///d:/antigravity/hocp1/.antigravity/skills/lifecycles/02-review.md)
  - [Test Skill (Thử nghiệm & Đánh giá)](file:///d:/antigravity/hocp1/.antigravity/skills/lifecycles/03-test.md)
  - [Push Skill (Lưu trữ nội bộ & Ghi nhận kết quả)](file:///d:/antigravity/hocp1/.antigravity/skills/lifecycles/04-push.md)
- Tham khảo thư mục `.antigravity/skills` để sử dụng các kỹ năng và luồng công việc (workflow) nâng cao.
