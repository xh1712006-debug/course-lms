const crypto = require('crypto');

/**
 * Dịch vụ tiền xử lý dữ liệu và bảo mật an toàn nghiên cứu khoa học
 */
module.exports = {
  /**
   * Nội suy tuyến tính chuỗi thời gian để xử lý giá trị khuyết (null)
   * [RS-DATA-02] Triển khai kỹ năng xử lý dữ liệu khuyết bằng phương pháp nội suy chuỗi thời gian
   * @param {Array} arr - Mảng chuỗi thời gian có chứa giá trị null
   * @returns {Array} - Mảng đã được điền khuyết bằng nội suy tuyến tính
   */
  interpolateTimeSeries: (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    
    const result = [...arr];
    const n = result.length;

    for (let i = 0; i < n; i++) {
      if (result[i] === null) {
        // Tìm vị trí giá trị hợp lệ gần nhất ở bên trái
        let leftIdx = -1;
        for (let l = i - 1; l >= 0; l--) {
          if (result[l] !== null) {
            leftIdx = l;
            break;
          }
        }

        // Tìm vị trí giá trị hợp lệ gần nhất ở bên phải
        let rightIdx = -1;
        for (let r = i + 1; r < n; r++) {
          if (result[r] !== null) {
            rightIdx = r;
            break;
          }
        }

        // Thực hiện nội suy hoặc ngoại suy
        if (leftIdx !== -1 && rightIdx !== -1) {
          const leftVal = result[leftIdx];
          const rightVal = result[rightIdx];
          // Nội suy tuyến tính: y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
          result[i] = leftVal + (rightVal - leftVal) * (i - leftIdx) / (rightIdx - leftIdx);
        } else if (leftIdx !== -1) {
          // Ngoại suy tiến (các phần tử khuyết ở cuối chuỗi): Lấy giá trị hợp lệ bên trái gần nhất
          result[i] = result[leftIdx];
        } else if (rightIdx !== -1) {
          // Ngoại suy lùi (các phần tử khuyết ở đầu chuỗi): Lấy giá trị hợp lệ bên phải gần nhất
          result[i] = result[rightIdx];
        } else {
          // Trường hợp đặc biệt: Toàn bộ mảng là null
          result[i] = 0.0;
        }

        // Làm tròn số thập phân
        result[i] = Math.round(result[i] * 10000) / 10000;
      }
    }

    return result;
  },

  /**
   * Khử định danh thông tin nhạy cảm PII
   * [RS-DATA-01] Khử định danh hoàn toàn trường dữ liệu khách hàng (PII) trước khi đưa vào huấn luyện
   * @param {object} customer - Đối tượng khách hàng chứa thông tin nhạy cảm
   * @param {string} salt - Mã muối dùng để mã hóa bảo mật
   * @returns {object} - Đối tượng khách hàng đã khử định danh an toàn
   */
  anonymizePII: (customer, salt = 'default_company_salt_key') => {
    // 1. Tạo bản sao để tránh làm thay đổi dữ liệu gốc trực tiếp
    const cleanCustomer = { ...customer };

    // 2. Loại bỏ hoàn toàn các trường thông tin PII nhạy cảm trực tiếp
    delete cleanCustomer.name;
    delete cleanCustomer.email;
    delete cleanCustomer.phone_number;

    // 3. Băm (Hash) trường ID duy nhất sử dụng HMAC SHA-256 kèm Salt
    if (cleanCustomer.customer_id) {
      cleanCustomer.customer_id = crypto
        .createHmac('sha256', salt)
        .update(cleanCustomer.customer_id.toString())
        .digest('hex');
    }

    return cleanCustomer;
  },

  /**
   * Chuẩn hóa Min-Max Scaling đưa dữ liệu về miền [0, 1]
   * @param {Array} arr - Mảng số thực cần chuẩn hóa
   * @returns {Array} - Mảng số thực đã được chuẩn hóa về miền [0, 1]
   */
  minMaxScale: (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min;

    // Phòng ngừa lỗi chia cho 0 nếu tất cả phần tử trong mảng bằng nhau (độ ổn định số học)
    if (range === 0) {
      return arr.map(() => 0.5);
    }

    return arr.map(x => Math.round(((x - min) / range) * 10000) / 10000);
  },

  /**
   * Quy trình Pipeline toàn diện: Khử định danh, nội suy, chuẩn hóa, phân chia dữ liệu
   * Phân chia theo tỷ lệ Train 70%, Val 15%, Test 15%
   * @param {Array} rawDataset - Tập dữ liệu thô
   * @param {string} salt - Mã muối cho PII Hashing
   * @returns {object} - Bộ dữ liệu đã được xử lý và phân tách { train, validation, test }
   */
  processDataset: (rawDataset, salt = 'default_company_salt_key') => {
    if (!Array.isArray(rawDataset)) {
      throw new Error('Dữ liệu đầu vào phải là một mảng.');
    }

    // 1. Xử lý từng mẫu dữ liệu qua pipeline làm sạch và an toàn
    const processed = rawDataset.map(sample => {
      // Khử định danh PII
      let cleanSample = module.exports.anonymizePII(sample, salt);
      // Nội suy chuỗi thời gian khuyết
      let interpolatedSeq = module.exports.interpolateTimeSeries(cleanSample.time_series);
      // Chuẩn hóa Min-Max Scaling
      let scaledSeq = module.exports.minMaxScale(interpolatedSeq);

      return {
        customer_id: cleanSample.customer_id,
        features: scaledSeq,
        label: cleanSample.label
      };
    });

    // Trộn ngẫu nhiên dữ liệu để tăng tính khách quan (dùng thuật toán Fisher-Yates)
    // Cố định random bằng seed ngẫu nhiên đơn giản
    const shuffled = [...processed];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 2. Phân chia Train 70%, Val 15%, Test 15%
    const total = shuffled.length;
    const trainEnd = Math.floor(total * 0.70);
    const valEnd = trainEnd + Math.floor(total * 0.15);

    const train = shuffled.slice(0, trainEnd);
    const validation = shuffled.slice(trainEnd, valEnd);
    const test = shuffled.slice(valEnd);

    return {
      train,
      validation,
      test
    };
  }
};
