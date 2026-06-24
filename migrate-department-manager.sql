-- ============================================================
-- MIGRATION: Thêm tính năng Trưởng phòng ban (Department Manager)
-- ============================================================

-- Thêm cột manager_id tham chiếu tới bảng users
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Đảm bảo chỉ số sequence được đồng bộ chính xác (nếu cần)
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id)+1 FROM departments), 1), false);
