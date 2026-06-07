# 继续教育证书发放系统

## 项目简介
继续教育证书发放全栈 Web 应用，实现学员选课学习、教务审核学时、管理员发放证书的完整流程。

## 核心功能
- 🔐 **角色权限**：学员、教务、管理员三种角色
- 📚 **课程管理**：管理员创建课程，学员自主选课
- ⏱️ **学时审核**：教务录入并审核学员学时
- 📝 **考试补考**：考试未通过可参加补考
- 🎓 **证书发放**：学时达标+考试通过方可发证
- 🔒 **信息锁定**：证书发放后个人信息不可修改

## 技术栈
- **后端**：Node.js + Express + SQLite + JWT
- **前端**：React 18 + Vite + React Router
- **部署**：Docker + Nginx

## 快速启动

### 方式一：Docker 启动（推荐）
```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

访问地址：http://localhost:8080

### 方式二：本地开发启动
```bash
# 启动后端
cd backend
npm install
npm start

# 启动前端（新开终端）
cd frontend
npm install
npm run dev
```

访问地址：http://localhost:5173

## 测试账号
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 学员 | student1 | 123456 |
| 学员 | student2 | 123456 |
| 教务 | staff1 | 123456 |
| 管理员 | admin1 | 123456 |

## 业务流程
1. **学员端**：选修课程 → 等待教务审核学时 → 参加考试（未通过可补考）→ 查看证书
2. **教务端**：录入学员学时 → 审核通过学时 → 查看学员考试记录
3. **管理员端**：创建课程 → 审核发证（学时达标+考试通过）→ 证书管理

## 目录结构
```
├── backend/          # 后端服务
│   ├── server.js     # API 服务
│   ├── init-db.js    # 数据库初始化
│   ├── data/         # SQLite 数据库文件
│   └── Dockerfile
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── pages/    # 页面组件
│   │   ├── api.js    # API 封装
│   │   └── App.jsx
│   ├── nginx.conf    # Nginx 配置
│   └── Dockerfile
└── docker-compose.yml
```
