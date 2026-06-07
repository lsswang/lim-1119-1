import { useState, useEffect } from 'react'
import { courseAPI, studentCourseAPI, examAPI, certificateAPI, authAPI } from '../api.js'

const statusMap = {
  learning: { text: '学习中', cls: 'badge-learning' },
  hours_approved: { text: '学时已审核', cls: 'badge-hours_approved' },
  exam_passed: { text: '考试通过', cls: 'badge-exam_passed' },
  exam_failed: { text: '考试未通过', cls: 'badge-exam_failed' },
  certified: { text: '已发证', cls: 'badge-certified' }
}

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('courses')
  const [courses, setCourses] = useState([])
  const [myCourses, setMyCourses] = useState([])
  const [certificates, setCertificates] = useState([])
  const [user, setUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '' })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'courses') {
        const [c, mc] = await Promise.all([courseAPI.list(), studentCourseAPI.mine()])
        setCourses(c)
        setMyCourses(mc)
      } else if (activeTab === 'certs') {
        setCertificates(await certificateAPI.list())
      } else if (activeTab === 'profile') {
        const u = await authAPI.getMe()
        setUser(u)
        setEditForm({ name: u.name, phone: u.phone || '', email: u.email || '' })
      }
    } catch (err) {
      showMsg(err.response?.data?.error || '加载失败', 'error')
    }
  }

  const showMsg = (text, type = 'info') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 3000)
  }

  const handleEnroll = async (courseId) => {
    try {
      await studentCourseAPI.enroll({ course_id: courseId })
      showMsg('选课成功！', 'success')
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '选课失败', 'error')
    }
  }

  const handleTakeExam = async (scId, currentScore = null) => {
    const scoreStr = prompt(currentScore !== null ? `上次成绩：${currentScore} 分，请输入补考成绩（60分及格）：` : '请输入考试成绩（60分及格）：')
    if (scoreStr === null) return
    const score = parseInt(scoreStr)
    if (isNaN(score) || score < 0 || score > 100) {
      showMsg('请输入有效的成绩（0-100）', 'error')
      return
    }
    try {
      const res = await examAPI.submit({ student_course_id: scId, score })
      if (res.passed) {
        showMsg(`考试通过！成绩：${score} 分`, 'success')
      } else {
        showMsg(`考试未通过，成绩：${score} 分。可参加补考。`, 'error')
      }
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '提交失败', 'error')
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      await authAPI.updateMe(editForm)
      showMsg('个人信息更新成功！', 'success')
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '更新失败', 'error')
    }
  }

  const isEnrolled = (courseId) => myCourses.some(mc => mc.course_id === courseId)

  return (
    <div>
      {message && <div className={`alert alert-${messageType}`}>{message}</div>}
      <div className="tabs">
        <div className={`tab ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>我的课程</div>
        <div className={`tab ${activeTab === 'certs' ? 'active' : ''}`} onClick={() => setActiveTab('certs')}>我的证书</div>
        <div className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>个人信息</div>
      </div>

      {activeTab === 'courses' && (
        <div className="grid-2">
          <div className="card">
            <h2>可选课程</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>学时</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.hours} 学时</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleEnroll(c.id)}
                        disabled={isEnrolled(c.id)}
                      >
                        {isEnrolled(c.id) ? '已选修' : '选修'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>学习进度</h2>
            {myCourses.length === 0 ? (
              <p style={{ color: '#999' }}>暂无学习记录</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>课程</th>
                    <th>进度</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {myCourses.map(mc => (
                    <tr key={mc.id}>
                      <td>{mc.course_name}</td>
                      <td>{mc.hours_approved || mc.hours_completed}/{mc.course_hours} 学时</td>
                      <td><span className={`badge ${statusMap[mc.status]?.cls}`}>{statusMap[mc.status]?.text}</span></td>
                      <td>
                        {mc.status === 'hours_approved' && (
                          <button className="btn btn-warning btn-sm" onClick={() => handleTakeExam(mc.id)}>参加考试</button>
                        )}
                        {mc.status === 'exam_failed' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleTakeExam(mc.id, myCourses.find(m => m.id === mc.id)?.score)}>参加补考</button>
                        )}
                        {mc.status === 'certified' && (
                          <span className="badge badge-certified">已发证</span>
                        )}
                        {mc.status === 'learning' && (
                          <span style={{ color: '#999', fontSize: 12 }}>等待教务审核学时</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'certs' && (
        <div className="card">
          <h2>我的证书</h2>
          {certificates.length === 0 ? (
            <p style={{ color: '#999' }}>暂无证书</p>
          ) : (
            <div className="grid-2">
              {certificates.map(c => (
                <div key={c.id} className="cert-card">
                  <h3>🎓 继续教育证书</h3>
                  <p>学员：{c.student_name}</p>
                  <p>课程：{c.course_name}</p>
                  <p>成绩：{c.score} 分</p>
                  <div className="cert-no">证书编号：{c.cert_no}</div>
                  <p style={{ fontSize: 12, color: '#999' }}>发证日期：{new Date(c.issued_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && user && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h2>个人信息</h2>
          {user.locked && (
            <div className="alert alert-info">⚠️ 证书已发放，个人信息不可修改</div>
          )}
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label>姓名</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} disabled={user.locked} />
            </div>
            <div className="form-group">
              <label>手机号</label>
              <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} disabled={user.locked} />
            </div>
            <div className="form-group">
              <label>邮箱</label>
              <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} disabled={user.locked} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={user.locked}>保存修改</button>
          </form>
        </div>
      )}
    </div>
  )
}
