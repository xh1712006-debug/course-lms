const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

// Yêu cầu đăng nhập cho tất cả các định tuyến khóa học
router.use(isAuthenticated);

// Trang học viên
router.get('/dashboard', courseController.getDashboard);

// Trang danh sách khóa học
router.get('/courses', requirePermission('COURSE_ENROLL_REQUEST'), courseController.getCourses);

// Chi tiết khóa học
router.get('/courses/:id', requirePermission('COURSE_ENROLL_REQUEST'), courseController.getCourseDetail);

// Đăng ký tham gia khóa học
router.get('/courses/:id/enroll', requirePermission('COURSE_ENROLL_REQUEST'), courseController.enrollCourse);

// Xem và tải chứng nhận hoàn thành khóa học
router.get('/courses/:id/certificate', requirePermission('HISTORY_VIEW'), courseController.getCertificate);

// Xem chi tiết bài giảng
router.get('/courses/:courseId/lessons/:lessonId', courseController.getLesson);

// Các trang Suite học viên mới
router.get('/my-paths', requirePermission('PATH_VIEW'), courseController.getMyPaths);
router.get('/my-history', requirePermission('HISTORY_VIEW'), courseController.getMyHistory);
router.get('/my-deadlines', requirePermission('PROGRESS_TRACK'), courseController.getMyDeadlines);
router.get('/my-groups', courseController.getMyGroups);
router.get('/settings', courseController.getSettings);
router.post('/settings/change-password', courseController.postChangePassword);

// Lưu thảo luận bài học
router.post('/courses/:lessonId/comments', async (req, res) => {
  const { Comment } = require('../models/schema');
  const lessonId = parseInt(req.params.lessonId);
  const userId = req.session.userId;
  const { content } = req.body;
  try {
    const saved = await Comment.create(lessonId, userId, content);
    res.json(saved);
  } catch (err) {
    console.error('Lỗi lưu bình luận:', err);
    res.status(500).json({ error: 'Không thể lưu bình luận.' });
  }
});

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
          const lessons = await Lesson.findByCourseId(lesson.course_id);
          const currentIdx = lessons.findIndex(l => l.id === lesson.id);
          const totalLessons = lessons.length;
          
          const enrollment = await Enrollment.findByUserAndCourse(userId, lesson.course_id);
          const calculatedProgress = Math.max(
            enrollment ? enrollment.progress : 0,
            Math.round(((currentIdx + 1) / totalLessons) * 100)
          );
          await Enrollment.updateProgress(userId, lesson.course_id, calculatedProgress);
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
