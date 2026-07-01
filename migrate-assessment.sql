-- ============================================================
-- MIGRATION: Thêm tính năng Bài Kiểm Tra Doanh Nghiệp (Assessment)
-- Chạy file này để thêm 4 bảng mới mà không xóa dữ liệu cũ
-- ============================================================

-- Bảng 1: Bài kiểm tra do công ty tạo (Assessments)
CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    course_ids JSONB NOT NULL DEFAULT '[]',   -- Mảng ID các khóa học được chọn
    question_count INTEGER DEFAULT 50,
    duration_minutes INTEGER DEFAULT 60,
    passing_score INTEGER DEFAULT 70,          -- % điểm đạt
    status VARCHAR(20) DEFAULT 'draft',        -- 'draft', 'published'
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 2: Câu hỏi của bài kiểm tra (AI sinh ra)
CREATE TABLE IF NOT EXISTS assessment_questions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,                    -- Mảng 4 lựa chọn
    correct_answer TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 3: Phân phối bài kiểm tra đến người dùng/phòng ban
CREATE TABLE IF NOT EXISTS assessment_assignments (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,          -- 'user' hoặc 'department'
    target_id INTEGER NOT NULL,
    start_time TIMESTAMP DEFAULT NULL,
    deadline TIMESTAMP DEFAULT NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 4: Kết quả làm bài của học viên
CREATE TABLE IF NOT EXISTS assessment_submissions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    score NUMERIC(5,2),                        -- Điểm % (0-100)
    total_questions INTEGER,
    correct_count INTEGER,
    is_passed BOOLEAN,
    answers JSONB,                             -- {questionId: selectedAnswer}
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, user_id)             -- Mỗi user chỉ nộp 1 lần
);
