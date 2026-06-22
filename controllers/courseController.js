const redis = require('../config/redis');
const { Course, Lesson, Enrollment, Comment, Quiz, QuizSubmission, LearningPath, User } = require('../models/schema');

module.exports = {
  // Trang tổng quan của học viên (Dashboard)
  getDashboard: async (req, res) => {
    const userId = req.session.userId;
    const permissions = req.session.permissions || [];

    // Kiểm tra các nhóm quyền hạn
    const studentPermissions = ['PATH_VIEW', 'COURSE_ENROLL_REQUEST', 'HISTORY_VIEW', 'PROGRESS_TRACK'];
    const hasStudentAccess = permissions.some(p => studentPermissions.includes(p));

    const adminPermissions = [
      'COURSE_VIEW', 'QUIZ_BANK_VIEW', 'LESSON_CREATE', 'LESSON_MANAGE', 
      'QUIZ_GRADE', 'PATH_MANAGE', 'ENROLL_APPROVE', 'ENROLL_ASSIGN',
      'USER_VIEW', 'USER_MANAGE', 'DEPARTMENT_MANAGE',
      'REPORT_VIEW', 'REPORT_EXPORT',
      'ROLE_MANAGE', 'AUDIT_LOG_VIEW'
    ];
    const hasAdminAccess = permissions.some(p => adminPermissions.includes(p));

    // Nếu không có bất kỳ quyền học tập nào nhưng có quyền quản lý thì redirect sang Admin Dashboard
    if (!hasStudentAccess && hasAdminAccess) {
      return res.redirect('/management');
    }

    try {
      let enrollments = [];
      let pendingEnrollments = [];
      let rejectedEnrollments = [];
      let submissions = [];
      let pathsWithCourses = [];

      // 1. Lấy thông tin các khóa học nhân viên đăng ký (chỉ khi có quyền truy cập khóa học / tiến độ)
      if (permissions.includes('COURSE_ENROLL_REQUEST') || permissions.includes('PROGRESS_TRACK')) {
        const allEnrollments = await Enrollment.findUserAllEnrollments(userId);
        enrollments = allEnrollments.filter(e => e.status === 'approved');
        pendingEnrollments = allEnrollments.filter(e => e.status === 'pending');
        rejectedEnrollments = allEnrollments.filter(e => e.status === 'rejected');
      }

      // 2. Lấy kết quả thi trắc nghiệm đã thực hiện (chỉ khi có quyền xem lịch sử thi)
      if (permissions.includes('HISTORY_VIEW')) {
        submissions = await QuizSubmission.findByUser(userId);
      }

      // 3. Lấy tất cả lộ trình học tập để hiển thị gợi ý (chỉ khi có quyền xem lộ trình)
      if (permissions.includes('PATH_VIEW')) {
        const learningPaths = await LearningPath.findAll();
        for (let path of learningPaths) {
          const pathCourses = await LearningPath.getCourses(path.id);
          pathsWithCourses.push({
            ...path,
            courses: pathCourses
          });
        }
      }

      res.render('dashboard', {
        user: {
          username: req.session.username,
          roleName: req.session.roleName,
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        },
        enrollments,
        pendingEnrollments,
        rejectedEnrollments,
        submissions,
        pathsWithCourses
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi tải dashboard:', err);
      res.render('error', { message: 'Không thể tải bảng điều khiển học tập cá nhân.' });
    }
  },

  // Danh sách khóa học công khai (Tích hợp Redis Cache)
  getCourses: async (req, res) => {
    const cacheKey = 'courses:published';

    try {
      // Sử dụng helper getOrSet để tối ưu hóa code và tăng khả năng chịu lỗi (fault-tolerance)
      const courses = await redis.getOrSet(cacheKey, async () => {
        return await Course.findAllPublished();
      }, 3600);

      res.render('courses/index', { 
        courses,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi lấy danh sách khóa học:', err);
      // Fallback: Đọc trực tiếp DB nếu Redis bị lỗi
      try {
        const courses = await Course.findAllPublished();
        return res.render('courses/index', { courses, user: { permissions: req.session.permissions } });
      } catch (dbErr) {
        res.render('error', { message: 'Không thể lấy danh sách khóa học.' });
      }
    }
  },

  // Chi tiết khóa học (danh sách bài giảng)
  getCourseDetail: async (req, res) => {
    const courseId = parseInt(req.params.id);
    const userId = req.session.userId;

    try {
      const course = await Course.findById(courseId);
      if (!course || (course.status !== 'published' && !req.session.permissions.includes('COURSE_UPDATE'))) {
        return res.status(404).render('error', { message: 'Khóa học không tồn tại hoặc chưa được xuất bản.' });
      }

      const lessons = await Lesson.findByCourseId(courseId);
      const enrollment = await Enrollment.findByUserAndCourse(userId, courseId);
      const quiz = await Quiz.findByCourseId(courseId);

      res.render('courses/detail', {
        course,
        lessons,
        enrollment,
        quiz,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi tải chi tiết khóa học:', err);
      res.render('error', { message: 'Có lỗi xảy ra khi tải khóa học.' });
    }
  },

  // Đăng ký học (hoặc gửi yêu cầu duyệt)
  enrollCourse: async (req, res) => {
    const courseId = parseInt(req.params.id);
    const userId = req.session.userId;

    try {
      const course = await Course.findById(courseId);
      if (!course || course.status !== 'published') {
        return res.status(404).render('error', { message: 'Khóa học không hợp lệ.' });
      }

      // Đăng ký khóa học:
      // Khóa Bảo mật thông tin (ID 2) yêu cầu duyệt, các khóa khác duyệt tự động
      const status = (courseId === 2) ? 'pending' : 'approved';
      await Enrollment.create(userId, courseId, false, status);

      // Thêm log đăng ký
      const { AuditLog } = require('../models/schema');
      await AuditLog.create(userId, status === 'pending' ? 'ENROLL_REQUEST' : 'ENROLL_DIRECT', { course_id: courseId, title: course.title });

      // Nếu cần duyệt, thông báo real-time qua Socket cho Admin
      if (status === 'pending') {
        try {
          const { getIO } = require('../config/socket');
          const io = getIO();
          io.emit('enroll_request_notification', { userId, username: req.session.username, courseId, courseTitle: course.title });
        } catch (ioErr) {
          console.warn('[Course Controller] Không thể gửi Socket notification:', ioErr.message);
        }
      }

      res.redirect(`/courses/${courseId}`);
    } catch (err) {
      console.error('[Course Controller] Lỗi đăng ký khóa học:', err);
      res.render('error', { message: 'Không thể đăng ký học khóa này.' });
    }
  },

  // Giao diện xem bài giảng chi tiết (Core Learning Interface)
  getLesson: async (req, res) => {
    const courseId = parseInt(req.params.courseId);
    const lessonId = parseInt(req.params.lessonId);
    const userId = req.session.userId;

    try {
      // 1. Kiểm tra học viên đã đăng ký học khóa này chưa
      const enrollment = await Enrollment.findByUserAndCourse(userId, courseId);
      if (!enrollment || enrollment.status !== 'approved') {
        return res.redirect(`/courses/${courseId}`);
      }

      // 2. Lấy thông tin bài học và tất cả bài học trong khóa
      const lesson = await Lesson.findById(lessonId);
      if (!lesson || lesson.course_id !== courseId) {
        return res.status(404).render('error', { message: 'Bài học không tìm thấy.' });
      }

      const lessons = await Lesson.findByCourseId(courseId);

      const currentIdx = lessons.findIndex(l => l.id === lessonId);
      const totalLessons = lessons.length;

      // 3. Kiểm tra xem bài học hiện tại có bị khóa không dựa trên tiến độ trước đó
      const requiredProgressForThisLesson = Math.round((currentIdx / totalLessons) * 100);
      if (currentIdx > 0 && enrollment.progress < requiredProgressForThisLesson) {
        // Tìm bài học hợp lệ gần nhất chưa bị khóa để chuyển hướng học viên về đó
        const lastUnlockedIdx = Math.max(0, Math.min(
          totalLessons - 1,
          Math.floor((enrollment.progress / 100) * totalLessons)
        ));
        const redirectLessonId = lessons[lastUnlockedIdx].id;
        return res.redirect(`/courses/${courseId}/lessons/${redirectLessonId}`);
      }

      // Tính toán và cập nhật tiến độ học tập (Progress)
      const calculatedProgress = Math.max(
        enrollment.progress, 
        Math.round(((currentIdx + 1) / totalLessons) * 100)
      );

      // Lưu tiến độ học mới vào PostgreSQL CSDL
      await Enrollment.updateProgress(userId, courseId, calculatedProgress);

      // 4. Lấy lịch sử bình luận / thảo luận bài học
      const comments = await Comment.findByLessonId(lessonId);

      // 5. Kiểm tra xem khóa học có bài kiểm tra trắc nghiệm không
      const quiz = await Quiz.findByCourseId(courseId);

      res.render('courses/lesson', {
        courseId,
        lesson,
        lessons,
        currentIdx,
        enrollment: { ...enrollment, progress: calculatedProgress },
        comments,
        quiz,
        user: {
          id: userId,
          username: req.session.username,
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi xem bài giảng:', err);
      res.render('error', { message: 'Không thể tải nội dung bài giảng.' });
    }
  },

  // Xem và tải chứng nhận hoàn thành khóa học
  getCertificate: async (req, res) => {
    const courseId = parseInt(req.params.id);
    const userId = req.session.userId;

    try {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).render('error', { message: 'Khóa học không tồn tại.' });
      }

      const enrollment = await Enrollment.findByUserAndCourse(userId, courseId);
      if (!enrollment || enrollment.status !== 'approved' || enrollment.progress < 100) {
        return res.status(403).render('error', { message: 'Bạn chưa hoàn thành khóa học này để nhận chứng chỉ.' });
      }

      // Render trang chứng chỉ độc lập
      res.render('courses/certificate', {
        course,
        enrollment,
        user: {
          username: req.session.username,
        },
        completionDate: new Date(enrollment.last_accessed).toLocaleDateString('vi-VN')
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi tải chứng nhận:', err);
      res.render('error', { message: 'Không thể tải chứng nhận khóa học.' });
    }
  },

  // Lộ trình học tập của tôi
  getMyPaths: async (req, res) => {
    const userId = req.session.userId;
    try {
      const learningPaths = await LearningPath.findAll();
      const pathsWithCourses = [];
      for (let path of learningPaths) {
        const pathCourses = await LearningPath.getCourses(path.id);
        let totalProgress = 0;
        let enrolledCount = 0;
        const coursesWithProgress = [];
        
        for (let c of pathCourses) {
          const enrollment = await Enrollment.findByUserAndCourse(userId, c.id);
          const progress = (enrollment && enrollment.status === 'approved') ? enrollment.progress : 0;
          if (enrollment && enrollment.status === 'approved') {
            enrolledCount++;
            totalProgress += progress;
          }
          coursesWithProgress.push({
            ...c,
            progress,
            isEnrolled: !!enrollment && enrollment.status === 'approved',
            isPending: !!enrollment && enrollment.status === 'pending'
          });
        }
        
        const averageProgress = pathCourses.length > 0 ? Math.round(totalProgress / pathCourses.length) : 0;
        
        pathsWithCourses.push({
          ...path,
          courses: coursesWithProgress,
          progress: averageProgress,
          enrolledCount,
          totalCourses: pathCourses.length
        });
      }
      
      res.render('courses/my-paths', {
        paths: pathsWithCourses,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi lấy lộ trình học viên:', err);
      res.render('error', { message: 'Không thể tải lộ trình học tập cá nhân.' });
    }
  },

  // Lịch sử & Thành tựu
  getMyHistory: async (req, res) => {
    const userId = req.session.userId;
    try {
      const submissions = await QuizSubmission.findByUser(userId);
      const enrollments = await Enrollment.findUserEnrollments(userId);
      const completedCourses = enrollments.filter(e => e.progress === 100);
      
      res.render('courses/my-history', {
        submissions,
        completedCourses,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi lấy lịch sử học tập:', err);
      res.render('error', { message: 'Không thể tải lịch sử học tập.' });
    }
  },

  // Lịch học & Deadline
  getMyDeadlines: async (req, res) => {
    const userId = req.session.userId;
    try {
      const enrollments = await Enrollment.findUserAllEnrollments(userId);
      const approvedEnrollments = enrollments.filter(e => e.status === 'approved');
      
      // Giả lập thời gian hoàn thành bắt buộc là 30 ngày từ lúc bắt đầu/giao khóa học
      const deadlines = approvedEnrollments.map(e => {
        const enrollDate = new Date(e.created_at);
        const deadlineDate = new Date(enrollDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const timeDiff = deadlineDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        let status = 'active';
        if (e.progress === 100) {
          status = 'completed';
        } else if (daysRemaining < 0) {
          status = 'overdue';
        } else if (daysRemaining <= 7) {
          status = 'warning';
        }
        
        return {
          ...e,
          deadlineDate: deadlineDate.toLocaleDateString('vi-VN'),
          daysRemaining,
          status
        };
      });
      
      res.render('courses/my-deadlines', {
        deadlines,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi lấy lịch trình và deadline:', err);
      res.render('error', { message: 'Không thể tải lịch học và deadline.' });
    }
  },

  // Cài đặt tài khoản
  getSettings: async (req, res) => {
    const userId = req.session.userId;
    try {
      const userDetails = await User.findById(userId);
      res.render('courses/settings', {
        userDetails,
        success: req.query.success || null,
        error: req.query.error || null,
        user: {
          permissions: req.session.permissions,
          isImpersonating: req.session.isImpersonating || false
        }
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi hiển thị cài đặt:', err);
      res.render('error', { message: 'Không thể tải trang cài đặt tài khoản.' });
    }
  },

  // Đổi mật khẩu bảo mật
  postChangePassword: async (req, res) => {
    const userId = req.session.userId;
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const bcrypt = require('bcryptjs');
    
    try {
      const db = require('../config/db');
      const userRes = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) {
        return res.redirect('/settings?error=' + encodeURIComponent('Không tìm thấy tài khoản.'));
      }
      
      const currentPasswordHash = userRes.rows[0].password;
      
      // Kiểm tra mật khẩu cũ
      const isMatch = (oldPassword === currentPasswordHash) || (currentPasswordHash.startsWith('$2') && await bcrypt.compare(oldPassword, currentPasswordHash));
      if (!isMatch) {
        return res.redirect('/settings?error=' + encodeURIComponent('Mật khẩu cũ không chính xác.'));
      }
      
      // Kiểm tra khớp mật khẩu mới
      if (newPassword !== confirmPassword) {
        return res.redirect('/settings?error=' + encodeURIComponent('Mật khẩu xác nhận không khớp.'));
      }
      
      if (newPassword.length < 6) {
        return res.redirect('/settings?error=' + encodeURIComponent('Mật khẩu mới phải từ 6 ký tự trở lên.'));
      }
      
      // Mã hóa mật khẩu
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Cập nhật DB
      await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
      
      // Nhật ký hệ thống
      const { AuditLog } = require('../models/schema');
      await AuditLog.create(userId, 'PASSWORD_RESET_SUCCESS', { reason: 'user_settings_change' }, req.ip);
      
      res.redirect('/settings?success=' + encodeURIComponent('Đổi mật khẩu tài khoản thành công!'));
    } catch (err) {
      console.error('[Course Controller] Lỗi thay đổi mật khẩu:', err);
      res.redirect('/settings?error=' + encodeURIComponent('Có lỗi hệ thống xảy ra khi đổi mật khẩu.'));
    }
  }
};
