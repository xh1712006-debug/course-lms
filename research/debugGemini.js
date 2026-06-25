const geminiService = require('../services/geminiService');

async function test() {
  try {
    console.log("=== BẮT ĐẦU CHẠY THỬ NGHIỆM TRUY VẤN GEMINI ===");
    const questions = await geminiService.generateAssessment("Test github", [{
      courseTitle: "khoá học làm việc với github",
      lessons: [{ 
        title: "giới thiệu về github", 
        content: "Github là một dịch vụ lưu trữ mã nguồn Git dựa trên đám mây. Nó cho phép các lập trình viên cộng tác làm việc cùng nhau từ khắp nơi trên thế giới. Git là một hệ thống quản lý phiên bản phân tán." 
      }]
    }], 5);
    console.log("=== KẾT QUẢ SINH CÂU HỎI CHUẨN ===");
    console.log(JSON.stringify(questions, null, 2));
  } catch (err) {
    console.error("=== LỖI KHI TRUY VẤN GEMINI ===");
    console.error(err);
  }
}

test();
