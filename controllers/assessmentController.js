const { Assessment, AssessmentQuestion, AssessmentAssignment, AssessmentSubmission, Course, Lesson, User, Department, AuditLog } = require('../models/schema');
const geminiService = require('../services/geminiService');

module.exports = {
  // ============================================================
  // ADMIN: Danh sách tất cả bài kiểm tra
  // ============================================================
  getList: async (req, res) => {
    try {
      const [assessments, courses, users, departments] = await Promise.all([
        Assessment.findAll(),
        Course.findAllPublished(),
        User.findAllLightweight(),
        Department.findAll()
      ]);
      res.render('admin/assessments', {
        user: req.session,
        assessments,
        courses,
        users,
        departments,
        flash: req.query.flash || null,
        flashType: req.query.flashType || 'success'
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi getList:', err);
      res.status(500).render('error', { message: 'Không thể tải danh sách bài kiểm tra.' });
    }
  },

  // ============================================================
  // ADMIN: Tạo bài kiểm tra mới (AI sinh câu hỏi) — API
  // ============================================================
  postCreate: async (req, res) => {
    const { title, description, courseIds, questionCount, durationMinutes, passingScore } = req.body;
    const userId = req.session.userId;

    try {
      // Validate
      if (!title || !courseIds || courseIds.length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập tiêu đề và chọn ít nhất 1 khóa học.' });
      }

      const ids = Array.isArray(courseIds) ? courseIds.map(Number) : [Number(courseIds)];
      const count = parseInt(questionCount) || 50;
      const duration = parseInt(durationMinutes) || 60;
      const passing = parseInt(passingScore) || 70;

      // Tạo bài kiểm tra (draft)
      const assessment = await Assessment.create(title, description, ids, count, duration, passing, userId);

      // Thu thập nội dung các bài học từ các khóa học được chọn
      const coursesData = [];
      for (const courseId of ids) {
        const course = await Course.findById(courseId);
        const lessons = await Lesson.findByCourseId(courseId);
        if (course && lessons.length > 0) {
          coursesData.push({
            courseTitle: course.title,
            lessons: lessons.map(l => ({ title: l.title, content: l.content || '' }))
          });
        }
      }

      if (coursesData.length === 0) {
        return res.status(400).json({ error: 'Các khóa học được chọn chưa có bài học. Vui lòng thêm bài học trước.' });
      }

      // Gọi AI sinh câu hỏi
      console.log(`[Assessment] Đang gọi AI sinh ${count} câu hỏi cho "${title}"...`);
      const questions = await geminiService.generateAssessment(title, coursesData, count);

      // Lưu câu hỏi vào DB
      await AssessmentQuestion.createBulk(assessment.id, questions);

      // Ghi audit log
      await AuditLog.create(userId, 'ASSESSMENT_CREATE', {
        assessment_id: assessment.id,
        title,
        course_ids: ids,
        question_count: questions.length
      }, req.ip);

      res.json({
        success: true,
        message: `Đã tạo bài kiểm tra "${title}" với ${questions.length} câu hỏi AI sinh ra thành công!`,
        assessmentId: assessment.id
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi postCreate:', err);
      res.status(500).json({ error: err.message || 'Có lỗi xảy ra khi tạo bài kiểm tra.' });
    }
  },

  // ============================================================
  // ADMIN: Xuất bản bài kiểm tra
  // ============================================================
  postPublish: async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;
    try {
      const questions = await AssessmentQuestion.findByAssessmentId(parseInt(id));
      if (questions.length === 0) {
        return res.redirect(`/admin/assessments?flash=${encodeURIComponent('Bài kiểm tra chưa có câu hỏi, không thể xuất bản.')}&flashType=error`);
      }
      await Assessment.publish(parseInt(id));
      await AuditLog.create(userId, 'ASSESSMENT_PUBLISH', { assessment_id: parseInt(id) }, req.ip);
      res.redirect(`/admin/assessments?flash=${encodeURIComponent('Đã xuất bản bài kiểm tra thành công!')}`);
    } catch (err) {
      console.error('[AssessmentController] Lỗi postPublish:', err);
      res.redirect(`/admin/assessments?flash=${encodeURIComponent('Lỗi khi xuất bản.')}&flashType=error`);
    }
  },

  // ============================================================
  // ADMIN: Xóa bài kiểm tra
  // ============================================================
  postDelete: async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;
    try {
      await Assessment.delete(parseInt(id));
      await AuditLog.create(userId, 'ASSESSMENT_DELETE', { assessment_id: parseInt(id) }, req.ip);
      res.redirect(`/admin/assessments?flash=${encodeURIComponent('Đã xóa bài kiểm tra.')}`);
    } catch (err) {
      console.error('[AssessmentController] Lỗi postDelete:', err);
      res.redirect(`/admin/assessments?flash=${encodeURIComponent('Lỗi khi xóa.')}&flashType=error`);
    }
  },

  // ============================================================
  // ADMIN: Phân phối bài kiểm tra — API JSON
  // ============================================================
  postAssign: async (req, res) => {
    const { assessmentId, targetType, targetIds, startTime, deadline } = req.body;
    const userId = req.session.userId;

    try {
      if (!assessmentId || !targetType || !targetIds || targetIds.length === 0) {
        return res.status(400).json({ error: 'Thiếu thông tin phân phối.' });
      }

      const ids = Array.isArray(targetIds) ? targetIds.map(Number) : [Number(targetIds)];
      const startTimeDate = startTime ? new Date(startTime) : null;
      const deadlineDate = deadline ? new Date(deadline) : null;

      await AssessmentAssignment.assign(parseInt(assessmentId), targetType, ids, startTimeDate, deadlineDate, userId);
      await AuditLog.create(userId, 'ASSESSMENT_ASSIGN', {
        assessment_id: parseInt(assessmentId),
        target_type: targetType,
        target_ids: ids
      }, req.ip);

      res.json({ success: true, message: `Đã phân phối cho ${ids.length} ${targetType === 'user' ? 'người dùng' : 'phòng ban'} thành công!` });
    } catch (err) {
      console.error('[AssessmentController] Lỗi postAssign:', err);
      res.status(500).json({ error: err.message || 'Có lỗi khi phân phối bài kiểm tra.' });
    }
  },

  // ============================================================
  // ADMIN: Xem chi tiết + kết quả của 1 bài kiểm tra
  // ============================================================
  getDetail: async (req, res) => {
    const { id } = req.params;
    try {
      const [assessment, questions, assignments, submissions] = await Promise.all([
        Assessment.findById(parseInt(id)),
        AssessmentQuestion.findByAssessmentId(parseInt(id)),
        AssessmentAssignment.findByAssessment(parseInt(id)),
        AssessmentSubmission.findByAssessment(parseInt(id))
      ]);

      if (!assessment) {
        return res.status(404).render('error', { message: 'Không tìm thấy bài kiểm tra.' });
      }

      res.render('admin/assessment-detail', {
        user: req.session,
        assessment,
        questions,
        assignments,
        submissions
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi getDetail:', err);
      res.status(500).render('error', { message: 'Không thể tải chi tiết bài kiểm tra.' });
    }
  },

  // ============================================================
  // LEARNER: Danh sách bài kiểm tra được giao
  // ============================================================
  getMyAssessments: async (req, res) => {
    const userId = req.session.userId;
    const departmentId = req.session.departmentId || null;

    try {
      const assessments = await Assessment.findForUser(userId, departmentId);
      res.render('courses/my-assessments', {
        user: req.session,
        assessments
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi getMyAssessments:', err);
      res.status(500).render('error', { message: 'Không thể tải danh sách bài kiểm tra.' });
    }
  },

  // ============================================================
  // LEARNER: Vào làm bài kiểm tra
  // ============================================================
  getTake: async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
      const assessment = await Assessment.findById(parseInt(id));
      if (!assessment || assessment.status !== 'published') {
        return res.status(404).render('error', { message: 'Bài kiểm tra không tồn tại hoặc chưa được xuất bản.' });
      }

      // Kiểm tra thời gian làm bài từ bảng phân phối
      const db = require('../config/db');
      const deptId = req.session.departmentId || null;
      const assignQuery = `
        SELECT start_time, deadline FROM assessment_assignments
        WHERE assessment_id = $1
          AND (
            (target_type = 'user' AND target_id = $2)
            ${deptId ? `OR (target_type = 'department' AND target_id = $3)` : ''}
          )
        ORDER BY assigned_at DESC
        LIMIT 1
      `;
      const assignParams = deptId ? [parseInt(id), userId, deptId] : [parseInt(id), userId];
      const assignRes = await db.query(assignQuery, assignParams);
      const assignment = assignRes.rows[0];

      if (assignment) {
        const now = new Date();
        if (assignment.start_time && new Date(assignment.start_time) > now) {
          return res.status(403).render('error', { 
            message: `Bài kiểm tra chưa mở. Thời gian mở làm bài: ${new Date(assignment.start_time).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}` 
          });
        }
        if (assignment.deadline && new Date(assignment.deadline) < now) {
          return res.status(403).render('error', { 
            message: `Bài kiểm tra đã hết hạn lúc: ${new Date(assignment.deadline).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}` 
          });
        }
      }

      // Kiểm tra đã nộp chưa
      const existing = await AssessmentSubmission.findByUserAndAssessment(userId, parseInt(id));
      if (existing) {
        return res.redirect(`/assessments/${id}/result`);
      }

      const questions = await AssessmentQuestion.findByAssessmentId(parseInt(id));

      // Shuffle câu hỏi để tránh copy nhau
      const shuffled = questions.sort(() => Math.random() - 0.5);

      res.render('courses/take-assessment', {
        user: req.session,
        assessment,
        questions: shuffled
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi getTake:', err);
      res.status(500).render('error', { message: 'Không thể tải bài kiểm tra.' });
    }
  },

  // ============================================================
  // LEARNER: Nộp bài kiểm tra
  // ============================================================
  postSubmit: async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;
    const { answers } = req.body; // { "questionId": "selectedAnswer", ... }

    try {
      const assessment = await Assessment.findById(parseInt(id));
      if (!assessment) {
        return res.status(404).json({ error: 'Không tìm thấy bài kiểm tra.' });
      }

      // Kiểm tra đã nộp chưa
      const existing = await AssessmentSubmission.findByUserAndAssessment(userId, parseInt(id));
      if (existing) {
        return res.json({ alreadySubmitted: true, redirectUrl: `/assessments/${id}/result` });
      }

      const questions = await AssessmentQuestion.findByAssessmentId(parseInt(id));
      const parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;

      // Tính điểm
      let correctCount = 0;
      for (const q of questions) {
        const userAnswer = parsedAnswers[q.id];
        if (userAnswer && userAnswer.trim() === q.correct_answer.trim()) {
          correctCount++;
        }
      }

      const totalQuestions = questions.length;
      const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100 * 100) / 100 : 0;
      const isPassed = score >= (assessment.passing_score || 70);

      await AssessmentSubmission.create(parseInt(id), userId, score, totalQuestions, correctCount, isPassed, parsedAnswers);

      await AuditLog.create(userId, 'ASSESSMENT_SUBMIT', {
        assessment_id: parseInt(id),
        score,
        is_passed: isPassed
      }, req.ip);

      res.json({ success: true, redirectUrl: `/assessments/${id}/result` });
    } catch (err) {
      console.error('[AssessmentController] Lỗi postSubmit:', err);
      res.status(500).json({ error: 'Có lỗi khi nộp bài. Vui lòng thử lại.' });
    }
  },

  // ============================================================
  // LEARNER: Xem kết quả sau khi nộp
  // ============================================================
  getResult: async (req, res) => {
    const { id } = req.params;
    const userId = req.session.userId;

    try {
      const [assessment, submission, questions] = await Promise.all([
        Assessment.findById(parseInt(id)),
        AssessmentSubmission.findByUserAndAssessment(userId, parseInt(id)),
        AssessmentQuestion.findByAssessmentId(parseInt(id))
      ]);

      if (!assessment || !submission) {
        return res.redirect(`/assessments/${id}/take`);
      }

      res.render('courses/assessment-result', {
        user: req.session,
        assessment,
        submission,
        questions
      });
    } catch (err) {
      console.error('[AssessmentController] Lỗi getResult:', err);
      res.status(500).render('error', { message: 'Không thể tải kết quả.' });
    }
  }
};
