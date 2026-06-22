const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

// Route gọi AI tóm tắt bài giảng
router.post('/ai/summarize', aiController.summarizeLesson);

// Route gọi AI trò chuyện / hỏi đáp
router.post('/ai/chat', aiController.chatWithAI);

// Route gọi AI tự tạo đề thi kiểm tra nhanh
router.post('/ai/quiz', aiController.generateLessonQuiz);

// Route gọi AI tạo đề thi và lưu vào ngân hàng câu hỏi (Cho Admin)
router.post('/ai/quiz-to-bank', aiController.generateQuizToBank);

module.exports = router;
