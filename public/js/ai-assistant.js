// Lịch sử trò chuyện với AI tại bài học hiện tại
let aiChatHistory = [];

// Trạng thái câu hỏi trắc nghiệm ôn tập nhanh
let quickQuizQuestions = [];
let quickQuizAnswers = {};

/**
 * Gọi AI tóm tắt bài giảng lý thuyết
 */
function handleAiSummarize() {
  const lessonIdField = document.getElementById('lesson-id-field');
  if (!lessonIdField) return;

  const lessonId = lessonIdField.value;
  const chatBox = document.getElementById('ai-chat-box');

  // Chèn bong bóng chờ
  const loadingId = appendAiMessage('assistant', '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>');
  chatBox.scrollTop = chatBox.scrollHeight;

  fetch('/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId })
  })
  .then(async res => {
    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new Error(errJson.error || `HTTP ${res.status}`);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (HTTP ${res.status})`);
      }
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Phiên đăng nhập có thể đã hết hạn hoặc máy chủ phản hồi định dạng không hợp lệ.');
    }
    return res.json();
  })
  .then(data => {
    removeMessageById(loadingId);
    if (data.error) {
      appendAiMessage('assistant', `❌ Gặp sự cố: ${data.error}`);
    } else {
      // Vì là EJS thô, ở đây ta hiển thị text markdown
      appendAiMessage('assistant', `<div style="font-weight:600; margin-bottom:0.5rem; color:#818cf8;"><i class="fa-solid fa-square-poll-horizontal"></i> TÓM TẮT BÀI HỌC BẰNG AI:</div>${formatMarkdown(data.summary)}`);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  })
  .catch(err => {
    removeMessageById(loadingId);
    appendAiMessage('assistant', `❌ Lỗi kết nối AI: ${err.message}`);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

/**
 * Trò chuyện hỏi đáp với AI
 */
function handleAiSendChat() {
  const inputEl = document.getElementById('ai-chat-input');
  const message = inputEl.value.trim();
  const lessonIdField = document.getElementById('lesson-id-field');

  if (!message || !lessonIdField) return;

  const lessonId = lessonIdField.value;
  const chatBox = document.getElementById('ai-chat-box');

  // 1. Chèn câu hỏi của User vào khung chat
  appendAiMessage('user', message);
  inputEl.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  // 2. Chèn bong bóng chờ phản hồi của AI
  const loadingId = appendAiMessage('assistant', '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>');
  chatBox.scrollTop = chatBox.scrollHeight;

  // Gọi API AI Chat
  fetch('/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lessonId,
      message,
      history: aiChatHistory
    })
  })
  .then(async res => {
    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new Error(errJson.error || `HTTP ${res.status}`);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (HTTP ${res.status})`);
      }
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Phiên đăng nhập có thể đã hết hạn hoặc máy chủ phản hồi định dạng không hợp lệ.');
    }
    return res.json();
  })
  .then(data => {
    removeMessageById(loadingId);
    if (data.error) {
      appendAiMessage('assistant', `❌ Sự cố: ${data.error}`);
    } else {
      appendAiMessage('assistant', formatMarkdown(data.answer));
      
      // Lưu vào lịch sử chat cục bộ của client
      aiChatHistory.push({ role: 'user', content: message });
      aiChatHistory.push({ role: 'model', content: data.answer });
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  })
  .catch(err => {
    removeMessageById(loadingId);
    appendAiMessage('assistant', `❌ Lỗi kết nối: ${err.message}`);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

/**
 * Gọi AI sinh 3 câu hỏi trắc nghiệm ôn tập nhanh trực tiếp
 */
function handleAiGenerateQuiz() {
  const lessonIdField = document.getElementById('lesson-id-field');
  if (!lessonIdField) return;

  const lessonId = lessonIdField.value;
  const chatBox = document.getElementById('ai-chat-box');
  const quizArea = document.getElementById('ai-quick-quiz-area');

  // Hiện thông báo đang tạo
  const loadingId = appendAiMessage('assistant', '🤖 Đang khởi tạo bộ trắc nghiệm thông minh dựa trên nội dung bài giảng...');
  chatBox.scrollTop = chatBox.scrollHeight;

  fetch('/ai/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId })
  })
  .then(async res => {
    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new Error(errJson.error || `HTTP ${res.status}`);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (HTTP ${res.status})`);
      }
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Phiên đăng nhập có thể đã hết hạn hoặc máy chủ phản hồi định dạng không hợp lệ.');
    }
    return res.json();
  })
  .then(data => {
    removeMessageById(loadingId);
    if (data.error) {
      appendAiMessage('assistant', `❌ Lỗi sinh đề thi: ${data.error}`);
      chatBox.scrollTop = chatBox.scrollHeight;
      return;
    }

    quickQuizQuestions = data.questions;
    quickQuizAnswers = {};

    // Render bộ trắc nghiệm ôn tập
    renderQuickQuiz(data.questions);
  })
  .catch(err => {
    removeMessageById(loadingId);
    appendAiMessage('assistant', `❌ Sự cố kết nối: ${err.message}`);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

/**
 * Admin dùng AI để sinh câu hỏi trắc nghiệm trực tiếp vào DB ngân hàng đề thi
 */
function handleAiGenerateToDb(quizId) {
  const lessonIdField = document.getElementById('lesson-id-field');
  if (!lessonIdField) return;

  const lessonId = lessonIdField.value;
  const chatBox = document.getElementById('ai-chat-box');

  // Hiện thông báo đang tạo
  const loadingId = appendAiMessage('assistant', '🤖 Đang dùng AI để tự động tạo câu hỏi trắc nghiệm chất lượng cao và đồng bộ trực tiếp vào Ngân hàng câu hỏi của hệ thống...');
  chatBox.scrollTop = chatBox.scrollHeight;

  fetch('/ai/quiz-to-bank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId, quizId })
  })
  .then(async res => {
    if (!res.ok) {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        throw new Error(errJson.error || `HTTP ${res.status}`);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (HTTP ${res.status})`);
      }
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Phiên đăng nhập có thể đã hết hạn hoặc máy chủ phản hồi định dạng không hợp lệ.');
    }
    return res.json();
  })
  .then(data => {
    removeMessageById(loadingId);
    if (data.error) {
      appendAiMessage('assistant', `❌ Gặp sự cố: ${data.error}`);
    } else {
      appendAiMessage('assistant', `✅ Thành công: ${data.success || 'Đã thêm câu hỏi vào CSDL.'}`);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  })
  .catch(err => {
    removeMessageById(loadingId);
    appendAiMessage('assistant', `❌ Lỗi kết nối AI: ${err.message}`);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

/**
 * Hiển thị khối trắc nghiệm tương tác
 */
function renderQuickQuiz(questions) {
  const quizArea = document.getElementById('ai-quick-quiz-area');
  quizArea.style.display = 'block';
  quizArea.className = 'quiz-widget';
  
  let html = `
    <h4 style="font-weight:700; color:#06b6d4; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <span><i class="fa-solid fa-circle-question"></i> Trắc Nghiệm Ôn Tập AI</span>
      <button class="btn btn-secondary" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="closeQuickQuiz()">Đóng</button>
    </h4>
  `;

  questions.forEach((q, qIdx) => {
    const qText = sanitizeMathText(q.question_text);
    html += `
      <div style="margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1rem; &:last-child { border-bottom:none; }">
        <p style="font-weight:600; font-size:0.85rem; margin-bottom:0.5rem;">Câu ${qIdx + 1}: ${qText}</p>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
    `;
    
    q.options.forEach((opt, oIdx) => {
      const cleanOpt = sanitizeMathText(opt);
      html += `
        <button class="quiz-option" id="quiz-q${qIdx}-o${oIdx}" onclick="answerQuickQuestion(${qIdx}, '${cleanOpt.replace(/'/g, "\\'")}', ${oIdx})">
          ${cleanOpt}
        </button>
      `;
    });

    html += `
        </div>
        <p id="quiz-feedback-q${qIdx}" style="font-size:0.8rem; font-weight:600; margin-top:0.5rem; display:none;"></p>
      </div>
    `;
  });

  quizArea.innerHTML = html;
  // Kết xuất công thức toán học trong phần trắc nghiệm ôn tập nhanh
  if (typeof renderMath === 'function') {
    renderMath(quizArea);
  }
  quizArea.scrollIntoView({ behavior: 'smooth' });
}

function closeQuickQuiz() {
  document.getElementById('ai-quick-quiz-area').style.display = 'none';
}

/**
 * Chấm điểm câu hỏi ôn tập
 */
function answerQuickQuestion(qIdx, selectedOpt, oIdx) {
  // Tránh chọn lại câu đã trả lời
  if (quickQuizAnswers[qIdx] !== undefined) return;

  const correctAns = quickQuizQuestions[qIdx].correct_answer;
  const feedbackEl = document.getElementById(`quiz-feedback-q${qIdx}`);
  
  quickQuizAnswers[qIdx] = selectedOpt;

  // Đánh dấu các đáp án màu xanh lá/đỏ
  quickQuizQuestions[qIdx].options.forEach((opt, idx) => {
    const btn = document.getElementById(`quiz-q${qIdx}-o${idx}`);
    if (opt === correctAns) {
      btn.className = 'quiz-option correct'; // màu xanh lá cho đáp án đúng
    } else if (idx === oIdx) {
      btn.className = 'quiz-option incorrect'; // màu đỏ cho đáp án sai đã chọn
    }
  });

  feedbackEl.style.display = 'block';
  if (selectedOpt === correctAns) {
    feedbackEl.innerHTML = '<span style="color:#10b981;"><i class="fa-solid fa-check"></i> Đúng rồi!</span>';
  } else {
    feedbackEl.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-xmark"></i> Sai rồi!</span> <span style="color:var(--text-muted)">Đáp án đúng là: <strong>${correctAns}</strong></span>`;
  }

  // Nếu trả lời đủ 3 câu, tính tổng điểm
  if (Object.keys(quickQuizAnswers).length === quickQuizQuestions.length) {
    let score = 0;
    quickQuizQuestions.forEach((q, idx) => {
      if (quickQuizAnswers[idx] === q.correct_answer) score++;
    });
    
    setTimeout(() => {
      alert(`Chúc mừng! Bạn đã hoàn thành bài ôn tập nhanh. Đạt được: ${score}/${quickQuizQuestions.length} câu đúng.`);
    }, 500);
  }
}

// ==========================================
// THI CUỐI KHÓA (MODAL THI THỰC TẾ)
// ==========================================
let currentQuizId = null;
let currentQuizQuestions = [];

function openFinalQuizModal() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('final-quiz-modal');
  const container = document.getElementById('modal-quiz-questions');
  const title = document.getElementById('modal-quiz-title');

  overlay.style.display = 'block';
  modal.style.display = 'block';

  // Tải danh sách câu hỏi đề thi cuối khóa
  const lessonId = document.getElementById('lesson-id-field').value;
  container.innerHTML = '<p style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Đang nạp đề thi từ hệ thống...</p>';

  // Lấy câu hỏi đề thi
  fetch(`/courses/quiz/questions?lessonId=${lessonId}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        container.innerHTML = `<p style="color:#ef4444;">❌ Lỗi: ${data.error}</p>`;
        return;
      }

      currentQuizId = data.quiz.id;
      currentQuizQuestions = data.questions;
      title.textContent = data.quiz.title;

      if (data.questions.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Đề thi chưa được tải câu hỏi lên. Vui lòng liên hệ Giáo viên/Admin.</p>';
        return;
      }

      // Render danh sách câu hỏi
      let html = '';
      data.questions.forEach((q, qIdx) => {
        const qText = sanitizeMathText(q.question_text);
        html += `
          <div style="margin-bottom:1.5rem; border-bottom:1px solid var(--border-light); padding-bottom:1rem;">
            <p style="font-weight:600; margin-bottom:0.75rem;">Câu ${qIdx + 1}: ${qText}</p>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
        `;
        
        if (q.question_type === 'essay') {
          html += `
            <textarea name="modal-q-${q.id}-essay" placeholder="Nhập câu trả lời tự luận của bạn tại đây..." style="width:100%; min-height:100px; padding:0.75rem; border-radius:8px; border:1px solid var(--border-light); background:rgba(0,0,0,0.2); color:#fff; font-family:inherit; font-size:0.9rem;" required></textarea>
          `;
        } else {
          q.options.forEach((opt, oIdx) => {
            const cleanOpt = sanitizeMathText(opt);
            html += `
              <label style="display:flex; align-items:center; gap:0.75rem; background:rgba(255,255,255,0.02); padding:0.6rem 1rem; border-radius:8px; border:1px solid var(--border-light); cursor:pointer;">
                <input type="radio" name="modal-q-${q.id}" value="${cleanOpt.replace(/"/g, '&quot;')}" required>
                <span>${cleanOpt}</span>
              </label>
            `;
          });
        }

        html += `
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
      // Kết xuất công thức toán học trong phần đề thi cuối khóa
      if (typeof renderMath === 'function') {
        renderMath(container);
      }
    })
    .catch(err => {
      container.innerHTML = `<p style="color:#ef4444;">❌ Không thể tải đề: ${err.message}</p>`;
    });
}

function closeFinalQuizModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('final-quiz-modal').style.display = 'none';
}

function submitFinalQuiz() {
  if (!currentQuizId || currentQuizQuestions.length === 0) return;

  const answers = {};
  let essayAnswer = null;
  let answeredCount = 0;

  // Thu thập câu trả lời
  currentQuizQuestions.forEach(q => {
    if (q.question_type === 'essay') {
      const ta = document.getElementsByName(`modal-q-${q.id}-essay`)[0];
      if (ta && ta.value.trim() !== '') {
        essayAnswer = ta.value.trim();
        answeredCount++;
      }
    } else {
      const radios = document.getElementsByName(`modal-q-${q.id}`);
      let selectedValue = null;
      for (let r of radios) {
        if (r.checked) {
          selectedValue = r.value;
          break;
        }
      }
      if (selectedValue !== null) {
        answers[q.id] = selectedValue;
        answeredCount++;
      }
    }
  });

  if (answeredCount < currentQuizQuestions.length) {
    alert('Vui lòng hoàn thành tất cả các câu hỏi (bao gồm cả tự luận) trước khi nộp bài.');
    return;
  }

  // Nộp bài thi lên server
  fetch('/courses/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizId: currentQuizId,
      answers,
      essayAnswer
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert('Lỗi nộp bài: ' + data.error);
    } else {
      if (data.has_essay) {
        alert('Nộp bài thành công! Bài thi có chứa câu tự luận nên đang chờ Giảng viên chấm điểm và phản hồi.');
      } else {
        alert(`Nộp bài thành công!\nĐiểm số đạt được: ${data.score}/100\nTrạng thái: ${data.is_passed ? 'ĐẠT (PASSED) 🎉' : 'CHƯA ĐẠT (FAILED) ❌'}`);
      }
      closeFinalQuizModal();
      window.location.reload(); // Reload để cập nhật tiến độ & chứng chỉ
    }
  })
  .catch(err => {
    alert('Lỗi gửi bài thi lên máy chủ: ' + err.message);
  });
}

