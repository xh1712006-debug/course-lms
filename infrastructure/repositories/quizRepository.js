const { Quiz } = require('../../models/schema');

class PgQuizRepository {
  async findById(id) {
    const quiz = await Quiz.findById(id);
    if (!quiz) return null;
    return {
      id: quiz.id,
      courseId: quiz.course_id,
      title: quiz.title,
      durationMinutes: quiz.duration_minutes,
      passingScore: quiz.passing_score
    };
  }
}

module.exports = PgQuizRepository;
