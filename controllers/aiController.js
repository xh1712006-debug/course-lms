const { Lesson, Quiz, Question, AuditLog } = require('../models/schema');
const geminiService = require('../services/geminiService');

module.exports = {
  // Trả về tóm tắt bài giảng bằng AI (Markdown format)
  summarizeLesson: async (req, res) => {
    const lessonId = parseInt(req.body.lessonId);

    try {
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: 'Không tìm thấy bài giảng.' });
      }

      // Gọi Gemini API để sinh nội dung tóm tắt
      const summaryMarkdown = await geminiService.summarizeLesson(lesson.title, lesson.content);

      // Ghi audit log hoạt động AI
      await AuditLog.create(req.session.userId, 'AI_SUMMARIZE_LESSON', { lesson_id: lessonId });

      res.json({ summary: summaryMarkdown });
    } catch (err) {
      console.error('[AI Controller] Lỗi tóm tắt bài học:', err);
      res.status(500).json({ error: 'Không thể tạo tóm tắt từ AI.' });
    }
  },

  // Hỏi đáp với trợ lý AI dựa trên bài học
  chatWithAI: async (req, res) => {
    const { lessonId, message, history } = req.body;

    try {
      const lesson = await Lesson.findById(parseInt(lessonId));
      if (!lesson) {
        return res.status(404).json({ error: 'Không tìm thấy bài giảng làm ngữ cảnh.' });
      }

      // Gọi Gemini API trả lời câu hỏi dựa trên nội dung bài học
      const aiResponse = await geminiService.answerQuestion(
        lesson.title,
        lesson.content,
        message,
        history || []
      );

      // Ghi nhật ký hoạt động
      await AuditLog.create(req.session.userId, 'AI_CHAT_ASSISTANT', { lesson_id: lessonId, message_length: message.length });

      res.json({ answer: aiResponse });
    } catch (err) {
      console.error('[AI Controller] Lỗi hỏi đáp AI:', err);
      res.status(500).json({ error: 'Gặp sự cố khi kết nối với máy chủ AI.' });
    }
  },

  // Tự sinh trắc nghiệm nhanh cho học viên ôn luyện trực tiếp
  generateLessonQuiz: async (req, res) => {
    const lessonId = parseInt(req.body.lessonId);

    try {
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: 'Không tìm thấy bài giảng.' });
      }

      // Gọi AI sinh 3 câu hỏi dưới dạng JSON Array
      const quizQuestions = await geminiService.generateQuiz(lesson.title, lesson.content);

      // Ghi nhật ký hoạt động
      await AuditLog.create(req.session.userId, 'AI_GENERATE_QUICK_QUIZ', { lesson_id: lessonId });

      res.json({ questions: quizQuestions });
    } catch (err) {
      console.error('[AI Controller] Lỗi sinh câu hỏi trắc nghiệm ôn tập:', err);
      res.status(500).json({ error: 'Không thể tự động sinh câu hỏi kiểm tra bằng AI.' });
    }
  },

  // Admin dùng AI để sinh câu hỏi trực tiếp vào Ngân hàng câu hỏi
  generateQuizToBank: async (req, res) => {
    const { lessonId, quizId } = req.body;

    // Yêu cầu quyền sửa ngân hàng câu hỏi
    if (!req.session.permissions.includes('QUIZ_BANK_MANAGE')) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý ngân hàng câu hỏi.' });
    }

    try {
      const lesson = await Lesson.findById(parseInt(lessonId));
      const quiz = await Quiz.findById(parseInt(quizId));

      if (!lesson || !quiz) {
        return res.status(404).json({ error: 'Không tìm thấy bài học hoặc đề thi chỉ định.' });
      }

      // Gọi AI sinh câu hỏi trắc nghiệm
      const generatedQuestions = await geminiService.generateQuiz(lesson.title, lesson.content);

      // Lưu các câu hỏi được sinh vào PostgreSQL CSDL
      const savedQuestions = [];
      for (let q of generatedQuestions) {
        const newQ = await Question.create(
          quiz.id,
          q.question_text,
          'multiple_choice',
          q.options,
          q.correct_answer
        );
        savedQuestions.push(newQ);
      }

      // Ghi nhật ký hoạt động
      await AuditLog.create(req.session.userId, 'AI_GENERATE_QUIZ_TO_BANK', { 
        lesson_id: lessonId, 
        quiz_id: quizId,
        questions_count: savedQuestions.length 
      });

      res.json({ 
        success: `Đã sinh thành công ${savedQuestions.length} câu hỏi từ bài giảng "${lesson.title}" và thêm vào đề thi "${quiz.title}".`,
        questions: savedQuestions 
      });
    } catch (err) {
      console.error('[AI Controller] Lỗi sinh câu hỏi đưa vào ngân hàng:', err);
      res.status(500).json({ error: 'Có lỗi xảy ra khi tự sinh câu hỏi đưa vào CSDL.' });
    }
  }
};
