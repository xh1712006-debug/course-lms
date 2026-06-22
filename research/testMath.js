const assert = require('assert').strict;
const dataPipeline = require('../services/dataPipelineService');

/**
 * Suite kiểm thử đơn vị logic toán học & ca biên (Mathematical Unit Tests)
 * Hướng tới tính đúng đắn toán học và ổn định số học của hệ thống
 */
function runTests() {
  console.log('=== KHỞI CHẠY KIỂM THỬ ĐƠN VỊ TOÁN HỌC ===\n');
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

  // 1. Kiểm thử băm dữ liệu và khử định danh PII [RS-DATA-01]
  test('Kiểm tra PII - Xóa bỏ thông tin nhạy cảm', () => {
    const rawCustomer = {
      customer_id: 'CUST-999',
      name: 'Nguyen Van Test',
      email: 'test@example.com',
      phone_number: '0901234567',
      time_series: [1, 2, 3],
      label: 1
    };

    const clean = dataPipeline.anonymizePII(rawCustomer, 'secret_salt_123');

    assert.strictEqual(clean.name, undefined, 'Phải xóa trường name');
    assert.strictEqual(clean.email, undefined, 'Phải xóa trường email');
    assert.strictEqual(clean.phone_number, undefined, 'Phải xóa trường phone_number');
    assert.strictEqual(clean.label, 1, 'Phải giữ nguyên trường label');
    assert.deepEqual(clean.time_series, [1, 2, 3], 'Phải giữ nguyên trường time_series');
  });

  test('Kiểm tra PII - Băm ID an toàn có muối (Salt)', () => {
    const id = 'CUST-111';
    const salt1 = 'saltA';
    const salt2 = 'saltB';

    const clean1 = dataPipeline.anonymizePII({ customer_id: id }, salt1);
    const clean2 = dataPipeline.anonymizePII({ customer_id: id }, salt1);
    const clean3 = dataPipeline.anonymizePII({ customer_id: id }, salt2);

    assert.notStrictEqual(clean1.customer_id, id, 'ID băm không được giống ID gốc');
    assert.strictEqual(clean1.customer_id.length, 64, 'Chiều dài chuỗi băm SHA-256 phải là 64 ký tự');
    assert.strictEqual(clean1.customer_id, clean2.customer_id, 'Cùng ID và Salt phải ra cùng một mã băm');
    assert.notStrictEqual(clean1.customer_id, clean3.customer_id, 'Khác Salt phải ra mã băm khác nhau');
  });

  // 2. Kiểm thử nội suy tuyến tính chuỗi thời gian [RS-DATA-02]
  test('Nội suy chuỗi thời gian - Điền khuyết ở giữa chuỗi (Nội suy)', () => {
    const input = [1.0, null, 3.0, null, 5.0];
    const expected = [1.0, 2.0, 3.0, 4.0, 5.0];
    const output = dataPipeline.interpolateTimeSeries(input);
    assert.deepEqual(output, expected);
  });

  test('Nội suy chuỗi thời gian - Điền khuyết ở biên (Ngoại suy)', () => {
    // Giá trị null ở đầu chuỗi và cuối chuỗi
    const input = [null, 2.0, 3.0, null];
    const expected = [2.0, 2.0, 3.0, 3.0];
    const output = dataPipeline.interpolateTimeSeries(input);
    assert.deepEqual(output, expected);
  });

  test('Nội suy chuỗi thời gian - Không có giá trị khuyết', () => {
    const input = [1.5, 2.5, 3.5];
    const expected = [1.5, 2.5, 3.5];
    const output = dataPipeline.interpolateTimeSeries(input);
    assert.deepEqual(output, expected);
  });

  test('Nội suy chuỗi thời gian - Toàn bộ chuỗi là null (Trường hợp biên cực đoan)', () => {
    const input = [null, null, null];
    const expected = [0.0, 0.0, 0.0];
    const output = dataPipeline.interpolateTimeSeries(input);
    assert.deepEqual(output, expected);
  });

  // 3. Kiểm thử chuẩn hóa MinMaxScaler
  test('Chuẩn hóa dữ liệu - Đưa về miền [0, 1]', () => {
    const input = [5.0, 10.0, 15.0, 20.0];
    const expected = [0.0, 0.3333, 0.6667, 1.0];
    const output = dataPipeline.minMaxScale(input);
    assert.deepEqual(output, expected);
  });

  test('Chuẩn hóa dữ liệu - Dải giá trị bằng 0 (Tất cả phần tử bằng nhau)', () => {
    const input = [10.0, 10.0, 10.0];
    const expected = [0.5, 0.5, 0.5]; // Trả về giá trị trung vị 0.5 để ổn định số học
    const output = dataPipeline.minMaxScale(input);
    assert.deepEqual(output, expected);
  });

  console.log('\n=======================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedCount} PASS, ${failedCount} FAIL`);
  
  if (failedCount > 0) {
    console.error('\n[ERR] Có bài kiểm thử bị thất bại. Vui lòng rà soát lại.');
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] Tất cả các ca kiểm thử toán học đều đạt chuẩn!');
    process.exit(0);
  }
}

// Chạy trực tiếp
runTests();
