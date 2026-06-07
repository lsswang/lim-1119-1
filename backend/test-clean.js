var http = require('http');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var BASE_URL = 'localhost';
var PORT = 3001;
var serverProcess = null;

function request(method, path, data, token, callback) {
  var options = {
    hostname: BASE_URL,
    port: PORT,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }

  var req = http.request(options, function (res) {
    var body = '';
    res.on('data', function (chunk) {
      body += chunk;
    });
    res.on('end', function () {
      var parsed;
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (e) {
        parsed = body;
      }
      callback(null, { status: res.statusCode, data: parsed });
    });
  });

  req.on('error', function (e) {
    callback(e);
  });

  if (data) {
    req.write(JSON.stringify(data));
  }
  req.end();
}

function killPortProcess(callback) {
  console.log('正在杀掉占用 3001 端口的进程...');
  var cmd = process.platform === 'win32' 
    ? 'netstat -ano | findstr :3001 | for /f "tokens=5" %a in (\'more\') do taskkill /F /PID %a'
    : 'lsof -ti:3001 | xargs kill -9 2>/dev/null; true';
  
  childProcess.exec(cmd, function () {
    setTimeout(callback, 1000);
  });
}

function deleteDatabase(callback) {
  console.log('正在删除数据库文件...');
  var dbPath = path.join(__dirname, 'data', 'certs.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('✓ 数据库文件已删除');
  } else {
    console.log('✓ 数据库文件不存在，跳过删除');
  }
  callback();
}

function initDatabase(callback) {
  console.log('正在初始化数据库...');
  childProcess.exec('node init-db.js', { cwd: __dirname }, function (err, stdout, stderr) {
    if (err) {
      console.error('数据库初始化失败:', err);
      callback(err);
      return;
    }
    console.log('✓ 数据库初始化完成');
    callback();
  });
}

function startServer(callback) {
  console.log('正在启动后端服务...');
  serverProcess = childProcess.spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  serverProcess.on('error', function (err) {
    console.error('启动服务失败:', err);
    callback(err);
  });
  
  callback();
}

function waitForServerReady(callback) {
  console.log('正在等待服务启动...');
  var maxAttempts = 30;
  var attempts = 0;
  
  function check() {
    attempts++;
    request('GET', '/api/courses', null, null, function (err, res) {
      if (!err && (res.status === 401 || res.status === 200)) {
        console.log('✓ 服务已启动');
        callback();
        return;
      }
      
      if (attempts >= maxAttempts) {
        callback(new Error('服务启动超时'));
        return;
      }
      
      setTimeout(check, 1000);
    });
  }
  
  check();
}

function login(username, password, callback) {
  request('POST', '/api/login', { username: username, password: password }, null, function (err, res) {
    if (err) {
      callback(err);
      return;
    }
    if (res.status !== 200) {
      callback(new Error('登录失败 ' + username + ': ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ ' + username + ' 登录成功');
    callback(null, res.data);
  });
}

function step1Login(callback) {
  console.log('\n--- 步骤 1: 登录三个用户 ---');
  var result = {};
  
  login('student1', '123456', function (err, studentData) {
    if (err) { callback(err); return; }
    result.student = studentData;
    
    login('staff1', '123456', function (err, staffData) {
      if (err) { callback(err); return; }
      result.staff = staffData;
      
      login('admin1', '123456', function (err, adminData) {
        if (err) { callback(err); return; }
        result.admin = adminData;
        callback(null, result);
      });
    });
  });
}

function step2Enroll(studentToken, callback) {
  console.log('\n--- 步骤 2: 学员选课 ---');
  request('GET', '/api/courses', null, studentToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 200) {
      callback(new Error('获取课程列表失败: ' + JSON.stringify(res.data)));
      return;
    }
    
    var courses = res.data;
    if (!courses || courses.length === 0) {
      callback(new Error('没有可用的课程'));
      return;
    }
    
    var firstCourse = courses[0];
    console.log('  选择课程: ' + firstCourse.name + ' (ID: ' + firstCourse.id + ', 要求学时: ' + firstCourse.hours + ')');
    
    request('POST', '/api/student-courses/enroll', { course_id: firstCourse.id }, studentToken, function (err, enrollRes) {
      if (err) { callback(err); return; }
      if (enrollRes.status !== 201) {
        callback(new Error('选课失败: ' + JSON.stringify(enrollRes.data)));
        return;
      }
      
      var studentCourse = enrollRes.data;
      console.log('✓ 选课成功，选课记录 ID: ' + studentCourse.id);
      callback(null, { course: firstCourse, studentCourse: studentCourse });
    });
  });
}

