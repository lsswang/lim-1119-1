var express = require('express');
var sqlite3 = require('sqlite3').verbose();
var cors = require('cors');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var bodyParser = require('body-parser');
var fs = require('fs');
var path = require('path');

var app = express();
var PORT = process.env.PORT || 3001;
var JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

var db = new sqlite3.Database(path.join(dataDir, 'certs.db'));

db.run('PRAGMA foreign_keys = ON');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authenticateToken(req, res, next) {
  var authHeader = req.headers['authorization'];
  var token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, function (err, user) {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.user = user;
    next();
  });
}

function roleMiddleware() {
  var roles = Array.prototype.slice.call(arguments);
  return function (req, res, next) {
    if (roles.indexOf(req.user.role) === -1) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

function generateCertNo() {
  var timestamp = Date.now().toString();
  var random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return 'CERT-' + timestamp + '-' + random;
}

app.post('/api/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], function (err, user) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    var isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    var token = generateToken(user);
    res.json({
      token: token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        locked: user.locked
      }
    });
  });
});

app.get('/api/users/me', authenticateToken, function (req, res) {
  db.get('SELECT id, username, name, role, phone, email, locked FROM users WHERE id = ?', [req.user.id], function (err, user) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
  });
});

app.put('/api/users/me', authenticateToken, function (req, res) {
  var userId = req.user.id;
  var name = req.body.name;
  var phone = req.body.phone;
  var email = req.body.email;

  db.get('SELECT locked FROM users WHERE id = ?', [userId], function (err, user) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (user.locked === 1) {
      return res.status(403).json({ error: '账户已锁定，无法修改个人信息' });
    }

    db.run(
      'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?',
      [name, phone, email, userId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: '更新失败' });
        }
        db.get('SELECT id, username, name, role, phone, email, locked FROM users WHERE id = ?', [userId], function (err, updatedUser) {
          if (err) {
            return res.status(500).json({ error: '数据库错误' });
          }
          res.json(updatedUser);
        });
      }
    );
  });
});

app.get('/api/courses', authenticateToken, function (req, res) {
  db.all('SELECT * FROM courses ORDER BY created_at DESC', [], function (err, courses) {
    if (err) {
      return res.status(500).json({ error: '获取课程列表失败' });
    }
    res.json(courses);
  });
});

app.post('/api/courses', authenticateToken, roleMiddleware('admin'), function (req, res) {
  var name = req.body.name;
  var hours = req.body.hours;
  var description = req.body.description || '';

  if (!name || !hours) {
    return res.status(400).json({ error: '课程名称和学时不能为空' });
  }

  db.run(
    'INSERT INTO courses (name, hours, description) VALUES (?, ?, ?)',
    [name, hours, description],
    function (err) {
      if (err) {
        return res.status(500).json({ error: '创建课程失败' });
      }
      var courseId = this.lastID;
      db.get('SELECT * FROM courses WHERE id = ?', [courseId], function (err, course) {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        res.status(201).json(course);
      });
    }
  );
});

app.post('/api/student-courses/enroll', authenticateToken, roleMiddleware('student'), function (req, res) {
  var studentId = req.user.id;
  var courseId = req.body.course_id;

  if (!courseId) {
    return res.status(400).json({ error: '课程ID不能为空' });
  }

  db.get('SELECT * FROM courses WHERE id = ?', [courseId], function (err, course) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!course) {
      return res.status(404).json({ error: '课程不存在' });
    }

    db.get(
      'SELECT * FROM student_courses WHERE student_id = ? AND course_id = ?',
      [studentId, courseId],
      function (err, existing) {
        if (err) {
          return res.status(500).json({ error: '数据库错误' });
        }
        if (existing) {
          return res.status(400).json({ error: '已经选过该课程' });
        }

        db.run(
          'INSERT INTO student_courses (student_id, course_id) VALUES (?, ?)',
          [studentId, courseId],
          function (err) {
            if (err) {
              return res.status(500).json({ error: '选课失败' });
            }
            var scId = this.lastID;
            db.get('SELECT * FROM student_courses WHERE id = ?', [scId], function (err, sc) {
              if (err) {
                return res.status(500).json({ error: '数据库错误' });
              }
              res.status(201).json(sc);
            });
          }
        );
      }
    );
  });
});

