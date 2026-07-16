-- Xóa các bảng cũ nếu có để tránh xung đột
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS quiz_submissions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS lessons CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS assessment_submissions CASCADE;
DROP TABLE IF EXISTS assessment_assignments CASCADE;
DROP TABLE IF EXISTS assessment_questions CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. Bảng sơ đồ phòng ban (Departments)
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
);

-- 2. Bảng vai trò (Roles)
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

-- 3. Bảng phân quyền vai trò (Role Permissions)
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (role_id, permission_name)
);

-- 4. Bảng tài khoản nhân sự (Users)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'disabled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Thêm manager_id vào departments sau khi bảng users được tạo để tránh lỗi phụ thuộc vòng (circular reference)
ALTER TABLE departments ADD COLUMN manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 5. Bảng khóa học (Courses)
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published'
    enrollment_type VARCHAR(20) DEFAULT 'open', -- 'open', 'restricted', 'only_assigned'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng chương (Chapters)
CREATE TABLE chapters (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng bài học (Lessons)
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    content TEXT,
    video_url VARCHAR(255),
    attachment_url VARCHAR(255),
    order_index INTEGER NOT NULL,
    is_quiz BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 9. Bảng đăng ký khóa học (Enrollments)
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0, -- từ 0 -> 100
    is_assigned BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    deadline TIMESTAMP DEFAULT NULL,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Bảng thảo luận bài học (Comments)
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Bảng đề thi / kiểm tra (Quizzes)
CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    passing_score INTEGER DEFAULT 80, -- Thang điểm 100, đạt từ 80
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Bảng ngân hàng câu hỏi (Questions)
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice', -- 'multiple_choice', 'essay'
    options JSONB, -- Mảng các đáp án dạng JSON
    correct_answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Bảng nộp bài thi (Quiz Submissions)
CREATE TABLE quiz_submissions (
    id SERIAL PRIMARY KEY,
    quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER,
    is_passed BOOLEAN,
    answers JSONB,
    essay_answer TEXT,
    grade_feedback TEXT,
    graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user_id ON quiz_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_created_at ON quiz_submissions(created_at DESC);

-- 14. Bảng nhật ký vết hoạt động (Audit Logs)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Bảng thực nghiệm khoa học (Experiments)
CREATE TABLE experiments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    epochs INTEGER NOT NULL,
    learning_rate NUMERIC(10, 5) NOT NULL,
    batch_size INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'success', 'failed'
    accuracy NUMERIC(5, 2),
    loss NUMERIC(10, 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- GIEO MẦM DỮ LIỆU BAN ĐẦU (SEED DATA)
-- ==========================================

-- Gieo mầm sơ đồ phòng ban
INSERT INTO departments (id, name, parent_id) VALUES
(1, 'Ban Giám Đốc', NULL),
(2, 'Phòng Công Nghệ & AI', 1),
(3, 'Phòng Nhân Sự (HR)', 1),
(4, 'Phòng Marketing', 1);

-- Gieo mầm vai trò
INSERT INTO roles (id, name, description) VALUES
(1, 'Super Admin', 'Vai trò quản trị cao cấp nhất, có toàn quyền hệ thống.'),
(2, 'HR Manager', 'Quản lý nhân sự, lộ trình học tập, phòng ban và xem báo cáo.'),
(3, 'Instructor', 'Giáo viên, quản lý khóa học, soạn bài học, ngân hàng câu hỏi và chấm thi.'),
(4, 'Employee', 'Nhân viên tham gia học tập, làm bài trắc nghiệm và thảo luận.');

-- Gieo mầm các quyền cho vai trò (Role Permissions)
-- Vai trò 1 (Super Admin): Gán tất cả 21 quyền
INSERT INTO role_permissions (role_id, permission_name) VALUES
(1, 'COURSE_VIEW'), (1, 'COURSE_CREATE'), (1, 'COURSE_UPDATE'), (1, 'COURSE_DELETE'), (1, 'COURSE_PUBLISH'),
(1, 'LESSON_CREATE'), (1, 'CONTENT_UPLOAD'), (1, 'LESSON_MANAGE'),
(1, 'QUIZ_BANK_VIEW'), (1, 'QUIZ_BANK_MANAGE'), (1, 'QUIZ_SETTING'), (1, 'QUIZ_GRADE'),
(1, 'PATH_MANAGE'), (1, 'ENROLL_ASSIGN'), (1, 'ENROLL_APPROVE'),
(1, 'USER_VIEW'), (1, 'USER_MANAGE'), (1, 'USER_DISABLE'), (1, 'DEPARTMENT_MANAGE'),
(1, 'REPORT_VIEW'), (1, 'REPORT_EXPORT'),
(1, 'ROLE_MANAGE'), (1, 'USER_IMPERSONATE'), (1, 'AUDIT_LOG_VIEW');

-- Vai trò 2 (HR Manager): Quản lý nhân sự, giao khóa học, báo cáo
INSERT INTO role_permissions (role_id, permission_name) VALUES
(2, 'PATH_MANAGE'), (2, 'ENROLL_ASSIGN'), (2, 'ENROLL_APPROVE'),
(2, 'USER_VIEW'), (2, 'USER_MANAGE'), (2, 'USER_DISABLE'), (2, 'DEPARTMENT_MANAGE'),
(2, 'REPORT_VIEW'), (2, 'REPORT_EXPORT');

-- Vai trò 3 (Instructor): Quản lý khóa học, bài học, đề thi
INSERT INTO role_permissions (role_id, permission_name) VALUES
(3, 'COURSE_VIEW'), (3, 'COURSE_CREATE'), (3, 'COURSE_UPDATE'), (3, 'COURSE_PUBLISH'),
(3, 'LESSON_CREATE'), (3, 'CONTENT_UPLOAD'), (3, 'LESSON_MANAGE'),
(3, 'QUIZ_BANK_VIEW'), (3, 'QUIZ_BANK_MANAGE'), (3, 'QUIZ_SETTING'), (3, 'QUIZ_GRADE'),
(3, 'REPORT_VIEW');

-- Vai trò 4 (Employee): Quyền cơ bản để học tập (Không có quyền quản trị/L&D)
INSERT INTO role_permissions (role_id, permission_name) VALUES
(4, 'PATH_VIEW'), (4, 'COURSE_ENROLL_REQUEST'), (4, 'HISTORY_VIEW'), (4, 'PROGRESS_TRACK');

-- Gieo mầm tài khoản Admin duy nhất
INSERT INTO users (username, email, password, role_id, status) VALUES
('admin', 'admin@gmail.com', 'admin@123', 1, 'active');

-- Khôi phục chỉ số ID tuần tự sau khi insert cố định id
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id)+1 FROM departments), 1), false);
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id)+1 FROM roles), 1), false);
SELECT setval('courses_id_seq', COALESCE((SELECT MAX(id)+1 FROM courses), 1), false);
SELECT setval('lessons_id_seq', COALESCE((SELECT MAX(id)+1 FROM lessons), 1), false);
SELECT setval('quizzes_id_seq', COALESCE((SELECT MAX(id)+1 FROM quizzes), 1), false);
SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id)+1 FROM questions), 1), false);
-- ============================================================
-- FEATURE: Bài Kiểm Tra Doanh Nghiệp (Assessment)
-- ============================================================

CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    course_ids JSONB NOT NULL DEFAULT '[]',
    question_count INTEGER DEFAULT 50,
    duration_minutes INTEGER DEFAULT 60,
    passing_score INTEGER DEFAULT 70,
    status VARCHAR(20) DEFAULT 'draft',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_assignments (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_id INTEGER NOT NULL,
    start_time TIMESTAMP DEFAULT NULL,
    deadline TIMESTAMP DEFAULT NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_submissions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(5,2),
    total_questions INTEGER,
    correct_count INTEGER,
    is_passed BOOLEAN,
    answers JSONB,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, user_id)
);

SELECT setval('assessments_id_seq', COALESCE((SELECT MAX(id)+1 FROM assessments), 1), false);
SELECT setval('assessment_questions_id_seq', COALESCE((SELECT MAX(id)+1 FROM assessment_questions), 1), false);
SELECT setval('assessment_assignments_id_seq', COALESCE((SELECT MAX(id)+1 FROM assessment_assignments), 1), false);
SELECT setval('assessment_submissions_id_seq', COALESCE((SELECT MAX(id)+1 FROM assessment_submissions), 1), false);
