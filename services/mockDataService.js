const crypto = require('crypto');

/**
 * Dịch vụ sinh dữ liệu giả lập phục vụ thực nghiệm khoa học
 */
module.exports = {
  /**
   * Sinh mảng dữ liệu khách hàng giả lập chứa thông tin nhạy cảm PII và chuỗi thời gian khuyết
   * @param {number} count - Số lượng khách hàng cần sinh
   * @param {number} timeSteps - Số lượng bước thời gian cho mỗi khách hàng (mặc định 50)
   * @returns {Array} - Mảng chứa dữ liệu khách hàng
   */
  generateMockData: (count = 500, timeSteps = 50) => {
    const data = [];
    const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
    const middleNames = ['Văn', 'Thị', 'Đăng', 'Minh', 'Ngọc', 'Hữu', 'Đức', 'Khánh', 'Thanh', 'Anh'];
    const lastNames = ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hải', 'Khánh', 'Linh', 'Minh', 'Nam', 'Oanh', 'Phương', 'Quân', 'Sơn', 'Trang', 'Vinh'];

    for (let i = 0; i < count; i++) {
      // 1. Tạo thông tin định danh cá nhân (PII) giả lập
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const mName = middleNames[Math.floor(Math.random() * middleNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fName} ${mName} ${lName}`;
      
      const customerId = `CUST-${100000 + i}`;
      const email = `${customerId.toLowerCase()}@company.com`;
      const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;

      // 2. Tạo chuỗi thời gian đại diện cho hành vi người dùng (ví dụ: lượng dữ liệu truyền tải)
      // Tạo một chuỗi cơ sở (sine wave hoặc trend) kèm nhiễu ngẫu nhiên để có tính quy luật
      const timeSeries = [];
      const isClass1 = Math.random() > 0.5; // Nhãn phân loại thực tế
      const freq = isClass1 ? 0.2 : 0.05;    // Tần số sóng khác nhau để mô hình CNN học phân loại
      const amp = isClass1 ? 10 : 3;         // Biên độ khác nhau

      for (let t = 0; t < timeSteps; t++) {
        // Hàm sinh dữ liệu: giá trị cơ sở + nhiễu
        let val = amp * Math.sin(t * freq) + (Math.random() * 2 - 1) * 1.5;
        
        // Tạo giá trị khuyết ngẫu nhiên (khoảng 12% tỷ lệ khuyết)
        if (Math.random() < 0.12) {
          timeSeries.push(null);
        } else {
          // Làm tròn 4 chữ số thập phân
          timeSeries.push(Math.round(val * 10000) / 10000);
        }
      }

      data.push({
        customer_id: customerId,
        name: fullName,
        email: email,
        phone_number: phone,
        time_series: timeSeries,
        label: isClass1 ? 1 : 0
      });
    }

    return data;
  }
};
