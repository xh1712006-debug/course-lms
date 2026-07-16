const redis = require('../config/redis');
const { emitToUser } = require('../config/socket');
const { 
  Course, Lesson, Chapter, Quiz, Question, QuizSubmission, 
  LearningPath, Enrollment, User, Department, Role, AuditLog,
  Assessment, AssessmentSubmission
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
    const filetypes = /pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar|png|jpg|jpeg|gif|mp4|webm|ogg|mov|avi|mkv|vtt|srt/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các định dạng tài liệu (PDF, Office, Zip), hình ảnh, video bài giảng hoặc phụ đề (.vtt, .srt).'));
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
      const success = req.query.success || null;
      const error = req.query.error || null;

      // Xử lý phân trang (mặc định trang 1, mỗi trang 15 khóa học)
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = 15;
      const offset = (page - 1) * limit;

      // Lấy song song dữ liệu phân trang và danh sách liên quan
      const [courses, totalCourses, users, departments] = await Promise.all([
        Course.findPaginated(limit, offset),
        Course.countAll(),
        User.findAll(),
        Department.findAll()
      ]);

      const totalPages = Math.max(1, Math.ceil(totalCourses / limit));

      res.render('admin/courses', { 
        courses, 
        users,
        departments,
        success,
        error,
        currentPage: page,
        totalPages,
        totalCourses
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải danh sách khóa học:', err);
      res.render('error', { message: 'Lỗi tải danh sách khóa học.' });
    }
  },

  createCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_CREATE')) {
      return res.status(403).json({ error: 'Bạn không có quyền tạo khóa học.' });
    }
    const { title, description, image_url, enrollment_type } = req.body;
    try {
      const newCourse = await Course.create(title, description, image_url || '/images/default_course.svg', 'draft', enrollment_type || 'open');
      
      // Ghi nhật ký
      await AuditLog.create(req.session.userId, 'COURSE_CREATE', { course_id: newCourse.id, title });
      // Xóa cache
      await invalidateCourseCache();

      // Redirect đến trang bài giảng (lessons) để người dùng tiếp tục thêm video
      res.redirect(`/course-management/${newCourse.id}/lessons?success=${encodeURIComponent('Đã tạo khóa học thành công. Vui lòng thêm bài giảng!')}`);
    } catch (err) {
      res.render('error', { message: 'Không thể tạo khóa học mới.' });
    }
  },

  createBulkCourses: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_CREATE')) {
      return res.status(403).json({ error: 'Bạn không có quyền tạo khóa học.' });
    }
    const { bulk_titles } = req.body;
    try {
      if (!bulk_titles || bulk_titles.trim() === '') {
        return res.redirect('/course-management?error=' + encodeURIComponent('Vui lòng nhập ít nhất một khóa học.'));
      }
      
      const titles = bulk_titles.split('\n').map(t => t.trim()).filter(t => t !== '');
      if (titles.length === 0) {
        return res.redirect('/course-management?error=' + encodeURIComponent('Vui lòng nhập ít nhất một khóa học hợp lệ.'));
      }

      let createdCount = 0;
      for (const title of titles) {
        const newCourse = await Course.create(title, '', '/images/default_course.svg', 'draft', 'open');
        await AuditLog.create(req.session.userId, 'COURSE_CREATE', { course_id: newCourse.id, title, note: 'Bulk created' });
        createdCount++;
      }

      await invalidateCourseCache();
      res.redirect(`/course-management?success=${encodeURIComponent(`Đã tạo hàng loạt ${createdCount} khóa học thành công.`)}`);
    } catch (err) {
      console.error('Lỗi khi tạo hàng loạt khóa học:', err);
      res.redirect('/course-management?error=' + encodeURIComponent('Có lỗi xảy ra khi tạo hàng loạt.'));
    }
  },

  updateCourse: async (req, res) => {
    if (!req.session.permissions.includes('COURSE_UPDATE')) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa khóa học.' });
    }
    const courseId = parseInt(req.params.id);
    const { title, description, image_url, status, enrollment_type } = req.body;
    try {
      await Course.update(courseId, title, description, image_url || '/images/default_course.svg', status, enrollment_type || 'open');
      
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
        courses
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
      const allLessons = await Lesson.findByCourseId(courseId);
      const chapters = await Chapter.findByCourseId(courseId);

      // Group lessons by chapter
      const chaptersData = chapters.map(ch => ({
        ...ch,
        lessons: allLessons.filter(l => l.chapter_id === ch.id)
      }));

      if (req.query.json === 'true') {
        return res.json({ chapters: chaptersData });
      }
      res.render('admin/lessons', { 
        course, 
        chapters: chaptersData,
        lessons: allLessons // keep it just in case
      });
    } catch (err) {
      if (req.query.json === 'true') {
        return res.status(500).json({ error: 'Lỗi tải danh sách bài học.' });
      }
      res.render('error', { message: 'Lỗi tải danh sách bài học.' });
    }
  },

  createChapter: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE')) {
      return res.status(403).json({ error: 'Không có quyền tạo chương.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { title, description, order_index } = req.body;
    try {
      await Chapter.create(courseId, title, description, parseInt(order_index) || 1);
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      res.render('error', { message: 'Lỗi tạo chương học.' });
    }
  },

  updateChapter: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền sửa chương.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { id } = req.params;
    const { title, description, order_index } = req.body;
    try {
      await Chapter.update(parseInt(id), title, description, parseInt(order_index) || 1);
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      res.render('error', { message: 'Lỗi cập nhật chương học.' });
    }
  },

  deleteChapter: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền xóa chương.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { id } = req.params;
    try {
      await Chapter.delete(parseInt(id));
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      res.render('error', { message: 'Lỗi xóa chương học.' });
    }
  },

  createChaptersBulk: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE')) {
      return res.status(403).json({ error: 'Không có quyền tạo chương.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { bulk_titles, start_order_index } = req.body;
    try {
      const titles = bulk_titles.split('\n').map(t => t.trim()).filter(t => t.length > 0);
      let orderIndex = parseInt(start_order_index) || 1;
      for (const title of titles) {
        await Chapter.create(courseId, title, '', orderIndex++);
      }
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi tạo nhiều chương:', err);
      res.render('error', { message: 'Lỗi tạo nhiều chương học.' });
    }
  },

  createLessonsBulk: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE')) {
      return res.status(403).json({ error: 'Không có quyền tạo bài học.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { chapter_id, start_order_index, titles, types, video_urls, attachment_urls } = req.body;
    try {
      if (!titles || !Array.isArray(titles)) {
        return res.status(400).json({ error: 'Dữ liệu bài học không hợp lệ.' });
      }

      let orderIndex = parseInt(start_order_index) || 1;
      
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i].trim();
        if (!title) continue;
        
        const type = types && types[i] ? types[i] : 'theory';
        const isQuiz = (type === 'quiz');
        
        const video = video_urls && video_urls[i] ? video_urls[i] : '';
        const attachment = attachment_urls && attachment_urls[i] ? attachment_urls[i] : '';
        
        const lesson = await Lesson.create(courseId, parseInt(chapter_id), title, '', video, attachment, orderIndex++, isQuiz);
        await AuditLog.create(req.session.userId, 'LESSON_CREATE', { course_id: courseId, chapter_id, lesson_title: title, is_quiz: isQuiz });
        
        // Nested Quiz handling
        if (isQuiz) {
          const lessonIndex = i + 1; // Frontend uses 1-indexed for tabs
          const qTextArray = req.body[`q_text_${lessonIndex}`];
          const qOptA = req.body[`q_optA_${lessonIndex}`];
          const qOptB = req.body[`q_optB_${lessonIndex}`];
          const qOptC = req.body[`q_optC_${lessonIndex}`];
          const qOptD = req.body[`q_optD_${lessonIndex}`];
          const qCorrect = req.body[`q_correct_${lessonIndex}`];

          if (qTextArray && Array.isArray(qTextArray)) {
            const db = require('../config/db');
            
            // 1. Tạo Quiz
            const quizRes = await db.query(
              `INSERT INTO quizzes (course_id, title, duration_minutes, passing_score, lesson_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [courseId, title, 15, 80, lesson.id]
            );
            const quizId = quizRes.rows[0].id;
            
            // 2. Tạo câu hỏi
            for (let j = 0; j < qTextArray.length; j++) {
              const text = qTextArray[j].trim();
              if (!text) continue;
              
              const options = [
                { id: 'A', text: qOptA[j] || '', is_correct: qCorrect[j] === 'A' },
                { id: 'B', text: qOptB[j] || '', is_correct: qCorrect[j] === 'B' },
                { id: 'C', text: qOptC[j] || '', is_correct: qCorrect[j] === 'C' },
                { id: 'D', text: qOptD[j] || '', is_correct: qCorrect[j] === 'D' }
              ];
              
              await db.query(
                `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES ($1, $2, $3, $4, $5)`,
                [quizId, text, 'multiple_choice', JSON.stringify(options), qCorrect[j]]
              );
            }
          }
        }
      }
      res.redirect(`/course-management/${courseId}/lessons`);
    } catch (err) {
      console.error('[Admin Controller] Lỗi tạo nhiều bài học:', err);
      res.render('error', { message: 'Lỗi tạo nhiều bài học.' });
    }
  },

  createLesson: async (req, res) => {
    if (!req.session.permissions.includes('LESSON_CREATE')) {
      return res.status(403).json({ error: 'Không có quyền tạo bài học.' });
    }
    const courseId = parseInt(req.params.courseId);
    const { chapter_id, title, content, video_url, attachment_url, order_index, lesson_type, q_text, q_optA, q_optB, q_optC, q_optD, q_correct, subtitle_url } = req.body;
    const isQuiz = lesson_type === 'quiz';

    if ((video_url || attachment_url || subtitle_url) && !req.session.permissions.includes('CONTENT_UPLOAD')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền tải lên video, đính kèm hoặc phụ đề.' });
    }

    try {
      const lesson = await Lesson.create(courseId, parseInt(chapter_id), title, content, video_url, attachment_url, parseInt(order_index) || 1, isQuiz, subtitle_url);
      await AuditLog.create(req.session.userId, 'LESSON_CREATE', { course_id: courseId, chapter_id, lesson_title: title, is_quiz: isQuiz });

      // Nếu là quiz và có truyền lên mảng câu hỏi
      if (isQuiz && q_text && Array.isArray(q_text)) {
        const db = require('../config/db');
        
        // 1. Tạo bản ghi Quiz liên kết với Lesson
        const quizRes = await db.query(
          `INSERT INTO quizzes (course_id, title, duration_minutes, passing_score, lesson_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [courseId, title, 15, 80, lesson.id]
        );
        const quizId = quizRes.rows[0].id;
        
        // 2. Chạy vòng lặp tạo câu hỏi
        for (let i = 0; i < q_text.length; i++) {
          const text = q_text[i].trim();
          if (!text) continue;
          
          const options = [
            { id: 'A', text: q_optA[i] || '', is_correct: q_correct[i] === 'A' },
            { id: 'B', text: q_optB[i] || '', is_correct: q_correct[i] === 'B' },
            { id: 'C', text: q_optC[i] || '', is_correct: q_correct[i] === 'C' },
            { id: 'D', text: q_optD[i] || '', is_correct: q_correct[i] === 'D' }
          ];
          
          await db.query(
            `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES ($1, $2, $3, $4, $5)`,
            [quizId, text, 'multiple_choice', JSON.stringify(options), q_correct[i]]
          );
        }
      }

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
    const { chapter_id, title, content, video_url, attachment_url, order_index, lesson_type, subtitle_url } = req.body;
    const isQuiz = lesson_type === 'quiz';

    if ((video_url || attachment_url || subtitle_url) && !req.session.permissions.includes('CONTENT_UPLOAD')) {
      return res.status(403).render('error', { message: 'Bạn không có quyền tải lên video, đính kèm hoặc phụ đề.' });
    }

    try {
      await Lesson.update(parseInt(id), parseInt(chapter_id), title, content, video_url, attachment_url, parseInt(order_index) || 1, isQuiz, subtitle_url);
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



  getGradeList: async (req, res) => {
    if (!req.session.permissions.includes('QUIZ_GRADE')) {
      return res.status(403).render('error', { message: 'Không có quyền xem kết quả thi.' });
    }
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      
      const search = req.query.search || '';
      const status = req.query.status || ''; // 'passed', 'failed', or '' (all)
      const assessmentId = req.query.assessmentId || ''; // specific assessment or '' (all)
      
      // Lấy danh sách kết quả bài kiểm tra doanh nghiệp phân trang
      const { total, submissions } = await AssessmentSubmission.findPagedSubmissions({
        search,
        status,
        assessmentId,
        limit,
        offset
      });
      
      // Lấy toàn bộ đề kiểm tra doanh nghiệp để hiển thị trong bộ lọc Dropdown
      const assessments = await Assessment.findAll();
      
      const totalPages = Math.ceil(total / limit) || 1;
      
      res.render('admin/grade', {
        submissions,
        assessments,
        totalCount: total,
        currentPage: page,
        totalPages,
        limit,
        filters: {
          search,
          status,
          assessmentId
        }
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải kết quả thi:', err);
      res.render('error', { message: 'Lỗi tải danh sách kết quả thi.' });
    }
  },


  assignMandatoryCourse: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_ASSIGN')) {
      return res.status(403).json({ error: 'Không có quyền giao khóa học bắt buộc.' });
    }
    const { targetType, targetId, courseId, timeLimitDays } = req.body;
    try {
      const cId = parseInt(courseId);
      let assignedCount = 0;

      let deadline = null;
      if (timeLimitDays && !isNaN(timeLimitDays) && parseInt(timeLimitDays) > 0) {
        deadline = new Date();
        deadline.setDate(deadline.getDate() + parseInt(timeLimitDays));
      }

      if (targetType === 'user') {
        const uId = parseInt(targetId);
        // Đăng ký bắt buộc, tự động duyệt
        await Enrollment.create(uId, cId, true, 'approved', deadline);
        assignedCount = 1;
        await AuditLog.create(req.session.userId, 'COURSE_ASSIGN_USER', { user_id: uId, course_id: cId, deadline });
      } else if (targetType === 'department') {
        const deptId = parseInt(targetId);
        // Tìm toàn bộ user thuộc phòng ban này
        const sql = 'SELECT id FROM users WHERE department_id = $1 AND status = \'active\'';
        const usersInDept = await require('../config/db').query(sql, [deptId]);
        
        for (let u of usersInDept.rows) {
          await Enrollment.create(u.id, cId, true, 'approved', deadline);
          assignedCount++;
        }
        await AuditLog.create(req.session.userId, 'COURSE_ASSIGN_DEPARTMENT', { department_id: deptId, course_id: cId, count: assignedCount, deadline });
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

  assignCourseBulk: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_ASSIGN')) {
      return res.status(403).json({ error: 'Không có quyền giao khóa học học tập.' });
    }
    const courseId = parseInt(req.params.id);
    const { userIds, departmentIds, timeLimitDays } = req.body;

    try {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.redirect('/course-management?error=' + encodeURIComponent('Khóa học không tồn tại.'));
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
        return res.redirect('/course-management?error=' + encodeURIComponent('Vui lòng chọn ít nhất một cá nhân hoặc phòng ban để giao khóa học.'));
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
        return res.redirect('/course-management?error=' + encodeURIComponent('Không tìm thấy nhân sự phù hợp nào trong đối tượng đã chọn.'));
      }

      // Tính toán deadline dựa trên số ngày chỉ định
      let deadline = null;
      if (timeLimitDays && !isNaN(timeLimitDays) && parseInt(timeLimitDays) > 0) {
        deadline = new Date();
        deadline.setDate(deadline.getDate() + parseInt(timeLimitDays));
      }

      let assignedCount = 0;
      // Giao khóa học cho từng nhân sự
      for (let uId of targetUserIds) {
        await Enrollment.create(uId, courseId, true, 'approved', deadline);
        assignedCount++;
      }

      // Lưu log Audit Log tổng hợp
      await AuditLog.create(req.session.userId, 'COURSE_ASSIGN_BULK', {
        course_id: courseId,
        user_count: assignedCount,
        selected_users: uIds,
        selected_departments: dIds,
        deadline
      });

      // Thông báo qua WebSocket
      try {
        const { getIO } = require('../config/socket');
        const io = getIO();
        io.emit('course_assigned_notification', { courseId, userIds: uIds, departmentIds: dIds });
      } catch (ioErr) {
        console.warn('[Admin Controller] Không thể gửi Socket notification:', ioErr.message);
      }

      res.redirect('/course-management?success=' + encodeURIComponent(`Giao thành công khóa học "${course.title}" cho ${assignedCount} nhân sự.`));
    } catch (err) {
      console.error('[Admin Controller] Lỗi giao khóa học:', err);
      res.redirect('/course-management?error=' + encodeURIComponent('Lỗi hệ thống khi giao khóa học.'));
    }
  },

  getEnrollmentApprovals: async (req, res) => {
    if (!req.session.permissions.includes('ENROLL_APPROVE')) {
      return res.status(403).render('error', { message: 'Không có quyền duyệt đăng ký.' });
    }
    try {
      const pendings = await Enrollment.findAllPending();
      res.render('admin/approvals', { pendings });
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
      const enrollment = await Enrollment.updateStatus(enrollmentId, action);
      await AuditLog.create(req.session.userId, `ENROLLMENT_${action.toUpperCase()}`, { enrollment_id: enrollmentId });

      // Gửi thông báo WebSocket real-time
      try {
        const { emitToUser, getIO } = require('../config/socket');
        const course = await Course.findById(enrollment.course_id);
        if (course) {
          emitToUser(enrollment.user_id, 'enrollment_status_changed', {
            courseId: enrollment.course_id,
            courseTitle: course.title,
            action: action
          });
        }
        
        // Broadcast để giảm số lượng hàng chờ duyệt trên dashboard của các admin khác
        const io = getIO();
        io.emit('enroll_request_processed');
      } catch (ioErr) {
        console.warn('[Admin Controller] Không thể gửi Socket notification phê duyệt:', ioErr.message);
      }

      res.redirect('/approvals');
    } catch (err) {
      console.error('[Admin Controller] Lỗi cập nhật trạng thái đăng ký:', err);
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
      const eligibleManagers = await User.findEligibleManagers();
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
        eligibleManagers,
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (err) {
      console.error('[Admin Controller] Lỗi tải trang phòng ban:', err);
      res.render('error', { message: 'Lỗi tải trang quản lý phòng ban.' });
    }
  },

  assignDepartmentManager: async (req, res) => {
    if (!req.session.permissions.includes('DEPARTMENT_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý sơ đồ phòng ban.' });
    }
    const id = parseInt(req.params.id);
    const { managerId } = req.body;
    try {
      const departments = await Department.findAll();
      const targetDept = departments.find(d => d.id === id);
      if (!targetDept) {
        return res.redirect('/departments?error=' + encodeURIComponent('Phòng ban không tồn tại.'));
      }

      const mId = managerId === '' ? null : parseInt(managerId);
      await Department.assignManager(id, mId);

      // Ghi log
      await AuditLog.create(req.session.userId, 'DEPARTMENT_ASSIGN_MANAGER', {
        department_id: id,
        department_name: targetDept.name,
        manager_id: mId
      });

      res.redirect('/departments?success=' + encodeURIComponent(`Đã phân công Trưởng phòng ban "${targetDept.name}" thành công.`));
    } catch (err) {
      console.error('[Admin Controller] Lỗi gán Trưởng phòng ban:', err);
      res.redirect('/departments?error=' + encodeURIComponent('Lỗi hệ thống khi phân công Trưởng phòng ban.'));
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

  deleteUser: async (req, res) => {
    if (!req.session.permissions.includes('USER_MANAGE')) {
      return res.status(403).json({ error: 'Không có quyền quản lý nhân sự.' });
    }
    const uId = parseInt(req.params.id);
    if (uId === parseInt(req.session.userId)) {
      return res.redirect('/users?createError=' + encodeURIComponent('Bạn không thể tự xóa tài khoản của chính mình.'));
    }
    if (uId === 1) {
      return res.redirect('/users?createError=' + encodeURIComponent('Không thể xóa tài khoản Super Admin mặc định.'));
    }
    try {
      const targetUser = await User.findById(uId);
      if (!targetUser) {
        return res.redirect('/users?createError=' + encodeURIComponent('Không tìm thấy thông tin nhân viên để xóa.'));
      }
      
      await User.delete(uId);
      
      // Xóa cache trạng thái và quyền hạn để thay đổi có hiệu lực ngay lập tức
      await redis.del(`user_status:${uId}`);
      await redis.del(`role_permissions:${targetUser.role_id}`);
      
      // Ghi nhật ký hệ thống
      await AuditLog.create(req.session.userId, 'USER_DELETE', { 
        target_user_id: uId, 
        username: targetUser.username, 
        email: targetUser.email 
      });
      
      res.redirect('/users?createSuccess=' + encodeURIComponent(`Đã xóa vĩnh viễn tài khoản của "${targetUser.username}" thành công.`));
    } catch (err) {
      console.error('[Admin Controller] Lỗi xóa nhân sự:', err);
      res.redirect('/users?createError=' + encodeURIComponent('Có lỗi xảy ra khi xóa tài khoản.'));
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
      // Không mã hóa mật khẩu (Lưu mật khẩu dạng plain text)
      const hashedPassword = password;
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
        { value: 'COURSE_ASSIGN_BULK', label: 'Giao khóa học hàng loạt' },
        { value: 'LESSON_CREATE', label: 'Thêm bài giảng' },
        { value: 'LESSON_UPDATE', label: 'Sửa bài giảng' },
        { value: 'LESSON_DELETE', label: 'Xóa bài giảng' },
        { value: 'PATH_CREATE', label: 'Tạo lộ trình đào tạo' },
        { value: 'PATH_UPDATE', label: 'Cập nhật lộ trình đào tạo' },
        { value: 'PATH_DELETE', label: 'Xóa lộ trình đào tạo' },
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

