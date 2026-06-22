document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('experimentForm');
  const btnStart = document.getElementById('btnStart');
  const progressBox = document.getElementById('progressBox');
  const consoleLogs = document.getElementById('consoleLogs');
  const progEpoch = document.getElementById('progEpoch');
  const progAcc = document.getElementById('progAcc');
  const progLoss = document.getElementById('progLoss');
  const progValAcc = document.getElementById('progValAcc');
  const tableBody = document.getElementById('experimentsTableBody');
  const noDataRow = document.getElementById('noDataRow');
  const nameInput = document.getElementById('name');

  // Khởi tạo giá trị mặc định cho tên thực nghiệm dựa trên mốc thời gian
  nameInput.value = `CNN_1D_Run_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Cấu hình vẽ Đồ thị liên tục hai trục (Chart.js)
  const ctx = document.getElementById('metricsChart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Loss (Train)',
          data: [],
          borderColor: '#f87171',
          backgroundColor: 'rgba(248, 113, 113, 0.08)',
          yAxisID: 'y-loss',
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: 'Loss (Val)',
          data: [],
          borderColor: '#fb923c',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          yAxisID: 'y-loss',
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: 'Accuracy (Train) %',
          data: [],
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.08)',
          yAxisID: 'y-acc',
          borderWidth: 2.5,
          tension: 0.2
        },
        {
          label: 'Accuracy (Val) %',
          data: [],
          borderColor: '#34d399',
          backgroundColor: 'transparent',
          borderDash: [4, 4],
          yAxisID: 'y-acc',
          borderWidth: 2.5,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        'y-loss': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Loss (Sai số)',
            color: '#f87171',
            font: { weight: 'bold' }
          },
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        'y-acc': {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          title: {
            display: true,
            text: 'Độ chính xác (Accuracy %)',
            color: '#34d399',
            font: { weight: 'bold' }
          },
          ticks: { color: '#94a3b8' },
          grid: { drawOnChartArea: false } // Không hiển thị đường lưới trục phải đè lên trục trái
        },
        x: {
          title: {
            display: true,
            text: 'Chu kỳ (Epoch)',
            color: '#a5b4fc',
            font: { weight: 'bold' }
          },
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f1f5f9', font: { size: 11 } }
        }
      }
    }
  });

  // Kết nối tới Socket.io server
  // Lấy ID người dùng và username từ thông tin hiện tại (được nhúng qua layout EJS session nếu cần)
  const socket = io();

  // Hàm in log vào console mô phỏng
  function appendLog(text, color = '#38bdf8') {
    const timeStr = new Date().toLocaleTimeString();
    const logDiv = document.createElement('div');
    logDiv.style.color = color;
    logDiv.innerHTML = `<span style="color: #64748b;">[${timeStr}]</span> ${text}`;
    consoleLogs.appendChild(logDiv);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // 2. Lắng nghe cập nhật tiến độ Epoch từ Socket.io
  socket.on('experiment_progress', (data) => {
    // Cập nhật thông số số học hiển thị
    progEpoch.innerText = `${data.epoch}/${form.epochs.value}`;
    progAcc.innerText = `${data.accuracy}%`;
    progLoss.innerText = data.loss;
    progValAcc.innerText = `${data.val_acc}%`;

    // Cập nhật log console
    appendLog(`[Epoch ${data.epoch}] Loss: ${data.loss} | Acc: ${data.accuracy}% | Val Loss: ${data.val_loss} | Val Acc: ${data.val_acc}%`, '#a7f3d0');

    // Thêm điểm vào đồ thị
    chart.data.labels.push(data.epoch);
    chart.data.datasets[0].data.push(data.loss);
    chart.data.datasets[1].data.push(data.val_loss);
    chart.data.datasets[2].data.push(data.accuracy);
    chart.data.datasets[3].data.push(data.val_acc);
    chart.update();
  });

  // 3. Lắng nghe sự kiện hoàn thành thực nghiệm
  socket.on('experiment_done', (data) => {
    btnStart.disabled = false;
    form.name.disabled = false;
    form.epochs.disabled = false;
    form.batchSize.disabled = false;
    form.learningRate.disabled = false;
    progressBox.style.borderLeftColor = data.status === 'success' ? '#10b981' : '#ef4444';

    if (data.status === 'success') {
      appendLog(`[HỆ THỐNG] Huấn luyện hoàn tất thành công! Kết quả cuối cùng: Val Acc = ${data.accuracy}%, Val Loss = ${data.loss}`, '#34d399');
      // Thêm dòng mới vào bảng lịch sử hoặc cập nhật dòng hiện có
      updateHistoryTable(data.experimentId, 'success', data.accuracy, data.loss);
    } else {
      appendLog(`[HỆ THỐNG] Huấn luyện thất bại! Lỗi: ${data.error}`, '#f87171');
      updateHistoryTable(data.experimentId, 'failed', null, null);
    }
  });

  // Hàm cập nhật dòng bảng lịch sử
  function updateHistoryTable(id, status, accuracy, loss) {
    // Tìm xem dòng đã tồn tại chưa (trong TH bảng được cập nhật lại)
    const existingRow = document.querySelector(`tr[data-exp-id="${id}"]`);
    if (existingRow) {
      existingRow.querySelector('.exp-accuracy').innerText = accuracy ? `${accuracy}%` : '-';
      existingRow.querySelector('.exp-loss').innerText = loss || '-';
      
      const statusCell = existingRow.querySelector('.exp-status');
      if (status === 'success') {
        statusCell.innerHTML = `<span class="status-badge status-approved"><i class="fa-solid fa-check"></i> Thành công</span>`;
      } else {
        statusCell.innerHTML = `<span class="status-badge status-rejected"><i class="fa-solid fa-xmark"></i> Thất bại</span>`;
      }
    } else {
      // Nếu là dòng mới chạy và chưa được load (f5), ta thêm lên đầu bảng
      if (noDataRow) {
        noDataRow.remove();
      }
      const newRow = document.createElement('tr');
      newRow.setAttribute('data-exp-id', id);
      newRow.innerHTML = `
        <td>${id}</td>
        <td><strong>${form.name.value}</strong></td>
        <td>${form.epochs.value}</td>
        <td>${form.learningRate.value}</td>
        <td>${form.batchSize.value}</td>
        <td class="exp-accuracy">${accuracy ? accuracy + '%' : '-'}</td>
        <td class="exp-loss">${loss || '-'}</td>
        <td class="exp-status">
          ${status === 'success' ? 
            '<span class="status-badge status-approved"><i class="fa-solid fa-check"></i> Thành công</span>' : 
            '<span class="status-badge status-rejected"><i class="fa-solid fa-xmark"></i> Thất bại</span>'}
        </td>
        <td style="color: var(--text-muted);">${new Date().toLocaleString('vi-VN')}</td>
      `;
      tableBody.insertBefore(newRow, tableBody.firstChild);
    }
  }

  // 4. Bắt sự kiện nộp Form bắt đầu chạy thực nghiệm
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Vô hiệu hóa form để tránh bấm chạy trùng lặp
    btnStart.disabled = true;
    form.name.disabled = true;
    form.epochs.disabled = true;
    form.batchSize.disabled = true;
    form.learningRate.disabled = true;

    // Reset lại console logs & đồ thị
    consoleLogs.innerHTML = '';
    chart.data.labels = [];
    chart.data.datasets.forEach(ds => ds.data = []);
    chart.update();

    // Reset các trị số hiển thị hộp thông tin
    progEpoch.innerText = `0/${form.epochs.value}`;
    progAcc.innerText = '0%';
    progLoss.innerText = '0.000';
    progValAcc.innerText = '0%';
    progressBox.style.display = 'block';
    progressBox.style.borderLeftColor = '#f59e0b';

    appendLog('[HỆ THỐNG] Bắt đầu khởi chạy quy trình xử lý dữ liệu...', '#e2e8f0');
    appendLog('[DATA PIPELINE] Khử định danh PII khách hàng (HMAC-SHA256 băm ID)...', '#f59e0b');
    appendLog('[DATA PIPELINE] Nội suy tuyến tính điền khuyết các giá trị cảm biến chuỗi thời gian...', '#f59e0b');
    appendLog('[DATA PIPELINE] Chuẩn hóa dữ liệu MinMax Scaling về miền [0, 1]...', '#f59e0b');
    appendLog('[DATA PIPELINE] Phân tách dữ liệu: 70% Train, 15% Val, 15% Test...', '#f59e0b');

    try {
      const response = await fetch('/admin/experiments/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: form.name.value,
          epochs: parseInt(form.epochs.value),
          learningRate: parseFloat(form.learningRate.value),
          batchSize: parseInt(form.batchSize.value)
        })
      });

      const resData = await response.json();

      if (resData.success) {
        appendLog(`[HỆ THỐNG] Tạo tiến trình nghiên cứu thành công (ID: ${resData.experimentId})`, '#38bdf8');
        appendLog('[WORKER] Khởi động luồng nền Node.js Worker Thread...', '#6366f1');
        appendLog('[WORKER] Đang tải mô hình CNN 1D tích hợp Batch Normalization...', '#6366f1');
        appendLog('[WORKER] Huấn luyện bằng Adam Optimizer (Epsilon = 1e-8)...', '#6366f1');
        
        // Thêm dòng tạm thời vào bảng lịch sử
        if (noDataRow) {
          noDataRow.remove();
        }
        const tempRow = document.createElement('tr');
        tempRow.setAttribute('data-exp-id', resData.experimentId);
        tempRow.innerHTML = `
          <td>${resData.experimentId}</td>
          <td><strong>${form.name.value}</strong></td>
          <td>${form.epochs.value}</td>
          <td>${form.learningRate.value}</td>
          <td>${form.batchSize.value}</td>
          <td class="exp-accuracy">-</td>
          <td class="exp-loss">-</td>
          <td class="exp-status">
            <span class="status-badge status-pending" style="animation: pulse 1.5s infinite;"><i class="fa-solid fa-spinner fa-spin"></i> Đang chạy</span>
          </td>
          <td style="color: var(--text-muted);">${new Date().toLocaleString('vi-VN')}</td>
        `;
        tableBody.insertBefore(tempRow, tableBody.firstChild);
      } else {
        appendLog(`[LỖI] Khởi động thất bại: ${resData.error}`, '#ef4444');
        btnStart.disabled = false;
        form.name.disabled = false;
        form.epochs.disabled = false;
        form.batchSize.disabled = false;
        form.learningRate.disabled = false;
      }

    } catch (err) {
      appendLog(`[LỖI HỆ THỐNG] Kết nối thất bại: ${err.message}`, '#ef4444');
      btnStart.disabled = false;
      form.name.disabled = false;
      form.epochs.disabled = false;
      form.batchSize.disabled = false;
      form.learningRate.disabled = false;
    }
  });

  // Xử lý link bấm đến tài liệu đặc tả
  document.getElementById('specLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Tài liệu đặc tả khoa học được lưu trữ tại đường dẫn:\n- d:/antigravity/hocp1/docs/features/01-cnn-time-series.md\n\nNó sẽ tự động đồng bộ kết quả thực tế (Loss, Accuracy, Epochs...) ngay khi thực nghiệm chạy thành công.');
  });
});