app.get('/api/student-courses/mine', authenticateToken, roleMiddleware('student'), function (req, res) {
  var studentId = req.user.id;

  db.all(
    `SELECT sc.*, c.name as course_name, c.hours as course_hours, c.description as course_description
     FROM student_courses sc
     JOIN courses c ON sc.course_id = c.id
     WHERE sc.student_id = ?
     ORDER BY sc.enrolled_at DESC`,
    [studentId],
    function (err, courses) {
      if (err) {
        return res.status(500).json({ error: '获取我的课程失败' });
      }
      res.json(courses);
    }
  );
});

app.get('/api/student-courses', authenticateToken, roleMiddleware('staff', 'admin'), function (req, res) {
  db.all(
    `SELECT sc.*, u.name as student_name, u.username, c.name as course_name, c.hours as course_hours
     FROM student_courses sc
     JOIN users u ON sc.student_id = u.id
     JOIN courses c ON sc.course_id = c.id
     ORDER BY sc.enrolled_at DESC`,
    [],
    function (err, courses) {
      if (err) {
        return res.status(500).json({ error: '获取选课列表失败' });
      }
      res.json(courses);
    }
  );
});

app.post('/api/student-courses/:id/update-hours', authenticateToken, roleMiddleware('staff'), function (req, res) {
  var scId = req.params.id;
  var hoursCompleted = req.body.hours_completed;

  if (hoursCompleted === undefined) {
    return res.status(400).json({ error: '学时不能为空' });
  }

  db.get('SELECT * FROM student_courses WHERE id = ?', [scId], function (err, sc) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!sc) {
      return res.status(404).json({ error: '选课记录不存在' });
    }

    db.run(
      'UPDATE student_courses SET hours_completed = ? WHERE id = ?',
      [hoursCompleted, scId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: '更新学时失败' });
        }
        db.get('SELECT * FROM student_courses WHERE id = ?', [scId], function (err, updatedSc) {
          if (err) {
            return res.status(500).json({ error: '数据库错误' });
          }
          res.json(updatedSc);
        });
      }
    );
  });
});

app.post('/api/student-courses/:id/approve-hours', authenticateToken, roleMiddleware('staff'), function (req, res) {
  var scId = req.params.id;
  var hoursApproved = req.body.hours_approved;

  if (hoursApproved === undefined) {
    return res.status(400).json({ error: '审核学时不能为空' });
  }

  db.get('SELECT * FROM student_courses WHERE id = ?', [scId], function (err, sc) {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!sc) {
      return res.status(404).json({ error: '选课记录不存在' });
    }

    db.run(
      'UPDATE student_courses SET hours_approved = ? WHERE id = ?',
      [hoursApproved, scId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: '审核学时失败' });
        }
        db.get('SELECT * FROM student_courses WHERE id = ?', [scId], function (err, updatedSc) {
          if (err) {
            return res.status(500).json({ error: '数据库错误' });
          }
          res.json(updatedSc);
        });
      }
    );
  });
});

app.post('/api/exams/submit', authenticateToken, roleMiddleware('student'), function (req, res) {
  var studentCourseId = req.body.student_course_id;
  var score = req.body.score;

  if (studentCourseId === undefined || score === undefined) {
    return res.status(400).json({ error: '选课记录ID和分数不能为空' });
  }

  db.get(
    'SELECT * FROM student_courses WHERE id = ? AND student_id = ?',
    [studentCourseId, req.user.id],
    function (err, sc) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      if (!sc) {
        return res.status(404).json({ error: '选课记录不存在' });
      }

      db.get(
        'SELECT COUNT(*) as count, MAX(attempts) as max_attempts FROM exams WHERE student_course_id = ?',
        [studentCourseId],
        function (err, result) {
          if (err) {
            return res.status(500).json({ error: '数据库错误' });
          }
          var attempts = result.max_attempts ? result.max_attempts + 1 : 1;
          var passed = score >= 60 ? 1 : 0;

          db.run(
            'INSERT INTO exams (student_course_id, score, passed, attempts) VALUES (?, ?, ?, ?)',
            [studentCourseId, score, passed, attempts],
            function (err) {
              if (err) {
                return res.status(500).json({ error: '提交考试失败' });
              }
              var examId = this.lastID;
              db.get('SELECT * FROM exams WHERE id = ?', [examId], function (err, exam) {
                if (err) {
                  return res.status(500).json({ error: '数据库错误' });
                }
                res.status(201).json(exam);
              });
            }
          );
        }
      );
    }
  );
});

