class ChatWithAiUseCase {
  constructor({ lessonRepository, auditLogRepository, aiService }) {
    this.lessonRepository = lessonRepository;
    this.auditLogRepository = auditLogRepository;
    this.aiService = aiService;
  }

  async execute({ lessonId, userId, message, history }) {
    const lesson = await this.lessonRepository.findById(lessonId);
    if (!lesson) {
      throw new Error('Không tìm thấy bài giảng làm ngữ cảnh.');
    }

    const answer = await this.aiService.answer(lesson, message, history);

    await this.auditLogRepository.log(userId, 'AI_CHAT_ASSISTANT', { 
      lesson_id: lessonId, 
      message_length: message.length 
    });

    return answer;
  }
}

module.exports = ChatWithAiUseCase;
