-- Xóa các bảng cũ nếu có để tránh xung đột
DROP TABLE IF EXISTS experiments CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS quiz_submissions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS learning_path_courses CASCADE;
DROP TABLE IF EXISTS learning_paths CASCADE;
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

-- 6. Bảng bài học (Lessons)
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    content TEXT,
    video_url VARCHAR(255),
    attachment_url VARCHAR(255),
    order_index INTEGER NOT NULL,
    is_quiz BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Bảng lộ trình đào tạo (Learning Paths)
CREATE TABLE learning_paths (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Bảng liên kết Lộ trình - Khóa học (Learning Path Courses)
CREATE TABLE learning_path_courses (
    learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (learning_path_id, course_id)
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

-- Gieo mầm tài khoản (Sử dụng mật khẩu dạng văn bản rõ 'password123' để dễ kiểm tra theo dõi)
INSERT INTO users (username, email, password, role_id, department_id, status) VALUES
('admin', 'admin@company.com', 'password123', 1, 1, 'active'),
('hr_manager', 'hr@company.com', 'password123', 2, 3, 'active'),
('instructor_tech', 'instructor@company.com', 'password123', 3, 2, 'active'),
('employee_it', 'emp.it@company.com', 'password123', 4, 2, 'active'),
('employee_mkt', 'emp.mkt@company.com', 'password123', 4, 4, 'active');

-- Gieo mầm khóa học mẫu
INSERT INTO courses (id, title, description, image_url, status) VALUES
(1, 'Lập trình Node.js & Express cơ bản', 'Khóa học cung cấp kiến thức nền tảng về NodeJS, cơ chế Single-Thread, Event Loop và cách xây dựng ứng dụng Web MVC, REST API chuyên nghiệp.', '/images/nodejs_course.svg', 'published'),
(2, 'Bảo mật thông tin trong doanh nghiệp', 'Hướng dẫn nhân viên các quy tắc an toàn bảo mật, bảo vệ dữ liệu khách hàng, nhận diện email giả mạo (Phishing) và an toàn mật khẩu.', '/images/security_course.svg', 'published'),
(3, 'Làm chủ Docker & Docker Compose', 'Đóng gói ứng dụng, tối ưu hóa môi trường phát triển và vận hành hệ thống container hóa hoàn chỉnh.', '/images/docker_course.svg', 'published'),
(4, 'Kỹ năng Giao tiếp Công sở nâng cao', 'Khóa học cải thiện kỹ năng thuyết trình, trao đổi thông tin hiệu quả giữa các phòng ban trong công ty.', '/images/comm_course.svg', 'draft');

-- Gieo mầm bài học mẫu
INSERT INTO lessons (id, course_id, title, content, video_url, order_index) VALUES
(1, 1, 'Bài 1: Giới thiệu NodeJS và Kiến trúc Event Loop', 'Node.js là một runtime JavaScript xây dựng trên engine V8 của Chrome. Điểm cốt lõi của Node.js là mô hình I/O non-blocking, hướng sự kiện (event-driven). Khi có yêu cầu I/O (như đọc DB, file), Node.js sẽ ủy thác cho hệ điều hành chạy nền, giải phóng Thread chính để xử lý yêu cầu khác. Khi I/O hoàn thành, Event Loop sẽ gắp callback vào Call Stack để thực thi. Nhờ đó Node.js xử lý hàng nghìn kết nối đồng thời cực tốt chỉ với một luồng duy nhất.', 'https://www.w3schools.com/html/mov_bbb.mp4', 1),
(2, 1, 'Bài 2: Tạo dự án MVC đầu tiên với Express', 'MVC viết tắt của Model-View-Controller. Đây là một mẫu kiến trúc phần mềm phổ biến:\n- Model: Chịu trách nhiệm về dữ liệu, tương tác với database (ví dụ qua pg pool).\n- View: Giao diện hiển thị (EJS render ở server side).\n- Controller: Xử lý logic nghiệp vụ, tiếp nhận yêu cầu từ client, gọi Model xử lý và trả ra View tương ứng. Express giúp cấu hình router cực nhanh.', 'https://www.w3schools.com/html/mov_bbb.mp4', 2),
(3, 2, 'Bài 1: Phân loại dữ liệu và Nguyên tắc bảo vệ PII', 'Thông tin định danh cá nhân (PII - Personally Identifiable Information) bao gồm Tên, Email, Số điện thoại, Số CCCD. Quy chế công ty bắt buộc các dữ liệu này phải được khử định danh (SHA-256 Hash) trước khi đưa vào các môi trường phân tích dữ liệu hoặc AI. Tuyệt đối không hardcode mật khẩu hay API key trong mã nguồn.', 'https://www.w3schools.com/html/mov_bbb.mp4', 1);

-- Gieo mầm các đề kiểm tra (Quizzes)
INSERT INTO quizzes (id, course_id, title, duration_minutes, passing_score) VALUES
(1, 1, 'Bài kiểm tra kiến thức cơ bản Node.js', 10, 80),
(2, 2, 'Trắc nghiệm An toàn thông tin doanh nghiệp', 5, 100);

-- Gieo mầm câu hỏi kiểm tra mẫu
INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES
(1, 'Kiến trúc Event Loop của Node.js chạy trên bao nhiêu luồng (thread) chính?', 'multiple_choice', '["1 luồng duy nhất (Single Thread)", "2 luồng", "Đa luồng song song (Multi-threaded)", "4 luồng"]', '1 luồng duy nhất (Single Thread)'),
(1, 'MVC viết tắt của từ gì?', 'multiple_choice', '["Model-Variable-Controller", "Model-View-Controller", "Main-View-Controller", "Model-View-Component"]', 'Model-View-Controller'),
(2, 'Dữ liệu PII bao gồm những thông tin nào sau đây?', 'multiple_choice', '["Địa chỉ IP công cộng", "Email, Tên, Số điện thoại của khách hàng", "Mã màu thiết kế logo", "Số lượng dòng code của dự án"]', 'Email, Tên, Số điện thoại của khách hàng');

-- Gieo mầm lộ trình học tập mẫu
INSERT INTO learning_paths (id, name, description) VALUES
(1, 'Lộ trình thử việc Kỹ sư Backend Node.js', 'Lộ trình bắt buộc dành cho nhân viên thử việc tại phòng Công Nghệ, bao gồm lập trình Node.js và Docker hóa hệ thống.');

-- Liên kết khóa học vào lộ trình
INSERT INTO learning_path_courses (learning_path_id, course_id, order_index) VALUES
(1, 1, 1),
(1, 3, 2);

-- Gieo mầm Đăng ký khóa học của học viên
-- Nhân viên IT tự đăng ký học khóa Node.js (progress = 50%, active)
INSERT INTO enrollments (user_id, course_id, progress, is_assigned, status) VALUES
(4, 1, 50, false, 'approved'),
(4, 2, 0, true, 'approved'); -- Được HR gán bắt buộc học khóa Bảo mật

-- Khôi phục chỉ số ID tuần tự sau khi insert cố định id
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id)+1 FROM departments), 1), false);
SELECT setval('roles_id_seq', COALESCE((SELECT MAX(id)+1 FROM roles), 1), false);
SELECT setval('courses_id_seq', COALESCE((SELECT MAX(id)+1 FROM courses), 1), false);
SELECT setval('lessons_id_seq', COALESCE((SELECT MAX(id)+1 FROM lessons), 1), false);
SELECT setval('quizzes_id_seq', COALESCE((SELECT MAX(id)+1 FROM quizzes), 1), false);
SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id)+1 FROM questions), 1), false);
SELECT setval('learning_paths_id_seq', COALESCE((SELECT MAX(id)+1 FROM learning_paths), 1), false);

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
