const { Question } = require('../../models/schema');

class PgQuestionRepository {
  async create(quizId, questionText, questionType, options, correctAnswer) {
    return await Question.create(quizId, questionText, questionType, options, correctAnswer);
  }
}

module.exports = PgQuestionRepository;
