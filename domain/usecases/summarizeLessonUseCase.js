class SummarizeLessonUseCase {
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
    
    // Kiểm tra tính hợp lệ của học liệu thông qua phương thức nghiệp vụ của Entity
    if (!lesson.hasValidLearningMaterial()) {
      return 'Bài học hiện chưa có nội dung tài liệu hoặc video chi tiết để trợ lý AI thực hiện tóm tắt. Vui lòng bổ sung học liệu dạng văn bản hoặc tải lên video bài giảng.';
    }

    const summary = await this.aiService.summarize(lesson);

    await this.auditLogRepository.log(userId, 'AI_SUMMARIZE_LESSON', { lesson_id: lessonId });

    return summary;
  }
}

module.exports = SummarizeLessonUseCase;
