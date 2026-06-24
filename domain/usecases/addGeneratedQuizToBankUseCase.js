class AddGeneratedQuizToBankUseCase {
  constructor({ lessonRepository, quizRepository, questionRepository, auditLogRepository, aiService }) {
    this.lessonRepository = lessonRepository;
    this.quizRepository = quizRepository;
    this.questionRepository = questionRepository;
    this.auditLogRepository = auditLogRepository;
    this.aiService = aiService;
  }

  async execute({ lessonId, quizId, userId }) {
    const lesson = await this.lessonRepository.findById(lessonId);
    const quiz = await this.quizRepository.findById(quizId);

    if (!lesson || !quiz) {
      throw new Error('Không tìm thấy bài học hoặc đề thi chỉ định.');
    }

    const generatedQuestions = await this.aiService.generateQuiz(lesson);

    const savedQuestions = [];
    for (let q of generatedQuestions) {
      const newQ = await this.questionRepository.create(
        quiz.id,
        q.question_text,
        'multiple_choice',
        q.options,
        q.correct_answer
      );
      savedQuestions.push(newQ);
    }

    await this.auditLogRepository.log(userId, 'AI_GENERATE_QUIZ_TO_BANK', {
      lesson_id: lessonId,
      quiz_id: quizId,
      questions_count: savedQuestions.length
    });

    return {
      success: `Đã sinh thành công ${savedQuestions.length} câu hỏi từ bài giảng "${lesson.title}" và thêm vào đề thi "${quiz.title}".`,
      questions: savedQuestions
    };
  }
}

module.exports = AddGeneratedQuizToBankUseCase;
