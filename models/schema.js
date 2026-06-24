const db = require('../config/db');

/**
 * Model và các hàm helper tương tác CSDL cho hệ thống LMS
 */
module.exports = {
  // 1. Quản lý Người dùng (Users)
  User: {
    create: async (username, email, passwordHash, roleId = 4, departmentId = null) => {
      const sql = `
        INSERT INTO users (username, email, password, role_id, department_id, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING id, username, email, role_id, department_id, status, created_at
      `;
      const res = await db.query(sql, [username, email, passwordHash, roleId, departmentId]);
      return res.rows[0];
    },

    findByEmail: async (email) => {
      const sql = `
        SELECT u.*, r.name as role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.email = $1
      `;
      const res = await db.query(sql, [email]);
      return res.rows[0];
    },

    findById: async (id) => {
      const sql = `
        SELECT u.id, u.username, u.email, u.role_id, u.department_id, u.status, u.created_at, 
               r.name as role_name, d.name as department_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1
      `;
      const res = await db.query(sql, [id]);
      return res.rows[0];
    },

    findAll: async () => {
      const sql = `
        SELECT u.id, u.username, u.email, u.status, u.created_at, 
               r.name as role_name, d.name as department_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.id DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    update: async (id, roleId, departmentId, status) => {
      const sql = `
        UPDATE users 
        SET role_id = $1, department_id = $2, status = $3 
        WHERE id = $4
        RETURNING id, username, email, role_id, department_id, status
      `;
      const res = await db.query(sql, [roleId, departmentId, status, id]);
      return res.rows[0];
    },

    getPermissions: async (roleId) => {
      const sql = `SELECT permission_name FROM role_permissions WHERE role_id = $1`;
      const res = await db.query(sql, [roleId]);
      return res.rows.map(row => row.permission_name);
    },

    countFiltered: async (search = '', deptId = null) => {
      let sql = 'SELECT COUNT(*) FROM users u WHERE 1=1';
      const params = [];
      
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        sql += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
      }
      
      if (deptId === 'none') {
        sql += ` AND u.department_id IS NULL`;
      } else if (deptId && deptId !== '' && deptId !== 'all') {
        params.push(parseInt(deptId));
        sql += ` AND u.department_id = $${params.length}`;
      }
      
      const res = await db.query(sql, params);
      return parseInt(res.rows[0].count);
    },

    findFilteredPaginated: async (search = '', deptId = null, limit = 20, offset = 0) => {
      let sql = `
        SELECT u.id, u.username, u.email, u.status, u.created_at, 
               r.name as role_name, d.name as department_name, u.role_id, u.department_id
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE 1=1
      `;
      const params = [];
      
      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        sql += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
      }
      
      if (deptId === 'none') {
        sql += ` AND u.department_id IS NULL`;
      } else if (deptId && deptId !== '' && deptId !== 'all') {
        params.push(parseInt(deptId));
        sql += ` AND u.department_id = $${params.length}`;
      }
      
      params.push(limit);
      sql += ` ORDER BY u.id DESC LIMIT $${params.length}`;
      
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
      
      const res = await db.query(sql, params);
      return res.rows;
    },

    findAllLightweight: async () => {
      const sql = `
        SELECT id, username, email 
        FROM users 
        WHERE status = 'active' 
        ORDER BY username ASC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    findEligibleManagers: async () => {
      const sql = `
        SELECT id, username, email 
        FROM users 
        WHERE status = 'active' 
        ORDER BY username ASC
      `;
      const res = await db.query(sql);
      return res.rows;
    }
  },

  // 2. Quản lý Phòng Ban (Departments)
  Department: {
    findAll: async () => {
      const sql = `
        SELECT d1.*, d2.name as parent_name, u.username as manager_name, u.email as manager_email
        FROM departments d1
        LEFT JOIN departments d2 ON d1.parent_id = d2.id
        LEFT JOIN users u ON d1.manager_id = u.id
        ORDER BY d1.id ASC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    create: async (name, parentId = null) => {
      const sql = `INSERT INTO departments (name, parent_id) VALUES ($1, $2) RETURNING *`;
      const res = await db.query(sql, [name, parentId]);
      return res.rows[0];
    },

    update: async (id, name, parentId = null) => {
      const sql = `UPDATE departments SET name = $1, parent_id = $2 WHERE id = $3 RETURNING *`;
      const res = await db.query(sql, [name, parentId, id]);
      return res.rows[0];
    },

    delete: async (id) => {
      const sql = `DELETE FROM departments WHERE id = $1`;
      await db.query(sql, [id]);
    },

    assignManager: async (id, managerId) => {
      const sql = `UPDATE departments SET manager_id = $1 WHERE id = $2 RETURNING *`;
      const res = await db.query(sql, [managerId, id]);
      return res.rows[0];
    },

    findManagedBy: async (userId) => {
      const sql = `
        SELECT d1.*, d2.name as parent_name
        FROM departments d1
        LEFT JOIN departments d2 ON d1.parent_id = d2.id
        WHERE d1.manager_id = $1
        ORDER BY d1.id ASC
      `;
      const res = await db.query(sql, [userId]);
      return res.rows;
    }
  },

  // 3. Quản lý Vai Trò & Phân Quyền (Roles & Permissions)
  Role: {
    findAll: async () => {
      const sql = `SELECT * FROM roles ORDER BY id ASC`;
      const res = await db.query(sql);
      return res.rows;
    },

    create: async (name, description) => {
      const sql = `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *`;
      const res = await db.query(sql, [name, description]);
      return res.rows[0];
    },

    updatePermissions: async (roleId, permissions) => {
      // Bắt đầu một transaction
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        // Xóa hết quyền cũ
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
        // Gán các quyền mới
        if (permissions && permissions.length > 0) {
          for (let perm of permissions) {
            await client.query(
              'INSERT INTO role_permissions (role_id, permission_name) VALUES ($1, $2)',
              [roleId, perm]
            );
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  },

  // 4. Quản lý Khóa học (Courses)
  Course: {
    findAll: async () => {
      const sql = `SELECT * FROM courses ORDER BY id DESC`;
      const res = await db.query(sql);
      return res.rows;
    },

    findAllPublished: async () => {
      const sql = `SELECT * FROM courses WHERE status = 'published' ORDER BY id DESC`;
      const res = await db.query(sql);
      return res.rows;
    },

    findById: async (id) => {
      const sql = `SELECT * FROM courses WHERE id = $1`;
      const res = await db.query(sql, [id]);
      return res.rows[0];
    },

    create: async (title, description, imageUrl, status = 'draft', enrollmentType = 'open') => {
      const sql = `
        INSERT INTO courses (title, description, image_url, status, enrollment_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const res = await db.query(sql, [title, description, imageUrl, status, enrollmentType]);
      return res.rows[0];
    },

    update: async (id, title, description, imageUrl, status, enrollmentType) => {
      const sql = `
        UPDATE courses 
        SET title = $1, description = $2, image_url = $3, status = $4, enrollment_type = $5
        WHERE id = $6
        RETURNING *
      `;
      const res = await db.query(sql, [title, description, imageUrl, status, enrollmentType, id]);
      return res.rows[0];
    },

    delete: async (id) => {
      const sql = `DELETE FROM courses WHERE id = $1`;
      await db.query(sql, [id]);
    }
  },

  // 5. Quản lý Bài học (Lessons)
  Lesson: {
    findByCourseId: async (courseId) => {
      const sql = `SELECT * FROM lessons WHERE course_id = $1 ORDER BY order_index ASC, id ASC`;
      const res = await db.query(sql, [courseId]);
      return res.rows;
    },

    findAll: async () => {
      const sql = `
        SELECT l.*, c.title as course_title
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        ORDER BY c.title ASC, l.order_index ASC, l.id ASC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    findById: async (id) => {
      const sql = `SELECT * FROM lessons WHERE id = $1`;
      const res = await db.query(sql, [id]);
      return res.rows[0];
    },

    create: async (courseId, title, content, videoUrl, attachmentUrl, orderIndex, isQuiz = false) => {
      const sql = `
        INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index, is_quiz)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const res = await db.query(sql, [courseId, title, content, videoUrl, attachmentUrl, orderIndex, isQuiz]);
      return res.rows[0];
    },

    update: async (id, title, content, videoUrl, attachmentUrl, orderIndex, isQuiz = false) => {
      const sql = `
        UPDATE lessons 
        SET title = $1, content = $2, video_url = $3, attachment_url = $4, order_index = $5, is_quiz = $6
        WHERE id = $7
        RETURNING *
      `;
      const res = await db.query(sql, [title, content, videoUrl, attachmentUrl, orderIndex, isQuiz, id]);
      return res.rows[0];
    },

    delete: async (id) => {
      const sql = `DELETE FROM lessons WHERE id = $1`;
      await db.query(sql, [id]);
    }
  },

  // 6. Quản lý Đăng ký và Tiến độ (Enrollments)
  Enrollment: {
    findByUserAndCourse: async (userId, courseId) => {
      const sql = `SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2`;
      const res = await db.query(sql, [userId, courseId]);
      return res.rows[0];
    },

    findUserEnrollments: async (userId) => {
      const sql = `
        SELECT e.*, c.title, c.description, c.image_url 
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = $1 AND e.status = 'approved'
      `;
      const res = await db.query(sql, [userId]);
      return res.rows;
    },

    findUserAllEnrollments: async (userId) => {
      const sql = `
        SELECT e.*, c.title, c.description, c.image_url 
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = $1
      `;
      const res = await db.query(sql, [userId]);
      return res.rows;
    },

    findAllPending: async () => {
      const sql = `
        SELECT e.*, u.username, u.email, c.title as course_title
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        WHERE e.status = 'pending'
        ORDER BY e.created_at DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    create: async (userId, courseId, isAssigned = false, status = 'approved', deadline = null) => {
      // Kiểm tra xem đã đăng ký chưa để cập nhật hoặc thêm mới
      const checkSql = `SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2`;
      const checkRes = await db.query(checkSql, [userId, courseId]);
      
      if (checkRes.rows.length > 0) {
        const updateSql = `
          UPDATE enrollments 
          SET is_assigned = $1, status = $2, deadline = $3
          WHERE user_id = $4 AND course_id = $5
          RETURNING *
        `;
        const res = await db.query(updateSql, [isAssigned, status, deadline, userId, courseId]);
        return res.rows[0];
      } else {
        const insertSql = `
          INSERT INTO enrollments (user_id, course_id, is_assigned, status, deadline)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const res = await db.query(insertSql, [userId, courseId, isAssigned, status, deadline]);
        return res.rows[0];
      }
    },

    updateProgress: async (userId, courseId, progress) => {
      const sql = `
        UPDATE enrollments 
        SET progress = $1, last_accessed = CURRENT_TIMESTAMP
        WHERE user_id = $2 AND course_id = $3
        RETURNING *
      `;
      const res = await db.query(sql, [progress, userId, courseId]);
      return res.rows[0];
    },

    updateStatus: async (id, status) => {
      const sql = `UPDATE enrollments SET status = $1 WHERE id = $2 RETURNING *`;
      const res = await db.query(sql, [status, id]);
      return res.rows[0];
    }
  },

  // 7. Thảo luận / Bình luận (Comments)
  Comment: {
    findByLessonId: async (lessonId) => {
      const sql = `
        SELECT c.*, u.username 
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.lesson_id = $1
        ORDER BY c.created_at ASC
      `;
      const res = await db.query(sql, [lessonId]);
      return res.rows;
    },

    create: async (lessonId, userId, content) => {
      const sql = `
        INSERT INTO comments (lesson_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const res = await db.query(sql, [lessonId, userId, content]);
      
      // Lấy thêm username để trả về client hiển thị ngay
      const userRes = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
      const comment = res.rows[0];
      comment.username = userRes.rows[0].username;
      return comment;
    }
  },

  // 8. Đề thi & Câu hỏi (Quizzes & Questions)
  Quiz: {
    findByCourseId: async (courseId) => {
      // Chỉ tìm các đề thi cuối khóa của course (ở đó lesson_id IS NULL)
      const sql = `SELECT * FROM quizzes WHERE course_id = $1 AND lesson_id IS NULL`;
      const res = await db.query(sql, [courseId]);
      return res.rows[0];
    },

    findByLessonId: async (lessonId) => {
      const sql = `SELECT * FROM quizzes WHERE lesson_id = $1`;
      const res = await db.query(sql, [lessonId]);
      return res.rows[0];
    },

    createLessonQuiz: async (courseId, lessonId, title, durationMinutes = 15, passingScore = 100) => {
      const sql = `
        INSERT INTO quizzes (course_id, lesson_id, title, duration_minutes, passing_score)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const res = await db.query(sql, [courseId, lessonId, title, durationMinutes, passingScore]);
      return res.rows[0];
    },

    findById: async (id) => {
      const sql = `SELECT * FROM quizzes WHERE id = $1`;
      const res = await db.query(sql, [id]);
      return res.rows[0];
    },

    createOrUpdate: async (courseId, title, durationMinutes, passingScore) => {
      // Kiểm tra đề thi đã tồn tại chưa
      const checkSql = `SELECT id FROM quizzes WHERE course_id = $1`;
      const checkRes = await db.query(checkSql, [courseId]);

      if (checkRes.rows.length > 0) {
        const sql = `
          UPDATE quizzes 
          SET title = $1, duration_minutes = $2, passing_score = $3 
          WHERE course_id = $4 
          RETURNING *
        `;
        const res = await db.query(sql, [title, durationMinutes, passingScore, courseId]);
        return res.rows[0];
      } else {
        const sql = `
          INSERT INTO quizzes (course_id, title, duration_minutes, passing_score)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const res = await db.query(sql, [courseId, title, durationMinutes, passingScore]);
        return res.rows[0];
      }
    }
  },

  Question: {
    findByQuizId: async (quizId) => {
      const sql = `SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id ASC`;
      const res = await db.query(sql, [quizId]);
      return res.rows;
    },

    findAll: async () => {
      const sql = `
        SELECT q.*, qz.title as quiz_title, c.title as course_title
        FROM questions q
        LEFT JOIN quizzes qz ON q.quiz_id = qz.id
        LEFT JOIN courses c ON qz.course_id = c.id
        ORDER BY q.id DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    create: async (quizId, questionText, questionType, options, correctAnswers) => {
      const sql = `
        INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const res = await db.query(sql, [quizId, questionText, questionType, JSON.stringify(options), correctAnswers]);
      return res.rows[0];
    },

    delete: async (id) => {
      const sql = `DELETE FROM questions WHERE id = $1`;
      await db.query(sql, [id]);
    }
  },

  QuizSubmission: {
    create: async (quizId, userId, score, isPassed, answers, essayAnswer = null) => {
      const sql = `
        INSERT INTO quiz_submissions (quiz_id, user_id, score, is_passed, answers, essay_answer)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const res = await db.query(sql, [quizId, userId, score, isPassed, JSON.stringify(answers), essayAnswer]);
      return res.rows[0];
    },

    findAllToGrade: async () => {
      const sql = `
        SELECT qs.*, u.username, u.email, q.title as quiz_title, c.title as course_title
        FROM quiz_submissions qs
        JOIN users u ON qs.user_id = u.id
        JOIN quizzes q ON qs.quiz_id = q.id
        JOIN courses c ON q.course_id = c.id
        WHERE qs.score IS NULL
        ORDER BY qs.created_at DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    grade: async (id, score, isPassed, feedback, gradedBy) => {
      const sql = `
        UPDATE quiz_submissions 
        SET score = $1, is_passed = $2, grade_feedback = $3, graded_by = $4
        WHERE id = $5
        RETURNING *
      `;
      const res = await db.query(sql, [score, isPassed, feedback, gradedBy, id]);
      return res.rows[0];
    },

    findByUser: async (userId) => {
      const sql = `
        SELECT qs.*, q.title as quiz_title, c.title as course_title
        FROM quiz_submissions qs
        JOIN quizzes q ON qs.quiz_id = q.id
        JOIN courses c ON q.course_id = c.id
        WHERE qs.user_id = $1
        ORDER BY qs.created_at DESC
      `;
      const res = await db.query(sql, [userId]);
      return res.rows;
    },

    findUserPassedSubmission: async (userId, quizId) => {
      const sql = `
        SELECT * FROM quiz_submissions 
        WHERE user_id = $1 AND quiz_id = $2 AND is_passed = true 
        ORDER BY score DESC, created_at DESC 
        LIMIT 1
      `;
      const res = await db.query(sql, [userId, quizId]);
      return res.rows[0];
    }
  },

  // 9. Lộ trình học tập (Learning Paths)
  LearningPath: {
    findAll: async () => {
      const sql = `SELECT * FROM learning_paths ORDER BY id DESC`;
      const res = await db.query(sql);
      return res.rows;
    },

    findById: async (id) => {
      const sql = `SELECT * FROM learning_paths WHERE id = $1`;
      const res = await db.query(sql, [id]);
      return res.rows[0];
    },

    getCourses: async (pathId) => {
      const sql = `
        SELECT c.*, lpc.order_index 
        FROM learning_path_courses lpc
        JOIN courses c ON lpc.course_id = c.id
        WHERE lpc.learning_path_id = $1
        ORDER BY lpc.order_index ASC
      `;
      const res = await db.query(sql, [pathId]);
      return res.rows;
    },

    create: async (name, description) => {
      const sql = `INSERT INTO learning_paths (name, description) VALUES ($1, $2) RETURNING *`;
      const res = await db.query(sql, [name, description]);
      return res.rows[0];
    },

    addCourses: async (pathId, courseIds) => {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM learning_path_courses WHERE learning_path_id = $1', [pathId]);
        if (courseIds && courseIds.length > 0) {
          for (let i = 0; i < courseIds.length; i++) {
            await client.query(
              'INSERT INTO learning_path_courses (learning_path_id, course_id, order_index) VALUES ($1, $2, $3)',
              [pathId, courseIds[i], i + 1]
            );
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    update: async (id, name, description) => {
      const sql = `
        UPDATE learning_paths 
        SET name = $1, description = $2 
        WHERE id = $3 
        RETURNING *
      `;
      const res = await db.query(sql, [name, description, id]);
      return res.rows[0];
    },

    delete: async (id) => {
      const sql = `DELETE FROM learning_paths WHERE id = $1`;
      await db.query(sql, [id]);
    }
  },

  // 10. Nhật ký Vết Hệ thống (Audit Logs)
  AuditLog: {
    create: async (userId, action, details, ipAddress = null) => {
      const sql = `
        INSERT INTO audit_logs (user_id, action, details, ip_address)
        VALUES ($1, $2, $3, $4)
      `;
      await db.query(sql, [userId, action, JSON.stringify(details), ipAddress]);
    },

    findAll: async () => {
      const sql = `
        SELECT a.*, u.username, u.email 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 200
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    findPaginated: async (limit, offset, search = null, action = null, startDate = null, endDate = null) => {
      let queryText = `
        SELECT a.*, u.username, u.email 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
      `;
      const conditions = [];
      const params = [];
      
      if (search && search.trim() !== '') {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`(LOWER(u.username) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
      }
      
      if (action && action.trim() !== '' && action !== 'all') {
        params.push(action.trim());
        conditions.push(`a.action = $${params.length}`);
      }

      if (startDate && startDate.trim() !== '') {
        params.push(`${startDate.trim()} 00:00:00`);
        conditions.push(`a.created_at >= $${params.length}`);
      }

      if (endDate && endDate.trim() !== '') {
        params.push(`${endDate.trim()} 23:59:59`);
        conditions.push(`a.created_at <= $${params.length}`);
      }
      
      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }
      
      queryText += ' ORDER BY a.created_at DESC ';
      
      params.push(limit);
      queryText += ` LIMIT $${params.length}`;
      
      params.push(offset);
      queryText += ` OFFSET $${params.length}`;
      
      const res = await db.query(queryText, params);
      return res.rows;
    },

    countAll: async (search = null, action = null, startDate = null, endDate = null) => {
      let queryText = `
        SELECT COUNT(*) as total 
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
      `;
      const conditions = [];
      const params = [];
      
      if (search && search.trim() !== '') {
        params.push(`%${search.trim().toLowerCase()}%`);
        conditions.push(`(LOWER(u.username) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
      }
      
      if (action && action.trim() !== '' && action !== 'all') {
        params.push(action.trim());
        conditions.push(`a.action = $${params.length}`);
      }

      if (startDate && startDate.trim() !== '') {
        params.push(`${startDate.trim()} 00:00:00`);
        conditions.push(`a.created_at >= $${params.length}`);
      }

      if (endDate && endDate.trim() !== '') {
        params.push(`${endDate.trim()} 23:59:59`);
        conditions.push(`a.created_at <= $${params.length}`);
      }
      
      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }
      
      const res = await db.query(queryText, params);
      return parseInt(res.rows[0].total);
    }

  },

  // 11. Các truy vấn Thống kê Báo cáo (Analytics & Reports)
  Report: {
    getCompletionStats: async () => {
      const sql = `
        SELECT c.id as course_id, c.title as course_title,
               COUNT(e.id) as total_enrollments,
               SUM(CASE WHEN e.progress = 100 THEN 1 ELSE 0 END) as completed_count,
               AVG(e.progress)::numeric(5,2) as average_progress
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'approved'
        GROUP BY c.id, c.title
        ORDER BY total_enrollments DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    getDepartmentStats: async () => {
      const sql = `
        SELECT d.id as department_id, d.name as department_name,
               COUNT(DISTINCT u.id) as total_users,
               COUNT(e.id) as total_enrollments,
               COALESCE(AVG(e.progress)::numeric(5,2), 0) as average_progress
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        LEFT JOIN enrollments e ON u.id = e.user_id AND e.status = 'approved'
        GROUP BY d.id, d.name
        ORDER BY average_progress DESC, total_enrollments DESC
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    getLeaderboard: async () => {
      const sql = `
        SELECT u.id as user_id, u.username, d.name as department_name,
               COUNT(e.id) as enrolled_count,
               SUM(CASE WHEN e.progress = 100 THEN 1 ELSE 0 END) as completed_count,
               COALESCE(AVG(e.progress)::numeric(5,2), 0) as average_progress
        FROM users u
        LEFT JOIN enrollments e ON u.id = e.user_id AND e.status = 'approved'
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.status = 'active'
        GROUP BY u.id, u.username, d.name
        ORDER BY completed_count DESC, average_progress DESC, enrolled_count DESC
        LIMIT 5
      `;
      const res = await db.query(sql);
      return res.rows;
    },

    getUserProgressDetails: async () => {
        const sql = `
        SELECT u.username, u.email, d.name as department_name,
               c.title as course_title, e.progress, e.is_assigned, e.status, e.last_accessed
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        JOIN courses c ON e.course_id = c.id
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.username ASC, c.title ASC
      `;
        const res = await db.query(sql);
        return res.rows;
      }
    },
  
    // 12. Quản lý Thực nghiệm Khoa học (Experiments)
    Experiment: {
      create: async (name, epochs, learningRate, batchSize, status = 'running') => {
        const sql = `
          INSERT INTO experiments (name, epochs, learning_rate, batch_size, status)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const res = await db.query(sql, [name, epochs, learningRate, batchSize, status]);
        return res.rows[0];
      },
  
      update: async (id, status, accuracy, loss) => {
        const sql = `
          UPDATE experiments
          SET status = $1, accuracy = $2, loss = $3
          WHERE id = $4
          RETURNING *
        `;
        const res = await db.query(sql, [status, accuracy, loss, id]);
        return res.rows[0];
      },
  
      findAll: async () => {
        const sql = `SELECT * FROM experiments ORDER BY created_at DESC LIMIT 100`;
        const res = await db.query(sql);
        return res.rows;
      },
  
      findById: async (id) => {
        const sql = `SELECT * FROM experiments WHERE id = $1`;
        const res = await db.query(sql, [id]);
        return res.rows[0];
      }
    }
  };
