const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { isAuthenticated, requirePermission, requireAnyPermission } = require('../middleware/auth');

// Yêu cầu đăng nhập cho tất cả các định tuyến khóa học
router.use(isAuthenticated);

// Trang học viên
router.get('/dashboard', courseController.getDashboard);

// Trang danh sách khóa học
router.get('/courses', requireAnyPermission(['COURSE_ENROLL_REQUEST', 'COURSE_VIEW', 'COURSE_UPDATE']), courseController.getCourses);

// Chi tiết khóa học
router.get('/courses/:id', requireAnyPermission(['COURSE_ENROLL_REQUEST', 'COURSE_VIEW', 'COURSE_UPDATE', 'LESSON_MANAGE']), courseController.getCourseDetail);

// Đăng ký tham gia khóa học
router.get('/courses/:id/enroll', requirePermission('COURSE_ENROLL_REQUEST'), courseController.enrollCourse);



// Xem chi tiết bài giảng
router.get('/courses/:courseId/lessons/:lessonId', courseController.getLesson);

// Đánh dấu hoàn thành bài học
router.post('/courses/:courseId/lessons/:lessonId/complete', courseController.completeLesson);

// Các trang Suite học viên mới
router.get('/my-deadlines', requirePermission('PROGRESS_TRACK'), courseController.getMyDeadlines);
router.get('/my-groups', courseController.getMyGroups);
router.get('/settings', courseController.getSettings);
router.post('/settings/change-password', courseController.postChangePassword);


// Lấy danh sách câu hỏi thi cuối khóa (Bảo mật: ẩn trường đáp án correct_answer)
router.get('/courses/quiz/questions', async (req, res) => {
  const { Lesson, Quiz, Question } = require('../models/schema');
  const lessonId = parseInt(req.query.lessonId);
  try {
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: 'Bài học không tìm thấy.' });
    
    const quiz = await Quiz.findByCourseId(lesson.course_id);
    if (!quiz) return res.status(404).json({ error: 'Đề thi chưa được thiết lập cho khóa học này.' });
    
    const questions = await Question.findByQuizId(quiz.id);
    // Làm sạch đáp án correct_answer để học viên không thể inspect element F12 xem lén
    const sanitizedQuestions = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      options: q.options,
      question_type: q.question_type
    }));
    
    res.json({ quiz, questions: sanitizedQuestions });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải đề thi.' });
  }
});

// Nộp bài thi cuối khóa & tự động cập nhật kết quả tiến độ khóa học lên 100% nếu đạt
router.post('/courses/quiz/submit', async (req, res) => {
  const { Quiz, Question, QuizSubmission, Enrollment, AuditLog, Lesson } = require('../models/schema');
  const { quizId, answers, essayAnswer } = req.body;
  const userId = req.session.userId;
  try {
    const quiz = await Quiz.findById(parseInt(quizId));
    if (!quiz) return res.status(404).json({ error: 'Đề thi không tồn tại.' });
    
    const questions = await Question.findByQuizId(quiz.id);
    if (questions.length === 0) return res.status(400).json({ error: 'Đề thi chưa cấu hình câu hỏi.' });
    
    // Kiểm tra xem đề thi có chứa câu hỏi tự luận hay không
    const hasEssay = questions.some(q => q.question_type === 'essay');
    
    let score = null;
    let isPassed = null;
    
    if (!hasEssay) {
      // Tự động chấm điểm trắc nghiệm
      let correctCount = 0;
      questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (userAnswer === q.correct_answer) {
          correctCount++;
        }
      });
      score = Math.round((correctCount / questions.length) * 100);
      isPassed = score >= quiz.passing_score;
      
      if (isPassed) {
        if (quiz.lesson_id) {
          // Bài kiểm tra trắc nghiệm của riêng bài học
          const lesson = await Lesson.findById(quiz.lesson_id);
          
          // Đánh dấu hoàn thành bài học
          const { LessonCompletion } = require('../models/schema');
          await LessonCompletion.create(userId, lesson.id, lesson.course_id);
          
          // Tính toán lại tiến trình của khóa học
          const lessons = await Lesson.findByCourseId(lesson.course_id);
          const completedLessonIds = await LessonCompletion.findByUserAndCourse(userId, lesson.course_id);
          const progress = Math.min(100, Math.round((completedLessonIds.length / lessons.length) * 100));
          await Enrollment.updateProgress(userId, lesson.course_id, progress);
        } else {
          // Thi cuối khóa: Cập nhật tiến độ hoàn thành 100%
          await Enrollment.updateProgress(userId, quiz.course_id, 100);
        }
      }
    } else {
      // Nếu có tự luận (chỉ dành cho đề cuối khóa): tiến độ đạt 95%
      await Enrollment.updateProgress(userId, quiz.course_id, 95);
    }
    
    // Lưu kết quả nộp bài thi
    await QuizSubmission.create(quiz.id, userId, score, isPassed, answers, essayAnswer || null);
    
    await AuditLog.create(userId, quiz.lesson_id ? 'LESSON_QUIZ_SUBMIT' : 'QUIZ_SUBMIT', { 
      quiz_id: quizId, 
      score, 
      is_passed: isPassed, 
      has_essay: hasEssay,
      lesson_id: quiz.lesson_id || null
    });
    
    res.json({ score, is_passed: isPassed, has_essay: hasEssay });
  } catch (err) {
    console.error('Lỗi chấm thi:', err);
    res.status(500).json({ error: 'Có lỗi xảy ra khi nộp bài thi.' });
  }
});

const assessmentController = require('../controllers/assessmentController');
router.get('/assessments', assessmentController.getMyAssessments);
router.get('/assessments/:id/take', assessmentController.getTake);
router.post('/assessments/:id/submit', assessmentController.postSubmit);
router.get('/assessments/:id/result', assessmentController.getResult);

module.exports = router;
