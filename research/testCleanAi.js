const assert = require('assert').strict;
const LessonEntity = require('../domain/entities/lessonEntity');
const SummarizeLessonUseCase = require('../domain/usecases/summarizeLessonUseCase');

function runCleanTests() {
  console.log('=== KHỞI CHẠY KIỂM THỬ ĐƠN VỊ CLEAN ARCHITECTURE ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function test(description, testFn) {
    try {
      testFn();
      console.log(`[PASS] ${description}`);
      passedCount++;
    } catch (err) {
      console.error(`[FAIL] ${description}`);
      console.error(err);
      failedCount++;
    }
  }

  // 1. Kiểm thử LessonEntity logic nghiệp vụ cốt lõi
  test('LessonEntity - Trả về true khi có ít nhất một học liệu hợp lệ', () => {
    const lesson = new LessonEntity({
      id: 1,
      title: 'Bài 1',
      content: 'Nội dung bài học',
      videoUrl: '',
      attachmentUrl: ''
    });
    assert.strictEqual(lesson.hasValidLearningMaterial(), true);
  });

  test('LessonEntity - Trả về false khi bài học rỗng hoàn toàn học liệu', () => {
    const lesson = new LessonEntity({
      id: 2,
      title: 'Bài 2',
      content: '',
      videoUrl: '',
      attachmentUrl: ''
    });
    assert.strictEqual(lesson.hasValidLearningMaterial(), false);
  });

  // 2. Kiểm thử SummarizeLessonUseCase bằng Mock Repository và Mock AI Service
  test('SummarizeLessonUseCase - Tóm tắt thành công khi học liệu hợp lệ', async () => {
    // Thiết lập Mock Repositories
    const mockLessonRepository = {
      findById: async (id) => {
        return new LessonEntity({
          id: id,
          title: 'Bài học kiểm thử',
          content: 'Nội dung bài học kiểm thử thành công.',
          videoUrl: '',
          attachmentUrl: ''
        });
      }
    };

    const mockAuditLogRepository = {
      loggedUser: null,
      loggedAction: null,
      log: async (userId, action, details) => {
        mockAuditLogRepository.loggedUser = userId;
        mockAuditLogRepository.loggedAction = action;
      }
    };

    const mockAiService = {
      summarize: async (lesson) => {
        return `Tóm tắt của bài giảng: ${lesson.title}`;
      }
    };

    const useCase = new SummarizeLessonUseCase({
      lessonRepository: mockLessonRepository,
      auditLogRepository: mockAuditLogRepository,
      aiService: mockAiService
    });

    const result = await useCase.execute(42, 99);

    assert.strictEqual(result, 'Tóm tắt của bài giảng: Bài học kiểm thử');
    assert.strictEqual(mockAuditLogRepository.loggedUser, 99);
    assert.strictEqual(mockAuditLogRepository.loggedAction, 'AI_SUMMARIZE_LESSON');
  });

  test('SummarizeLessonUseCase - Ném lỗi khi không tìm thấy bài học', async () => {
    const mockLessonRepository = {
      findById: async () => null // Không tìm thấy
    };
    const mockAuditLogRepository = { log: async () => {} };
    const mockAiService = { summarize: async () => '' };

    const useCase = new SummarizeLessonUseCase({
      lessonRepository: mockLessonRepository,
      auditLogRepository: mockAuditLogRepository,
      aiService: mockAiService
    });

    try {
      await useCase.execute(999, 1);
      assert.fail('Đáng lẽ phải ném lỗi khi không tìm thấy bài học');
    } catch (err) {
      assert.strictEqual(err.message, 'Không tìm thấy bài giảng.');
    }
  });

  setTimeout(() => {
    console.log('\n=======================================');
    console.log(`KẾT QUẢ KIỂM THỬ CLEAN: ${passedCount} PASS, ${failedCount} FAIL`);
    if (failedCount > 0) {
      process.exit(1);
    } else {
      console.log('\n[SUCCESS] Tất cả các ca kiểm thử Clean Architecture đều đạt chuẩn!');
      process.exit(0);
    }
  }, 100);
}

runCleanTests();