// ==========================================
// CÁC HÀM HELPER PHỤ TRỢ
// ==========================================

function appendAiMessage(role, text) {
  const chatBox = document.getElementById('ai-chat-box');
  const msgId = 'ai-msg-' + Date.now();

  const msgDiv = document.createElement('div');
  msgDiv.className = `ai-msg ${role}`;
  msgDiv.id = msgId;
  msgDiv.innerHTML = text;

  chatBox.appendChild(msgDiv);

  // Kết xuất công thức toán học trong tin nhắn vừa thêm
  if (typeof renderMath === 'function') {
    renderMath(msgDiv);
  }

  return msgId;
}

function removeMessageById(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function formatMarkdown(text) {
  const cleanedText = typeof text === 'string' ? text.replace(/\\ +([a-zA-Z]+)/g, '\\$1') : text;
  if (typeof marked !== 'undefined') {
    return marked.parse(cleanedText);
  }
  // Thay thế thô các thẻ markdown cơ bản sang HTML để hiển thị đẹp
  let formatted = cleanedText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1); padding:0.1rem 0.3rem; border-radius:3px; font-family:monospace;">$1</code>')
    .replace(/\n/g, '<br>');
  return formatted;
}

function sanitizeMathText(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\\ +([a-zA-Z]+)/g, '\\$1');
}

