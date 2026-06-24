const { Lesson } = require('../../models/schema');
const LessonEntity = require('../../domain/entities/lessonEntity');

class PgLessonRepository {
  async findById(id) {
    const lesson = await Lesson.findById(id);
    if (!lesson) return null;
    
    // Map từ DB record sang domain entity
    return new LessonEntity({
      id: lesson.id,
      courseId: lesson.course_id,
      title: lesson.title,
      content: lesson.content,
      videoUrl: lesson.video_url,
      attachmentUrl: lesson.attachment_url,
      isQuiz: lesson.is_quiz
    });
  }
}

module.exports = PgLessonRepository;
