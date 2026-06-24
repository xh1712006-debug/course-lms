const SummarizeLessonUseCase = require('../domain/usecases/summarizeLessonUseCase');
const ChatWithAiUseCase = require('../domain/usecases/chatWithAiUseCase');
const GenerateQuickQuizUseCase = require('../domain/usecases/generateQuickQuizUseCase');
const AddGeneratedQuizToBankUseCase = require('../domain/usecases/addGeneratedQuizToBankUseCase');

const PgLessonRepository = require('../infrastructure/repositories/lessonRepository');
const PgQuizRepository = require('../infrastructure/repositories/quizRepository');
const PgQuestionRepository = require('../infrastructure/repositories/questionRepository');
const PgAuditLogRepository = require('../infrastructure/repositories/auditLogRepository');
const GeminiAiService = require('../infrastructure/gateways/aiServiceGateway');

module.exports = {
  // Trả về tóm tắt bài giảng bằng AI (Markdown format)
  summarizeLesson: async (req, res) => {
    const lessonId = parseInt(req.body.lessonId);
    const userId = req.session.userId;

    try {
      const lessonRepository = new PgLessonRepository();
      const auditLogRepository = new PgAuditLogRepository();
      const aiService = new GeminiAiService();

      const useCase = new SummarizeLessonUseCase({
        lessonRepository,
        auditLogRepository,
        aiService
      });

      const summaryMarkdown = await useCase.execute(lessonId, userId);
      res.json({ summary: summaryMarkdown });
    } catch (err) {
      console.error('[AI Clean Architecture] Lỗi tóm tắt bài học:', err);
      res.status(500).json({ error: err.message || 'Không thể tạo tóm tắt từ AI.' });
    }
  },

  // Hỏi đáp với trợ lý AI dựa trên bài học
  chatWithAI: async (req, res) => {
    const { lessonId, message, history } = req.body;
    const userId = req.session.userId;

    try {
      const lessonRepository = new PgLessonRepository();
      const auditLogRepository = new PgAuditLogRepository();
      const aiService = new GeminiAiService();

      const useCase = new ChatWithAiUseCase({
        lessonRepository,
        auditLogRepository,
        aiService
      });

      const aiResponse = await useCase.execute({
        lessonId: parseInt(lessonId),
        userId,
        message,
        history: history || []
      });

      res.json({ answer: aiResponse });
    } catch (err) {
      console.error('[AI Clean Architecture] Lỗi hỏi đáp AI:', err);
      res.status(500).json({ error: err.message || 'Gặp sự cố khi kết nối với máy chủ AI.' });
    }
  },

  // Tự sinh trắc nghiệm nhanh cho học viên ôn luyện trực tiếp
  generateLessonQuiz: async (req, res) => {
    const lessonId = parseInt(req.body.lessonId);
    const userId = req.session.userId;

    try {
      const lessonRepository = new PgLessonRepository();
      const auditLogRepository = new PgAuditLogRepository();
      const aiService = new GeminiAiService();

      const useCase = new GenerateQuickQuizUseCase({
        lessonRepository,
        auditLogRepository,
        aiService
      });

      const quizQuestions = await useCase.execute(lessonId, userId);
      res.json({ questions: quizQuestions });
    } catch (err) {
      console.error('[AI Clean Architecture] Lỗi sinh câu hỏi trắc nghiệm ôn tập:', err);
      res.status(500).json({ error: err.message || 'Không thể tự động sinh câu hỏi kiểm tra bằng AI.' });
    }
  },

  // Admin dùng AI để sinh câu hỏi trực tiếp vào Ngân hàng câu hỏi
  generateQuizToBank: async (req, res) => {
    const { lessonId, quizId } = req.body;
    const userId = req.session.userId;

    // Yêu cầu quyền sửa ngân hàng câu hỏi
    if (!req.session.permissions.includes('QUIZ_BANK_MANAGE')) {
      return res.status(403).json({ error: 'Bạn không có quyền quản lý ngân hàng câu hỏi.' });
    }

    try {
      const lessonRepository = new PgLessonRepository();
      const quizRepository = new PgQuizRepository();
      const questionRepository = new PgQuestionRepository();
      const auditLogRepository = new PgAuditLogRepository();
      const aiService = new GeminiAiService();

      const useCase = new AddGeneratedQuizToBankUseCase({
        lessonRepository,
        quizRepository,
        questionRepository,
        auditLogRepository,
        aiService
      });

      const result = await useCase.execute({
        lessonId: parseInt(lessonId),
        quizId: parseInt(quizId),
        userId
      });

      res.json(result);
    } catch (err) {
      console.error('[AI Clean Architecture] Lỗi sinh câu hỏi đưa vào ngân hàng:', err);
      res.status(500).json({ error: err.message || 'Có lỗi xảy ra khi tự sinh câu hỏi đưa vào CSDL.' });
    }
  }
};
