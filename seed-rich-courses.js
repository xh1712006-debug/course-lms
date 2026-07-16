const db = require('./config/db');
const redis = require('./config/redis');

async function seedRichCourses() {
  console.log('\n=== BẮT ĐẦU GIEO MẦM DỮ LIỆU KHÓA HỌC ĐẦY ĐỦ ===');
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Xóa các dữ liệu cũ liên quan đến Khóa học, Bài học, Đề thi, Câu hỏi, Đăng ký và Trắc nghiệm
    console.log('1. Đang làm sạch dữ liệu khóa học cũ...');
    await client.query('DELETE FROM quiz_submissions CASCADE');
    await client.query('DELETE FROM questions CASCADE');
    await client.query('DELETE FROM quizzes CASCADE');
    await client.query('DELETE FROM comments CASCADE');
    await client.query('DELETE FROM enrollments CASCADE');
    await client.query('DELETE FROM learning_path_courses CASCADE');
    await client.query('DELETE FROM courses CASCADE');

    // Reset các Sequence ID của các bảng này về 1
    console.log('2. Đang thiết lập lại ID tự tăng...');
    await client.query("SELECT setval('courses_id_seq', 1, false)");
    await client.query("SELECT setval('lessons_id_seq', 1, false)");
    await client.query("SELECT setval('quizzes_id_seq', 1, false)");
    await client.query("SELECT setval('questions_id_seq', 1, false)");
    await client.query("SELECT setval('enrollments_id_seq', 1, false)");

    // 2. Thêm mới các Khóa học mẫu chất lượng cao
    console.log('3. Đang gieo mầm các khóa học mẫu chất lượng cao...');
    const coursesResult = await client.query(`
      INSERT INTO courses (id, title, description, image_url, status) VALUES
      (1, 'Lập trình Node.js & Express cơ bản', 'Khóa học cung cấp kiến thức nền tảng về NodeJS, cơ chế Single-Thread, Event Loop và cách xây dựng ứng dụng Web MVC, REST API chuyên nghiệp.', '/images/nodejs_course.svg', 'published'),
      (2, 'Bảo mật thông tin trong doanh nghiệp', 'Hướng dẫn nhân viên các quy tắc an toàn bảo mật, bảo vệ dữ liệu khách hàng, nhận diện email giả mạo (Phishing) và an toàn mật khẩu.', '/images/security_course.svg', 'published'),
      (3, 'Làm chủ Docker & Docker Compose', 'Đóng gói ứng dụng, tối ưu hóa môi trường phát triển và vận hành hệ thống container hóa hoàn chỉnh.', '/images/docker_course.svg', 'published'),
      (4, 'Kỹ năng Giao tiếp Công sở nâng cao', 'Khóa học cải thiện kỹ năng thuyết trình, trao đổi thông tin hiệu quả giữa các phòng ban trong công ty.', '/images/comm_course.svg', 'published'),
      (5, 'Học máy & Trí tuệ Nhân tạo Ứng dụng', 'Tìm hiểu cơ bản về các mô hình học máy phân lớp, hồi quy và ứng dụng mạng neural tích chập (CNN) phân loại ảnh.', '/images/default_course.svg', 'draft')
      RETURNING id, title
    `);
    console.log(`- Đã thêm ${coursesResult.rowCount} khóa học.`);

    // 3. Thêm mới các Bài học chi tiết cho từng khóa học
    console.log('4. Đang thêm các bài học chi tiết...');

    // Khóa học 1: Node.js (4 bài học)
    await client.query(`
      INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index) VALUES
      (1, 'Bài 1: Giới thiệu NodeJS và Kiến trúc Event Loop', 'Node.js là một runtime JavaScript xây dựng trên engine V8 của Chrome. Điểm cốt lõi của Node.js là mô hình I/O non-blocking, hướng sự kiện (event-driven).\n\nKhi có yêu cầu I/O (như đọc DB, file), Node.js sẽ ủy thác cho hệ điều hành chạy nền, giải phóng Thread chính để xử lý yêu cầu khác. Khi I/O hoàn thành, Event Loop sẽ gắp callback vào Call Stack để thực thi. Nhờ đó Node.js xử lý hàng nghìn kết nối đồng thời cực tốt chỉ với một luồng duy nhất.', 'https://www.w3schools.com/html/mov_bbb.mp4', 'https://www.w3schools.com/html/html_media.asp', 1),
      (1, 'Bài 2: Tạo dự án MVC đầu tiên với Express', 'MVC viết tắt của Model-View-Controller. Đây là một mẫu kiến trúc phần mềm phổ biến:\n\n- Model: Chịu trách nhiệm về dữ liệu, tương tác với database (ví dụ qua pg pool).\n- View: Giao diện hiển thị (EJS render ở server side).\n- Controller: Xử lý logic nghiệp vụ, tiếp nhận yêu cầu từ client, gọi Model xử lý và trả ra View tương ứng. Express giúp cấu hình router cực nhanh.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 2),
      (1, 'Bài 3: Tương tác Cơ sở dữ liệu với PostgreSQL và Pool Connection', 'PostgreSQL là một hệ quản trị cơ sở dữ liệu quan hệ mạnh mẽ.\n\nTrong ứng dụng Node.js, thay vì tạo và đóng kết nối liên tục cho mỗi request (tốn tài nguyên), chúng ta sử dụng Connection Pool (thư viện pg). Pool sẽ tạo sẵn một nhóm kết nối mở và quản lý chúng. Khi có truy vấn, ứng dụng mượn một kết nối từ Pool, thực thi và trả lại Pool ngay lập tức.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 3),
      (1, 'Bài 4: Tích hợp Redis để quản lý Session và Cache dữ liệu', 'Redis là cơ sở dữ liệu in-memory tốc độ cực cao, hoạt động dưới dạng Key-Value.\n\nTrong ứng dụng LMS, Redis được dùng làm Session Store giúp quản lý phiên đăng nhập ổn định ngay cả khi restart server. Ngoài ra, Redis còn dùng để cache danh sách khóa học đã xuất bản, giúp giảm tải trực tiếp cho PostgreSQL khi có hàng ngàn học viên truy cập cùng lúc.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 4)
    `);

    // Khóa học 2: Bảo mật thông tin (3 bài học)
    await client.query(`
      INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index) VALUES
      (2, 'Bài 1: Phân loại dữ liệu và Nguyên tắc bảo vệ PII', 'Thông tin định danh cá nhân (PII - Personally Identifiable Information) bao gồm Tên, Email, Số điện thoại, Số CCCD.\n\nQuy chế công ty bắt buộc các dữ liệu này phải được khử định danh (mã hóa hoặc băm bằng SHA-256) trước khi đưa vào các môi trường phân tích dữ liệu hoặc AI. Tuyệt đối không hardcode mật khẩu hay API key trong mã nguồn.', 'https://www.w3schools.com/html/mov_bbb.mp4', 'https://www.w3schools.com/html/html_media.asp', 1),
      (2, 'Bài 2: Nhận diện Email giả mạo (Phishing) và Social Engineering', 'Tấn công giả mạo (Phishing) là phương thức kẻ tấn công gửi email giả danh các đơn vị uy tín (Ngân hàng, Ban Giám đốc) để lừa người dùng nhấp vào link độc hại hoặc cung cấp mật khẩu.\n\nHãy luôn kiểm tra kỹ địa chỉ email của người gửi, không nhấp vào liên kết lạ, và luôn báo cáo cho bộ phận IT Security khi thấy email đáng ngờ.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 2),
      (2, 'Bài 3: Quy tắc quản lý mật khẩu an toàn và Xác thực 2 lớp (2FA)', 'Mật khẩu yếu là nguyên nhân hàng đầu dẫn đến rò rỉ tài khoản doanh nghiệp. Một mật khẩu an toàn phải có độ dài tối thiểu 12 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.\n\nXác thực 2 yếu tố (2FA) bổ sung một lớp bảo mật bổ sung (mã OTP thời gian thực qua điện thoại) giúp bảo vệ tài khoản ngay cả khi mật khẩu bị lộ.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 3)
    `);

    // Khóa học 3: Docker (3 bài học)
    await client.query(`
      INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index) VALUES
      (3, 'Bài 1: Tổng quan về Containerization và sự khác biệt với Máy ảo', 'Containerization là công nghệ đóng gói ứng dụng cùng với tất cả các thư viện, dependencies cần thiết để ứng dụng có thể chạy ổn định trên bất kỳ môi trường nào.\n\nKhác với Máy ảo (Virtual Machines) chứa cả hệ điều hành khách (Guest OS) nặng nề, Containers chia sẻ chung nhân hệ điều hành của máy host (Host OS Kernel) nên cực kỳ nhẹ, khởi động chỉ trong vài giây và tốn rất ít RAM/CPU.', 'https://www.w3schools.com/html/mov_bbb.mp4', 'https://www.w3schools.com/html/html_media.asp', 1),
      (3, 'Bài 2: Cách viết Dockerfile tối ưu và Multi-stage Builds', 'Dockerfile là file cấu hình chứa các chỉ dẫn để Docker build thành một Image.\n\nĐể tối ưu hóa dung lượng image và bảo mật, chúng ta sử dụng cơ chế Multi-stage Build. Cơ chế này cho phép tạo các stage trung gian để biên dịch code (ví dụ build TypeScript, compile C++), sau đó chỉ copy file sản phẩm cuối cùng sang stage production siêu nhẹ, loại bỏ hoàn toàn các tool build cồng kềnh.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 2),
      (3, 'Bài 3: Sử dụng Docker Compose để quản lý hệ thống nhiều Container', 'Hệ thống thực tế thường có nhiều dịch vụ (Node.js App, PostgreSQL, Redis). Việc chạy từng lệnh docker run sẽ rất phức tạp và khó quản lý.\n\nDocker Compose giúp chúng ta định nghĩa toàn bộ kiến trúc đa container trong một file cấu hình duy nhất là docker-compose.yml, sau đó khởi chạy toàn bộ hệ thống bằng một câu lệnh duy nhất: "docker compose up -d".', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 3)
    `);

    // Khóa học 4: Giao tiếp công sở (3 bài học)
    await client.query(`
      INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index) VALUES
      (4, 'Bài 1: Lắng nghe chủ động và phản hồi tích cực trong cuộc họp', 'Lắng nghe chủ động (Active Listening) đòi hỏi người nghe phải hoàn toàn tập trung, thấu hiểu và phản hồi lại thông tin một cách xây dựng.\n\nHãy thể hiện sự tập trung bằng ngôn ngữ cơ thể, hỏi lại để xác nhận hiểu đúng ý, ghi chép tóm tắt các điểm chính và tuyệt đối không ngắt lời khi đồng nghiệp đang trình bày phương án.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 1),
      (4, 'Bài 2: Kỹ năng soạn thảo email công việc chuyên nghiệp và lịch sự', 'Email là kênh giao tiếp chính thức trong doanh nghiệp. Một email chuyên nghiệp cần có:\n\n1. Tiêu đề rõ ràng, đi thẳng vào nội dung chính.\n2. Lời chào lịch sự.\n3. Nội dung trình bày ngắn gọn, rõ ý bằng bullet points.\n4. Đề xuất hành động hoặc hạn phản hồi rõ ràng.\n5. Lời cảm ơn và chữ ký chuyên nghiệp.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 2),
      (4, 'Bài 3: Giải quyết xung đột và đồng thuận nhóm hiệu quả', 'Trong môi trường làm việc, việc bất đồng ý kiến là điều khó tránh khỏi. Xử lý xung đột chuyên nghiệp nghĩa là tập trung giải quyết vấn đề (problem-oriented) thay vì công kích cá nhân (person-oriented).\n\nHãy lắng nghe khách quan quan điểm các bên, phân tích dựa trên dữ liệu thực tế và mục tiêu chung của dự án để đưa ra giải pháp đồng thuận tốt nhất.', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 3)
    `);

    // Khóa học 5: AI & Machine learning (1 bài học nháp)
    await client.query(`
      INSERT INTO lessons (course_id, title, content, video_url, attachment_url, order_index) VALUES
      (5, 'Bài 1: Giới thiệu về Học máy (Machine Learning) và các nhóm bài toán cơ bản', 'Học máy là một nhánh của Trí tuệ nhân tạo, tập trung vào việc phát triển các thuật toán cho phép máy tính tự học hỏi từ dữ liệu để đưa ra dự đoán hoặc quyết định.\n\nCác nhóm bài toán cơ bản gồm:\n- Học có giám sát (Supervised Learning): Hồi quy (Regression) và Phân lớp (Classification).\n- Học không giám sát (Unsupervised Learning): Phân cụm (Clustering).\n- Học tăng cường (Reinforcement Learning).', 'https://www.w3schools.com/html/mov_bbb.mp4', null, 1)
    `);

    console.log('- Đã thêm bài học cho các khóa học.');

    // 4. Thêm đề thi (Quizzes) cho các khóa học đã xuất bản
    console.log('5. Đang cấu hình đề thi cuối khóa...');
    await client.query(`
      INSERT INTO quizzes (id, course_id, title, duration_minutes, passing_score) VALUES
      (1, 1, 'Bài kiểm tra kiến thức cơ bản Node.js', 15, 80),
      (2, 2, 'Trắc nghiệm An toàn thông tin doanh nghiệp', 10, 100),
      (3, 3, 'Bài thi Đánh giá năng lực Docker & Docker Compose', 15, 80),
      (4, 4, 'Trắc nghiệm Kỹ năng Giao tiếp Công sở', 10, 80)
    `);

    // 5. Thêm câu hỏi kiểm tra mẫu (Questions) cho các đề thi
    console.log('6. Đang thêm các câu hỏi trắc nghiệm chi tiết...');

    // Đề thi 1 (NodeJS): 4 câu trắc nghiệm, 1 câu tự luận
    await client.query(`
      INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES
      (1, 'Kiến trúc Event Loop của Node.js chạy trên bao nhiêu luồng (thread) chính?', 'multiple_choice', '["1 luồng duy nhất (Single Thread)", "2 luồng", "Đa luồng song song (Multi-threaded)", "4 luồng"]', '1 luồng duy nhất (Single Thread)'),
      (1, 'MVC viết tắt của từ gì?', 'multiple_choice', '["Model-Variable-Controller", "Model-View-Controller", "Main-View-Controller", "Model-View-Component"]', 'Model-View-Controller'),
      (1, 'Trong Express, middleware là gì?', 'multiple_choice', '["Một hàm có quyền truy cập vào các đối tượng request (req), response (res) và hàm tiếp theo (next)", "Một cơ sở dữ liệu lưu trữ tạm thời", "Một view engine hiển thị HTML", "Một công cụ nén mã nguồn"]', 'Một hàm có quyền truy cập vào các đối tượng request (req), response (res) và hàm tiếp theo (next)'),
      (1, 'PostgreSQL Connection Pool giúp tối ưu hóa hệ thống bằng cách nào?', 'multiple_choice', '["Tạo mới kết nối mỗi khi có request và đóng ngay lập tức", "Duy trì một tập hợp các kết nối mở sẵn để tái sử dụng, tránh chi phí khởi tạo kết nối liên tục", "Tăng tốc độ mã hóa mật khẩu người dùng", "Tự động sao lưu dữ liệu sang Redis"]', 'Duy trì một tập hợp các kết nối mở sẵn để tái sử dụng, tránh chi phí khởi tạo kết nối liên tục'),
      (1, 'Hãy trình bày ngắn gọn hiểu biết của bạn về cách hoạt động của Event Loop trong Node.js (phân biệt Call Stack, Task Queue và Microtask Queue).', 'essay', '[]', '')
    `);

    // Đề thi 2 (Bảo mật): 4 câu hỏi
    await client.query(`
      INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES
      (2, 'Dữ liệu PII bao gồm những thông tin nào sau đây?', 'multiple_choice', '["Địa chỉ IP công cộng", "Email, Tên, Số điện thoại của khách hàng", "Mã màu thiết kế logo", "Số lượng dòng code của dự án"]', 'Email, Tên, Số điện thoại của khách hàng'),
      (2, 'Khi nhận được một email yêu cầu cung cấp mật khẩu hoặc thông tin nhạy cảm từ một địa chỉ trông gần giống email của công ty, bạn nên làm gì?', 'multiple_choice', '["Cung cấp thông tin ngay để tránh bị khóa tài khoản", "Bỏ qua email và không làm gì cả", "Báo cáo cho bộ phận IT Security và tuyệt đối không nhấp vào liên kết lạ nào", "Gửi email cho đồng nghiệp để hỏi ý kiến"]', 'Báo cáo cho bộ phận IT Security và tuyệt đối không nhấp vào liên kết lạ nào'),
      (2, 'Độ dài tối thiểu được khuyến nghị cho một mật khẩu an toàn là bao nhiêu ký tự?', 'multiple_choice', '["Ít nhất 6 ký tự", "Ít nhất 8 ký tự", "Ít nhất 12 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt", "Càng ngắn càng tốt cho dễ nhớ"]', 'Ít nhất 12 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt'),
      (2, 'Xác thực 2 yếu tố (2FA) có tác dụng gì?', 'multiple_choice', '["Tự động thay đổi mật khẩu định kỳ", "Yêu cầu thêm một lớp xác minh (như mã OTP thời gian thực) ngoài mật khẩu thông thường", "Ngăn chặn virus lây lan sang máy tính", "Mã hóa toàn bộ ổ cứng của máy tính"]', 'Yêu cầu thêm một lớp xác minh (như mã OTP thời gian thực) ngoài mật khẩu thông thường')
    `);

    // Đề thi 3 (Docker): 4 câu hỏi
    await client.query(`
      INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES
      (3, 'Điểm khác biệt cốt lõi giữa Container và Máy ảo (Virtual Machine) là gì?', 'multiple_choice', '["Container chia sẻ chung nhân hệ điều hành của host (Kernel) giúp nhẹ và chạy nhanh, máy ảo có OS riêng biệt nặng nề", "Máy ảo nhẹ hơn Container", "Container chỉ chạy được hệ điều hành Windows", "Không có sự khác biệt nào"]', 'Container chia sẻ chung nhân hệ điều hành của host (Kernel) giúp nhẹ và chạy nhanh, máy ảo có OS riêng biệt nặng nề'),
      (3, 'Trong Dockerfile, lệnh nào dùng để xác định cổng ứng dụng sẽ lắng nghe trong container?', 'multiple_choice', '["PORT", "EXPOSE", "LISTEN", "RUN"]', 'EXPOSE'),
      (3, 'Lợi ích lớn nhất của Multi-stage Build trong Dockerfile là gì?', 'multiple_choice', '["Tự động đăng tải image lên Docker Hub", "Giảm kích thước image thành phẩm bằng cách chỉ copy tệp cần thiết từ các stage build trung gian", "Tăng tốc độ kết nối internet của container", "Tự động sửa lỗi cú pháp trong code"]', 'Giảm kích thước image thành phẩm bằng cách chỉ copy tệp cần thiết từ các stage build trung gian'),
      (3, 'Docker Compose sử dụng định dạng tệp nào để khai báo dịch vụ?', 'multiple_choice', '["JSON", "YAML", "XML", "INI"]', 'YAML')
    `);

    // Đề thi 4 (Giao tiếp): 3 câu hỏi
    await client.query(`
      INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES
      (4, 'Lắng nghe chủ động (Active Listening) yêu cầu bạn thực hiện hành động nào?', 'multiple_choice', '["Nghe thụ động và làm việc riêng song song", "Tập trung hoàn toàn vào người nói, tương tác bằng cử chỉ, hỏi lại để xác nhận và không ngắt lời", "Chờ người khác nói xong rồi lập tức bác bỏ ý kiến", "Chỉ ghi âm lại và tự nghe sau"]', 'Tập trung hoàn toàn vào người nói, tương tác bằng cử chỉ, hỏi lại để xác nhận và không ngắt lời'),
      (4, 'Khi soạn thảo email công việc, thành phần nào dưới đây không bắt buộc nhưng giúp email chuyên nghiệp hơn?', 'multiple_choice', '["Tiêu đề email", "Nội dung email", "Chữ ký email chứa tên, chức danh và thông tin liên hệ chuyên nghiệp", "Địa chỉ email của người nhận"]', 'Chữ ký email chứa tên, chức danh và thông tin liên hệ chuyên nghiệp'),
      (4, 'Khi xảy ra bất đồng ý kiến trong nhóm về một giải pháp, cách xử lý chuyên nghiệp nhất là gì?', 'multiple_choice', '["Bỏ qua ý kiến của người khác và làm theo cách của mình", "Tranh cãi lớn tiếng để khẳng định ý kiến mình đúng", "Lắng nghe quan điểm các bên, phân tích khách quan dựa trên dữ liệu/yêu cầu thực tế để đồng thuận giải pháp tốt nhất", "Im lặng và không tham gia đóng góp nữa"]', 'Lắng nghe quan điểm các bên, phân tích khách quan dựa trên dữ liệu/yêu cầu thực tế để đồng thuận giải pháp tốt nhất')
    `);

    // 6. Gieo mầm dữ liệu học tập cho người học (Enrollments)
    console.log('7. Đang gieo mầm dữ liệu tiến trình đăng ký học tập...');
    
    // Đảm bảo có đủ users để gieo mầm enrollments
    const userCheck = await client.query('SELECT count(*) FROM users');
    const userCount = parseInt(userCheck.rows[0].count, 10);
    if (userCount < 5) {
      console.log('  - Tạo thêm người dùng mẫu để gieo mầm tiến trình đăng ký...');
      await client.query(`
        INSERT INTO users (id, username, email, password, role_id, status) VALUES
        (2, 'hr_manager', 'hr@gmail.com', 'hr@123', 2, 'active'),
        (3, 'instructor_dev', 'instructor@gmail.com', 'instructor@123', 3, 'active'),
        (4, 'employee_it', 'employee4@gmail.com', 'emp@123', 4, 'active'),
        (5, 'employee_mkt', 'employee5@gmail.com', 'emp@123', 4, 'active')
        ON CONFLICT (id) DO NOTHING;
      `);
      await client.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 1), false)");
    }

    // Lấy ID người dùng employee_it (id=4) và employee_mkt (id=5) để gieo mầm đăng ký học tập
    // Đăng ký học NodeJS cho employee_it với tiến độ 50%
    await client.query(`
      INSERT INTO enrollments (user_id, course_id, progress, is_assigned, status) VALUES
      (4, 1, 50, false, 'approved'),
      (4, 2, 0, true, 'approved'),
      (4, 3, 0, false, 'approved'),
      (5, 2, 100, true, 'approved')
    `);

    // Đồng bộ lại Sequence ID của các bảng sau khi chèn cứng ID
    console.log('8. Đồng bộ hóa lại Sequence IDs...');
    await client.query("SELECT setval('courses_id_seq', COALESCE((SELECT MAX(id)+1 FROM courses), 1), false)");
    await client.query("SELECT setval('lessons_id_seq', COALESCE((SELECT MAX(id)+1 FROM lessons), 1), false)");
    await client.query("SELECT setval('quizzes_id_seq', COALESCE((SELECT MAX(id)+1 FROM quizzes), 1), false)");
    await client.query("SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id)+1 FROM questions), 1), false)");
    await client.query("SELECT setval('enrollments_id_seq', COALESCE((SELECT MAX(id)+1 FROM enrollments), 1), false)");

    await client.query('COMMIT');
    console.log('=> GIEO MẦM DỮ LIỆU THÀNH CÔNG!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('LỖI KHI GIEO MẦM DỮ LIỆU:', err);
  } finally {
    client.release();
  }

  // 7. Xóa sạch cache Redis để các danh sách khóa học cập nhật lập tức
  try {
    await redis.del('courses:published');
    console.log('[Redis] Đã xóa cache "courses:published" thành công.');
  } catch (redisErr) {
    console.warn('[Redis Warning] Không thể xóa cache Redis:', redisErr.message);
  }

  process.exit(0);
}

seedRichCourses();
