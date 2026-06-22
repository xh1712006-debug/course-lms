/**
   ==========================================================================
   WEB WORKER CHẠY NGẦM - XUẤT BÁO CÁO ĐIỂM HỌC VIÊN SANG FILE CSV
   ==========================================================================
*/

self.onmessage = function(e) {
  if (e.data.action === 'start_export') {
    // Gọi API nội bộ lấy dữ liệu thô (Raw JSON) của báo cáo
    fetch('/admin/reports/raw')
      .then(response => {
        if (!response.ok) {
          throw new Error('Mã phản hồi HTTP: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        // Thực hiện xử lý chuyển đổi cấu trúc dữ liệu JSON sang chuỗi CSV
        const csvRows = [];
        
        // 1. Định nghĩa các hàng tiêu đề cột
        const headers = [
          'Nhân viên',
          'Email',
          'Phòng ban',
          'Khóa học',
          'Tiến độ (%)',
          'Hình thức',
          'Trạng thái phê duyệt',
          'Thời gian truy cập cuối'
        ];
        csvRows.push(headers.join(','));

        // 2. Chuyển đổi từng hàng dữ liệu của nhân viên
        data.forEach(row => {
          const values = [
            escapeCsvValue(row.username),
            escapeCsvValue(row.email),
            escapeCsvValue(row.department_name || 'Chưa gán'),
            escapeCsvValue(row.course_title),
            row.progress + '%',
            row.is_assigned ? 'Bắt buộc' : 'Tự học',
            row.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
            new Date(row.last_accessed).toLocaleString('vi-VN')
          ];
          csvRows.push(values.join(','));
        });

        // Ghép mảng hàng thành một chuỗi văn bản lớn phân tách bằng ngắt dòng
        const csvString = csvRows.join('\n');
        
        // Gửi kết quả chuỗi CSV đã biên soạn về luồng UI chính
        self.postMessage(csvString);
      })
      .catch(err => {
        // Gửi lỗi về nếu gặp sự cố
        self.postMessage({ error: err.message });
      });
  }
};

/**
 * Hàm trợ giúp bọc chuỗi chứa dấu phẩy để tránh lỗi lệch cột trong Excel
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) {
    return '""';
  }
  let str = val.toString();
  // Nếu chứa dấu phẩy, dấu nháy kép hoặc xuống dòng, phải bọc trong nháy kép và escape nháy kép cũ
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}
