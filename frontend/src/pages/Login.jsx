import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api.js'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authAPI.login({ username, password })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      switch (res.user.role) {
        case 'student': navigate('/student'); break
        case 'staff': navigate('/staff'); break
        case 'admin': navigate('/admin'); break
      }
    } catch (err) {
      setError(err.response?.data?.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h2>📜 证书管理系统</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>用户名</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div style={{ marginTop: 20, fontSize: 12, color: '#999', textAlign: 'center' }}>
          <p>测试账号：</p>
          <p>学员：student1 / 123456</p>
          <p>教务：staff1 / 123456</p>
          <p>管理员：admin1 / 123456</p>
        </div>
      </div>
    </div>
  )
}
