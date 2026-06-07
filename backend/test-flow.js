const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3001;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
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

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function login(username, password) {
  const res = await request('POST', '/api/login', { username, password });
  if (res.status !== 200) {
    throw new Error('登录失败 ' + username + ': ' + JSON.stringify(res.data));
  }
  console.log('✓ ' + username + ' 登录成功');
  return res.data;
}

async function runTests() {
  console.log('========== 开始测试核心业务流程 ==========\n');

  try {
    console.log('--- 步骤 1: 登录三个用户 ---');
    const studentLogin = await login('student1', '123456');
    const staffLogin = await login('staff1', '123456');
    const adminLogin = await login('admin1', '123456');

    const studentToken = studentLogin.token;
    const staffToken = staffLogin.token;
    const adminToken = adminLogin.token;
    const studentId = studentLogin.user.id;

    console.log('\n--- 步骤 2: 学员选课 ---');
    const coursesRes = await request('GET', '/api/courses', null, studentToken);
    if (coursesRes.status !== 200) {
      throw new Error('获取课程列表失败: ' + JSON.stringify(coursesRes.data));
    }
    const courses = coursesRes.data;
    if (!courses || courses.length === 0) {
      throw new Error('没有可用的课程');
    }
    const firstCourse = courses[0];
    console.log('  选择课程: ' + firstCourse.name + ' (ID: ' + firstCourse.id + ', 要求学时: ' + firstCourse.hours + ')');

    const enrollRes = await request('POST', '/api/student-courses/enroll', { course_id: firstCourse.id }, studentToken);
    if (enrollRes.status !== 201) {
      throw new Error('选课失败: ' + JSON.stringify(enrollRes.data));
    }
    const studentCourse = enrollRes.data;
    console.log('✓ 选课成功，选课记录 ID: ' + studentCourse.id);

    console.log('\n--- 步骤 3: 教务录入 20 学时并审核 ---');
    const updateHours20Res = await request('POST', '/api/student-courses/' + studentCourse.id + '/update-hours', { hours_completed: 20 }, staffToken);
    if (updateHours20Res.status !== 200) {
      throw new Error('录入学时失败: ' + JSON.stringify(updateHours20Res.data));
    }
    console.log('✓ 教务录入 20 学时成功');

    const approveHours20Res = await request('POST', '/api/student-courses/' + studentCourse.id + '/approve-hours', { hours_approved: 20 }, staffToken);
    if (approveHours20Res.status !== 200) {
      throw new Error('审核学时失败: ' + JSON.stringify(approveHours20Res.data));
    }
    console.log('✓ 教务审核 20 学时成功');

    console.log('\n--- 步骤 4: 管理员尝试发证（学时不足）---');
    const issueCertFail1Res = await request('POST', '/api/certificates/issue', { student_id: studentId, course_id: firstCourse.id }, adminToken);
    if (issueCertFail1Res.status !== 400) {
      throw new Error('预期返回 400，但实际返回: ' + issueCertFail1Res.status);
    }
    if (!issueCertFail1Res.data.error || !issueCertFail1Res.data.error.includes('学时')) {
      throw new Error('错误信息应包含"学时": ' + JSON.stringify(issueCertFail1Res.data));
    }
    console.log('✓ 验证通过：学时不足时发证返回 400，错误信息包含"学时"');

    console.log('\n--- 步骤 5: 教务补足到 40 学时并审核 ---');
    const updateHours40Res = await request('POST', '/api/student-courses/' + studentCourse.id + '/update-hours', { hours_completed: 40 }, staffToken);
    if (updateHours40Res.status !== 200) {
      throw new Error('录入学时失败: ' + JSON.stringify(updateHours40Res.data));
    }
    console.log('✓ 教务录入 40 学时成功');

    const approveHours40Res = await request('POST', '/api/student-courses/' + studentCourse.id + '/approve-hours', { hours_approved: 40 }, staffToken);
    if (approveHours40Res.status !== 200) {
      throw new Error('审核学时失败: ' + JSON.stringify(approveHours40Res.data));
    }
    console.log('✓ 教务审核 40 学时成功');

    console.log('\n--- 步骤 6: 学员提交考试 59 分（不及格）---');
    const examFailRes = await request('POST', '/api/exams/submit', { student_course_id: studentCourse.id, score: 59 }, studentToken);
    if (examFailRes.status !== 201) {
      throw new Error('提交考试失败: ' + JSON.stringify(examFailRes.data));
    }
    console.log('✓ 学员提交考试 59 分成功');

    console.log('\n--- 步骤 7: 管理员尝试发证（考试未通过）---');
    const issueCertFail2Res = await request('POST', '/api/certificates/issue', { student_id: studentId, course_id: firstCourse.id }, adminToken);
    if (issueCertFail2Res.status !== 400) {
      throw new Error('预期返回 400，但实际返回: ' + issueCertFail2Res.status);
    }
    console.log('✓ 验证通过：考试未通过时发证返回 400');

    console.log('\n--- 步骤 8: 学员补考 85 分（通过）---');
    const examPassRes = await request('POST', '/api/exams/submit', { student_course_id: studentCourse.id, score: 85 }, studentToken);
    if (examPassRes.status !== 201) {
      throw new Error('提交考试失败: ' + JSON.stringify(examPassRes.data));
    }
    console.log('✓ 学员补考 85 分成功');

    console.log('\n--- 步骤 9: 管理员发证 ---');
    const issueCertRes = await request('POST', '/api/certificates/issue', { student_id: studentId, course_id: firstCourse.id }, adminToken);
    if (issueCertRes.status !== 201) {
      throw new Error('发证失败: ' + JSON.stringify(issueCertRes.data));
    }
    const certificate = issueCertRes.data;
    if (!certificate.cert_no) {
      throw new Error('未返回证书编号');
    }
    console.log('✓ 发证成功！证书编号: ' + certificate.cert_no);

    console.log('\n--- 步骤 10: 学员尝试修改个人信息（已锁定）---');
    const updateProfileRes = await request('PUT', '/api/users/me', { name: '测试修改' }, studentToken);
    if (updateProfileRes.status !== 403 && updateProfileRes.status !== 400) {
      throw new Error('预期返回 403 或 400，但实际返回: ' + updateProfileRes.status);
    }
    const errorMsg = updateProfileRes.data.error || '';
    if (!errorMsg.includes('不可修改') && !errorMsg.includes('锁定')) {
      throw new Error('错误信息应包含"不可修改"或"锁定": ' + JSON.stringify(updateProfileRes.data));
    }
    console.log('✓ 验证通过：已发证学员无法修改个人信息');

    console.log('\n========== 所有测试通过！==========');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
