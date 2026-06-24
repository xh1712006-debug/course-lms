class LessonEntity {
  constructor({ id, courseId, title, content, videoUrl, attachmentUrl, isQuiz }) {
    this.id = id;
    this.courseId = courseId;
    this.title = title;
    this.content = content;
    this.videoUrl = videoUrl;
    this.attachmentUrl = attachmentUrl;
    this.isQuiz = !!isQuiz;
  }

  // Kiểm tra xem bài học có bất kỳ tài liệu học tập nào không
  hasValidLearningMaterial() {
    return !!(
      (this.content && this.content.trim() !== '') ||
      (this.videoUrl && this.videoUrl.trim() !== '') ||
      (this.attachmentUrl && this.attachmentUrl.trim() !== '')
    );
  }
}

module.exports = LessonEntity;
