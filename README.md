# MiniMax Proxy

MiniMax Token Plan 的轻量级 API 代理，支持用户/密钥管理、用量追踪、限流和过期控制。

> 本项目由 [OpenCode](https://opencode.ai) 构建，AI 模型使用了 **MiniMax2.7** 和 **DeepSeek V4 Flash** 进行辅助生成。

## 功能特性

### 管理后台

- **仪表盘**：请求趋势堆叠条状图（成功/失败）、Top 用户横向条状图、关键指标卡片
- **请求趋势**：支持按 24 小时（小时级）/ 7 天（天级）/ 30 天（天级）查看，鼠标悬浮显示当日用户组成
- **用户管理**：创建/编辑/删除用户，管理员权限控制
- **密钥管理**：创建/删除/启用/禁用 API 密钥，设置调用上限和过期时间
- **请求日志**：查看所有 API 请求记录（用户、密钥前缀、模型、状态、IP、时间）
- 中英文界面切换

### 安全设计

- 用户密码 bcrypt 哈希存储
- API 密钥 SHA-256 哈希存储（数据库泄露也无法还原）
- MiniMax 主密钥 AES-256-GCM 加密存储
- 会话数据存储在 SQLite 中
- 限流及额度控制均在密钥级别管理

### 代理功能

- 标准 OpenAI 格式请求转发到 MiniMax 非标准接口
- RPM 限流（每用户）
- 密钥级别调用上限和过期时间控制

## 前置要求

- Docker 和 Docker Compose
- MiniMax API Key（从 [MiniMax 开放平台](https://platform.minimaxi.com/user-center/basic-information/interface-key) 获取）

## 快速开始

1. 进入项目目录并复制环境配置文件：

```bash
git clone https://gitcode.com/chenpi_1/MiniMax-Token-Plan-Router.git
cd MiniMax-Token-Plan-Router
cp .env.example .env
```

2. 编辑 `.env` 文件，填入配置：

```env
SESSION_SECRET=随机密钥（至少32字符）
ADMIN_PASSWORD=管理员密码
MINIMAX_API_KEY=你的MiniMax密钥
MASTER_KEY=加密密钥（至少32字符）
```

3. 生成 MASTER_KEY：

```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[BitConverter]::ToString($bytes) -replace '-',''
```

4. 启动服务：

```bash
docker-compose up -d
```

5. 访问管理后台 `http://localhost:3001`
   - 默认账号：`admin` / `admin123`
   - **首次登录后请立即修改密码！**

## 使用方法

### 创建 API 密钥

1. 登录管理后台
2. 进入"API Keys"页面
3. 点击"Create Key"
4. 选择用户（管理员）
5. 设置调用上限和/或过期时间（可选，可同时设置）
6. **复制生成的密钥（只显示一次！）**

### 使用代理

通过代理发送请求：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_minimax_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-M2.1",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## API 接口

| 方法   | 路径                     | 说明                   |
| ------ | ------------------------ | ---------------------- |
| POST   | `/api/auth/login`      | 管理员登录             |
| POST   | `/api/auth/logout`     | 登出                   |
| GET    | `/api/auth/me`         | 获取当前用户信息       |
| GET    | `/api/admin/users`     | 获取所有用户（管理员） |
| POST   | `/api/admin/users`     | 创建用户（管理员）     |
| PUT    | `/api/admin/users/:id` | 更新用户（管理员）     |
| DELETE | `/api/admin/users/:id` | 删除用户（管理员）     |
| GET    | `/api/keys`            | 获取密钥列表           |
| POST   | `/api/keys`            | 创建密钥               |
| DELETE | `/api/keys/:id`        | 删除密钥               |
| PUT    | `/api/keys/:id/toggle` | 启用/禁用密钥          |
| GET    | `/api/stats`           | 获取用量统计           |
| GET    | `/api/stats/logs`      | 获取请求日志           |
| POST   | `/v1/chat/completions` | 代理请求到 MiniMax     |
| GET    | `/health`              | 健康检查               |

## 项目结构

```
minimax-router/
├── backend/                   # Node.js Express API (端口 3000)
│   ├── server.js              # 主入口
│   ├── init.sql               # SQLite 表结构（启动时自动执行）
│   └── src/
│       ├── routes/            # auth, users, keys, stats 路由
│       ├── middleware/        # 认证、限流中间件
│       ├── services/
│       │   └── proxy.js       # MiniMax API 转发
│       ├── models/
│       │   └── database.js    # SQLite 连接
│       └── utils/
│           └── crypto.js       # AES-256-GCM 加密
├── frontend/                  # React Vite 应用（nginx 端口 3001）
│   ├── src/
│   │   ├── pages/             # Login, Dashboard, Users, Keys, Logs
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── api/               # API 客户端
│   │   └── i18n/              # 中英文翻译
│   └── nginx.conf             # /api 和 /v1 代理到后端
├── data/                      # SQLite 数据库（运行时创建）
├── docker-compose.yml
└── .env.example
```

## 许可证

MIT