// Xử lý nộp bài thi kiểm tra trắc nghiệm AI của riêng bài học
function highlightSelectedOption(element) {
  const siblings = element.parentNode.querySelectorAll('.quiz-option-label');
  siblings.forEach(sib => {
    sib.style.background = 'rgba(255, 255, 255, 0.01)';
    sib.style.borderColor = 'var(--border-light)';
  });
  element.style.background = 'rgba(99, 102, 241, 0.1)';
  element.style.borderColor = '#6366f1';
}

function submitLessonQuiz(event) {
  event.preventDefault();
  const form = document.getElementById('lesson-quiz-form');
  const quizId = document.getElementById('lesson-quiz-id').value;
  const lessonId = document.getElementById('lesson-id-field').value;
  const btn = document.getElementById('btn-submit-lesson-quiz');
  const alertBox = document.getElementById('quiz-result-alert');

  if (!btn || !alertBox) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang chấm điểm...';

  // Thu thập đáp án
  const answers = {};
  const formData = new FormData(form);
  for (let [key, value] of formData.entries()) {
    if (key.startsWith('q-')) {
      const questionId = key.replace('q-', '');
      answers[questionId] = value;
    }
  }

  fetch('/courses/quiz/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId, answers })
  })
    .then(res => res.json())
    .then(data => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Nộp bài kiểm tra';

      if (data.error) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert alert-danger';
        alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
        alertBox.style.border = '1px solid #ef4444';
        alertBox.style.color = '#f87171';
        alertBox.innerText = '❌ Lỗi: ' + data.error;
        return;
      }

      alertBox.style.display = 'block';
      if (data.is_passed) {
        alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
        alertBox.style.border = '1px solid #10b981';
        alertBox.style.color = '#34d399';
        alertBox.innerHTML = `🎉 <strong>Tuyệt vời!</strong> Bạn đã trả lời đúng ${data.score}% (${data.score / 10}/10 câu) và hoàn thành bài kiểm tra!`;

        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
        alertBox.style.border = '1px solid #ef4444';
        alertBox.style.color = '#f87171';
        alertBox.innerHTML = `❌ <strong>Không đạt!</strong> Điểm số của bạn: ${data.score}% (Yêu cầu phải đạt 100% để vượt qua). <br>Vui lòng nhấn nút dưới đây để làm lại bài kiểm tra từ đầu.`;

        // Đổi nút nộp bài thành nút làm lại
        const actionsContainer = document.getElementById('quiz-actions-container');
        if (actionsContainer) {
          actionsContainer.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="window.location.reload()" style="padding: 0.8rem 2.5rem; font-size: 0.95rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-rotate-left"></i> Làm lại từ đầu
            </button>
          `;
        }
      }
    })
    .catch(err => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Nộp bài kiểm tra';
      alertBox.style.display = 'block';
      alertBox.className = 'alert alert-danger';
      alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
      alertBox.style.border = '1px solid #ef4444';
      alertBox.style.color = '#f87171';
      alertBox.innerText = '❌ Không thể kết nối đến máy chủ: ' + err.message;
    });
}
