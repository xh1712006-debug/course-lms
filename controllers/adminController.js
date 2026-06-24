const redis = require('../config/redis');
const { emitToUser } = require('../config/socket');
const { 
  Course, Lesson, Quiz, Question, QuizSubmission, 
  LearningPath, Enrollment, User, Department, Role, AuditLog, Report 
} = require('../models/schema');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục upload tồn tại
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    cb(null, basename + '-' + uniqueSuffix + ext);
  }
});

// Giới hạn dung lượng và định dạng (100MB)
const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar|png|jpg|jpeg|gif|mp4|webm|ogg|mov|avi|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các định dạng tài liệu (PDF, Office, Zip), hình ảnh hoặc video bài giảng.'));
    }
  }
}).single('file');


// Hàm Helper xóa Cache danh sách khóa học khi có thay đổi cấu trúc khóa học
async function invalidateCourseCache() {
  await redis.del('courses:published');
  console.log('[Redis] Đã xóa cache "courses:published" để đồng bộ dữ liệu mới.');
}

// Chuẩn hóa tên phòng ban: Viết hoa chữ cái đầu và sửa lỗi chính tả ki/kĩ thuật
function sanitizeDepartmentName(name) {
  if (!name) return '';
  let cleaned = name.replace(/\bk[iìíỉĩyỳýỷỹ]\s+thuật\b/gi, 'kỹ thuật');
  return cleaned.trim().split(/\s+/).map(word => {
    const cleanWord = word.toLowerCase();
    if (cleanWord === 'ai') return 'AI';
    if (cleanWord === 'hr') return 'HR';
    if (cleanWord === '(hr)') return '(HR)';
    if (cleanWord === 'r&d') return 'R&D';
    if (cleanWord === 'ui/ux') return 'UI/UX';
    if (cleanWord === 'devops') return 'DevOps';
    if (cleanWord === '3d') return '3D';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

module.exports = {
  getDashboard: async (req, res) => {
    res.redirect('/dashboard');
  },

  // ==========================================
  // NHÓM 1: QUẢN LÝ KHÓA HỌC (COURSE MANAGEMENT)
  // ==========================================

  getCourses: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_VIEW')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền xem khóa học.' });
    }
    try {
      const courses = await Course.findAll();
      res.render('admin/courses', { 
        courses, 
        user: { permissions: req.session.permissions } 
      });
    } catch (err) {
      res.render('error', { message: 'Lỗi tải danh sách khóa học.' });
    }
  },

  createCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_CREATE')) {
      return res.status(403).json({ error: 'Bạn không có quyền tạo khóa học.' });
    }
    const { title, description, image_url, enrollment_type } = req.body;
    try {
      const newCourse = await Course.create(title, description, image_url || '/images/default_course.jpg', 'draft', enrollment_type || 'open');
      
      // Ghi nhật ký
      await AuditLog.create(req.session.userId, 'COURSE_CREATE', { course_id: newCourse.id, title });
      // Xóa cache
      await invalidateCourseCache();

      res.redirect('/course-management');
    } catch (err) {
      res.render('error', { message: 'Không thể tạo khóa học mới.' });
    }
  },

  updateCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_UPDATE')) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa khóa học.' });
    }
    const courseId = parseInt(req.params.id);
    const { title, description, image_url, status, enrollment_type } = req.body;
    try {
      await Course.update(courseId, title, description, image_url, status, enrollment_type || 'open');
      
      await AuditLog.create(req.session.userId, 'COURSE_UPDATE', { course_id: courseId, title });
      await invalidateCourseCache();

      res.redirect('/course-management');
    } catch (err) {
      res.render('error', { message: 'Không thể cập nhật khóa học.' });
    }
  },

  deleteCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_DELETE')) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa khóa học.' });
    }
    const courseId = parseInt(req.params.id);
    try {
      await Course.delete(courseId);
      
      await AuditLog.create(req.session.userId, 'COURSE_DELETE', { course_id: courseId });
      await invalidateCourseCache();

      res.redirect('/course-management');
    } catch (err) {
      res.render('error', { message: 'Không thể xóa khóa học.' });
    }
  },

  publishCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_PUBLISH')) {
      return res.status(403).json({ error: 'Bạn không có quyền xuất bản khóa học.' });
    }
    const courseId = parseInt(req.params.id);
    const { status } = req.body; // 'published' hoặc 'draft'
    try {
      const course = await Course.findById(courseId);
      await Course.update(courseId, course.title, course.description, course.image_url, status);
      
      await AuditLog.create(req.session.userId, 'COURSE_PUBLISH', { course_id: courseId, status });
      await invalidateCourseCache();

      res.redirect('/course-management');
    } catch (err) {
      res.render('error', { message: 'Không thể thay đổi trạng thái khóa học.' });
    }
  },

  // ==========================================
  // NHÓM 2: QUẢN LÝ BÀI HỌC (LESSON & CONTENT)
  // ==========================================

  getAllLessons: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE') && !req.session.permissions.includes('LESSON_MANAGE')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền xem trang quản lý bài học.' });
    }
    try {
      const allLessons = await Lesson.findAll();
      const courses = await Course.findAll();

      // Nhóm bài học theo khóa học
      const lessonsByCourse = {};
      courses.forEach(c => { lessonsByCourse[c.id] = { course: c, lessons: [] }; });
      allLessons.forEach(l => {
        if (lessonsByCourse[l.course_id]) {
          lessonsByCourse[l.course_id].lessons.push(l);
        }
      });

      res.render('admin/lessons-overview', {
        allLessons,
        lessonsByCourse: Object.values(lessonsByCourse),
        courses,
        user: res.locals.user || { permissions: req.session.permissions }
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải danh sách tất cả bài học:', err);
      res.render('error', { message: 'Lỗi tải trang quản lý bài học.' });
    }
  },

  getLessons: async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    try {
      const course = await Course.findById(courseId);
      const lessons = await Lesson.findByCourseId(courseId);
      if (req.query.json === 'true') {
        return res.json(lessons);
      }
      res.render('admin/lessons', { 
        course, 
        lessons, 
        user: { permissions: req.session.permissions } 
      });
    } catch (err) {
      if (req.query.json === 'true') {
        return res.status(500).json({ error: 'Lỗi tải danh sách bài học.' });
      }
      res.render('error', { message: 'Lỗi tải danh sách bài học.' });
    }
  },

  createLesson: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE')) {
      return res.status(403).json({ error: 'Không có quyền tạo bài học.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { title, content, video_url, attachment_url, order_index, is_quiz } = req.body;
    const isQuiz = is_quiz === 'true' || is_quiz === true;

    // Yêu cầu quyền CONTENT_UPLOAD nếu đính kèm video hoặc tài liệu học liệu
    if ((video_url || attachment_url) && !req.session.permissions.includes('CONTENT_UPLOAD')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền tải lên video hoặc đính kèm tài liệu học tập.' });
    }

    try {
      await Lesson.create(courseId, title, content, video_url, attachment_url, parseInt(order_index), isQuiz);
      await AuditLog.create(req.session.userId, 'LESSON_CREATE', { course_id: courseId, lesson_title: title, is_quiz: isQuiz });
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi thêm bài giảng:', err);
      res.render('error', { message: 'Lỗi thêm bài giảng.' });
    }
  },

  updateLesson: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền chỉnh sửa bài học.' });
    }
    const { courseId, id } = req.params;
    const { title, content, video_url, attachment_url, order_index, is_quiz } = req.body;
    const isQuiz = is_quiz === 'true' || is_quiz === true;

    // Yêu cầu quyền CONTENT_UPLOAD nếu đính kèm video hoặc tài liệu học liệu
    if ((video_url || attachment_url) && !req.session.permissions.includes('CONTENT_UPLOAD')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền tải lên video hoặc đính kèm tài liệu học tập.' });
    }

    try {
      await Lesson.update(parseInt(id), title, content, video_url, attachment_url, parseInt(order_index), isQuiz);
      await AuditLog.create(req.session.userId, 'LESSON_UPDATE', { lesson_id: id, title, is_quiz: isQuiz });
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi cập nhật bài giảng:', err);
      res.render('error', { message: 'Lỗi cập nhật bài giảng.' });
    }
  },

  deleteLesson: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền xóa bài học.' });
    }
    const { courseId, id } = req.params;
    try {
      await Lesson.delete(parseInt(id));
      await AuditLog.create(req.session.userId, 'LESSON_DELETE', { lesson_id: id });
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      res.render('error', { message: 'Lỗi xóa bài giảng.' });
    }
  },

  // ==========================================
  // NHÓM 3: QUẢN LÝ ĐỀ THI & NGÂN HÀNG CÂU HỎI (QUIZ)
  // ==========================================

  getQuizzes: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_BANK_VIEW')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền truy cập ngân hàng đề thi.' });
    }
    try {
      const courses = await Course.findAll();
      const questions = await Question.findAll();
      
      // Tìm bài thi cho từng khóa học
      const quizzes = [];
      for (let c of courses) {
        const qz = await Quiz.findByCourseId(c.id);
        quizzes.push({
          course: c,
          quiz: qz
        });
      }

      res.render('admin/quiz', { 
        quizzes, 
        questions, 
        courses,
        user: { permissions: req.session.permissions } 
      });
    } catch (err) {
      res.render('error', { message: 'Lỗi tải ngân hàng câu hỏi.' });
    }
  },

  saveQuizSetting: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_SETTING')) {
      return res.status(403).json({ error: 'Không có quyền thiết lập đề thi.' });
    }
    const { courseId, title, durationMinutes, passingScore } = req.body;
    try {
      const qz = await Quiz.createOrUpdate(
        parseInt(courseId), 
        title, 
        parseInt(durationMinutes), 
        parseInt(passingScore)
      );
      await AuditLog.create(req.session.userId, 'QUIZ_SETTING_UPDATE', { quiz_id: qz.id, title });
      res.redirect('/quiz-management');
    } catch (err) {
      res.render('error', { message: 'Lỗi lưu cấu hình đề thi.' });
    }
  },

  createQuestion: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_BANK_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền tạo câu hỏi.' });
    }
    const { quizId, questionText, optionA, optionB, optionC, optionD, correctOption } = req.body;
    try {
      const options = [optionA, optionB, optionC, optionD];
      // correctOption là A, B, C, hoặc D. Lấy giá trị chuỗi tương ứng
      const optionMapping = { A: optionA, B: optionB, C: optionC, D: optionD };
      const correctAnswer = optionMapping[correctOption];

      await Question.create(parseInt(quizId), questionText, 'multiple_choice', options, correctAnswer);
      res.redirect('/quiz-management');
    } catch (err) {
      res.render('error', { message: 'Lỗi thêm câu hỏi.' });
    }
  },

  deleteQuestion: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_BANK_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền xóa câu hỏi.' });
    }
    const id = parseInt(req.params.id);
    try {
      await Question.delete(id);
      res.redirect('/quiz-management');
    } catch (err) {
      res.render('error', { message: 'Lỗi xóa câu hỏi.' });
    }
  },

  getGradeList: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_GRADE')) {
      return res.status(403).render('error', { message: 'Không có quyền chấm thi.' });
    }
    try {
      // Vì là trắc nghiệm tự chấm điểm ở Client, ở đây ta lấy danh sách các bài làm để giám sát hoặc tự luận (nếu có)
      const submissions = await QuizSubmission.findAllToGrade();
      res.render('admin/grade', { submissions, user: { permissions: req.session.permissions } });
    } catch (err) {
      res.render('error', { message: 'Lỗi tải danh sách chấm thi.' });
    }
  },

  postGrade: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_GRADE')) {
      return res.status(403).json({ error: 'Không có quyền chấm thi.' });
    }
    const submissionId = parseInt(req.params.id);
    const { score, isPassed, feedback } = req.body;
    const gradedBy = req.session.userId;
    try {
      // 1. Cập nhật điểm số & nhận xét
      const updatedSub = await QuizSubmission.grade(
        submissionId,
        parseInt(score),
        isPassed === 'true',
        feedback,
        gradedBy
      );

      // 2. Nếu đạt (isPassed = true), tự động cập nhật tiến độ học tập khóa này lên 100% (Hoàn thành)
      if (updatedSub && updatedSub.is_passed) {
        const subDetails = await require('../config/db').query(
          'SELECT q.course_id, qs.user_id FROM quiz_submissions qs JOIN quizzes q ON qs.quiz_id = q.id WHERE qs.id = $1',
          [submissionId]
        );
        if (subDetails.rows.length > 0) {
          const { course_id, user_id } = subDetails.rows[0];
          await Enrollment.updateProgress(user_id, course_id, 100);
        }
      }

      // 3. Ghi nhật ký hệ thống (Audit Log)
      await AuditLog.create(gradedBy, 'QUIZ_GRADE', { submission_id: submissionId, score, is_passed: isPassed === 'true' });

      // 4. Gửi thông báo real-time qua Socket cho học viên nếu họ online
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('quiz_graded_notification', { submissionId, userId: updatedSub.user_id, score, isPassed: isPassed === 'true' });
      } catch (socketErr) {
        console.warn('[Admin Controller] Lỗi gửi Socket notification chấm thi:', socketErr.message);
      }

      res.redirect('/grade');
    } catch (err) {
      console.error('[Admin Controller] Lỗi chấm điểm tự luận:', err);
      res.render('error', { message: 'Lỗi chấm điểm bài thi.' });
    }
  },

  // ==========================================
  // NHÓM 4: QUẢN LÝ LỘ TRÌNH ĐÀO TẠO & ĐĂNG KÝ (LEARNING PATH)
  // ==========================================

  getLearningPaths: async (req, res) => {
    if (!req.session.permissions.includes('PATH_MANAGE')) {
      return res.status(403).render('error', { message: 'Không có quyền quản lý lộ trình học tập.' });
    }
    try {
      const success = req.query.success || null;
      const error = req.query.error || null;

      const paths = await LearningPath.findAll();
      const courses = await Course.findAllPublished();
      const users = await User.findAll();
      const departments = await Department.findAll();
      
      const pathsWithCourses = [];
      for (let p of paths) {
        const pathCourses = await LearningPath.getCourses(p.id);
        pathsWithCourses.push({
          ...p,
          courses: pathCourses
        });
      }

      res.render('admin/paths', { 
        paths: pathsWithCourses, 
        courses, 
        users,
        departments,
        success,
        error,
        user: { permissions: req.session.permissions } 
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải lộ trình học tập:', err);
      res.render('error', { message: 'Lỗi tải lộ trình học tập.' });
    }
  },

  createLearningPath: async (req, res) => {
    if (!req.session.permissions.includes('PATH_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền tạo lộ trình học tập.' });
    }
    const { name, description, courseIds } = req.body;
    try {
      const newPath = await LearningPath.create(name, description);
      
      // Xử lý mảng id khóa học
      let courses = [];
      if (courseIds) {
        courses = Array.isArray(courseIds) ? courseIds.map(Number) : [Number(courseIds)];
        await LearningPath.addCourses(newPath.id, courses);
      }

      await AuditLog.create(req.session.userId, 'PATH_CREATE', { path_id: newPath.id, name, courses });
      res.redirect('/paths');
    } catch (err) {
      res.render('error', { message: 'Lỗi thêm lộ trình đào tạo.' });
    }
  },

  assignLearningPath: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_ASSIGN')) {
      return res.status(403).json({ error: 'Không có quyền giao lộ trình học tập.' });
    }
    const pathId = parseInt(req.params.id);
    const { userIds, departmentIds } = req.body;

    try {
      const path = await LearningPath.findById(pathId);
      if (!path) {
        return res.redirect('/paths?error=' + encodeURIComponent('Lộ trình đào tạo không tồn tại.'));
      }

      const pathCourses = await LearningPath.getCourses(pathId);
      if (pathCourses.length === 0) {
        return res.redirect('/paths?error=' + encodeURIComponent('Lộ trình này chưa có khóa học nào để giao.'));
      }

      // Chuẩn hóa danh sách ID từ form submit
      let uIds = [];
      if (userIds) {
        uIds = Array.isArray(userIds) ? userIds.map(Number) : [Number(userIds)];
      }
      let dIds = [];
      if (departmentIds) {
        dIds = Array.isArray(departmentIds) ? departmentIds.map(Number) : [Number(departmentIds)];
      }

      if (uIds.length === 0 && dIds.length === 0) {
        return res.redirect('/paths?error=' + encodeURIComponent('Vui lòng chọn ít nhất một cá nhân hoặc phòng ban để giao lộ trình.'));
      }

      // Sử dụng Set để tránh gán trùng lặp cho một nhân sự
      const targetUserIds = new Set(uIds);

      // Tìm tất cả user active thuộc các phòng ban được chọn
      for (let deptId of dIds) {
        const sql = 'SELECT id FROM users WHERE department_id = $1 AND status = \'active\'';
        const usersInDept = await require('../config/db').query(sql, [deptId]);
        for (let u of usersInDept.rows) {
          targetUserIds.add(u.id);
        }
      }

      if (targetUserIds.size === 0) {
        return res.redirect('/paths?error=' + encodeURIComponent('Không tìm thấy nhân sự phù hợp nào trong đối tượng đã chọn.'));
      }

      let assignedCount = 0;
      // Giao tất cả khóa học của lộ trình cho từng nhân sự
      for (let uId of targetUserIds) {
        for (let c of pathCourses) {
          await Enrollment.create(uId, c.id, true, 'approved');
        }
        assignedCount++;
      }

      // Lưu log Audit Log tổng hợp
      await AuditLog.create(req.session.userId, 'PATH_ASSIGN_BULK', {
        learning_path_id: pathId,
        user_count: assignedCount,
        course_count: pathCourses.length,
        selected_users: uIds,
        selected_departments: dIds
      });

      // Thông báo qua WebSocket
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('path_assigned_notification', { pathId, userIds: uIds, departmentIds: dIds });
      } catch (ioErr) {
        console.warn('[Admin Controller] Không thể gửi Socket notification:', ioErr.message);
      }

      res.redirect('/paths?success=' + encodeURIComponent(`Giao thành công lộ trình "${path.name}" cho ${assignedCount} nhân sự.`));
    } catch (err) {
      console.error('[Admin Controller] Lỗi giao lộ trình:', err);
      res.redirect('/paths?error=' + encodeURIComponent('Lỗi hệ thống khi giao lộ trình đào tạo.'));
    }
  },

  assignMandatoryCourse: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_ASSIGN')) {
      return res.status(403).json({ error: 'Không có quyền giao khóa học bắt buộc.' });
    }
    const { targetType, targetId, courseId } = req.body;
    try {
      const cId = parseInt(courseId);
      let assignedCount = 0;

      if (targetType === 'user') {
        const uId = parseInt(targetId);
        // Đăng ký bắt buộc, tự động duyệt
        await Enrollment.create(uId, cId, true, 'approved');
        assignedCount = 1;
        await AuditLog.create(req.session.userId, 'COURSE_ASSIGN_USER', { user_id: uId, course_id: cId });
      } else if (targetType === 'department') {
        const deptId = parseInt(targetId);
        // Tìm toàn bộ user thuộc phòng ban này
        const sql = 'SELECT id FROM users WHERE department_id = $1 AND status = \'active\'';
        const usersInDept = await require('../config/db').query(sql, [deptId]);
        
        for (let u of usersInDept.rows) {
          await Enrollment.create(u.id, cId, true, 'approved');
          assignedCount++;
        }
        await AuditLog.create(req.session.userId, 'COURSE_ASSIGN_DEPARTMENT', { department_id: deptId, course_id: cId, count: assignedCount });
      }

      // Thông báo qua WebSocket (sẽ bắt ở server sau qua getIO)
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('course_assigned_notification', { courseId: cId, targetType, targetId });
      } catch (ioErr) {
        console.warn('[Admin Controller] Không thể gửi Socket notification:', ioErr.message);
      }

      res.redirect('/users');
    } catch (err) {
      res.render('error', { message: 'Lỗi giao khóa học bắt buộc.' });
    }
  },

  getEnrollmentApprovals: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_APPROVE')) {
      return res.status(403).render('error', { message: 'Không có quyền duyệt đăng ký.' });
    }
    try {
      const pendings = await Enrollment.findAllPending();
      res.render('admin/approvals', { pendings, user: { permissions: req.session.permissions } });
    } catch (err) {
      res.render('error', { message: 'Lỗi tải danh sách phê duyệt.' });
    }
  },

  approveEnrollment: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_APPROVE')) {
      return res.status(403).json({ error: 'Không có quyền phê duyệt học tập.' });
    }
    const enrollmentId = parseInt(req.params.id);
    const { action } = req.body; // 'approved' hoặc 'rejected'
    try {
      await Enrollment.updateStatus(enrollmentId, action);
      await AuditLog.create(req.session.userId, `ENROLLMENT_${action.toUpperCase()}`, { enrollment_id: enrollmentId });
      res.redirect('/approvals');
    } catch (err) {
      res.render('error', { message: 'Lỗi cập nhật trạng thái đăng ký.' });
    }
  },

  // ==========================================
  // NHÓM 5: QUẢN LÝ NHÂN SỰ & PHÒNG BAN (USER)
  // ==========================================

  getDepartments: async (req, res) => {
    if (!req.session.permissions.includes('DEPARTMENT_MANAGE')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền quản lý phòng ban.' });
    }
    try {
      const departments = await Department.findAll();
      // Đếm số nhân viên theo từng phòng ban
      const db = require('../config/db');
      const countRes = await db.query(
        'SELECT department_id, COUNT(*) as cnt FROM users WHERE department_id IS NOT NULL GROUP BY department_id'
      );
      const deptUserCounts = {};
      countRes.rows.forEach(r => { deptUserCounts[r.department_id] = parseInt(r.cnt); });

      res.render('admin/departments', {
        departments,
        deptUserCounts,
        user: res.locals.user || { permissions: req.session.permissions },
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải trang phòng ban:', err);
      res.render('error', { message: 'Lỗi tải trang quản lý phòng ban.' });
    }
  },

  getUsers: async (req, res) => {
    if (!req.session.permissions.includes('USER_VIEW')) {
      return res.status(403).render('error', { message: 'Không có quyền xem nhân viên.' });
    }
    try {
      const search = req.query.search ? req.query.search.trim() : '';
      const departmentId = req.query.departmentId ? req.query.departmentId.trim() : '';
      
      let page = parseInt(req.query.page) || 1;
      const limit = 20;
      
      const totalCount = await User.countFiltered(search, departmentId);
      const totalPages = Math.ceil(totalCount / limit) || 1;
      
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      
      const offset = (page - 1) * limit;
      
      const users = await User.findFilteredPaginated(search, departmentId, limit, offset);
      const allUsers = await User.findAllLightweight();
      const departments = await Department.findAll();
      const roles = await Role.findAll();
      const courses = await Course.findAllPublished();

      res.render('admin/users', { 
        users, 
        allUsers,
        departments, 
        roles, 
        courses,
        currentPage: page,
        totalPages,
        totalCount,
        search,
        selectedDeptId: departmentId,
        user: { permissions: req.session.permissions },
        createSuccess: req.query.createSuccess || null,
        createError: req.query.createError || null
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải danh sách nhân sự:', err);
      res.render('error', { message: 'Lỗi tải danh sách nhân sự.' });
    }
  },

  updateUser: async (req, res) => {
    if (!req.session.permissions.includes('USER_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý nhân sự.' });
    }
    const uId = parseInt(req.params.id);
    const { roleId, departmentId, status } = req.body;
    try {
      const targetUser = await User.findById(uId);
      if (!targetUser) {
        return res.status(404).render('error', { message: 'Không tìm thấy thông tin nhân sự.' });
      }

      // Kiểm tra quyền USER_DISABLE nếu muốn thay đổi trạng thái thành vô hiệu hóa
      if (status === 'disabled' && targetUser.status !== 'disabled') {
        if (!req.session.permissions.includes('USER_DISABLE')) {
          return res.status(403).render('error', { message: 'Bạn không có quyền vô hiệu hóa tài khoản nhân viên.' });
        }
      }

      const dId = departmentId === '' ? null : parseInt(departmentId);
      await User.update(uId, parseInt(roleId), dId, status);
      
      // Xóa cache trạng thái và vai trò để thay đổi có hiệu lực ngay lập tức
      await redis.del(`user_status:${uId}`);

      await AuditLog.create(req.session.userId, 'USER_PROFILE_UPDATE', { target_user_id: uId, role_id: roleId, department_id: dId, status });
      res.redirect('/users');
    } catch (err) {
      res.render('error', { message: 'Lỗi cập nhật thông tin nhân viên.' });
    }
  },

  createUser: async (req, res) => {
    if (!req.session.permissions.includes('USER_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền tạo tài khoản nhân viên.' });
    }
    const { username, email, password, roleId, departmentId } = req.body;
    if (!username || !email || !password) {
      return res.redirect('/users?createError=Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
    }
    try {
      const bcrypt = require('bcryptjs');
      const existing = await User.findByEmail(email.trim().toLowerCase());
      if (existing) {
        return res.redirect(`/users?createError=Email đã tồn tại trong hệ thống.`);
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const rId = roleId && roleId !== '' ? parseInt(roleId) : 4;
      const dId = departmentId && departmentId !== '' ? parseInt(departmentId) : null;
      const newUser = await User.create(username.trim(), email.trim().toLowerCase(), hashedPassword, rId, dId);
      await AuditLog.create(req.session.userId, 'USER_CREATE', {
        new_user_id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role_id: rId
      });
      res.redirect(`/users?createSuccess=Đã tạo tài khoản cho "${newUser.username}" thành công.`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi tạo tài khoản:', err);
      if (err.code === '23505') {
        return res.redirect('/users?createError=Tên tài khoản hoặc email đã tồn tại.');
      }
      res.redirect('/users?createError=Có lỗi xảy ra khi tạo tài khoản.');
    }
  },

  createDepartment: async (req, res) => {
    if (!req.session.permissions.includes('DEPARTMENT_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý sơ đồ phòng ban.' });
    }
    const { name, parentId } = req.body;
    try {
      const pId = parentId === '' ? null : parseInt(parentId);
      const cleanedName = sanitizeDepartmentName(name);
      await Department.create(cleanedName, pId);
      await AuditLog.create(req.session.userId, 'DEPARTMENT_CREATE', { name: cleanedName, parent_id: pId });
      res.redirect('/departments?success=' + encodeURIComponent(`Đã tạo phòng ban "‎${cleanedName}‎" thành công.`));
    } catch (err) {
      res.redirect('/departments?error=' + encodeURIComponent('Lỗi tạo phòng ban mới.'));
    }
  },

  deleteDepartment: async (req, res) => {
    if (!req.session.permissions.includes('DEPARTMENT_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý sơ đồ phòng ban.' });
    }
    const id = parseInt(req.params.id);
    try {
      await Department.delete(id);
      await AuditLog.create(req.session.userId, 'DEPARTMENT_DELETE', { department_id: id });
      res.redirect('/departments?success=' + encodeURIComponent('Đã xóa phòng ban thành công.'));
    } catch (err) {
      res.redirect('/departments?error=' + encodeURIComponent('Không thể xóa phòng ban. Đảm bảo không còn phòng ban con trực thuộc.'));
    }
  },

  updateDepartment: async (req, res) => {
    if (!req.session.permissions.includes('DEPARTMENT_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý sơ đồ phòng ban.' });
    }
    const id = parseInt(req.params.id);
    const { name, parentId } = req.body;
    try {
      const pId = !parentId || parentId === '' ? null : parseInt(parentId);
      const cleanedName = sanitizeDepartmentName(name);
      await Department.update(id, cleanedName, pId);
      await AuditLog.create(req.session.userId, 'DEPARTMENT_UPDATE', { department_id: id, name: cleanedName, parent_id: pId });
      res.redirect('/departments?success=' + encodeURIComponent(`Đã cập nhật phòng ban "‎${cleanedName}‎" thành công.`));
    } catch (err) {
      res.redirect('/departments?error=' + encodeURIComponent('Lỗi cập nhật phòng ban.'));
    }
  },

  // ==========================================
  // NHÓM 6: BÁO CÁO & THỐNG KÊ (ANALYTICS)
  // ==========================================

  getReports: async (req, res) => {
    if (!req.session.permissions.includes('REPORT_VIEW')) {
      return res.status(403).render('error', { message: 'Không có quyền xem báo cáo thống kê.' });
    }
    try {
      const stats = await Report.getCompletionStats();
      const deptStats = await Report.getDepartmentStats();
      const leaderboard = await Report.getLeaderboard();
      
      res.render('admin/reports', { 
        stats, 
        deptStats,
        leaderboard,
        user: { 
          username: req.session.username,
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        } 
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải báo cáo:', err);
      res.render('error', { message: 'Lỗi tải trang báo cáo thống kê.' });
    }
  },

  // Cung cấp giao diện báo cáo điểm chi tiết trực quan hoặc dữ liệu JSON thô cho Web Worker
  getRawReportData: async (req, res) => {
    if (!req.session.permissions.includes('REPORT_EXPORT')) {
      if (req.query.format === 'json') {
        return res.status(403).json({ error: 'Không có quyền xuất dữ liệu báo cáo.' });
      }
      return res.status(403).render('error', { message: 'Không có quyền xuất dữ liệu báo cáo.' });
    }
    try {
      const data = await Report.getUserProgressDetails();

      if (req.query.format === 'json') {
        return res.json(data);
      }

      // Lọc dữ liệu phía server (Server-side filtering)
      const search = (req.query.search || '').trim().toLowerCase();
      const courseFilter = (req.query.course || '').trim();
      const deptFilter = (req.query.department || '').trim();

      let filteredData = data;

      if (search) {
        filteredData = filteredData.filter(row => 
          (row.username && row.username.toLowerCase().includes(search)) ||
          (row.email && row.email.toLowerCase().includes(search)) ||
          (row.department_name && row.department_name.toLowerCase().includes(search)) ||
          (row.course_title && row.course_title.toLowerCase().includes(search))
        );
      }

      if (courseFilter && courseFilter !== 'all' && courseFilter !== '') {
        filteredData = filteredData.filter(row => row.course_title === courseFilter);
      }

      if (deptFilter && deptFilter !== 'all' && deptFilter !== '') {
        filteredData = filteredData.filter(row => row.department_name === deptFilter);
      }

      // Phân trang
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const totalRows = filteredData.length;
      const totalPages = Math.ceil(totalRows / limit);
      const offset = (page - 1) * limit;
      const paginatedData = filteredData.slice(offset, offset + limit);

      // Lấy danh sách duy nhất các khóa học và phòng ban để hiển thị bộ lọc dropdown
      const uniqueCourses = [...new Set(data.map(row => row.course_title))].filter(Boolean);
      const uniqueDepts = [...new Set(data.map(row => row.department_name))].filter(Boolean);

      res.render('admin/raw-reports', {
        reportData: paginatedData,
        currentPage: page,
        totalPages,
        totalRows,
        search,
        selectedCourse: courseFilter,
        selectedDept: deptFilter,
        coursesList: uniqueCourses,
        deptsList: uniqueDepts,
        user: { 
          username: req.session.username,
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        } 
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi xuất dữ liệu báo cáo:', err);
      if (req.query.format === 'json') {
        return res.status(500).json({ error: 'Không thể xuất dữ liệu thô.' });
      }
      res.render('error', { message: 'Lỗi tải trang báo cáo điểm chi tiết.' });
    }
  },

  // ==========================================
  // NHÓM 7: BẢO MẬT & ĐẶC QUYỀN HỆ THỐNG (PRIVILEGES)
  // ==========================================

  getRoles: async (req, res) => {
    if (!req.session.permissions.includes('ROLE_MANAGE')) {
      return res.status(403).render('error', { message: 'Không có quyền quản lý vai trò và phân quyền.' });
    }
    try {
      const roles = await Role.findAll();
      
      // Trả về danh sách quyền của từng vai trò
      const rolesWithPerms = [];
      for (let r of roles) {
        const perms = await User.getPermissions(r.id);
        rolesWithPerms.push({
          ...r,
          permissions: perms
        });
      }

      res.render('admin/roles', { 
        roles: rolesWithPerms, 
        user: { permissions: req.session.permissions },
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (err) {
      res.render('error', { message: 'Lỗi tải phân quyền hệ thống.' });
    }
  },

  createRole: async (req, res) => {
    if (!req.session.permissions.includes('ROLE_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền tạo vai trò.' });
    }
    const { name, description } = req.body;
    if (!name || name.trim() === '') {
      return res.redirect('/permissions?error=Tên vai trò không được để trống.');
    }
    try {
      const newRole = await Role.create(name.trim(), description ? description.trim() : '');
      await AuditLog.create(req.session.userId, 'ROLE_CREATE', { role_id: newRole.id, role_name: newRole.name });
      res.redirect(`/permissions?success=Đã tạo vai trò "${newRole.name}" thành công.`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi tạo vai trò:', err);
      if (err.code === '23505') {
        // Unique constraint violation - tên vai trò đã tồn tại
        return res.redirect(`/permissions?error=Tên vai trò "${name}" đã tồn tại trong hệ thống.`);
      }
      res.redirect('/permissions?error=Có lỗi xảy ra khi tạo vai trò mới.');
    }
  },

  deleteRole: async (req, res) => {
    if (!req.session.permissions.includes('ROLE_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền xóa vai trò.' });
    }
    const roleId = parseInt(req.params.id);
    
    // Bảo vệ: Không cho xóa Super Admin
    if (roleId === 1) {
      return res.redirect('/permissions?error=Không thể xóa vai trò Super Admin để bảo toàn hệ thống.');
    }

    try {
      const db = require('../config/db');
      
      // Kiểm tra xem có nhân viên nào đang dùng vai trò này không
      const userCheck = await db.query('SELECT COUNT(*) as cnt FROM users WHERE role_id = $1', [roleId]);
      const userCount = parseInt(userCheck.rows[0].cnt);
      if (userCount > 0) {
        return res.redirect(`/permissions?error=Không thể xóa vì có ${userCount} nhân viên đang sử dụng vai trò này. Hãy chuyển họ sang vai trò khác trước.`);
      }

      // Lấy tên vai trò để ghi log
      const roleRes = await db.query('SELECT name FROM roles WHERE id = $1', [roleId]);
      if (!roleRes.rows[0]) {
        return res.redirect('/permissions?error=Vai trò không tồn tại.');
      }
      const roleName = roleRes.rows[0].name;

      // Xóa quyền hạn trước, sau đó xóa vai trò
      await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

      // Xóa cache Redis của vai trò này
      await redis.del(`role_permissions:${roleId}`);

      await AuditLog.create(req.session.userId, 'ROLE_DELETE', { role_id: roleId, role_name: roleName });

      res.redirect(`/permissions?success=Đã xóa vai trò "${roleName}" thành công.`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi xóa vai trò:', err);
      res.redirect('/permissions?error=Có lỗi xảy ra khi xóa vai trò.');
    }
  },



  updateRolePermissions: async (req, res) => {
    if (!req.session.permissions.includes('ROLE_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền thay đổi cấu hình phân quyền.' });
    }
    const roleId = parseInt(req.params.id);
    const { permissions } = req.body; // Mảng chứa các checkbox quyền hạn được tick chọn
    try {
      const permsArray = Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []);
      
      await Role.updatePermissions(roleId, permsArray);
      
      // Xóa Cache Redis cho vai trò này để cập nhật quyền thời gian thực
      await redis.del(`role_permissions:${roleId}`);

      await AuditLog.create(req.session.userId, 'ROLE_PERMISSIONS_UPDATE', { role_id: roleId, permissions: permsArray });
      
      console.log(`[RBAC] Đã cập nhật quyền hạn cho vai trò ID: ${roleId}.`);
      res.redirect('/permissions');
    } catch (err) {
      res.render('error', { message: 'Lỗi cập nhật phân quyền vai trò.' });
    }
  },

  getAuditLogs: async (req, res) => {
    if (!req.session.permissions.includes('AUDIT_LOG_VIEW')) {
      return res.status(403).render('error', { message: 'Không có quyền truy cập nhật ký hệ thống.' });
    }
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      const action = req.query.action || '';
      const startDate = req.query.startDate || '';
      const endDate = req.query.endDate || '';
      const limit = 20;
      const offset = (page - 1) * limit;

      const [logs, totalLogs] = await Promise.all([
        AuditLog.findPaginated(limit, offset, search, action, startDate, endDate),
        AuditLog.countAll(search, action, startDate, endDate)
      ]);

      const totalPages = Math.ceil(totalLogs / limit);

      // Định nghĩa các loại hành động để lọc trong dropdown EJS
      const actionTypes = [
        { value: 'all', label: 'Tất cả hành động' },
        { value: 'USER_LOGIN', label: 'Đăng nhập' },
        { value: 'USER_LOGOUT', label: 'Đăng xuất' },
        { value: 'PASSWORD_RESET_REQUESTED', label: 'Yêu cầu OTP quên mật khẩu' },
        { value: 'PASSWORD_RESET_SUCCESS', label: 'Đặt lại mật khẩu thành công' },
        { value: 'USER_CREATE', label: 'Tạo tài khoản nhân viên' },
        { value: 'USER_PROFILE_UPDATE', label: 'Cập nhật thông tin nhân viên' },
        { value: 'ROLE_CREATE', label: 'Tạo vai trò' },
        { value: 'ROLE_DELETE', label: 'Xóa vai trò' },
        { value: 'ROLE_PERMISSIONS_UPDATE', label: 'Cập nhật phân quyền vai trò' },
        { value: 'ROLE_PERMISSION_TOGGLE', label: 'Thay đổi phân quyền nhanh' },
        { value: 'COURSE_CREATE', label: 'Tạo khóa học' },
        { value: 'COURSE_UPDATE', label: 'Cập nhật khóa học' },
        { value: 'COURSE_DELETE', label: 'Xóa khóa học' },
        { value: 'COURSE_PUBLISH', label: 'Thay đổi trạng thái khóa học' },
        { value: 'COURSE_ASSIGN_USER', label: 'Giao khóa học cho nhân sự' },
        { value: 'COURSE_ASSIGN_DEPARTMENT', label: 'Giao khóa học cho phòng ban' },
        { value: 'LESSON_CREATE', label: 'Thêm bài giảng' },
        { value: 'LESSON_UPDATE', label: 'Sửa bài giảng' },
        { value: 'LESSON_DELETE', label: 'Xóa bài giảng' },
        { value: 'PATH_CREATE', label: 'Tạo lộ trình đào tạo' },
        { value: 'PATH_ASSIGN_BULK', label: 'Giao lộ trình học tập hàng loạt' },
        { value: 'DEPARTMENT_CREATE', label: 'Tạo phòng ban' },
        { value: 'DEPARTMENT_DELETE', label: 'Xóa phòng ban' },
        { value: 'DEPARTMENT_UPDATE', label: 'Cập nhật phòng ban' },
        { value: 'ENROLLMENT_APPROVED', label: 'Phê duyệt đăng ký khóa học' },
        { value: 'ENROLLMENT_REJECTED', label: 'Từ chối đăng ký khóa học' },
        { value: 'ENROLL_REQUEST', label: 'Yêu cầu đăng ký học tập' },
        { value: 'ENROLL_DIRECT', label: 'Vào học trực tiếp' },
        { value: 'USER_IMPERSONATE_START', label: 'Bắt đầu đóng vai người dùng' },
        { value: 'USER_IMPERSONATE_END', label: 'Kết thúc đóng vai người dùng' },
        { value: 'RUN_EXPERIMENT_SUCCESS', label: 'Huấn luyện AI thành công' },
        { value: 'RUN_EXPERIMENT_FAILED', label: 'Huấn luyện AI thất bại' },
        { value: 'AI_SUMMARIZE_LESSON', label: 'AI tóm tắt bài giảng' },
        { value: 'AI_CHAT_ASSISTANT', label: 'Trò chuyện với trợ lý AI' },
        { value: 'AI_GENERATE_QUICK_QUIZ', label: 'AI sinh đề trắc nghiệm nhanh' },
        { value: 'AI_GENERATE_QUIZ_TO_BANK', label: 'AI lưu trắc nghiệm vào DB' },
        { value: 'QUIZ_SETTING_UPDATE', label: 'Cập nhật cài đặt đề thi' },
        { value: 'QUIZ_GRADE', label: 'Chấm điểm đề thi' },
        { value: 'QUIZ_SUBMIT', label: 'Nộp bài thi trắc nghiệm' }
      ];

      res.render('admin/audit', { 
        logs, 
        user: { permissions: req.session.permissions },
        currentPage: page,
        totalPages,
        totalLogs,
        search,
        action,
        startDate,
        endDate,
        actionTypes
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải nhật ký vết hệ thống:', err);
      res.render('error', { message: 'Lỗi tải nhật ký vết hệ thống.' });
    }
  },







  toggleRolePermission: async (req, res) => {
    if (!req.session.permissions.includes('ROLE_MANAGE')) {
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi cấu hình phân quyền.' });
    }
    const roleId = parseInt(req.body.roleId);
    const permission = req.body.permission;
    const isChecked = req.body.isChecked === true || req.body.isChecked === 'true';

    if (roleId === 1) {
      return res.status(400).json({ error: 'Không thể chỉnh sửa vai trò Super Admin để đảm bảo an toàn hệ thống.' });
    }

    try {
      const db = require('../config/db');
      if (isChecked) {
        // Thêm quyền mới
        const sql = `
          INSERT INTO role_permissions (role_id, permission_name)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `;
        await db.query(sql, [roleId, permission]);
      } else {
        // Xóa quyền hiện tại
        const sql = `
          DELETE FROM role_permissions
          WHERE role_id = $1 AND permission_name = $2
        `;
        await db.query(sql, [roleId, permission]);
      }

      // Xóa Cache Redis cho vai trò này để cập nhật quyền thời gian thực
      await redis.del(`role_permissions:${roleId}`);

      // Lấy tên vai trò phục vụ ghi nhật ký
      const roleRes = await db.query('SELECT name FROM roles WHERE id = $1', [roleId]);
      const roleName = roleRes.rows[0]?.name || `Vai trò ${roleId}`;

      // === THÔNG BÁO THỜI GIAN THỰC ===
      // Tìm tất cả user thuộc vai trò này và gửi thông báo cập nhật quyền
      const affectedUsersRes = await db.query(
        'SELECT id FROM users WHERE role_id = $1 AND status = $2',
        [roleId, 'active']
      );
      const changeDesc = isChecked
        ? `được cấp thêm quyền "${permission}"`
        : `bị thu hồi quyền "${permission}"`;
      const notifyMsg = `Quyền hạn tài khoản của bạn vừa được Admin cập nhật (${changeDesc}). Hệ thống sẽ tự động tải lại trong vài giây...`;

      for (const { id: affectedUserId } of affectedUsersRes.rows) {
        emitToUser(affectedUserId, 'permission_changed', {
          message: notifyMsg,
          roleName,
          permission,
          isAssigned: isChecked
        });
      }
      console.log(`[RBAC] Đã thông báo đến ${affectedUsersRes.rows.length} user(s) của vai trò "${roleName}" về thay đổi quyền "${permission}"`);

      // Ghi audit log
      await AuditLog.create(req.session.userId, 'ROLE_PERMISSION_TOGGLE', {
        role_id: roleId,
        role_name: roleName,
        permission: permission,
        is_assigned: isChecked
      });

      res.json({ 
        success: true, 
        message: `Đã cập nhật quyền ${permission} cho vai trò ${roleName} thành công.` 
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi cập nhật quyền vai trò:', err);
      res.status(500).json({ error: 'Có lỗi xảy ra khi cập nhật quyền hạn vai trò.' });
    }
  },

  uploadAttachment: (req, res) => {
    if (!req.session.permissions.includes('CONTENT_UPLOAD')) {
      return res.status(403).json({ error: 'Bạn không có quyền tải lên học liệu.' });
    }

    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Lỗi tải lên: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn tệp tin để tải lên.' });
      }

      const filePath = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        filePath: filePath,
        fileName: req.file.originalname
      });
    });
  }
};

