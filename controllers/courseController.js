const redis = require('../config/redis');
const { Course, Lesson, Enrollment, Comment, Quiz, Question, QuizSubmission, LearningPath, User, AuditLog, Report } = require('../models/schema');

module.exports = {
  // Trang tổng quan tích hợp (Unified Dashboard)
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

    try {
      let enrollments = [];
      let pendingEnrollments = [];
      let rejectedEnrollments = [];
      let submissions = [];
      let pathsWithCourses = [];
      let myAssessments = [];
      
      const stats = {
        totalUsers: null,
        totalCourses: null,
        pendingApprovals: null,
        onlineCount: 0
      };
      let recentLogs = [];

      // 1. Lấy thông tin học tập nếu người dùng có quyền
      if (hasStudentAccess) {
        if (permissions.includes('COURSE_ENROLL_REQUEST') || permissions.includes('PROGRESS_TRACK')) {
          const allEnrollments = await Enrollment.findUserAllEnrollments(userId);
          enrollments = allEnrollments.filter(e => e.status === 'approved');
          pendingEnrollments = allEnrollments.filter(e => e.status === 'pending');
          rejectedEnrollments = allEnrollments.filter(e => e.status === 'rejected');
        }

        if (permissions.includes('HISTORY_VIEW')) {
          submissions = await QuizSubmission.findByUser(userId);
        }

        if (permissions.includes('PATH_VIEW')) {
          const learningPaths = await LearningPath.findAll();
          // Lấy tối đa 3 lộ trình mới nhất để gợi ý trên dashboard
          const latestPaths = learningPaths.slice(0, 3);
          for (let path of latestPaths) {
            const pathCourses = await LearningPath.getCourses(path.id);
            pathsWithCourses.push({
              ...path,
              courses: pathCourses
            });
          }
        }

        // Lấy danh sách bài kiểm tra doanh nghiệp được phân phối
        const { Assessment } = require('../models/schema');
        myAssessments = await Assessment.findForUser(userId, req.session.departmentId || null);
      }

      // 2. Lấy thông tin thống kê quản trị nếu người dùng có quyền quản lý
      if (hasAdminAccess) {
        if (permissions.includes('USER_VIEW') || permissions.includes('USER_MANAGE')) {
          const users = await User.findAll();
          stats.totalUsers = users.length;
        }

        if (permissions.includes('COURSE_VIEW')) {
          const courses = await Course.findAll();
          stats.totalCourses = courses.length;
        }

        if (permissions.includes('ENROLL_APPROVE')) {
          const pendingEnrollmentsData = await Enrollment.findAllPending();
          stats.pendingApprovals = pendingEnrollmentsData.length;
        }

        if (permissions.includes('AUDIT_LOG_VIEW')) {
          const logs = await AuditLog.findAll();
          recentLogs = logs.slice(0, 10);
        }

        if (permissions.includes('REPORT_VIEW')) {
          try {
            stats.completionStats = await Report.getCompletionStats();
            stats.departmentStats = await Report.getDepartmentStats();
          } catch (reportErr) {
            console.error('[Course Controller] Lỗi lấy báo cáo thống kê quản trị:', reportErr);
            stats.completionStats = [];
            stats.departmentStats = [];
          }
        }

        stats.onlineCount = await redis.scard('online_users');
      }

      res.render('dashboard', {
        hasStudentAccess,
        hasAdminAccess,
        stats,
        recentLogs,
        enrollments,
        pendingEnrollments,
        rejectedEnrollments,
        submissions,
        pathsWithCourses,
        myAssessments
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi tải dashboard tích hợp:', err);
      res.render('error', { message: 'Không thể tải bảng điều khiển hệ thống.' });
    }
  },

  // Danh sách khóa học công khai (Tích hợp Redis Cache)
  getCourses: async (req, res) => {
    const cacheKey = 'courses:published';
    const userId = req.session.userId;

    try {
      // Sử dụng helper getOrSet để tối ưu hóa code và tăng khả năng chịu lỗi (fault-tolerance)
      const courses = await redis.getOrSet(cacheKey, async () => {
        return await Course.findAllPublished();
      }, 3600);

      const userEnrollments = await Enrollment.findUserAllEnrollments(userId);
      const enrollMap = {};
      userEnrollments.forEach(e => {
        enrollMap[e.course_id] = e;
      });

      const coursesWithEnrollment = courses.map(c => {
        const enrollment = enrollMap[c.id];
        return {
          ...c,
          isEnrolled: enrollment && enrollment.status === 'approved',
          isPending: enrollment && enrollment.status === 'pending',
          isRejected: enrollment && enrollment.status === 'rejected',
          progress: enrollment ? enrollment.progress : 0
        };
      });

      res.render('courses/index', { 
        courses: coursesWithEnrollment
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi lấy danh sách khóa học:', err);
      // Fallback: Đọc trực tiếp DB nếu Redis bị lỗi
      try {
        const courses = await Course.findAllPublished();
        const userEnrollments = await Enrollment.findUserAllEnrollments(userId);
        const enrollMap = {};
        userEnrollments.forEach(e => {
          enrollMap[e.course_id] = e;
        });

        const coursesWithEnrollment = courses.map(c => {
          const enrollment = enrollMap[c.id];
          return {
            ...c,
            isEnrolled: enrollment && enrollment.status === 'approved',
            isPending: enrollment && enrollment.status === 'pending',
            isRejected: enrollment && enrollment.status === 'rejected',
            progress: enrollment ? enrollment.progress : 0
          };
        });

        return res.render('courses/index', { 
          courses: coursesWithEnrollment 
        });
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
      let enrollment = await Enrollment.findByUserAndCourse(userId, courseId);
      const quiz = await Quiz.findByCourseId(courseId);

      const canManage = req.session.permissions && (
        req.session.permissions.includes('LESSON_MANAGE') || 
        req.session.permissions.includes('LESSON_CREATE') ||
        req.session.permissions.includes('COURSE_UPDATE')
      );

      if (canManage && (!enrollment || enrollment.status !== 'approved')) {
        enrollment = {
          id: null,
          user_id: userId,
          course_id: courseId,
          status: 'approved',
          progress: 100,
          is_assigned: false,
          deadline: null
        };
      }

      res.render('courses/detail', {
        course,
        lessons,
        enrollment,
        quiz
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

      // Nếu hình thức là 'restricted' thì cần phê duyệt (status = pending), ngược lại thì tự duyệt ngay (approved)
      const status = (course.enrollment_type === 'restricted') ? 'pending' : 'approved';
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
      let enrollment = await Enrollment.findByUserAndCourse(userId, courseId);
      const canManage = req.session.permissions && (
        req.session.permissions.includes('LESSON_MANAGE') || 
        req.session.permissions.includes('LESSON_CREATE') ||
        req.session.permissions.includes('COURSE_UPDATE')
      );

      if (canManage && (!enrollment || enrollment.status !== 'approved')) {
        enrollment = {
          id: null,
          user_id: userId,
          course_id: courseId,
          status: 'approved',
          progress: 100,
          is_assigned: false,
          deadline: null
        };
      }

      if (!enrollment || enrollment.status !== 'approved') {
        return res.redirect(`/courses/${courseId}`);
      }

      // 2. Lấy danh sách tất cả bài học trong khóa
      const lessons = await Lesson.findByCourseId(courseId);
      if (lessons.length === 0) {
        return res.status(404).render('error', { message: 'Khóa học này chưa có bài học nào.' });
      }

      // 3. Kiểm tra thông tin bài học hiện tại
      let lesson = await Lesson.findById(lessonId);

      // Nếu bài học không tồn tại, hoặc không thuộc về khóa học này, chuyển hướng đến bài học thích hợp dựa trên tiến trình hoặc bài đầu tiên
      if (!lesson || lesson.course_id !== courseId) {
        let redirectLessonId;
        if (enrollment.progress === 100) {
          // Đã hoàn thành khóa học, quay lại bài 1 để ôn tập
          redirectLessonId = lessons[0].id;
        } else {
          // Đang học dở, tìm bài học chưa học tiếp theo dựa trên tiến độ
          const lastUnlockedIdx = Math.max(0, Math.min(
            lessons.length - 1,
            Math.floor((enrollment.progress / 100) * lessons.length)
          ));
          redirectLessonId = lessons[lastUnlockedIdx].id;
        }
        return res.redirect(`/courses/${courseId}/lessons/${redirectLessonId}`);
      }

      const currentIdx = lessons.findIndex(l => l.id === lessonId);
      const totalLessons = lessons.length;

      // 4. Kiểm tra xem bài học hiện tại có bị khóa không dựa trên tiến độ trước đó
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

      // Xử lý tiến độ và bài kiểm tra tự sinh
      let calculatedProgress = enrollment.progress;
      let lessonQuiz = null;
      let lessonQuestions = [];
      let isQuizPassed = false;

      if (lesson.is_quiz) {
        // 1. Tìm hoặc tự động tạo đề thi cho bài kiểm tra này
        lessonQuiz = await Quiz.findByLessonId(lessonId);
        if (!lessonQuiz) {
          lessonQuiz = await Quiz.createLessonQuiz(courseId, lessonId, `Bài kiểm tra: ${lesson.title}`, 15, 100);
        }

        // 2. Lấy danh sách câu hỏi
        lessonQuestions = await Question.findByQuizId(lessonQuiz.id);

        // 3. Nếu chưa có câu hỏi nào, tự động gọi AI sinh ra 10 câu hỏi
        if (lessonQuestions.length === 0) {
          // Lấy nội dung các bài học trước đó (ngược từ currentIdx - 1 đến khi gặp bài kiểm tra khác hoặc đầu khóa)
          let combinedContent = '';
          for (let i = currentIdx - 1; i >= 0; i--) {
            if (lessons[i].is_quiz) break;
            combinedContent += `Tiêu đề: ${lessons[i].title}\nNội dung: ${lessons[i].content || ''}\n\n`;
          }

          if (combinedContent.trim() === '') {
            combinedContent = `Nội dung tổng quát của khóa học: ${lesson.title}`;
          }

          const geminiService = require('../services/geminiService');
          const generated = await geminiService.generateLessonQuiz(lesson.title, combinedContent, 10);
          
          // Lưu câu hỏi vào CSDL
          for (const q of generated) {
            await Question.create(lessonQuiz.id, q.question_text, 'multiple_choice', q.options, q.correct_answer);
          }

          // Lấy lại danh sách câu hỏi đã lưu
          lessonQuestions = await Question.findByQuizId(lessonQuiz.id);
        }

        // 4. Kiểm tra xem học viên đã vượt qua bài kiểm tra này chưa (đạt 100%)
        const passedSubmission = await QuizSubmission.findUserPassedSubmission(userId, lessonQuiz.id);
        if (passedSubmission) {
          isQuizPassed = true;
          // Nếu đã qua bài kiểm tra, đảm bảo tiến độ tối thiểu đã cập nhật cho bài này
          calculatedProgress = Math.max(
            enrollment.progress,
            Math.round(((currentIdx + 1) / totalLessons) * 100)
          );
          if (enrollment.id !== null) {
            await Enrollment.updateProgress(userId, courseId, calculatedProgress);
          }
        }
      } else {
        // Bài lý thuyết/Video: tự động cập nhật tiến độ khi xem
        calculatedProgress = Math.max(
          enrollment.progress, 
          Math.round(((currentIdx + 1) / totalLessons) * 100)
        );
        if (enrollment.id !== null) {
          await Enrollment.updateProgress(userId, courseId, calculatedProgress);
        }
      }

      // 4. Lấy lịch sử bình luận / thảo luận bài học
      const comments = await Comment.findByLessonId(lessonId);

      // 5. Kiểm tra xem khóa học có bài kiểm tra trắc nghiệm cuối khóa không (lesson_id IS NULL)
      const quiz = await Quiz.findByCourseId(courseId);

      res.render('courses/lesson', {
        courseId,
        lesson,
        lessons,
        currentIdx,
        enrollment: { ...enrollment, progress: calculatedProgress },
        comments,
        quiz,
        lessonQuiz,
        lessonQuestions,
        isQuizPassed
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi xem bài giảng:', err);
      res.render('error', { message: 'Không thể tải nội dung bài giảng.' });
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
        let isMandatory = false;
        
        for (let c of pathCourses) {
          const enrollment = await Enrollment.findByUserAndCourse(userId, c.id);
          const progress = (enrollment && enrollment.status === 'approved') ? enrollment.progress : 0;
          const isEnrolled = !!enrollment && enrollment.status === 'approved';
          if (isEnrolled) {
            enrolledCount++;
            totalProgress += progress;
            if (enrollment.is_assigned) {
              isMandatory = true;
            }
          }
          coursesWithProgress.push({
            ...c,
            progress,
            isEnrolled,
            isPending: !!enrollment && enrollment.status === 'pending',
            isAssigned: !!enrollment && !!enrollment.is_assigned
          });
        }
        
        const averageProgress = pathCourses.length > 0 ? Math.round(totalProgress / pathCourses.length) : 0;
        
        pathsWithCourses.push({
          ...path,
          courses: coursesWithProgress,
          progress: averageProgress,
          enrolledCount,
          totalCourses: pathCourses.length,
          isMandatory
        });
      }
      
      const mandatoryPaths = pathsWithCourses.filter(p => p.isMandatory);
      const electivePaths = pathsWithCourses.filter(p => !p.isMandatory);
      
      const myCourses = await Enrollment.findUserEnrollments(userId);
      myCourses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      res.render('courses/my-paths', {
        paths: pathsWithCourses,
        mandatoryPaths,
        electivePaths,
        myCourses
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
        completedCourses
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
      
      const deadlines = approvedEnrollments.map(e => {
        let deadlineDateText = 'Không giới hạn';
        let daysRemaining = null;
        let status = 'unlimited';

        if (e.progress === 100) {
          status = 'completed';
        }

        if (e.deadline) {
          const deadlineDate = new Date(e.deadline);
          deadlineDateText = deadlineDate.toLocaleDateString('vi-VN');
          const now = new Date();
          const timeDiff = deadlineDate.getTime() - now.getTime();
          daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          
          if (e.progress !== 100) {
            if (daysRemaining < 0) {
              status = 'overdue';
            } else if (daysRemaining <= 7) {
              status = 'warning';
            } else {
              status = 'active';
            }
          }
        }
        
        return {
          ...e,
          deadlineDate: deadlineDateText,
          daysRemaining,
          status
        };
      });
      
      res.render('courses/my-deadlines', {
        deadlines
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
        error: req.query.error || null
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
      
      // Không mã hóa mật khẩu (Lưu mật khẩu dạng plain text)
      const hashedPassword = newPassword;
      
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
  },

  getMyGroups: async (req, res) => {
    const userId = req.session.userId;
    try {
      const { Department } = require('../models/schema');
      const managedDepts = await Department.findManagedBy(userId);
      if (managedDepts.length === 0) {
        return res.status(403).render('error', { message: 'Bạn không phải là Trưởng phòng ban để truy cập chức năng này.' });
      }

      const db = require('../config/db');
      const departmentsData = [];

      for (let dept of managedDepts) {
        const sql = `
          SELECT u.id, u.username, u.email, u.status,
                 COUNT(e.id) as total_courses,
                 SUM(CASE WHEN e.progress = 100 THEN 1 ELSE 0 END) as completed_courses,
                 COALESCE(AVG(e.progress)::numeric(5,2), 0) as average_progress
          FROM users u
          LEFT JOIN enrollments e ON u.id = e.user_id AND e.status = 'approved'
          WHERE u.department_id = $1
          GROUP BY u.id, u.username, u.email, u.status
          ORDER BY u.username ASC
        `;
        const membersRes = await db.query(sql, [dept.id]);
        
        departmentsData.push({
          ...dept,
          members: membersRes.rows
        });
      }

      res.render('courses/my-groups', {
        departments: departmentsData
      });
    } catch (err) {
      console.error('[Course Controller] Lỗi xem Nhóm của tôi:', err);
      res.render('error', { message: 'Lỗi hệ thống khi tải thông tin nhóm quản lý.' });
    }
  }
};
