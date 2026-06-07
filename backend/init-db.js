const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./data/certs.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'staff', 'admin')),
    phone TEXT,
    email TEXT,
    locked INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hours INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS student_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    hours_completed INTEGER DEFAULT 0,
    hours_approved INTEGER DEFAULT 0,
    status TEXT DEFAULT 'learning',
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_course_id INTEGER NOT NULL,
    score INTEGER,
    passed INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_course_id) REFERENCES student_courses(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    cert_no TEXT UNIQUE NOT NULL,
    issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (exam_id) REFERENCES exams(id)
  )`);

  const salt = bcrypt.genSaltSync(10);
  const users = [
    { username: 'student1', password: bcrypt.hashSync('123456', salt), name: '张三', role: 'student', phone: '13800138001', email: 'zhangsan@example.com' },
    { username: 'student2', password: bcrypt.hashSync('123456', salt), name: '李四', role: 'student', phone: '13800138002', email: 'lisi@example.com' },
    { username: 'staff1', password: bcrypt.hashSync('123456', salt), name: '王老师', role: 'staff', phone: '13800138003', email: 'wang@example.com' },
    { username: 'admin1', password: bcrypt.hashSync('123456', salt), name: '系统管理员', role: 'admin', phone: '13800138004', email: 'admin@example.com' }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO users (username, password, name, role, phone, email) VALUES (?, ?, ?, ?, ?, ?)');
  users.forEach(u => stmt.run(u.username, u.password, u.name, u.role, u.phone, u.email));
  stmt.finalize();

  const courses = [
    { name: 'Web 前端开发', hours: 40, description: 'HTML/CSS/JavaScript 基础到进阶' },
    { name: '后端开发技术', hours: 60, description: 'Node.js, Python, Java 后端开发' },
    { name: '数据科学入门', hours: 30, description: '数据分析与机器学习基础' },
    { name: '项目管理', hours: 20, description: '敏捷开发与项目管理实践' }
  ];

  const stmt2 = db.prepare('INSERT OR IGNORE INTO courses (name, hours, description) VALUES (?, ?, ?)');
  courses.forEach(c => stmt2.run(c.name, c.hours, c.description));
  stmt2.finalize();

  console.log('数据库初始化完成');
});

db.close();
