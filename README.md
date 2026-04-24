# MiniMax Proxy

MiniMax Token Plan 的轻量级 API 代理，支持用量追踪、限流和密钥管理。

## 功能特性

- API 密钥管理（创建、删除、启用/禁用）
- 用户管理（仅管理员）
- 用量追踪（按密钥/用户统计）
- 限流（RPM 每用户）
- 密钥过期时间设置
- 请求日志记录
- 简易管理后台
- 中英文界面切换

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
4. 选择用户并设置过期时间（可选）
5. **复制生成的密钥（只显示一次！）**

### 使用代理

通过代理发送请求：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk_minimax_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "abab5.5-chat",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 管理员登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/admin/users` | 获取所有用户（管理员） |
| POST | `/api/admin/users` | 创建用户（管理员） |
| PUT | `/api/admin/users/:id` | 更新用户（管理员） |
| DELETE | `/api/admin/users/:id` | 删除用户（管理员） |
| GET | `/api/keys` | 获取密钥列表 |
| POST | `/api/keys` | 创建密钥 |
| DELETE | `/api/keys/:id` | 删除密钥 |
| PUT | `/api/keys/:id/toggle` | 启用/禁用密钥 |
| GET | `/api/stats` | 获取用量统计 |
| GET | `/api/stats/logs` | 获取请求日志 |
| POST | `/v1/chat/completions` | 代理请求到 MiniMax |
| GET | `/health` | 健康检查 |

## 安全说明

- 密码使用 bcrypt 哈希存储
- API 密钥使用 SHA-256 哈希存储（数据库泄露也无法还原）
- MiniMax 主密钥使用 AES-256-GCM 加密存储
- 会话数据存储在 SQLite 中
- 生产环境建议启用 HTTPS

## 项目结构

```
minimax-router/
├── backend/
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── middleware/    # 认证、限流中间件
│   │   ├── services/      # MiniMax 代理服务
│   │   ├── models/        # 数据库
│   │   └── utils/         # 加密工具
│   ├── server.js
│   ├── init.sql
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/         # 管理页面
│   │   ├── components/     # UI 组件
│   │   ├── api/            # API 客户端
│   │   └── i18n/           # 中英文翻译
│   ├── nginx.conf
│   └── Dockerfile
├── data/                   # SQLite 数据库（运行时创建）
├── docker-compose.yml
└── .env.example
```

## 许可证

MIT
