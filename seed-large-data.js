const db = require('./config/db');
const redis = require('./config/redis');
const bcrypt = require('bcryptjs');

async function seedLargeData() {
  console.log('\n==================================================');
  console.log('[SEED] Bắt đầu gieo mầm dữ liệu lớn (20 phòng ban, 200 tài khoản, 10 khóa học)...');
  console.log('==================================================\n');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Làm sạch dữ liệu cũ liên quan
    console.log('[1/7] Đang dọn dẹp các bảng dữ liệu cũ...');
    await client.query('DELETE FROM quiz_submissions CASCADE');
    await client.query('DELETE FROM questions CASCADE');
    await client.query('DELETE FROM quizzes CASCADE');
    await client.query('DELETE FROM comments CASCADE');
    await client.query('DELETE FROM enrollments CASCADE');
    await client.query('DELETE FROM learning_path_courses CASCADE');
    await client.query('DELETE FROM courses CASCADE');
    await client.query('DELETE FROM users CASCADE');
    await client.query('DELETE FROM departments CASCADE');

    // Reset Sequence ID các bảng
    console.log('[2/7] Thiết lập lại chỉ số tự tăng (Sequence IDs)...');
    await client.query("SELECT setval('departments_id_seq', 1, false)");
    await client.query("SELECT setval('users_id_seq', 1, false)");
    await client.query("SELECT setval('courses_id_seq', 1, false)");
    await client.query("SELECT setval('lessons_id_seq', 1, false)");
    await client.query("SELECT setval('quizzes_id_seq', 1, false)");
    await client.query("SELECT setval('questions_id_seq', 1, false)");
    await client.query("SELECT setval('enrollments_id_seq', 1, false)");

    // 2. Đảm bảo vai trò hệ thống tồn tại
    console.log('[3/7] Đồng bộ cấu trúc vai trò và quyền hạn...');
    await client.query(`
      INSERT INTO roles (id, name, description) VALUES
      (1, 'Super Admin', 'Vai trò quản trị cao cấp nhất, có toàn quyền hệ thống.'),
      (2, 'HR Manager', 'Quản lý nhân sự, lộ trình học tập, phòng ban và xem báo cáo.'),
      (3, 'Instructor', 'Giáo viên, quản lý khóa học, soạn bài học, ngân hàng câu hỏi và chấm thi.'),
      (4, 'Employee', 'Nhân viên tham gia học tập, làm bài trắc nghiệm và thảo luận.')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    `);

    await client.query(`
      INSERT INTO role_permissions (role_id, permission_name) VALUES
      (1, 'COURSE_VIEW'), (1, 'COURSE_CREATE'), (1, 'COURSE_UPDATE'), (1, 'COURSE_DELETE'), (1, 'COURSE_PUBLISH'),
      (1, 'LESSON_CREATE'), (1, 'CONTENT_UPLOAD'), (1, 'LESSON_MANAGE'),
      (1, 'QUIZ_BANK_VIEW'), (1, 'QUIZ_BANK_MANAGE'), (1, 'QUIZ_SETTING'), (1, 'QUIZ_GRADE'),
      (1, 'PATH_MANAGE'), (1, 'ENROLL_ASSIGN'), (1, 'ENROLL_APPROVE'),
      (1, 'USER_VIEW'), (1, 'USER_MANAGE'), (1, 'USER_DISABLE'), (1, 'DEPARTMENT_MANAGE'),
      (1, 'REPORT_VIEW'), (1, 'REPORT_EXPORT'),
      (1, 'ROLE_MANAGE'), (1, 'USER_IMPERSONATE'), (1, 'AUDIT_LOG_VIEW'),
      (2, 'PATH_MANAGE'), (2, 'ENROLL_ASSIGN'), (2, 'ENROLL_APPROVE'),
      (2, 'USER_VIEW'), (2, 'USER_MANAGE'), (2, 'USER_DISABLE'), (2, 'DEPARTMENT_MANAGE'),
      (2, 'REPORT_VIEW'), (2, 'REPORT_EXPORT'),
      (3, 'COURSE_VIEW'), (3, 'COURSE_CREATE'), (3, 'COURSE_UPDATE'), (3, 'COURSE_PUBLISH'),
      (3, 'LESSON_CREATE'), (3, 'CONTENT_UPLOAD'), (3, 'LESSON_MANAGE'),
      (3, 'QUIZ_BANK_VIEW'), (3, 'QUIZ_BANK_MANAGE'), (3, 'QUIZ_SETTING'), (3, 'QUIZ_GRADE'),
      (3, 'REPORT_VIEW'),
      (4, 'PATH_VIEW'), (4, 'COURSE_ENROLL_REQUEST'), (4, 'HISTORY_VIEW'), (4, 'PROGRESS_TRACK')
      ON CONFLICT DO NOTHING
    `);

    // 3. Thêm 20 phòng ban trực thuộc có cấu trúc phân cấp rõ ràng
    console.log('[4/7] Gieo mầm 20 phòng ban...');
    const depts = [
      { name: 'Ban Giám Đốc', parent_id: null }, // 1
      { name: 'Khối Công Nghệ & AI', parent_id: 1 }, // 2
      { name: 'Khối Nhân Sự & Hành Chính', parent_id: 1 }, // 3
      { name: 'Khối Tài Chính - Kế Toán', parent_id: 1 }, // 4
      { name: 'Khối Kinh Doanh & Marketing', parent_id: 1 }, // 5
      { name: 'Phòng Phát triển Phần mềm', parent_id: 2 }, // 6
      { name: 'Phòng Nghiên cứu AI & ML', parent_id: 2 }, // 7
      { name: 'Phòng Vận hành Cloud & DevOps', parent_id: 2 }, // 8
      { name: 'Phòng Bảo mật & An toàn thông tin', parent_id: 2 }, // 9
      { name: 'Phòng Tuyển dụng & Đào tạo', parent_id: 3 }, // 10
      { name: 'Phòng Chế độ & Phúc lợi (C&B)', parent_id: 3 }, // 11
      { name: 'Phòng Hành chính - Lễ tân', parent_id: 3 }, // 12
      { name: 'Phòng Kế toán Tổng hợp', parent_id: 4 }, // 13
      { name: 'Phòng Quản trị Rủi ro Tài chính', parent_id: 4 }, // 14
      { name: 'Phòng Phân tích Đầu tư', parent_id: 4 }, // 15
      { name: 'Phòng Kinh doanh B2B', parent_id: 5 }, // 16
      { name: 'Phòng Chăm sóc Khách hàng', parent_id: 5 }, // 17
      { name: 'Phòng Digital Marketing', parent_id: 5 }, // 18
      { name: 'Phòng Thiết kế & Sáng tạo nội dung', parent_id: 5 }, // 19
      { name: 'Ban Quản lý Chất lượng (QA/QC)', parent_id: 1 } // 20
    ];

    for (const dept of depts) {
      await client.query(
        'INSERT INTO departments (name, parent_id) VALUES ($1, $2)',
        [dept.name, dept.parent_id]
      );
    }
    console.log('- Đã tạo thành công 20 phòng ban phân cấp.');

    // 4. Tạo khoảng 200 tài khoản với vai trò và phòng ban được phân bổ đều
    console.log('[5/7] Tạo 200 tài khoản người dùng với mật khẩu không mã hóa...');
    const passwordHash = 'password123';

    let userCount = 0;

    // A. 5 Super Admin
    for (let i = 1; i <= 5; i++) {
      const username = `admin${i}`;
      const email = `admin${i}@company.com`;
      const deptId = i;
      await client.query(
        'INSERT INTO users (username, email, password, role_id, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, email, passwordHash, 1, deptId, 'active']
      );
      userCount++;
    }

    // B. 15 HR Managers
    const hrDepts = [3, 10, 11, 12];
    for (let i = 1; i <= 15; i++) {
      const username = `hr${i}`;
      const email = `hr${i}@company.com`;
      const deptId = hrDepts[i % hrDepts.length];
      await client.query(
        'INSERT INTO users (username, email, password, role_id, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, email, passwordHash, 2, deptId, 'active']
      );
      userCount++;
    }

    // C. 30 Instructors
    const instructorDepts = [2, 6, 7, 8, 9];
    for (let i = 1; i <= 30; i++) {
      const username = `instructor${i}`;
      const email = `instructor${i}@company.com`;
      const deptId = instructorDepts[i % instructorDepts.length];
      await client.query(
        'INSERT INTO users (username, email, password, role_id, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, email, passwordHash, 3, deptId, 'active']
      );
      userCount++;
    }

    // D. 150 Employees
    for (let i = 1; i <= 150; i++) {
      const username = `emp${i}`;
      const email = `employee${i}@company.com`;
      const deptId = (i % 20) + 1;
      await client.query(
        'INSERT INTO users (username, email, password, role_id, department_id, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [username, email, passwordHash, 4, deptId, 'active']
      );
      userCount++;
    }
    console.log(`- Đã gieo mầm thành công ${userCount} tài khoản người dùng với mật khẩu mặc định là: password123`);

    // 5. Thêm 10 khóa học chất lượng đầy đủ
    console.log('[6/7] Gieo mầm 10 khóa học cùng 30 bài học có video đầy đủ...');
    const courses = [
      {
        id: 1,
        title: 'Lập trình Node.js & Express nâng cao',
        description: 'Khóa học cung cấp kiến thức thực chiến nâng cao về NodeJS, tối ưu hóa Event Loop, xử lý Stream dung lượng lớn và thiết kế Rest API chuẩn sạch.',
        image_url: '/images/nodejs_course.svg',
        lessons: [
          {
            title: 'Bài 1: Tối ưu hóa hiệu năng Event Loop và cơ chế Clustering',
            content: 'Tìm hiểu cách chia sẻ cổng kết nối giữa các worker process qua cluster module để tận dụng sức mạnh đa nhân của CPU máy chủ. Giải quyết bài toán block luồng chính (Main Thread) do các tác vụ CPU-intensive gây ra bằng Web Worker hoặc Worker Threads.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Xây dựng REST API chuẩn RESTful với kiến trúc Clean Architecture',
            content: 'Hướng dẫn phân lớp rõ ràng cho dự án Node.js: Controllers, Services, Repositories và Entities. Đảm bảo code dễ dàng bảo trì, viết unit test và độc lập với các thư viện bên thứ ba.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Xử lý tệp lớn với Stream và Buffer trong Node.js',
            content: 'Cách thức đọc/ghi các file log hoặc hình ảnh, video có dung lượng hàng gigabyte bằng Stream (Readable, Writable, Transform) để kiểm soát bộ nhớ RAM ở mức tối thiểu dưới 30MB.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Bài trắc nghiệm nâng cao Node.js',
          questions: [
            {
              text: 'Cách tốt nhất để xử lý tác vụ tính toán nặng (CPU-bound) trong Node.js mà không làm nghẽn Event Loop là gì?',
              options: ["Sử dụng setTimeout", "Sử dụng cluster module hoặc Worker Threads", "Sử dụng async/await thông thường", "Sử dụng process.nextTick()"],
              correct: 'Sử dụng cluster module hoặc Worker Threads'
            },
            {
              text: 'Để đọc một file video dung lượng 5GB mà không làm tràn bộ nhớ RAM, ta nên dùng gì?',
              options: ["fs.readFileSync", "fs.readFile", "Stream (fs.createReadStream)", "JSON.parse"],
              correct: 'Stream (fs.createReadStream)'
            },
            {
              text: 'Clean Architecture chia ứng dụng thành mấy lớp chính?',
              options: ["2 lớp", "3 lớp", "4 lớp (Entities, Use Cases, Interface Adapters, Frameworks & Drivers)", "5 lớp"],
              correct: '4 lớp (Entities, Use Cases, Interface Adapters, Frameworks & Drivers)'
            }
          ]
        }
      },
      {
        id: 2,
        title: 'Làm chủ Docker & Kubernetes cho Production',
        description: 'Đóng gói container hóa ứng dụng và vận hành điều phối container tự động bằng Kubernetes (K8s) trên môi trường sản xuất thực tế.',
        image_url: '/images/docker_course.svg',
        lessons: [
          {
            title: 'Bài 1: Đóng gói và tối ưu hóa Docker Image với Multi-stage Build',
            content: 'Hướng dẫn tối ưu kích thước Image từ 1GB xuống còn dưới 100MB bằng cách loại bỏ các devDependencies, compiler cồng kềnh và sử dụng base image siêu nhẹ như alpine hoặc distroless.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Điều phối Container với Docker Swarm và Kubernetes Pods',
            content: 'Khái niệm cơ bản về Pods, Services, Deployments, ReplicaSets và cơ chế tự động khởi động lại container bị lỗi (Self-healing) trên hệ thống Kubernetes Cluster.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Quản lý Network và Volume an toàn trên Production',
            content: 'Cấu hình kết nối an toàn giữa ứng dụng và cơ sở dữ liệu qua Docker Bridge Network, Overlays, cùng cách thiết lập Persistent Volumes (PV/PVC) chống mất mát dữ liệu.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Kiểm tra kiến thức Docker & K8s',
          questions: [
            {
              text: 'Để giảm tối đa dung lượng Docker Image thành phẩm của ứng dụng Node.js, bạn nên dùng kỹ thuật nào?',
              options: ["Multi-stage build kết hợp base image alpine", "Cài đặt thêm các package nén", "Chạy lệnh docker run trực tiếp", "Không cài package nào"],
              correct: 'Multi-stage build kết hợp base image alpine'
            },
            {
              text: 'Đơn vị nhỏ nhất mà Kubernetes có thể quản lý và triển khai là gì?',
              options: ["Container", "Service", "Pod", "Node"],
              correct: 'Pod'
            },
            {
              text: 'Muốn lưu trữ dữ liệu bền vững cho cơ sở dữ liệu chạy trong Container, ta cần sử dụng cấu phần nào?',
              options: ["Docker Network", "Docker Port Mapping", "Persistent Volumes (PV/PVC) hoặc Volumes", "Docker ENV variables"],
              correct: 'Persistent Volumes (PV/PVC) hoặc Volumes'
            }
          ]
        }
      },
      {
        id: 3,
        title: 'Phát triển Ứng dụng Web với React & Next.js',
        description: 'Tận dụng sức mạnh của React 18+ và Next.js App Router để phát triển các trang web tải nhanh, hỗ trợ Server-Side Rendering (SSR) hoàn hảo cho SEO.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Hiểu sâu về Server Components (RSC) trong Next.js App Router',
            content: 'Phân biệt Client Components và Server Components. Tìm hiểu lợi ích của việc render HTML sẵn tại máy chủ giúp giảm tải tải dung lượng JavaScript tải về trình duyệt người dùng.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Quản lý State tối ưu với Zustand và Context API',
            content: 'Khi nào nên dùng Global State và khi nào nên dùng Local State. So sánh hiệu năng của Zustand so với Redux Toolkit, loại bỏ hoàn toàn hiện tượng re-render không cần thiết.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Cải thiện SEO và Core Web Vitals của dự án Next.js',
            content: 'Tối ưu chỉ số LCP, FID, CLS bằng cách tối ưu hóa hình ảnh (next/image), script tải chậm (next/script) và cấu hình dynamic sitemap tự động.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Trắc nghiệm React & NextJS',
          questions: [
            {
              text: 'Mặc định trong thư mục app/ của Next.js (App Router), các component được tạo ra là loại nào?',
              options: ["Client Components", "Server Components (RSC)", "Class Components", "Redux Components"],
              correct: 'Server Components (RSC)'
            },
            {
              text: 'Dòng lệnh khai báo ở đầu file để biến một component thành Client Component là gì?',
              options: ["\"use client\"", "\"use react\"", "\"import React\"", "\"client side\""],
              correct: '"use client"'
            },
            {
              text: 'Core Web Vitals bao gồm các chỉ số chính nào?',
              options: ["LCP, FID, CLS", "CPU, RAM, DISK", "GET, POST, PUT", "HTML, CSS, JS"],
              correct: 'LCP, FID, CLS'
            }
          ]
        }
      },
      {
        id: 4,
        title: 'Tối ưu hóa Cơ sở dữ liệu PostgreSQL',
        description: 'Tìm hiểu cách thiết kế Index thông minh, đọc hiểu biểu đồ câu truy vấn và cấu hình tối ưu hóa tài nguyên cho hệ thống PostgreSQL quy mô lớn.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Thiết kế Index thông minh: B-Tree, Hash, GIN và GiST',
            content: 'Cách thức hoạt động của từng loại Index. Khi nào nên dùng B-Tree (mặc định), khi nào dùng GIN (cho cột dạng JSONB) và cách tránh lạm dụng Index gây giảm hiệu năng ghi dữ liệu.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Phân tích hiệu năng câu lệnh truy vấn bằng EXPLAIN ANALYZE',
            content: 'Đọc hiểu kết quả trả về của EXPLAIN ANALYZE: Nhận diện phép quét tuần tự (Sequential Scan), phép quét theo Index (Index Scan) và xác định các nút cổ chai tốn thời gian nhất.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Replication, Partitioning và Connection Pooling',
            content: 'Kỹ thuật phân vùng bảng (Table Partitioning) cho các bảng chứa hàng trăm triệu bản ghi. Thiết lập Master-Slave Replication để tăng khả năng đọc và sao lưu dữ liệu dự phòng.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Đánh giá tối ưu hóa PostgreSQL',
          questions: [
            {
              text: 'Kiểu index nào được Postgres sử dụng mặc định và phù hợp cho hầu hết các phép so sánh bằng hoặc khoảng (<, <=, =, >=, >)?',
              options: ["GIN", "GiST", "B-Tree", "Hash"],
              correct: 'B-Tree'
            },
            {
              text: 'Để xem chi tiết thời gian thực thi thực tế của từng bước trong câu lệnh truy vấn SQL, bạn dùng từ khóa nào?',
              options: ["EXPLAIN ONLY", "EXPLAIN ANALYZE", "DESCRIBE TABLE", "SHOW PROFILE"],
              correct: 'EXPLAIN ANALYZE'
            },
            {
              text: 'Khi lưu trữ mảng hoặc dữ liệu JSONB và muốn tìm kiếm nhanh các khóa bên trong, ta nên tạo loại index nào?',
              options: ["B-Tree", "GIN", "Hash", "Không có loại nào"],
              correct: 'GIN'
            }
          ]
        }
      },
      {
        id: 5,
        title: 'Xây dựng Hệ thống Microservices với NestJS',
        description: 'Thiết kế kiến trúc hệ thống phân tán hướng dịch vụ (Microservices), đồng bộ dữ liệu thông qua Message Broker và quản lý API Gateway tập trung.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Kiến trúc Module và Dependency Injection trong NestJS',
            content: 'Cách tổ chức code chuyên nghiệp bằng Module, Controllers, Services cùng cơ chế Dependency Injection (DI) mạnh mẽ lấy cảm hứng từ Angular.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Giao tiếp Microservices qua gRPC và Message Broker (RabbitMQ)',
            content: 'Cấu hình giao tiếp phi đồng bộ thông qua RabbitMQ/Kafka giúp giảm sự phụ thuộc lẫn nhau (Loose Coupling) giữa các dịch vụ và tối ưu hiệu suất gRPC cho truyền tải dữ liệu đồng bộ siêu tốc.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Triển khai API Gateway và Service Discovery',
            content: 'Quản lý định tuyến tất cả các request của client tập trung tại một đầu mối duy nhất (API Gateway), xử lý phân quyền JWT, Rate Limiting và tích hợp cơ chế phát hiện dịch vụ tự động.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Kiểm tra kiến thức NestJS Microservices',
          questions: [
            {
              text: 'Ngôn ngữ lập trình chính được khuyến nghị và sử dụng mặc định để viết NestJS là gì?',
              options: ["JavaScript", "Python", "TypeScript", "Go"],
              correct: 'TypeScript'
            },
            {
              text: 'Phương thức giao tiếp nào phù hợp nhất để truyền tải thông điệp phi đồng bộ (asynchronous) giữa các microservice?',
              options: ["HTTP REST Request", "Message Broker (như RabbitMQ, Kafka)", "gRPC đồng bộ", "Ghi file vật lý"],
              correct: 'Message Broker (như RabbitMQ, Kafka)'
            },
            {
              text: 'Mục đích chính của API Gateway trong hệ thống microservices là gì?',
              options: ["Lưu trữ cơ sở dữ liệu chính", "Đầu mối duy nhất tiếp nhận request từ client, điều hướng, bảo mật và giới hạn tần suất yêu cầu", "Build Docker Image", "Gửi email cho nhân viên"],
              correct: 'Đầu mối duy nhất tiếp nhận request từ client, điều hướng, bảo mật và giới hạn tần suất yêu cầu'
            }
          ]
        }
      },
      {
        id: 6,
        title: 'Bảo mật Ứng dụng Web và Phòng chống OWASP Top 10',
        description: 'Tìm hiểu về các lỗ hổng bảo mật phổ biến nhất trên môi trường web theo tiêu chuẩn OWASP và lập trình phòng ngừa triệt để.',
        image_url: '/images/security_course.svg',
        lessons: [
          {
            title: 'Bài 1: Ngăn chặn lỗi SQL Injection và Cross-Site Scripting (XSS)',
            content: 'Hướng dẫn sử dụng Parameterized Queries khi truy vấn cơ sở dữ liệu để loại bỏ SQL Injection. Thực thi kiểm duyệt đầu vào (Input Sanitization) và mã hóa đầu ra (Output Encoding) để phòng ngừa XSS.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Triển khai chuẩn xác thực OAuth2 và JSON Web Token (JWT) an toàn',
            content: 'Cách thiết lập thuật toán ký khóa (RS256/HS256) cho JWT, cấu hình HttpOnly Secure Cookie lưu trữ token phía client để chống tấn công đánh cắp session (XSS Session Hijacking).',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Quản lý phiên làm việc và mã hóa dữ liệu nhạy cảm PII',
            content: 'Áp dụng các thuật toán mã hóa đối xứng (AES-256-GCM) để lưu trữ thông tin nhạy cảm của khách hàng trong database. Cấu hình bảo mật HTTP Header với Helmet.js.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Bài thi bảo mật OWASP',
          questions: [
            {
              text: 'Biện pháp hiệu quả nhất để phòng chống lỗ hổng SQL Injection là gì?',
              options: ["Mã hóa cơ sở dữ liệu", "Sử dụng tham số hóa truy vấn (Parameterized Queries / Prepared Statements)", "Chặn IP truy cập lạ", "Sử dụng thẻ HTML5"],
              correct: 'Sử dụng tham số hóa truy vấn (Parameterized Queries / Prepared Statements)'
            },
            {
              text: 'Đâu là nơi an toàn nhất để lưu trữ Access Token/Session ID ở phía Client nhằm tránh bị mã độc JS đánh cắp qua lỗ hổng XSS?',
              options: ["LocalStorage", "SessionStorage", "HttpOnly Cookie với thuộc tính Secure và SameSite", "Biến toàn cục (Global Variable)"],
              correct: 'HttpOnly Cookie với thuộc tính Secure và SameSite'
            },
            {
              text: 'Thuật toán băm một chiều nào phù hợp để băm và lưu mật khẩu của người dùng an toàn nhất?',
              options: ["MD5", "SHA-1", "bcrypt hoặc Argon2", "Base64"],
              correct: 'bcrypt hoặc Argon2'
            }
          ]
        }
      },
      {
        id: 7,
        title: 'Cơ bản về Trí tuệ Nhân tạo và Machine Learning',
        description: 'Làm quen với các thuật toán học máy cơ bản, cách tiền xử lý dữ liệu và huấn luyện mô hình hồi quy, phân lớp đơn giản.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Thu thập và tiền xử lý dữ liệu với Python Pandas',
            content: 'Cách đọc tệp CSV/Excel. Xử lý các giá trị bị thiếu (Missing Values), chuẩn hóa dữ liệu số (Feature Scaling) và mã hóa biến phân loại (One-Hot Encoding).',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Xây dựng mô hình phân lớp tuyến tính (Linear Regression)',
            content: 'Hiểu về hàm mất mát (Loss Function), thuật toán hạ độ dốc (Gradient Descent) để tối ưu hóa trọng số mô hình nhằm dự báo xu hướng liên tục.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Huấn luyện mô hình Deep Learning cơ bản với TensorFlow',
            content: 'Giới thiệu về Mạng nơ-ron nhân tạo (ANN). Cấu hình các lớp ẩn (Dense layers), hàm kích hoạt (Activation Functions như ReLU, Sigmoid) và biên dịch mô hình.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Trắc nghiệm AI & ML cơ bản',
          questions: [
            {
              text: 'Kỹ thuật biến đổi các dữ liệu danh mục thành định dạng vector số nhị phân (0 và 1) để máy học hiểu được gọi là gì?',
              options: ["Normalization", "One-Hot Encoding", "Standardization", "Gradient Descent"],
              correct: 'One-Hot Encoding'
            },
            {
              text: 'Thuật toán tối ưu hóa phổ biến nhất dùng để cập nhật trọng số nhằm giảm thiểu hàm mất mát của mô hình là gì?',
              options: ["B-Tree Search", "Gradient Descent (Hạ độ dốc)", "Bubble Sort", "Linear Search"],
              correct: 'Gradient Descent (Hạ độ dốc)'
            },
            {
              text: 'Hàm kích hoạt nào thường được sử dụng ở lớp đầu ra (Output layer) cho bài toán phân loại nhị phân (Binary Classification)?',
              options: ["ReLU", "Sigmoid", "Linear", "Tanh"],
              correct: 'Sigmoid'
            }
          ]
        }
      },
      {
        id: 8,
        title: 'Quản lý Dự án Công nghệ theo mô hình Scrum/Agile',
        description: 'Áp dụng khung làm việc Scrum để tổ chức nhóm phát triển dự án phần mềm linh hoạt, gia tăng chất lượng sản phẩm và tối ưu hóa thời gian bàn giao.',
        image_url: '/images/comm_course.svg',
        lessons: [
          {
            title: 'Bài 1: Tuyên ngôn Agile và các vai trò cốt lõi trong Scrum',
            content: 'Giới thiệu 4 giá trị và 12 nguyên lý của Agile. Phân định rõ trách nhiệm của Product Owner (Quản lý Product Backlog), Scrum Master (Hỗ trợ tháo gỡ rào cản) và Developers (Trực tiếp xây dựng sản phẩm).',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Quy trình tổ chức các sự kiện trong một Sprint',
            content: 'Chi tiết cách thực hiện: Sprint Planning (Lập kế hoạch Sprint), Daily Scrum (Họp đứng hàng ngày 15 phút), Sprint Review (Kiểm điểm và trình diễn sản phẩm) và Sprint Retrospective (Họp cải tiến nhóm).',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Quản lý yêu cầu và Đo lường tiến độ dự án',
            content: 'Cách viết User Story đạt tiêu chuẩn INVEST. Sử dụng Story Points để ước lượng khối lượng công việc và đọc biểu đồ Burn-down Chart để kiểm soát tiến độ Sprint.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Đánh giá năng lực Scrum Master',
          questions: [
            {
              text: 'Trong Scrum, ai là người chịu trách nhiệm chính về việc tối đa hóa giá trị sản phẩm và quản lý danh sách yêu cầu (Product Backlog)?',
              options: ["Scrum Master", "Product Owner (PO)", "Development Team", "CEO"],
              correct: 'Product Owner (PO)'
            },
            {
              text: 'Buổi họp đứng Daily Scrum hàng ngày nên kéo dài tối đa bao lâu?',
              options: ["5 phút", "15 phút", "30 phút", "1 tiếng"],
              correct: '15 phút'
            },
            {
              text: 'Mục đích chính của sự kiện Sprint Retrospective (Cải tiến Sprint) là gì?',
              options: ["Trình diễn sản phẩm cho khách hàng xem", "Lên kế hoạch công việc cho Sprint sau", "Nhìn nhận lại quá trình làm việc của Sprint vừa qua để tìm ra điểm tốt và điểm cần cải tiến nhằm nâng cao hiệu suất làm việc", "Chấm điểm Story Points"],
              correct: 'Nhìn nhận lại quá trình làm việc của Sprint vừa qua để tìm ra điểm tốt và điểm cần cải tiến nhằm nâng cao hiệu suất làm việc'
            }
          ]
        }
      },
      {
        id: 9,
        title: 'Kỹ năng DevOps: CI/CD với GitHub Actions và Docker',
        description: 'Tự động hóa toàn bộ quy trình kiểm thử, build Docker Image và deploy code tự động lên máy chủ ngay khi lập trình viên commit code.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Viết quy trình chạy thử nghiệm tự động (Workflow CI) trên GitHub',
            content: 'Cấu hình tệp YAML trong thư mục .github/workflows để tự động cài đặt dependencies, chạy trình kiểm tra lỗi cú pháp (Linter) và chạy unit tests mỗi khi có Pull Request.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Tự động hóa build Docker Image và đẩy lên Docker Hub',
            content: 'Tích hợp các câu lệnh docker build và docker push vào trong workflow. Sử dụng các biến bí mật (GitHub Secrets) để bảo mật tài khoản Docker Hub và AWS Credentials.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Tự động deploy ứng dụng thông qua SSH Actions',
            content: 'Cấu hình máy ảo GitHub tự động kết nối SSH vào máy chủ Linux VPS, kéo code mới nhất từ Docker Hub về và chạy docker-compose up -d để cập nhật ứng dụng tức thì không gián đoạn (Zero-downtime).',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Bài trắc nghiệm DevOps CI/CD',
          questions: [
            {
              text: 'Thư mục mặc định dùng để định nghĩa các tệp workflow của GitHub Actions trong dự án Git là gì?',
              options: ["/workflows", "/.github/workflows", "/github-actions", "/.config"],
              correct: '/.github/workflows'
            },
            {
              text: 'Để lưu trữ các thông tin nhạy cảm như Mật khẩu, Khóa SSH trong GitHub Actions một cách an toàn, bạn nên lưu vào đâu?',
              options: ["Hardcode trong file workflow yaml", "Lưu trong file .env đẩy lên git", "GitHub Repository Secrets", "Lưu vào file README.md"],
              correct: 'GitHub Repository Secrets'
            },
            {
              text: 'CI/CD là viết tắt của cụm từ nào?',
              options: ["Continuous Integration & Continuous Delivery/Deployment", "Code Integration & Code Development", "Computer Integration & Cloud Deployment", "Continuous Internet & Cloud Data"],
              correct: 'Continuous Integration & Continuous Delivery/Deployment'
            }
          ]
        }
      },
      {
        id: 10,
        title: 'Xây dựng Kiến trúc Cloud trên AWS cơ bản',
        description: 'Tìm hiểu các dịch vụ cơ bản của Amazon Web Services (AWS) để tự thiết kế một hệ thống mạng và lưu trữ ảo an toàn trên nền tảng điện toán đám mây.',
        image_url: '/images/default_course.svg',
        lessons: [
          {
            title: 'Bài 1: Thiết kế hệ thống mạng ảo bảo mật Virtual Private Cloud (VPC)',
            content: 'Hiểu về cách chia dải IP (CIDR), thiết lập Subnet công khai (Public Subnet) và Subnet riêng tư (Private Subnet). Cấu hình Route Tables, NAT Gateway và Internet Gateway.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 2: Quản lý máy chủ ảo EC2 và Dịch vụ lưu trữ S3',
            content: 'Khởi tạo máy chủ EC2 chạy Linux, quản lý khóa bảo mật Key Pair. Tạo các S3 Bucket để lưu trữ tệp tin tĩnh (hình ảnh, video) có tính dự phòng dữ liệu cao.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          },
          {
            title: 'Bài 3: Thiết lập cân bằng tải (ALB) và tự động co giãn (Auto Scaling)',
            content: 'Cấu hình Application Load Balancer để chia sẻ lưu lượng truy cập tới nhiều máy chủ EC2 phía sau. Thiết lập Auto Scaling Group tự động bật thêm máy chủ khi CPU quá tải.',
            video_url: 'https://www.w3schools.com/html/mov_bbb.mp4'
          }
        ],
        quiz: {
          title: 'Bài thi cuối khóa Điện toán đám mây AWS',
          questions: [
            {
              text: 'Thành phần nào cho phép các tài nguyên trong Private Subnet có thể kết nối ra ngoài Internet nhưng không cho phép chiều ngược lại?',
              options: ["Internet Gateway", "NAT Gateway", "Route Table", "VPC Peering"],
              correct: 'NAT Gateway'
            },
            {
              text: 'Dịch vụ nào của AWS cung cấp không gian lưu trữ dạng đối tượng (Object Storage), phù hợp lưu trữ file ảnh/video tĩnh giá rẻ?',
              options: ["EC2", "RDS", "Amazon S3", "EBS"],
              correct: 'Amazon S3'
            },
            {
              text: 'Auto Scaling giúp hệ thống đạt được thuộc tính nào dưới đây?',
              options: ["Tính bảo mật cao", "Khả năng co giãn tự động theo tải thực tế (Elasticity)", "Khả năng mã hóa dữ liệu", "Giảm kích thước Docker Image"],
              correct: 'Khả năng co giãn tự động theo tải thực tế (Elasticity)'
            }
          ]
        }
      }
    ];

    for (const c of courses) {
      // Chèn khóa học
      const cRes = await client.query(
        'INSERT INTO courses (id, title, description, image_url, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [c.id, c.title, c.description, c.image_url, 'published']
      );
      const courseId = cRes.rows[0].id;

      // Chèn các bài học
      for (let order = 0; order < c.lessons.length; order++) {
        const lesson = c.lessons[order];
        await client.query(
          'INSERT INTO lessons (course_id, title, content, video_url, order_index) VALUES ($1, $2, $3, $4, $5)',
          [courseId, lesson.title, lesson.content, lesson.video_url, order + 1]
        );
      }

      // Chèn đề thi trắc nghiệm
      const quizRes = await client.query(
        'INSERT INTO quizzes (course_id, title, duration_minutes, passing_score) VALUES ($1, $2, $3, $4) RETURNING id',
        [courseId, c.quiz.title, 15, 80]
      );
      const quizId = quizRes.rows[0].id;

      // Chèn các câu hỏi trắc nghiệm
      for (const q of c.quiz.questions) {
        await client.query(
          'INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer) VALUES ($1, $2, $3, $4, $5)',
          [quizId, q.text, 'multiple_choice', JSON.stringify(q.options), q.correct]
        );
      }
    }
    console.log('- Đã gieo mầm thành công 10 khóa học, 30 bài học có video đầy đủ, 10 đề thi cùng 30 câu hỏi trắc nghiệm.');

    // 6. Gieo mầm tiến độ học tập giả lập cho nhân viên (Enrollments)
    console.log('[7/7] Đang gieo mầm dữ liệu tiến độ đăng ký học tập giả lập cho 50 nhân viên đầu tiên...');
    for (let empId = 51; empId <= 100; empId++) {
      const course1 = (empId % 10) + 1;
      const course2 = ((empId + 3) % 10) + 1;

      const progress1 = Math.floor(Math.random() * 80) + 10;
      const progress2 = Math.floor(Math.random() * 80) + 10;

      await client.query(
        'INSERT INTO enrollments (user_id, course_id, progress, is_assigned, status) VALUES ($1, $2, $3, $4, $5)',
        [empId, course1, progress1, true, 'approved']
      );

      await client.query(
        'INSERT INTO enrollments (user_id, course_id, progress, is_assigned, status) VALUES ($1, $2, $3, $4, $5)',
        [empId, course2, progress2, false, 'approved']
      );
    }
    console.log('- Đã thêm tiến độ học tập mẫu.');

    // Đồng bộ lại Sequence ID của các bảng sau khi chèn cứng ID
    console.log('[+] Đồng bộ hóa lại Sequence IDs...');
    await client.query("SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id)+1 FROM departments), 1), false)");
    await client.query("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id)+1 FROM users), 1), false)");
    await client.query("SELECT setval('courses_id_seq', COALESCE((SELECT MAX(id)+1 FROM courses), 1), false)");
    await client.query("SELECT setval('lessons_id_seq', COALESCE((SELECT MAX(id)+1 FROM lessons), 1), false)");
    await client.query("SELECT setval('quizzes_id_seq', COALESCE((SELECT MAX(id)+1 FROM quizzes), 1), false)");
    await client.query("SELECT setval('questions_id_seq', COALESCE((SELECT MAX(id)+1 FROM questions), 1), false)");
    await client.query("SELECT setval('enrollments_id_seq', COALESCE((SELECT MAX(id)+1 FROM enrollments), 1), false)");

    await client.query('COMMIT');
    console.log('\n==================================================');
    console.log('=> GIEO MẦM DỮ LIỆU LỚN THÀNH CÔNG!');
    console.log('==================================================\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[LỖI] QUÁ TRÌNH GIEO MẦM THẤT BẠI:', err);
  } finally {
    client.release();
  }

  // 7. Xóa sạch cache Redis để các danh sách khóa học và quyền hạn cập nhật lập tức
  try {
    await redis.delPattern('courses:*');
    await redis.delPattern('role_permissions:*');
    await redis.delPattern('user_status:*');
    console.log('[Redis] Đã làm sạch toàn bộ cache khóa học và quyền hạn RBAC.');
  } catch (redisErr) {
    console.warn('[Redis Warning] Không thể xóa cache Redis:', redisErr.message);
  }

  process.exit(0);
}

seedLargeData();
