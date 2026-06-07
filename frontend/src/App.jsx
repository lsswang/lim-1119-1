import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

function PrivateRoute({ children, allowedRoles }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (!user) return <Navigate to="/login" />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />
  return children
}

function Layout({ children }) {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  const location = useLocation()

  const roleMap = { student: '学员', staff: '教务', admin: '管理员' }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (location.pathname === '/login') return children

  return (
    <div>
      <div className="header">
        <h1>📜 继续教育证书管理系统</h1>
        <div className="header-right">
          <span className="role-tag">{roleMap[user?.role]}：{user?.name}</span>
          <button className="btn btn-default" onClick={handleLogout}>退出登录</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  )
}

function App() {
  const [init, setInit] = useState(false)

  useEffect(() => {
    setInit(true)
  }, [])

  if (!init) return null

  const user = JSON.parse(localStorage.getItem('user') || 'null')

  const getHomePath = () => {
    if (!user) return '/login'
    switch (user.role) {
      case 'student': return '/student'
      case 'staff': return '/staff'
      case 'admin': return '/admin'
      default: return '/login'
    }
  }

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={
          <PrivateRoute allowedRoles={['student']}><StudentDashboard /></PrivateRoute>
        } />
        <Route path="/staff" element={
          <PrivateRoute allowedRoles={['staff', 'admin']}><StaffDashboard /></PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute allowedRoles={['admin']}><AdminDashboard /></PrivateRoute>
        } />
        <Route path="/" element={<Navigate to={getHomePath()} />} />
      </Routes>
    </Layout>
  )
}

export default App
