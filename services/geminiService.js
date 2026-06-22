const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Khởi tạo thực thể Gemini API nếu khóa có tồn tại
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Hàm trợ giúp làm sạch văn bản phản hồi JSON từ AI (loại bỏ markdown code block)
 * @param {string} rawText - Phản hồi thô từ Gemini
 * @returns {string} - Chuỗi JSON sạch
 */
function cleanJsonResponse(rawText) {
  let cleaned = rawText.trim();
  // Loại bỏ các thẻ bao ```json và ``` nếu có
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

module.exports = {
  /**
   * Tóm tắt bài học ngắn gọn, tập trung vào các ý chính quan trọng
   * @param {string} lessonTitle - Tiêu đề bài học
   * @param {string} lessonContent - Nội dung chi tiết của bài học
   * @returns {Promise<string>} - Chuỗi markdown chứa nội dung tóm tắt bằng tiếng Việt
   */
  summarizeLesson: async (lessonTitle, lessonContent) => {
    if (!genAI) {
      return '> [!WARNING]\n> Gemini API Key chưa được thiết lập. Không thể sử dụng tính năng tóm tắt tự động bằng AI.';
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
        Bạn là Trợ lý Học tập AI dành cho doanh nghiệp nội bộ.
        Hãy tóm tắt ngắn gọn bài học sau đây bằng Tiếng Việt.
        Tiêu đề: ${lessonTitle}
        Nội dung: ${lessonContent}
        
        Yêu cầu:
        1. Sử dụng định dạng Markdown đẹp (gạch đầu dòng, tô đậm ý chính).
        2. Tóm tắt súc tích, chỉ ra 3-5 điểm cốt lõi nhất cần nhớ.
        3. Không viết lan man, tập trung vào thực tế áp dụng.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error('[Gemini Service] Lỗi tóm tắt bài học:', err);
      return `> [!CAUTION]\n> Không thể tóm tắt bài giảng do lỗi kết nối AI: ${err.message}`;
    }
  },

  /**
   * Trả lời câu hỏi của học viên dựa trên ngữ cảnh nội dung bài học
   * @param {string} lessonTitle - Tiêu đề bài học
   * @param {string} lessonContent - Nội dung bài học làm ngữ cảnh
   * @param {string} userQuestion - Câu hỏi của học viên
   * @param {Array} history - Lịch sử trò chuyện trước đó (nếu có)
   * @returns {Promise<string>} - Câu trả lời chi tiết dạng Markdown bằng tiếng Việt
   */
  answerQuestion: async (lessonTitle, lessonContent, userQuestion, history = []) => {
    if (!genAI) {
      return 'Trợ lý AI chưa sẵn sàng do thiếu cấu hình API Key. Vui lòng liên hệ Admin hệ thống.';
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Xây dựng ngữ cảnh học tập
      const systemContext = `
        Bạn là một Trợ lý AI học tập chuyên nghiệp tích hợp trong hệ thống LMS nội bộ của công ty.
        Nhiệm vụ của bạn là giải thích bài học và trả lời câu hỏi của nhân viên dựa trên bài học dưới đây:
        
        BÀI HỌC: "${lessonTitle}"
        NỘI DUNG BÀI HỌC:
        ${lessonContent}
        
        QUY TẮC TRẢ LỜI:
        1. Câu trả lời phải lịch sự, chuyên nghiệp, xưng hô là "Trợ lý AI" và "Bạn".
        2. Trả lời bằng TIẾNG VIỆT, sử dụng định dạng Markdown rõ ràng.
        3. Nếu câu hỏi KHÔNG liên quan đến bài học, hãy trả lời khéo léo để nhắc họ tập trung vào bài học này, nhưng vẫn có thể giải thích ngắn gọn nếu đó là kiến thức công nghệ/chuyên môn liên quan.
        4. Tránh bịa đặt thông tin không có trong tài liệu.
      `;

      // Tạo hội thoại kèm lịch sử nếu có
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        systemInstruction: systemContext
      });

      const result = await chat.sendMessage(userQuestion);
      return result.response.text();
    } catch (err) {
      console.error('[Gemini Service] Lỗi trả lời câu hỏi AI:', err);
      return `Rất tiếc, Trợ lý AI gặp lỗi khi xử lý câu hỏi của bạn: ${err.message}`;
    }
  },

  /**
   * Tự động tạo câu hỏi trắc nghiệm ôn tập (3 câu) dựa trên nội dung bài giảng
   * @param {string} lessonTitle - Tiêu đề bài học
   * @param {string} lessonContent - Nội dung chi tiết làm nguồn đề
   * @returns {Promise<Array>} - Mảng JSON chứa các câu hỏi trắc nghiệm
   */
  generateQuiz: async (lessonTitle, lessonContent) => {
    if (!genAI) {
      throw new Error('Gemini API Key chưa được cấu hình.');
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
        Bạn là một chuyên gia L&D thiết kế câu hỏi trắc nghiệm ôn tập.
        Dựa vào bài học sau đây, hãy sinh ra 3 câu hỏi trắc nghiệm (multiple choice) để kiểm tra kiến thức nhân viên:
        
        Tiêu đề bài học: ${lessonTitle}
        Nội dung: ${lessonContent}
        
        YÊU CẦU ĐẦU RA BẮT BUỘC:
        1. Trả về kết quả DẠNG MẢNG JSON duy nhất (JSON array). Không thêm bất kỳ văn bản giải thích nào trước hoặc sau khối JSON.
        2. Cấu trúc mỗi phần tử trong mảng JSON phải đúng 100% như sau:
        {
          "question_text": "Chuỗi chứa câu hỏi kiểm tra",
          "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
          "correct_answer": "Phải khớp chính xác hoàn toàn với 1 trong 4 lựa chọn trong mảng options"
        }
        3. Nội dung câu hỏi phải bám sát bài học, có độ khó phù hợp với thực tế công việc.
      `;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const cleanJson = cleanJsonResponse(rawText);
      
      const quizQuestions = JSON.parse(cleanJson);
      if (!Array.isArray(quizQuestions)) {
        throw new Error('Đầu ra của AI không phải là một mảng.');
      }
      return quizQuestions;
    } catch (err) {
      console.error('[Gemini Service] Lỗi sinh câu hỏi trắc nghiệm:', err);
      // Trả về bộ câu hỏi fallback nếu gặp sự cố kết nối/parse
      return [
        {
          question_text: `Câu hỏi ôn tập nhanh cho bài học: ${lessonTitle}?`,
          options: ["Đáp án Đúng", "Đáp án Sai 1", "Đáp án Sai 2", "Đáp án Sai 3"],
          correct_answer: "Đáp án Đúng"
        }
      ];
    }
  }
};
