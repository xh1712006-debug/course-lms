const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
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

const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite'
];

async function generateContentWithFallback(prompt) {
  let lastError = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`[Gemini Service] Đang thử gọi mô hình: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      console.warn(`[Gemini Service] Gọi mô hình ${modelName} thất bại: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error('Không thể kết nối đến bất kỳ mô hình Gemini nào.');
}

async function startChatWithFallback(history, systemInstruction, userQuestion) {
  let lastError = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`[Gemini Service] Đang bắt đầu chat bằng mô hình: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        systemInstruction: systemInstruction
      });
      const result = await chat.sendMessage(userQuestion);
      return result;
    } catch (err) {
      console.warn(`[Gemini Service] Chat bằng mô hình ${modelName} thất bại: ${err.message}`);
      lastError = err;
    }
  }
  throw lastError || new Error('Không thể chat bằng bất kỳ mô hình Gemini nào.');
}

async function getYouTubeVideoTitle(videoUrl) {
  if (!videoUrl) return null;
  const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  if (!isYouTube) return null;
  try {
    const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      return data.title;
    }
  } catch (err) {
    console.warn(`[Gemini Service] Không lấy được tiêu đề YouTube qua oembed: ${err.message}`);
  }
  return null;
}

module.exports = {
  /**
   * Tóm tắt bài học ngắn gọn, tập trung vào các ý chính quan trọng
   * @param {string} lessonTitle - Tiêu đề bài học
   * @param {string} lessonContent - Nội dung chi tiết của bài học
   * @returns {Promise<string>} - Chuỗi markdown chứa nội dung tóm tắt bằng tiếng Việt
   */
  summarizeLesson: async (lessonTitle, lessonContent, videoUrl = null, attachmentUrl = null) => {
    if (!genAI) {
      return '> [!WARNING]\n> Gemini API Key chưa được thiết lập. Không thể sử dụng tính năng tóm tắt tự động bằng AI.';
    }

    const hasContent = lessonContent && lessonContent.trim() !== '';
    const hasVideo = videoUrl && videoUrl.trim() !== '';
    const hasAttachment = attachmentUrl && attachmentUrl.trim() !== '';

    if (!hasContent && !hasVideo && !hasAttachment) {
      return 'Bài học hiện chưa có nội dung tài liệu hoặc video chi tiết để trợ lý AI thực hiện tóm tắt. Vui lòng bổ sung học liệu dạng văn bản hoặc tải lên video bài giảng.';
    }

    try {
      const parts = [];
      let promptText = `
        Bạn là Trợ lý Học tập AI dành cho doanh nghiệp nội bộ.
        Hãy tóm tắt ngắn gọn bài học sau đây bằng Tiếng Việt.
        Tiêu đề bài học: ${lessonTitle}
      `;

      if (hasContent) {
        promptText += `\nNội dung bài học dạng văn bản:\n${lessonContent}\n`;
      }

      let videoPart = null;
      if (hasVideo) {
        if (videoUrl.startsWith('/uploads/')) {
          const localFilePath = path.join(__dirname, '..', 'public', videoUrl);
          if (fs.existsSync(localFilePath)) {
            const stats = fs.statSync(localFilePath);
            // Giới hạn gửi trực tiếp dưới 20MB để tránh tràn bộ nhớ và quá giới hạn API
            if (stats.size < 20 * 1024 * 1024) {
              console.log(`[Gemini Service] Đang nạp video cục bộ để gửi kèm AI (${(stats.size/1024/1024).toFixed(2)} MB): ${localFilePath}`);
              const videoData = fs.readFileSync(localFilePath);
              const ext = path.extname(localFilePath).toLowerCase();
              let mimeType = 'video/mp4';
              if (ext === '.webm') mimeType = 'video/webm';
              else if (ext === '.ogg') mimeType = 'video/ogg';

              videoPart = {
                inlineData: {
                  data: videoData.toString('base64'),
                  mimeType: mimeType
                }
              };
              promptText += `\nTôi đã gửi kèm tệp video thực tế của bài học này. Hãy phân tích hình ảnh và âm thanh trong video này để tóm tắt chính xác nội dung bài học.\n`;
            } else {
              promptText += `\nLưu ý: Bài học có video cục bộ nằm tại "${videoUrl}" nhưng dung lượng quá lớn (${(stats.size/1024/1024).toFixed(2)} MB), không thể gửi kèm trực tiếp cho AI phân tích.\n`;
            }
          }
        } else {
          const youtubeTitle = await getYouTubeVideoTitle(videoUrl);
          if (youtubeTitle) {
            promptText += `\nĐường dẫn Video bài giảng (YouTube hoặc liên kết ngoài): ${videoUrl}\nTiêu đề video YouTube: "${youtubeTitle}"\n`;
          } else {
            promptText += `\nĐường dẫn Video bài giảng (YouTube hoặc liên kết ngoài): ${videoUrl}\n`;
          }
        }
      }

      let attachmentPart = null;
      if (hasAttachment) {
        if (attachmentUrl.startsWith('/uploads/')) {
          const localFilePath = path.join(__dirname, '..', 'public', attachmentUrl);
          if (fs.existsSync(localFilePath)) {
            const stats = fs.statSync(localFilePath);
            // Giới hạn gửi trực tiếp dưới 20MB
            if (stats.size < 20 * 1024 * 1024) {
              const ext = path.extname(localFilePath).toLowerCase();
              const SUPPORTED_MIME_TYPES = {
                '.pdf': 'application/pdf',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.heic': 'image/heic',
                '.heif': 'image/heif',
                '.txt': 'text/plain',
                '.csv': 'text/csv',
                '.html': 'text/html',
                '.htm': 'text/html',
                '.xml': 'text/xml',
                '.js': 'text/javascript',
                '.json': 'application/json',
                '.css': 'text/css',
                '.md': 'text/markdown'
              };

              const mimeType = SUPPORTED_MIME_TYPES[ext];
              if (mimeType) {
                console.log(`[Gemini Service] Đang nạp tài liệu cục bộ để gửi kèm AI (${(stats.size/1024/1024).toFixed(2)} MB): ${localFilePath}`);
                const attachmentData = fs.readFileSync(localFilePath);
                attachmentPart = {
                  inlineData: {
                    data: attachmentData.toString('base64'),
                    mimeType: mimeType
                  }
                };
                promptText += `\nTôi đã gửi kèm tệp tài liệu thực tế của bài học này (định dạng ${mimeType}). Hãy đọc và phân tích kỹ tài liệu này để tóm tắt chính xác nội dung bài học.\n`;
              } else {
                promptText += `\nLưu ý: Bài học có tài liệu đính kèm tên là "${path.basename(localFilePath)}" tại "${attachmentUrl}" nhưng định dạng này không hỗ trợ gửi trực tiếp dưới dạng inline data cho AI.\n`;
              }
            } else {
              promptText += `\nLưu ý: Bài học có tài liệu đính kèm tại "${attachmentUrl}" nhưng dung lượng quá lớn (${(stats.size/1024/1024).toFixed(2)} MB), không thể gửi kèm trực tiếp cho AI phân tích.\n`;
            }
          }
        } else {
          promptText += `\nĐường dẫn Tài liệu đính kèm (liên kết ngoài): ${attachmentUrl}\n`;
        }
      }

      promptText += `
        Yêu cầu tóm tắt:
        1. Sử dụng định dạng Markdown đẹp (gạch đầu dòng, tô đậm ý chính).
        2. Tóm tắt súc tích, chỉ ra 3-5 điểm cốt lõi nhất cần nhớ.
        3. Không viết lan man, tập trung vào thực tế áp dụng.
        4. QUY TẮC BẮT BUỘC: Bạn phải tóm tắt dựa trên NỘI DUNG VĂN BẢN, TÀI LIỆU ĐÍNH KÈM, NỘI DUNG VIDEO ĐƯỢC GỬI KÈM hoặc ĐƯỜNG DẪN VIDEO BÊN NGOÀI.
           - Nếu có đường dẫn video bài giảng bên ngoài (như YouTube), hãy sử dụng thông tin từ tiêu đề bài học, tiêu đề video (nếu có) cùng kiến thức chuyên môn của bạn về chủ đề này để tạo ra một bản tóm tắt kiến thức lý thuyết cốt lõi tổng quan tương ứng, đồng thời nhắc nhở học viên truy cập đường dẫn video ngoài để xem chi tiết bài học.
           - Chỉ khi nào hoàn toàn không có bất kỳ nguồn học liệu nào (cả nội dung văn bản, tài liệu gửi kèm, video gửi kèm và đường dẫn video ngoài đều trống hoặc không hợp lệ), bạn mới phản hồi bằng Tiếng Việt rằng: "Bài học hiện chưa có nội dung tài liệu hoặc video chi tiết để trợ lý AI thực hiện tóm tắt. Vui lòng bổ sung học liệu dạng văn bản hoặc tải lên video bài giảng."
        5. QUY TẮC CÔNG THỨC TOÁN: Khi sử dụng ký hiệu toán học hoặc công thức LaTeX (như Delta, phân số, nghiệm số), bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn và không có khoảng trắng sau dấu gạch chéo ngược (ví dụ: viết $\\Delta$ hoặc $\\Delta'$, tuyệt đối không viết $\\ Delta$ hoặc $\\ Delta'$).
      `;

      parts.push(promptText);
      if (videoPart) {
        parts.push(videoPart);
      }
      if (attachmentPart) {
        parts.push(attachmentPart);
      }

      const result = await generateContentWithFallback(parts);
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
        5. QUY TẮC CÔNG THỨC TOÁN: Khi sử dụng ký hiệu toán học hoặc công thức LaTeX, bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn trong cặp dấu đô la $...$ hoặc $$...$$. Tuyệt đối không được thêm khoảng trắng sau dấu gạch chéo ngược (ví dụ: viết $\\Delta$, không được viết $\\ Delta$).
      `;

      const result = await startChatWithFallback(history, systemContext, userQuestion);
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
        4. QUY TẮC CÔNG THỨC TOÁN: Nếu câu hỏi hoặc đáp án có chứa ký hiệu toán học hoặc công thức LaTeX, bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn trong cặp dấu $...$ (ví dụ: viết $\\Delta$, không viết $\\ Delta$).
      `;

      const result = await generateContentWithFallback(prompt);
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
  },

  /**
   * Tự động tạo bài kiểm tra gồm 10 câu hỏi dựa trên nội dung tổng hợp của nhiều bài học
   */
  generateLessonQuiz: async (quizTitle, combinedContent, count = 10) => {
    if (!genAI) {
      throw new Error('Gemini API Key chưa được cấu hình.');
    }

    try {
      const prompt = `
        Bạn là một chuyên gia L&D thiết kế câu hỏi trắc nghiệm ôn tập cho nhân sự doanh nghiệp.
        Dựa vào nội dung các bài học dưới đây, hãy sinh ra đúng ${count} câu hỏi trắc nghiệm (multiple choice) để kiểm tra kiến thức nhân viên:
        
        Tiêu đề bài kiểm tra: ${quizTitle}
        Nội dung các bài học trước đó:
        ${combinedContent}
        
        YÊU CẦU ĐẦU RA BẮT BUỘC:
        1. Trả về kết quả DẠNG MẢNG JSON duy nhất (JSON array). Không thêm bất kỳ văn bản giải thích nào trước hoặc sau khối JSON.
        2. Cấu trúc mỗi phần tử trong mảng JSON phải đúng 100% như sau:
        {
          "question_text": "Chuỗi chứa câu hỏi kiểm tra",
          "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
          "correct_answer": "Phải khớp chính xác hoàn toàn với 1 trong 4 lựa chọn trong mảng options"
        }
        3. Nội dung câu hỏi phải bám sát nội dung bài học được cung cấp, có độ khó phù hợp với thực tế công việc.
        4. QUY TẮC CÔNG THỨC TOÁN: Nếu câu hỏi hoặc đáp án có chứa ký hiệu toán học hoặc công thức LaTeX, bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn trong cặp dấu $...$ (ví dụ: viết $\\Delta$, không viết $\\ Delta$).
      `;

      const result = await generateContentWithFallback(prompt);
      const rawText = result.response.text();
      const cleanJson = cleanJsonResponse(rawText);
      
      const quizQuestions = JSON.parse(cleanJson);
      if (!Array.isArray(quizQuestions)) {
        throw new Error('Đầu ra của AI không phải là một mảng.');
      }
      return quizQuestions;
    } catch (err) {
      console.error('[Gemini Service] Lỗi sinh câu hỏi trắc nghiệm bài giảng:', err);
      const fallbackQuestions = [];
      for (let i = 1; i <= count; i++) {
        fallbackQuestions.push({
          question_text: `Câu hỏi kiểm tra số ${i} cho bài học: ${quizTitle}?`,
          options: ["Đáp án Đúng", "Đáp án Sai 1", "Đáp án Sai 2", "Đáp án Sai 3"],
          correct_answer: "Đáp án Đúng"
        });
      }
      return fallbackQuestions;
    }
  }
};