function step3UpdateHours20(staffToken, studentCourseId, callback) {
  console.log('\n--- 步骤 3: 教务录入 20 学时并审核 ---');
  request('POST', '/api/student-courses/' + studentCourseId + '/update-hours', { hours_completed: 20 }, staffToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 200) {
      callback(new Error('录入学时失败: ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 教务录入 20 学时成功');
    
    request('POST', '/api/student-courses/' + studentCourseId + '/approve-hours', { hours_approved: 20 }, staffToken, function (err, approveRes) {
      if (err) { callback(err); return; }
      if (approveRes.status !== 200) {
        callback(new Error('审核学时失败: ' + JSON.stringify(approveRes.data)));
        return;
      }
      console.log('✓ 教务审核 20 学时成功');
      callback();
    });
  });
}

function step4IssueCertFail1(adminToken, studentId, courseId, callback) {
  console.log('\n--- 步骤 4: 管理员尝试发证（学时不足）---');
  request('POST', '/api/certificates/issue', { student_id: studentId, course_id: courseId }, adminToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 400) {
      callback(new Error('预期返回 400，但实际返回: ' + res.status));
      return;
    }
    var errorMsg = res.data.error || '';
    if (!errorMsg.includes('学时')) {
      callback(new Error('错误信息应包含"学时": ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 验证通过：学时不足时发证返回 400，错误信息包含"学时"');
    callback();
  });
}

function step5UpdateHours40(staffToken, studentCourseId, callback) {
  console.log('\n--- 步骤 5: 教务补足到 40 学时并审核 ---');
  request('POST', '/api/student-courses/' + studentCourseId + '/update-hours', { hours_completed: 40 }, staffToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 200) {
      callback(new Error('录入学时失败: ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 教务录入 40 学时成功');
    
    request('POST', '/api/student-courses/' + studentCourseId + '/approve-hours', { hours_approved: 40 }, staffToken, function (err, approveRes) {
      if (err) { callback(err); return; }
      if (approveRes.status !== 200) {
        callback(new Error('审核学时失败: ' + JSON.stringify(approveRes.data)));
        return;
      }
      console.log('✓ 教务审核 40 学时成功');
      callback();
    });
  });
}

function step6ExamFail(studentToken, studentCourseId, callback) {
  console.log('\n--- 步骤 6: 学员提交考试 59 分（不及格）---');
  request('POST', '/api/exams/submit', { student_course_id: studentCourseId, score: 59 }, studentToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 201) {
      callback(new Error('提交考试失败: ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 学员提交考试 59 分成功');
    callback();
  });
}

function step7IssueCertFail2(adminToken, studentId, courseId, callback) {
  console.log('\n--- 步骤 7: 管理员尝试发证（考试未通过）---');
  request('POST', '/api/certificates/issue', { student_id: studentId, course_id: courseId }, adminToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 400) {
      callback(new Error('预期返回 400，但实际返回: ' + res.status));
      return;
    }
    console.log('✓ 验证通过：考试未通过时发证返回 400');
    callback();
  });
}

function step8ExamPass(studentToken, studentCourseId, callback) {
  console.log('\n--- 步骤 8: 学员补考 85 分（通过）---');
  request('POST', '/api/exams/submit', { student_course_id: studentCourseId, score: 85 }, studentToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 201) {
      callback(new Error('提交考试失败: ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 学员补考 85 分成功');
    callback();
  });
}

function step9IssueCertSuccess(adminToken, studentId, courseId, callback) {
  console.log('\n--- 步骤 9: 管理员发证 ---');
  request('POST', '/api/certificates/issue', { student_id: studentId, course_id: courseId }, adminToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 201) {
      callback(new Error('发证失败: ' + JSON.stringify(res.data)));
      return;
    }
    var certificate = res.data;
    if (!certificate.cert_no) {
      callback(new Error('未返回证书编号'));
      return;
    }
    console.log('✓ 发证成功！证书编号: ' + certificate.cert_no);
    callback(null, certificate);
  });
}

