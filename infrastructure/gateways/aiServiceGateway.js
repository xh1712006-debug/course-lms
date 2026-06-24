const geminiService = require('../../services/geminiService');

class GeminiAiService {
  async summarize(lessonEntity) {
    return await geminiService.summarizeLesson(
      lessonEntity.title,
      lessonEntity.content,
      lessonEntity.videoUrl,
      lessonEntity.attachmentUrl
    );
  }

  async answer(lessonEntity, userQuestion, history = []) {
    return await geminiService.answerQuestion(
      lessonEntity.title,
      lessonEntity.content,
      userQuestion,
      history
    );
  }

  async generateQuiz(lessonEntity) {
    return await geminiService.generateQuiz(
      lessonEntity.title,
      lessonEntity.content
    );
  }
}

module.exports = GeminiAiService;
