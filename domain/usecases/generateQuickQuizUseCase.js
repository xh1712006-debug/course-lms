class GenerateQuickQuizUseCase {
  constructor({ lessonRepository, auditLogRepository, aiService }) {
    this.lessonRepository = lessonRepository;
    this.auditLogRepository = auditLogRepository;
    this.aiService = aiService;
  }

  async execute(lessonId, userId) {
    const lesson = await this.lessonRepository.findById(lessonId);
    if (!lesson) {
      throw new Error('Không tìm thấy bài giảng.');
    }

    const questions = await this.aiService.generateQuiz(lesson);

    await this.auditLogRepository.log(userId, 'AI_GENERATE_QUICK_QUIZ', { lesson_id: lessonId });

    return questions;
  }
}

module.exports = GenerateQuickQuizUseCase;
