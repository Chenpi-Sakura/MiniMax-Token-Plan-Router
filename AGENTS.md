# MiniMax Proxy - Agent 说明

## 项目概述

MiniMax Token Plan 的轻量级 API 代理，支持用户/密钥管理、用量追踪、限流和过期控制。后端 Node.js + Express，前端 React + Vite，SQLite 数据库，Docker 部署。

## 项目结构

```
minimax-router/
├── backend/              # Node.js Express API (端口 3000)
│   ├── server.js         # 主入口
│   ├── init.sql          # SQLite 表结构（启动时自动执行）
│   ├── src/routes/       # auth, users, keys, stats 路由
│   ├── src/middleware/   # 认证、限流中间件
│   ├── src/services/proxy.js  # MiniMax API 转发
│   ├── src/models/database.js  # SQLite 连接
│   └── src/utils/crypto.js     # AES-256-GCM 加密
├── frontend/             # React Vite 应用（nginx 端口 3001）
│   ├── src/pages/        # Login, Dashboard, Users, Keys, Logs
│   ├── src/components/Layout.jsx
│   └── nginx.conf        # /api 和 /v1 代理到后端
├── data/                  # SQLite 数据库（运行时创建）
├── docker-compose.yml
└── .env.example
```

## 开发命令

```bash
# 后端
cd backend && npm install
npm run dev          # nodemon 热重载

# 前端
cd frontend && npm install
npm run dev          # Vite 开发服务器 :3001，代理 /api 到 :3000
npm run build        # 生产构建到 dist/
```

## Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose up -d --build
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `SESSION_SECRET` | 是 | 会话加密密钥（32+ 字符） |
| `ADMIN_PASSWORD` | 是 | 初始管理员密码（登录后立即修改） |
| `MINIMAX_API_KEY` | 是 | MiniMax API 密钥（或使用 `ENCRYPTED_MINIMAX_KEY`） |
| `MASTER_KEY` | 是 | 加密存储 MiniMax 密钥的密钥（32+ 字符） |
| `ENCRYPTED_MINIMAX_KEY` | 否 | AES-256-GCM 加密格式（前缀 `enc:`） |
| `MINIMAX_API_URL` | 否 | 默认：`https://api.minimax.chat` |

## 密钥安全设计

- **用户密码**：bcrypt 哈希（cost factor 10）
- **API 密钥**：SHA-256 哈希存储（仅保存前缀用于显示）
- **MiniMax 主密钥**：AES-256-GCM 加密，运行时解密
- **API 密钥格式**：`sk_minimax_` + 32 位十六进制字符

## 代理接口

```
POST /v1/chat/completions
Authorization: Bearer sk_minimax_xxx
Content-Type: application/json

{"model": "abab5.5-chat", "messages": [...]}
```

转发到 MiniMax 非标准端点：`/v1/text/chatcompletion_v2`

## 用户与密钥管理流程

1. **创建用户**：管理员在用户管理页面创建用户（用户名/密码/是否管理员），不涉及用量限制
2. **创建 API Key**：管理员在密钥管理页面为指定用户创建密钥，可选设置：
   - 调用上限（`quota_limit`）：该密钥最多允许的调用次数
   - 过期时间（`expires_at`）：该密钥的有效截止日期
   - 两者可独立设置，也可同时设置
3. **Key 级别限制**：每个 API Key 独立管理自己的 `quota_used`（已用次数）、`quota_limit`（上限）和 `expires_at`（过期时间）

## 默认账号

- 用户名：`admin`
- 密码：`admin123`（首次登录后立即修改）

## 数据库

- SQLite 存储在 `data/proxy.db`
- 首次启动时通过 `init.sql` 自动创建
- 会话存储在 `data/sessions.db`

### api_keys 表关键字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `quota_used` | INTEGER | 已调用次数 |
| `quota_limit` | INTEGER | 调用上限（NULL 表示不限制） |
| `expires_at` | DATETIME | 过期时间（NULL 表示永不过期） |

## 重要注意事项

1. **密钥显示**：新密钥创建时只显示一次，无法找回
2. **MiniMax API 格式**：非标准 OpenAI 格式，代理进行转换
3. **限流**：内存存储，重启重置，非分布式
4. **额度追踪**：按请求次数计，非 token 数
5. **密钥级别限制**：调用上限（`quota_limit`）和过期时间（`expires_at`）均在密钥级别管理，用户创建时无需设置限制