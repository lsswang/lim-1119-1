import { useState, useEffect } from 'react'
import { studentCourseAPI, userAPI, examAPI } from '../api.js'

const statusMap = {
  learning: { text: '学习中', cls: 'badge-learning' },
  hours_approved: { text: '学时已审核', cls: 'badge-hours_approved' },
  exam_passed: { text: '考试通过', cls: 'badge-exam_passed' },
  exam_failed: { text: '考试未通过', cls: 'badge-exam_failed' },
  certified: { text: '已发证', cls: 'badge-certified' }
}

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState('hours')
  const [studentCourses, setStudentCourses] = useState([])
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState({})
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'hours') {
        setStudentCourses(await studentCourseAPI.list())
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
    setTimeout(() => setMessage(''), 3000)
  }

  const handleUpdateHours = async (scId, currentHours) => {
    const hoursStr = prompt('请输入完成学时：', currentHours || 0)
    if (hoursStr === null) return
    const hours = parseInt(hoursStr)
    if (isNaN(hours) || hours < 0) {
      showMsg('请输入有效的学时数', 'error')
      return
    }
    try {
      await studentCourseAPI.updateHours(scId, { hours_completed: hours })
      showMsg('学时更新成功！', 'success')
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '更新失败', 'error')
    }
  }

  const handleApproveHours = async (scId) => {
    if (!confirm('确认审核通过该学员的学时？')) return
    try {
      await studentCourseAPI.approveHours(scId)
      showMsg('学时审核通过！', 'success')
      loadData()
    } catch (err) {
      showMsg(err.response?.data?.error || '审核失败', 'error')
    }
  }

  const viewExams = async (scId) => {
    try {
      const data = await examAPI.listByStudentCourse(scId)
      setExams({ ...exams, [scId]: data })
    } catch (err) {
      showMsg(err.response?.data?.error || '加载失败', 'error')
    }
  }

  return (
    <div>
      {message && <div className={`alert alert-${messageType}`}>{message}</div>}
      <div className="tabs">
        <div className={`tab ${activeTab === 'hours' ? 'active' : ''}`} onClick={() => setActiveTab('hours')}>学时审核</div>
        <div className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>学员列表</div>
      </div>

      {activeTab === 'hours' && (
        <div className="card">
          <h2>学员学习记录</h2>
          <table className="table">
            <thead>
              <tr>
                <th>学员</th>
                <th>课程</th>
                <th>要求学时</th>
                <th>完成学时</th>
                <th>已审核学时</th>
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
                  <td>{sc.hours_completed}</td>
                  <td style={{ color: sc.hours_approved >= sc.course_hours ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
                    {sc.hours_approved}
                  </td>
                  <td><span className={`badge ${statusMap[sc.status]?.cls}`}>{statusMap[sc.status]?.text}</span></td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sc.status !== 'certified' && (
                      <>
                        <button className="btn btn-warning btn-sm" onClick={() => handleUpdateHours(sc.id, sc.hours_completed)}>录入学时</button>
                        {sc.hours_completed > 0 && sc.status === 'learning' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleApproveHours(sc.id)}>审核通过</button>
                        )}
                      </>
                    )}
                    <button className="btn btn-default btn-sm" onClick={() => viewExams(sc.id)}>查看考试</button>
                  </td>
                </tr>
              ))}
              {studentCourses.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>暂无记录</td></tr>
              )}
            </tbody>
          </table>

          {Object.keys(exams).length > 0 && Object.entries(exams).map(([scId, examList]) => (
            examList.length > 0 && (
              <div key={scId} className="card" style={{ marginTop: 20, background: '#fafafa' }}>
                <h3>考试记录（学习记录ID：{scId}）</h3>
                <table className="table">
                  <thead>
                    <tr>
                      <th>第几次考试</th>
                      <th>成绩</th>
                      <th>是否通过</th>
                      <th>考试时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examList.map(e => (
                      <tr key={e.id}>
                        <td>第 {e.attempts} 次</td>
                        <td style={{ fontWeight: 600, color: e.passed ? '#52c41a' : '#ff4d4f' }}>{e.score} 分</td>
                        <td>{e.passed ? '✅ 通过' : '❌ 未通过'}</td>
                        <td>{new Date(e.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn btn-default btn-sm" onClick={() => {
                  const newExams = { ...exams }
                  delete newExams[scId]
                  setExams(newExams)
                }}>关闭</button>
              </div>
            )
          ))}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card">
          <h2>学员列表</h2>
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