function step10UpdateProfileLocked(studentToken, callback) {
  console.log('\n--- 步骤 10: 学员尝试修改个人信息（已锁定）---');
  request('PUT', '/api/users/me', { name: '测试修改', phone: '13900139000', email: 'test@example.com' }, studentToken, function (err, res) {
    if (err) { callback(err); return; }
    if (res.status !== 403 && res.status !== 400) {
      callback(new Error('预期返回 403 或 400，但实际返回: ' + res.status));
      return;
    }
    var errorMsg = res.data.error || '';
    if (!errorMsg.includes('不可修改') && !errorMsg.includes('锁定')) {
      callback(new Error('错误信息应包含"不可修改"或"锁定": ' + JSON.stringify(res.data)));
      return;
    }
    console.log('✓ 验证通过：已发证学员无法修改个人信息');
    callback();
  });
}

function cleanup(callback) {
  console.log('\n正在清理资源...');
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    console.log('✓ 后端服务已停止');
  }
  callback();
}

function runTests() {
  console.log('========== 开始测试核心业务流程 ==========\n');
  
  killPortProcess(function () {
    deleteDatabase(function () {
      initDatabase(function (err) {
        if (err) {
          console.error('❌ 测试失败:', err.message);
          process.exit(1);
        }
        
        startServer(function (err) {
          if (err) {
            console.error('❌ 测试失败:', err.message);
            process.exit(1);
          }
          
          waitForServerReady(function (err) {
            if (err) {
              console.error('❌ 测试失败:', err.message);
              cleanup(function () {
                process.exit(1);
              });
              return;
            }
            
            step1Login(function (err, loginData) {
              if (err) {
                console.error('❌ 测试失败:', err.message);
                cleanup(function () {
                  process.exit(1);
                });
                return;
              }
              
              var studentToken = loginData.student.token;
              var staffToken = loginData.staff.token;
              var adminToken = loginData.admin.token;
              var studentId = loginData.student.user.id;
              
              step2Enroll(studentToken, function (err, enrollData) {
                if (err) {
                  console.error('❌ 测试失败:', err.message);
                  cleanup(function () {
                    process.exit(1);
                  });
                  return;
                }
                
                var firstCourse = enrollData.course;
                var studentCourse = enrollData.studentCourse;
                var studentCourseId = studentCourse.id;
                var courseId = firstCourse.id;
                
                step3UpdateHours20(staffToken, studentCourseId, function (err) {
                  if (err) {
                    console.error('❌ 测试失败:', err.message);
                    cleanup(function () {
                      process.exit(1);
                    });
                    return;
                  }
                  
                  step4IssueCertFail1(adminToken, studentId, courseId, function (err) {
                    if (err) {
                      console.error('❌ 测试失败:', err.message);
                      cleanup(function () {
                        process.exit(1);
                      });
                      return;
                    }
                    
                    step5UpdateHours40(staffToken, studentCourseId, function (err) {
                      if (err) {
                        console.error('❌ 测试失败:', err.message);
                        cleanup(function () {
                          process.exit(1);
                        });
                        return;
                      }
                      
                      step6ExamFail(studentToken, studentCourseId, function (err) {
                        if (err) {
                          console.error('❌ 测试失败:', err.message);
                          cleanup(function () {
                            process.exit(1);
                          });
                          return;
                        }
                        
                        step7IssueCertFail2(adminToken, studentId, courseId, function (err) {
                          if (err) {
                            console.error('❌ 测试失败:', err.message);
                            cleanup(function () {
                              process.exit(1);
                            });
                            return;
                          }
                          
                          step8ExamPass(studentToken, studentCourseId, function (err) {
                            if (err) {
                              console.error('❌ 测试失败:', err.message);
                              cleanup(function () {
                                process.exit(1);
                              });
                              return;
                            }
                            
                            step9IssueCertSuccess(adminToken, studentId, courseId, function (err) {
                              if (err) {
                                console.error('❌ 测试失败:', err.message);
                                cleanup(function () {
                                  process.exit(1);
                                });
                                return;
                              }
                              
                              step10UpdateProfileLocked(studentToken, function (err) {
                                if (err) {
                                  console.error('❌ 测试失败:', err.message);
                                  cleanup(function () {
                                    process.exit(1);
                                  });
                                  return;
                                }
                                
                                console.log('\n========== 所有测试通过！==========');
                                cleanup(function () {
                                  process.exit(0);
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

runTests();
