const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, requirePermission } = require('../middleware/auth');

// Yêu cầu đăng nhập để truy cập bất kỳ tính năng quản trị L&D nào
router.use(isAuthenticated);

// Trang chủ quản trị L&D dashboard
router.get('/management', adminController.getDashboard);

// ==========================================
// NHÓM 1: QUẢN LÝ KHÓA HỌC (COURSE MANAGEMENT)
// ==========================================
router.get('/course-management', requirePermission('COURSE_VIEW'), adminController.getCourses);
router.post('/course-management', requirePermission('COURSE_CREATE'), adminController.createCourse);
router.post('/course-management/:id/update', requirePermission('COURSE_UPDATE'), adminController.updateCourse);
router.post('/course-management/:id/delete', requirePermission('COURSE_DELETE'), adminController.deleteCourse);
router.post('/course-management/:id/publish', requirePermission('COURSE_PUBLISH'), adminController.publishCourse);
router.post('/course-management/:id/assign', requirePermission('ENROLL_ASSIGN'), adminController.assignCourseBulk);
router.post('/course-management/upload', requirePermission('CONTENT_UPLOAD'), adminController.uploadAttachment);

// ==========================================
// NHÓM 2: QUẢN LÝ BÀI HỌC (LESSON & CONTENT)
// ==========================================
router.get('/lessons', adminController.getAllLessons);
router.get('/course-management/:courseId/lessons', requirePermission('COURSE_VIEW'), adminController.getLessons);
router.post('/course-management/:courseId/lessons', requirePermission('LESSON_CREATE'), adminController.createLesson);
router.post('/course-management/:courseId/lessons/:id/update', requirePermission('LESSON_MANAGE'), adminController.updateLesson);
router.post('/course-management/:courseId/lessons/:id/delete', requirePermission('LESSON_MANAGE'), adminController.deleteLesson);

// ==========================================
// NHÓM 3: QUẢN LÝ ĐỀ THI & NGÂN HÀNG CÂU HỎI
// ==========================================
router.get('/grade', requirePermission('QUIZ_GRADE'), adminController.getGradeList);

// ==========================================
// NHÓM 4: QUẢN LÝ LỘ TRÌNH ĐÀO TẠO & ĐĂNG KÝ
// ==========================================
router.get('/paths', requirePermission('PATH_MANAGE'), adminController.getLearningPaths);
router.post('/paths', requirePermission('PATH_MANAGE'), adminController.createLearningPath);
router.post('/paths/:id/update', requirePermission('PATH_MANAGE'), adminController.updateLearningPath);
router.post('/paths/:id/delete', requirePermission('PATH_MANAGE'), adminController.deleteLearningPath);
router.post('/paths/:id/assign', requirePermission('ENROLL_ASSIGN'), adminController.assignLearningPath);
router.post('/course-management/assign', requirePermission('ENROLL_ASSIGN'), adminController.assignMandatoryCourse);
router.get('/approvals', requirePermission('ENROLL_APPROVE'), adminController.getEnrollmentApprovals);
router.post('/approvals/:id', requirePermission('ENROLL_APPROVE'), adminController.approveEnrollment);

// ==========================================
// NHÓM 5: QUẢN LÝ NHÂN SỰ & PHÒNG BAN (USER)
// ==========================================
router.get('/users', requirePermission('USER_VIEW'), adminController.getUsers);
router.post('/users/create', requirePermission('USER_MANAGE'), adminController.createUser);
router.get('/users/create', requirePermission('USER_MANAGE'), (req, res) => res.redirect('/users'));
router.post('/users/:id/update', requirePermission('USER_MANAGE'), adminController.updateUser);
router.post('/users/:id/delete', requirePermission('USER_MANAGE'), adminController.deleteUser);
router.get('/departments', requirePermission('DEPARTMENT_MANAGE'), adminController.getDepartments);
router.post('/departments', requirePermission('DEPARTMENT_MANAGE'), adminController.createDepartment);
router.post('/departments/:id/update', requirePermission('DEPARTMENT_MANAGE'), adminController.updateDepartment);
router.post('/departments/:id/delete', requirePermission('DEPARTMENT_MANAGE'), adminController.deleteDepartment);
router.post('/departments/:id/assign-manager', requirePermission('DEPARTMENT_MANAGE'), adminController.assignDepartmentManager);

// ==========================================
// NHÓM 6: BÁO CÁO & THỐNG KÊ (ANALYTICS)
// ==========================================
router.get('/reports', requirePermission('REPORT_VIEW'), adminController.getReports);
router.get('/reports/raw', requirePermission('REPORT_EXPORT'), adminController.getRawReportData);

// ==========================================
// NHÓM 7: BẢO MẬT & ĐẶC QUYỀN HỆ THỐNG (PRIVILEGES)
// ==========================================
router.get('/permissions', requirePermission('ROLE_MANAGE'), adminController.getRoles);
router.post('/permissions/create', requirePermission('ROLE_MANAGE'), adminController.createRole);
router.post('/permissions/:id/update', requirePermission('ROLE_MANAGE'), adminController.updateRolePermissions);
router.post('/permissions/:id/delete', requirePermission('ROLE_MANAGE'), adminController.deleteRole);
router.post('/permissions/toggle', requirePermission('ROLE_MANAGE'), adminController.toggleRolePermission);
router.get('/audit', requirePermission('AUDIT_LOG_VIEW'), adminController.getAuditLogs);

// ==========================================
// NHÓM 8: BÀI KIỂM TRA DOANH NGHIỆP (ASSESSMENT)
// ==========================================
const assessmentController = require('../controllers/assessmentController');
router.get('/admin/assessments', requirePermission('QUIZ_BANK_VIEW'), assessmentController.getList);
router.post('/admin/assessments/create', requirePermission('QUIZ_BANK_MANAGE'), assessmentController.postCreate);
router.get('/admin/assessments/create', requirePermission('QUIZ_BANK_MANAGE'), (req, res) => res.redirect('/admin/assessments'));
router.get('/admin/assessments/:id', requirePermission('QUIZ_BANK_VIEW'), assessmentController.getDetail);
router.post('/admin/assessments/:id/publish', requirePermission('QUIZ_BANK_MANAGE'), assessmentController.postPublish);
router.post('/admin/assessments/:id/delete', requirePermission('QUIZ_BANK_MANAGE'), assessmentController.postDelete);
router.post('/admin/assessments/:id/assign', requirePermission('ENROLL_ASSIGN'), assessmentController.postAssign);
router.post('/admin/assessments/:id/questions/add', requirePermission('QUIZ_BANK_MANAGE'), assessmentController.postAddQuestion);
router.post('/admin/assessments/:id/questions/:questionId/delete', requirePermission('QUIZ_BANK_MANAGE'), assessmentController.postDeleteQuestion);

module.exports = router;

