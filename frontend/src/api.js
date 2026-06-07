import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login: (data) => api.post('/login', data).then(r => r.data),
  getMe: () => api.get('/users/me').then(r => r.data),
  updateMe: (data) => api.put('/users/me', data).then(r => r.data)
}

export const courseAPI = {
  list: () => api.get('/courses').then(r => r.data),
  create: (data) => api.post('/courses', data).then(r => r.data)
}

export const studentCourseAPI = {
  enroll: (data) => api.post('/student-courses/enroll', data).then(r => r.data),
  mine: () => api.get('/student-courses/mine').then(r => r.data),
  list: () => api.get('/student-courses').then(r => r.data),
  updateHours: (id, data) => api.post(`/student-courses/${id}/update-hours`, data).then(r => r.data),
  approveHours: (id) => api.post(`/student-courses/${id}/approve-hours`).then(r => r.data)
}

export const examAPI = {
  submit: (data) => api.post('/exams/submit', data).then(r => r.data),
  listByStudentCourse: (id) => api.get(`/exams/student/${id}`).then(r => r.data)
}

export const certificateAPI = {
  issue: (data) => api.post('/certificates/issue', data).then(r => r.data),
  list: () => api.get('/certificates').then(r => r.data)
}

export const userAPI = {
  listStudents: () => api.get('/users/students').then(r => r.data)
}

export default api
