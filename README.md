# docspec-server

文档权限网关 — 按角色过滤 `douhua-spec` 仓库的文档访问，支持 JWT 认证、GitLab MR 自动创建和项目接入向导。

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env
# 编辑 .env，填入真实路径和密钥

# 3. 启动开发服务
npm run dev
# → http://localhost:4000
```

## 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `PORT` | 服务端口 | `4000` |
| `JWT_SECRET` | JWT 签发密钥 | 随机强字符串 |
| `SPEC_REPO_PATH` | douhua-spec 仓库绝对路径 | `D:/GitHub/Douhua/douhua-spec` |
| `PERMISSIONS_FILE` | 权限配置文件（相对仓库根） | `.spec-permissions.yaml` |
| `TOKEN_ISSUE_SECRET` | `/api/auth/token` 签发密钥 | 随机强字符串 |
| `GITLAB_URL` | GitLab 实例地址 | `https://gitlab.example.com` |
| `GITLAB_TOKEN` | GitLab Personal Access Token（api scope） | `glpat-xxx` |
| `GITLAB_SPEC_REPO_ID` | douhua-spec 仓库的 GitLab 项目 ID 或路径 | `douhua/douhua-spec` |
| `LOG_LEVEL` | 日志级别 | `info` |

## API 一览

### 无需认证

```
GET  /api/health                    健康检查
```

### 签发 Token（开发/CI 用）

```
POST /api/auth/token
Body: { sub: string, role: string, secret: string }
返回: { token, sub, role, expiresIn }
```

角色列表见 `douhua-spec/.spec-permissions.yaml`。

### 文档操作（需 Bearer Token）

```
GET  /api/docs?prefix=02-modules    列出角色可访问的文件
GET  /api/docs/:path                读取单个文件
PUT  /api/docs/:path                直接写文件（需写权限，用于 AUTO 区域更新）
PUT  /api/docs/:path/mr             写文件并创建 GitLab MR（用于手写文档变更）
```

### 角色查询（需 Bearer Token）

```
GET  /api/roles                     列出所有角色（admin 可见全部，其他只见自己）
GET  /api/roles/:role/paths         查询角色的 glob 权限列表
```

### 接入向导（无需认证）

```
GET  /onboard                       打开接入向导 Web UI
POST /api/onboard/init              初始化项目（创建目录 + 生成配置）
GET  /api/onboard/projects          列出已接入的项目
```

## 权限模型

权限由 `SPEC_REPO_PATH/.spec-permissions.yaml` 驱动，支持：
- **glob 路径匹配**（基于 `micromatch`）
- **读/写分离**（`write: true` 字段）
- **special_rules**（敏感文件、部署信息特殊规则）

文件更新时权限配置自动热重载（mtime 缓存）。

## 两种写入模式

| 模式 | 接口 | 适用场景 |
|------|------|---------|
| **直写 main** | `PUT /api/docs/:path` | AUTO 区域（CI 自动更新部署信息） |
| **创建 MR** | `PUT /api/docs/:path/mr` | 手写文档（AI Agent 起草，需人工 Review） |

## 目录结构

```
src/
├── config.ts          环境变量
├── auth.ts            JWT 中间件
├── permissions.ts     权限引擎（解析 YAML + glob 匹配）
├── gitfs.ts           本地文件读写（路径遍历防护）
├── gitlab.ts          GitLab API 封装（branch/commit/MR）
└── routes/
    ├── health.ts
    ├── auth.ts        Token 签发
    ├── docs.ts        文档读写
    ├── roles.ts       角色查询
    └── onboard.ts     接入向导 API
public/
└── onboard/           接入向导 Web UI
```
