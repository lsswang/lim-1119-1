import { useState, useEffect } from 'react'
import { courseAPI, studentCourseAPI, certificateAPI, userAPI } from '../api.js'

const statusMap = {
  learning: { text: '学习中', cls: 'badge-learning' },
  hours_approved: { text: '学时已审核', cls: 'badge-hours_approved' },
  exam_passed: { text: '考试通过', cls: 'badge-exam_passed' },
  exam_failed: { text: '考试未通过', cls: 'badge-exam_failed' },
  certified: { text: '已发证', cls: 'badge-certified' }
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('issue')
  const [studentCourses, setStudentCourses] = useState([])
  const [certificates, setCertificates] = useState([])
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [newCourse, setNewCourse] = useState({ name: '', hours: '', description: '' })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'issue') {
        setStudentCourses(await studentCourseAPI.list())
      } else if (activeTab === 'certs') {
        setCertificates(await certificateAPI.list())
      } else if (activeTab === 'courses') {
        setCourses(await courseAPI.list())
      } else if (activeTab === 'students') {
        setStudents(await userAPI.listStudents())
      }
    } catch (err) {
      showMsg(err.response?.data?.error || '加载失败', 'error')
    }
  }

  const showMsg = (text, type = 'info') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }

  const handleIssueCert = async (scId) => {
    if (!confirm('确认发放证书？请确保学时达标且考试通过。')) return
    try {
      const res = await certificateAPI.issue({ student_course_id: scId })
      showMsg(`证书发放成功！证书编号：${res.cert_no}`, 'success')
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '发证失败', 'error')
    }
  }

  const handleCreateCourse = async (e) => {
    e.preventDefault()
    if (!newCourse.name || !newCourse.hours) {
      showMsg('请填写完整信息', 'error')
      return
    }
    try {
      await courseAPI.create({
        name: newCourse.name,
        hours: parseInt(newCourse.hours),
        description: newCourse.description
      })
      showMsg('课程创建成功！', 'success')
      setNewCourse({ name: '', hours: '', description: '' })
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '创建失败', 'error')
    }
  }

  const canIssue = (sc) => {
    return sc.hours_approved >= sc.course_hours && sc.status === 'exam_passed'
  }

  return (
    <div>
      {message && <div className={`alert alert-${messageType}`}>{message}</div>}
      <div className="tabs">
        <div className={`tab ${activeTab === 'issue' ? 'active' : ''}`} onClick={() => setActiveTab('issue')}>证书发放</div>
        <div className={`tab ${activeTab === 'certs' ? 'active' : ''}`} onClick={() => setActiveTab('certs')}>证书管理</div>
        <div className={`tab ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => setActiveTab('courses')}>课程管理</div>
        <div className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>学员管理</div>
      </div>

      {activeTab === 'issue' && (
        <div className="card">
          <h2>证书发放</h2>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            💡 发证条件：学时审核通过且学时达标（≥ 要求学时），且考试通过（≥ 60分）
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>学员</th>
                <th>课程</th>
                <th>要求学时</th>
                <th>已审核学时</th>
                <th>是否达标</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {studentCourses.map(sc => (
                <tr key={sc.id}>
                  <td>{sc.student_name}</td>
                  <td>{sc.course_name}</td>
                  <td>{sc.course_hours}</td>
                  <td>{sc.hours_approved}</td>
                  <td>
                    {sc.hours_approved >= sc.course_hours
                      ? <span style={{ color: '#52c41a' }}>✅ 达标</span>
                      : <span style={{ color: '#ff4d4f' }}>❌ 不足（差 {sc.course_hours - sc.hours_approved} 学时）</span>
                    }
                  </td>
                  <td><span className={`badge ${statusMap[sc.status]?.cls}`}>{statusMap[sc.status]?.text}</span></td>
                  <td>
                    {sc.status === 'certified' ? (
                      <span className="badge badge-certified">已发证</span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleIssueCert(sc.id)}
                        disabled={!canIssue(sc)}
                        title={!canIssue(sc) ? '学时不足或考试未通过' : ''}
                      >
                        发放证书
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {studentCourses.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>暂无记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'certs' && (
        <div className="card">
          <h2>已发放证书</h2>
          <table className="table">
            <thead>
              <tr>
                <th>证书编号</th>
                <th>学员</th>
                <th>课程</th>
                <th>成绩</th>
                <th>发证日期</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace' }}>{c.cert_no}</td>
                  <td>{c.student_name}</td>
                  <td>{c.course_name}</td>
                  <td>{c.score} 分</td>
                  <td>{new Date(c.issued_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {certificates.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>暂无证书</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="grid-2">
          <div className="card">
            <h2>新建课程</h2>
            <form onSubmit={handleCreateCourse}>
              <div className="form-group">
                <label>课程名称</label>
                <input value={newCourse.name} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="请输入课程名称" />
              </div>
              <div className="form-group">
                <label>要求学时</label>
                <input type="number" value={newCourse.hours} onChange={e => setNewCourse({ ...newCourse, hours: e.target.value })} placeholder="请输入要求学时" />
              </div>
              <div className="form-group">
                <label>课程描述</label>
                <input value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} placeholder="请输入课程描述" />
              </div>
              <button type="submit" className="btn btn-primary">创建课程</button>
            </form>
          </div>
          <div className="card">
            <h2>课程列表</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>课程名称</th>
                  <th>要求学时</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.hours} 学时</td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: '#999' }}>暂无课程</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card">
          <h2>学员管理</h2>
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>用户名</th>
                <th>手机号</th>
                <th>邮箱</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.username}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.email || '-'}</td>
                  <td>{s.locked ? <span className="badge badge-certified">信息已锁定（已发证）</span> : '正常'}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>暂无学员</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