app.get('/api/exams/student/:student_course_id', authenticateToken, function (req, res) {
  var studentCourseId = req.params.student_course_id;

  db.all(
    'SELECT * FROM exams WHERE student_course_id = ? ORDER BY created_at DESC',
    [studentCourseId],
    function (err, exams) {
      if (err) {
        return res.status(500).json({ error: '获取考试记录失败' });
      }
      res.json(exams);
    }
  );
});

app.post('/api/certificates/issue', authenticateToken, roleMiddleware('admin'), function (req, res) {
  var studentId = req.body.student_id;
  var courseId = req.body.course_id;

  if (!studentId || !courseId) {
    return res.status(400).json({ error: '学生ID和课程ID不能为空' });
  }

  db.get(
    `SELECT sc.*, c.hours as course_hours
     FROM student_courses sc
     JOIN courses c ON sc.course_id = c.id
     WHERE sc.student_id = ? AND sc.course_id = ?`,
    [studentId, courseId],
    function (err, sc) {
      if (err) {
        return res.status(500).json({ error: '数据库错误' });
      }
      if (!sc) {
        return res.status(400).json({ error: '学生未选修该课程' });
      }

      if (sc.hours_approved < sc.course_hours) {
        return res.status(400).json({ error: '审核学时不足，无法发放证书' });
      }

      db.get(
        'SELECT * FROM exams WHERE student_course_id = ? AND passed = 1 ORDER BY created_at DESC LIMIT 1',
        [sc.id],
        function (err, exam) {
          if (err) {
            return res.status(500).json({ error: '数据库错误' });
          }
          if (!exam) {
            return res.status(400).json({ error: '未找到通过的考试记录' });
          }

          db.get(
            'SELECT * FROM certificates WHERE student_id = ? AND course_id = ?',
            [studentId, courseId],
            function (err, existingCert) {
              if (err) {
                return res.status(500).json({ error: '数据库错误' });
              }
              if (existingCert) {
                return res.status(400).json({ error: '该证书已发放' });
              }

              var certNo = generateCertNo();

              db.run('BEGIN TRANSACTION');

              db.run(
                'INSERT INTO certificates (student_id, course_id, exam_id, cert_no) VALUES (?, ?, ?, ?)',
                [studentId, courseId, exam.id, certNo],
                function (err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: '发放证书失败' });
                  }
                  var certId = this.lastID;

                  db.run(
                    'UPDATE student_courses SET status = ? WHERE id = ?',
                    ['certified', sc.id],
                    function (err) {
                      if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: '更新课程状态失败' });
                      }

                      db.run(
                        'UPDATE users SET locked = 1 WHERE id = ?',
                        [studentId],
                        function (err) {
                          if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: '锁定用户失败' });
                          }

                          db.run('COMMIT', function (err) {
                            if (err) {
                              db.run('ROLLBACK');
                              return res.status(500).json({ error: '事务提交失败' });
                            }

                            db.get('SELECT * FROM certificates WHERE id = ?', [certId], function (err, cert) {
                              if (err) {
                                return res.status(500).json({ error: '数据库错误' });
                              }
                              res.status(201).json(cert);
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

app.get('/api/certificates', authenticateToken, function (req, res) {
  var userId = req.user.id;
  var role = req.user.role;

  var query = `SELECT cert.*, 
                      u.name as student_name, u.username,
                      c.name as course_name, c.hours as course_hours
               FROM certificates cert
               JOIN users u ON cert.student_id = u.id
               JOIN courses c ON cert.course_id = c.id`;
  var params = [];

  if (role === 'student') {
    query += ' WHERE cert.student_id = ?';
    params.push(userId);
  }

  query += ' ORDER BY cert.issued_at DESC';

  db.all(query, params, function (err, certificates) {
    if (err) {
      return res.status(500).json({ error: '获取证书列表失败' });
    }
    res.json(certificates);
  });
});

app.get('/api/users/students', authenticateToken, roleMiddleware('staff', 'admin'), function (req, res) {
  db.all(
    'SELECT id, username, name, role, phone, email, locked FROM users WHERE role = ? ORDER BY id',
    ['student'],
    function (err, students) {
      if (err) {
        return res.status(500).json({ error: '获取学生列表失败' });
      }
      res.json(students);
    }
  );
});

app.get('/', function (req, res) {
  res.json({ message: '继续教育证书发放系统 API', status: 'running' });
});

app.listen(PORT, function () {
  console.log('服务器运行在 http://localhost:' + PORT);
});

module.exports = app;
