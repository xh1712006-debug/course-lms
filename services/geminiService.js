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

async function startChatWithFallback(formattedHistory, systemInstruction, messageParts) {
  let lastError = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`[Gemini Service] Đang bắt đầu chat bằng mô hình: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: formattedHistory,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }]
        }
      });
      const result = await chat.sendMessage(messageParts);
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

/**
 * Trích xuất tệp video và tài liệu đính kèm cục bộ dưới dạng inlineData cho Gemini
 */
async function getLessonMediaParts(videoUrl, attachmentUrl) {
  const mediaParts = {
    videoPart: null,
    attachmentPart: null,
    videoPromptText: '',
    attachmentPromptText: ''
  };

  const hasVideo = videoUrl && videoUrl.trim() !== '';
  const hasAttachment = attachmentUrl && attachmentUrl.trim() !== '';

  if (hasVideo) {
    if (videoUrl.startsWith('/uploads/')) {
      const localFilePath = path.join(__dirname, '..', 'public', videoUrl);
      if (fs.existsSync(localFilePath)) {
        const stats = fs.statSync(localFilePath);
        if (stats.size < 20 * 1024 * 1024) {
          console.log(`[Gemini Service] Đang nạp video cục bộ để gửi kèm AI (${(stats.size/1024/1024).toFixed(2)} MB): ${localFilePath}`);
          const videoData = fs.readFileSync(localFilePath);
          const ext = path.extname(localFilePath).toLowerCase();
          let mimeType = 'video/mp4';
          if (ext === '.webm') mimeType = 'video/webm';
          else if (ext === '.ogg') mimeType = 'video/ogg';

          mediaParts.videoPart = {
            inlineData: {
              data: videoData.toString('base64'),
              mimeType: mimeType
            }
          };
          mediaParts.videoPromptText = `\nTôi đã gửi kèm tệp video thực tế của bài học này. Hãy phân tích hình ảnh và âm thanh trong video này để trả lời chính xác các câu hỏi liên quan đến nội dung bài học.\n`;
        } else {
          mediaParts.videoPromptText = `\nLưu ý: Bài học có video cục bộ nằm tại "${videoUrl}" nhưng dung lượng quá lớn (${(stats.size/1024/1024).toFixed(2)} MB), không thể gửi kèm trực tiếp cho AI phân tích.\n`;
        }
      }
    } else {
      const youtubeTitle = await getYouTubeVideoTitle(videoUrl);
      if (youtubeTitle) {
        mediaParts.videoPromptText = `\nĐường dẫn Video bài giảng (YouTube hoặc liên kết ngoài): ${videoUrl}\nTiêu đề video YouTube: "${youtubeTitle}"\n`;
      } else {
        mediaParts.videoPromptText = `\nĐường dẫn Video bài giảng (YouTube hoặc liên kết ngoài): ${videoUrl}\n`;
      }
    }
  }

  if (hasAttachment) {
    if (attachmentUrl.startsWith('/uploads/')) {
      const localFilePath = path.join(__dirname, '..', 'public', attachmentUrl);
      if (fs.existsSync(localFilePath)) {
        const stats = fs.statSync(localFilePath);
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
            mediaParts.attachmentPart = {
              inlineData: {
                data: attachmentData.toString('base64'),
                mimeType: mimeType
              }
            };
            mediaParts.attachmentPromptText = `\nTôi đã gửi kèm tệp tài liệu thực tế của bài học này (định dạng ${mimeType}). Hãy đọc và phân tích kỹ tài liệu này để trả lời chính xác các câu hỏi liên quan đến nội dung bài học.\n`;
          } else {
            mediaParts.attachmentPromptText = `\nLưu ý: Bài học có tài liệu đính kèm tên là "${path.basename(localFilePath)}" tại "${attachmentUrl}" nhưng định dạng này không hỗ trợ gửi trực tiếp dưới dạng inline data cho AI.\n`;
          }
        } else {
          mediaParts.attachmentPromptText = `\nLưu ý: Bài học có tài liệu đính kèm tại "${attachmentUrl}" nhưng dung lượng quá lớn (${(stats.size/1024/1024).toFixed(2)} MB), không thể gửi kèm trực tiếp cho AI phân tích.\n`;
        }
      }
    } else {
      mediaParts.attachmentPromptText = `\nĐường dẫn Tài liệu đính kèm (liên kết ngoài): ${attachmentUrl}\n`;
    }
  }

  return mediaParts;
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
      const mediaParts = await getLessonMediaParts(videoUrl, attachmentUrl);
      const parts = [];
      let promptText = `
        Bạn là Trợ lý Học tập AI dành cho doanh nghiệp nội bộ.
        Hãy tóm tắt ngắn gọn bài học sau đây bằng Tiếng Việt.
        Tiêu đề bài học: ${lessonTitle}
      `;

      if (hasContent) {
        promptText += `\nNội dung bài học dạng văn bản:\n${lessonContent}\n`;
      }

      promptText += mediaParts.videoPromptText;
      promptText += mediaParts.attachmentPromptText;

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
      if (mediaParts.videoPart) {
        parts.push(mediaParts.videoPart);
      }
      if (mediaParts.attachmentPart) {
        parts.push(mediaParts.attachmentPart);
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
  answerQuestion: async (lessonTitle, lessonContent, userQuestion, history = [], videoUrl = null, attachmentUrl = null) => {
    if (!genAI) {
      return 'Trợ lý AI chưa sẵn sàng do thiếu cấu hình API Key. Vui lòng liên hệ Admin hệ thống.';
    }

    try {
      const mediaParts = await getLessonMediaParts(videoUrl, attachmentUrl);
      
      // Xây dựng ngữ cảnh học tập
      let systemContext = `
        Bạn là một Trợ lý AI học tập chuyên nghiệp tích hợp trong hệ thống LMS nội bộ của công ty.
        Nhiệm vụ của bạn là giải thích bài học và trả lời câu hỏi của nhân viên dựa trên bài học dưới đây:
        
        BÀI HỌC: "${lessonTitle}"
      `;

      if (lessonContent && lessonContent.trim() !== '') {
        systemContext += `\nNỘI DUNG BÀI HỌC DẠNG VĂN BẢN:\n${lessonContent}\n`;
      }

      systemContext += mediaParts.videoPromptText;
      systemContext += mediaParts.attachmentPromptText;

      systemContext += `
        QUY TẮC TRẢ LỜI:
        1. Câu trả lời phải lịch sự, chuyên nghiệp, xưng hô là "Trợ lý AI" và "Bạn".
        2. Trả lời bằng TIẾNG VIỆT, sử dụng định dạng Markdown rõ ràng.
        3. Nếu câu hỏi KHÔNG liên quan đến bài học, hãy trả lời khéo léo để nhắc họ tập trung vào bài học này, nhưng vẫn có thể giải thích ngắn gọn nếu đó là kiến thức công nghệ/chuyên môn liên quan.
        4. Tránh bịa đặt thông tin không có trong tài liệu/video/đính kèm được cung cấp. Bạn có thể sử dụng thông tin từ video và tài liệu đính kèm đã gửi để trả lời câu hỏi.
        5. QUY TẮC CÔNG THỨC TOÁN: Khi sử dụng ký hiệu toán học hoặc công thức LaTeX, bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn trong cặp dấu đô la $...$ hoặc $$...$$. Tuyệt đối không được thêm khoảng trắng sau dấu gạch chéo ngược (ví dụ: viết $\\Delta$, không được viết $\\ Delta$).
      `;

      // Phân chia gửi tệp đính kèm trong chat
      const formattedHistory = [];
      let videoSent = false;
      let attachmentSent = false;

      for (let i = 0; i < history.length; i++) {
        const h = history[i];
        const role = h.role === 'user' ? 'user' : 'model';
        const parts = [{ text: h.content }];

        if (role === 'user' && !videoSent && !attachmentSent) {
          if (mediaParts.videoPart) {
            parts.push(mediaParts.videoPart);
            videoSent = true;
          }
          if (mediaParts.attachmentPart) {
            parts.push(mediaParts.attachmentPart);
            attachmentSent = true;
          }
        }
        formattedHistory.push({ role, parts });
      }

      const messageParts = [userQuestion];
      if (!videoSent && mediaParts.videoPart) {
        messageParts.push(mediaParts.videoPart);
      }
      if (!attachmentSent && mediaParts.attachmentPart) {
        messageParts.push(mediaParts.attachmentPart);
      }

      const result = await startChatWithFallback(formattedHistory, systemContext, messageParts);
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
  generateQuiz: async (lessonTitle, lessonContent, videoUrl = null, attachmentUrl = null) => {
    if (!genAI) {
      throw new Error('Gemini API Key chưa được cấu hình.');
    }

    try {
      const mediaParts = await getLessonMediaParts(videoUrl, attachmentUrl);
      const parts = [];
      let prompt = `
        Bạn là một chuyên gia L&D thiết kế câu hỏi trắc nghiệm ôn tập.
        Dựa vào bài học sau đây, hãy sinh ra 3 câu hỏi trắc nghiệm (multiple choice) để kiểm tra kiến thức nhân viên:
        
        Tiêu đề bài học: ${lessonTitle}
      `;

      if (lessonContent && lessonContent.trim() !== '') {
        prompt += `\nNội dung bài học dạng văn bản:\n${lessonContent}\n`;
      }

      prompt += mediaParts.videoPromptText;
      prompt += mediaParts.attachmentPromptText;

      prompt += `
        YÊU CẦU ĐẦU RA BẮT BUỘC:
        1. Trả về kết quả DẠNG MẢNG JSON duy nhất (JSON array). Không thêm bất kỳ văn bản giải thích nào trước hoặc sau khối JSON.
        2. Cấu trúc mỗi phần tử trong mảng JSON phải đúng 100% như sau:
        {
          "question_text": "Chuỗi chứa câu hỏi kiểm tra",
          "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
          "correct_answer": "Phải khớp chính xác hoàn toàn với 1 trong 4 lựa chọn trong mảng options"
        }
        3. Nội dung câu hỏi phải bám sát bài học (văn bản, video hoặc tài liệu đính kèm), có độ khó phù hợp với thực tế công việc.
        4. QUY TẮC CÔNG THỨC TOÁN: Nếu câu hỏi hoặc đáp án có chứa ký hiệu toán học hoặc công thức LaTeX, bạn BẮT BUỘC phải viết đúng định dạng LaTeX chuẩn trong cặp dấu $...$ (ví dụ: viết $\\Delta$, không viết $\\ Delta$).
      `;

      parts.push(prompt);
      if (mediaParts.videoPart) {
        parts.push(mediaParts.videoPart);
      }
      if (mediaParts.attachmentPart) {
        parts.push(mediaParts.attachmentPart);
      }

      const result = await generateContentWithFallback(parts);
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
        3. RÀNG BUỘC SỰ THẬT NGHIÊM NGẶT: Câu hỏi và tất cả các đáp án (bao gồm cả đáp án đúng và đáp án gây nhiễu) BẮT BUỘC phải dựa trực tiếp và hoàn toàn vào thông tin đã được nêu cụ thể trong "Nội dung các bài học trước đó" ở trên. Tuyệt đối KHÔNG suy diễn, tự giả định hoặc bổ sung bất kỳ kiến thức bên ngoài nào không có trong văn bản được cung cấp. Nếu tài liệu chứa các quy trình hoặc thuật ngữ nội bộ đặc thù, hãy kiểm tra chính xác các chi tiết đó.
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
  },

  /**
   * Sinh ~50 câu hỏi trắc nghiệm cho bài kiểm tra doanh nghiệp
   * Dựa trên nội dung tổng hợp từ nhiều khóa học được chọn
   * @param {string} assessmentTitle - Tiêu đề bài kiểm tra
   * @param {Array} coursesData - Mảng [{courseTitle, lessons: [{title, content}]}]
   * @param {number} count - Số câu hỏi cần sinh (mặc định 50)
   * @returns {Promise<Array>} - Mảng câu hỏi JSON
   */
  generateAssessment: async (assessmentTitle, coursesData, count = 50) => {
    if (!genAI) {
      throw new Error('Gemini API Key chưa được cấu hình. Vui lòng liên hệ Admin hệ thống.');
    }

    // Trích xuất danh sách tất cả các bài học có nội dung chữ
    const lessonsWithContent = [];
    for (const course of coursesData) {
      for (const lesson of course.lessons) {
        if (lesson.content && lesson.content.trim()) {
          lessonsWithContent.push({
            courseTitle: course.courseTitle,
            lessonTitle: lesson.title,
            content: lesson.content.trim()
          });
        }
      }
    }

    if (lessonsWithContent.length === 0) {
      throw new Error('Các khóa học được chọn chưa có nội dung bài học để AI có thể sinh câu hỏi.');
    }

    // Chia đều số lượng câu hỏi cho các bài học
    const totalLessons = lessonsWithContent.length;
    const baseCount = Math.floor(count / totalLessons);
    let remainder = count % totalLessons;

    const allocations = lessonsWithContent.map((l) => {
      let allocated = baseCount;
      if (remainder > 0) {
        allocated += 1;
        remainder -= 1;
      }
      return { ...l, allocatedCount: allocated };
    });

    console.log(`[Gemini Service] Phân chia sinh câu hỏi cho ${totalLessons} bài học. Tổng số câu hỏi yêu cầu: ${count}.`);

    // Hàm sinh câu hỏi cho một bài giảng đơn lẻ
    const generateForSingleLesson = async (courseTitle, lessonTitle, content, allocatedCount) => {
      const prompt = `
Bạn là một chuyên gia L&D (Learning & Development) thiết kế bài kiểm tra năng lực nhân sự cho doanh nghiệp.
Dựa vào nội dung bài học dưới đây thuộc khóa học "${courseTitle}", hãy sinh ra đúng ${allocatedCount} câu hỏi trắc nghiệm (multiple choice) chất lượng cao để đánh giá kiến thức nhân viên về riêng bài học này.

Tiêu đề bài học: "${lessonTitle}"

NỘI DUNG BÀI HỌC:
${content}

YÊU CẦU BẮT BUỘC:
1. Sinh ĐÚNG ${allocatedCount} câu hỏi, không nhiều hơn, không ít hơn.
2. RÀNG BUỘC SỰ THẬT NGHIÊM NGẶT: Câu hỏi và tất cả các lựa chọn đáp án (đúng/sai) BẮT BUỘC phải dựa trực tiếp và hoàn toàn vào thông tin đã được nêu cụ thể trong phần "NỘI DUNG BÀI HỌC" ở trên. Tuyệt đối KHÔNG suy diễn, tự giả định hoặc bổ sung bất kỳ kiến thức bên ngoài nào không có trong tài liệu nguồn. Nếu tài liệu chứa các chính sách, quy tắc hoặc thuật ngữ nội bộ đặc thù, hãy kiểm tra chính xác các chi tiết thực tế đó.
3. Mỗi câu có ĐÚNG 4 đáp án (A/B/C/D), chỉ 1 đáp án đúng.
4. Trả về KẾT QUẢ DUY NHẤT là một mảng JSON (JSON array), KHÔNG có văn bản giải thích trước/sau.
5. Cấu trúc mỗi phần tử:
{
  "question_text": "Nội dung câu hỏi",
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
  "correct_answer": "Phải khớp chính xác với 1 trong 4 options"
}
6. QUY TẮC LATEX: Công thức toán viết trong $...$ không có khoảng trắng sau backslash (ví dụ: $\\Delta$ đúng, $\\ Delta$ sai).
`;

      const result = await generateContentWithFallback(prompt);
      const rawText = result.response.text();
      const cleanJson = cleanJsonResponse(rawText);
      
      const questions = JSON.parse(cleanJson);
      if (!Array.isArray(questions)) {
        throw new Error('Đầu ra của AI không phải là mảng JSON hợp lệ.');
      }
      return questions;
    };

    // Chạy tuần tự quá trình tạo câu hỏi cho từng bài học để tránh Rate Limit (429/503)
    const allQuestions = [];
    const filteredAllocations = allocations.filter(l => l.allocatedCount > 0);

    for (let idx = 0; idx < filteredAllocations.length; idx++) {
      const l = filteredAllocations[idx];
      try {
        console.log(`[Gemini Service] [Bài học ${idx+1}/${filteredAllocations.length}] Đang sinh ${l.allocatedCount} câu hỏi cho bài: "${l.lessonTitle}"`);
        const resQuestions = await generateForSingleLesson(l.courseTitle, l.lessonTitle, l.content, l.allocatedCount);
        allQuestions.push(...resQuestions);
      } catch (err) {
        console.error(`[Gemini Service] Lỗi khi sinh câu hỏi cho bài "${l.lessonTitle}":`, err.message);
        // Fallback cục bộ cho bài giảng bị lỗi
        const fallback = [];
        for (let i = 1; i <= l.allocatedCount; i++) {
          fallback.push({
            question_text: `[Câu hỏi bài giảng: ${l.lessonTitle}] Câu hỏi trắc nghiệm kiểm tra nội dung bài giảng.`,
            options: ["Đáp án Đúng", "Đáp án Sai A", "Đáp án Sai B", "Đáp án Sai C"],
            correct_answer: "Đáp án Đúng"
          });
        }
        allQuestions.push(...fallback);
      }

      // Đợi 300ms giữa các bài giảng để tránh Rate Limit từ Gemini API
      if (idx < filteredAllocations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[Gemini Service] Tổng cộng đã sinh thành công ${allQuestions.length} câu hỏi cho bài kiểm tra "${assessmentTitle}"`);
    return allQuestions;
  }
};
