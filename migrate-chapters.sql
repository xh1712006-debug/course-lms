CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE;

-- Tạo một chương mặc định cho mỗi khóa học nếu chưa có
INSERT INTO chapters (course_id, title, description, order_index)
SELECT id, 'Chương 1: Tổng quan', 'Chương mặc định', 1
FROM courses
WHERE id NOT IN (SELECT course_id FROM chapters)
ON CONFLICT DO NOTHING;

-- Cập nhật các bài học cũ để thuộc về chương mặc định của khóa học đó
UPDATE lessons l
SET chapter_id = c.id
FROM chapters c
WHERE l.course_id = c.course_id AND l.chapter_id IS NULL;
