# DocSpec 系统完整开发规划（Phase 2-4）

基于 Phase 1 已完成的权限配置，分三阶段构建文档权限网关、GitLab CI 自动化流水线和 Paperclip AI Agent 文档生成系统。

---

## 背景约束（已确认）

| 项目 | 决策 |
|------|------|
| Git 平台 | **GitLab**（各端独立仓库：frontend / android / ios / backend / douhua-spec） |
| 部署方式 | docspec-server 本地运行，直接读写 `D:/GitHub/Douhua/douhua-spec` 目录 |
| 手写文档更新 | **AI Agent 自动起草 → GitLab MR → 人工 Review → 合并** |
| AUTO 区域更新 | 各端 GitLab CI 打包完成后自动调用 docspec-server，**直推 main**（无需 MR） |

---

## 核心工作流全景

```
┌─────────── 代码变更 ──────────────┐    ┌───── 人工操作 ─────┐
│                                  │    │                    │
│  frontend-repo push              │    │  工程师在 Windsurf  │
│  android-repo push               │    │  或 IDE 里写代码    │
│  ios-repo      push              │    └────────────────────┘
│  backend-repo  push              │              │
└──────────────┬───────────────────┘              │
               │ GitLab CI Pipeline               │ Paperclip Agent
               │ (各端 .gitlab-ci.yml)            │ 监听代码变更
               ▼                                  ▼
    ┌─────────────────────┐           ┌──────────────────────┐
    │  AUTO 区域更新       │           │  手写文档起草         │
    │  (T0-部署信息等)     │           │  (接口说明/规范等)    │
    │  直接 push main     │           │  创建 MR 等待 Review  │
    └──────────┬──────────┘           └──────────┬───────────┘
               │                                  │
               ▼                                  ▼
    ┌──────────────────────────────────────────────────────┐
    │               docspec-server (:4000)                  │
    │  • 权限引擎（读 .spec-permissions.yaml）               │
    │  • JWT 认证（角色 token）                              │
    │  • GET/PUT /api/docs/*（按角色过滤）                   │
    │  • GitLab API 集成（创建 branch / MR）                 │
    └──────────────────────────┬───────────────────────────┘
                               │ 读写文件系统
                               ▼
                    douhua-spec 本地仓库
```

---

## Phase 2：docspec-server 补全

### 已完成（骨架 + 依赖已装 + 服务可启动）
`config` / `permissions` / `gitfs` / `auth` / `routes/health|auth|docs|roles` / `index.ts`

### 待补充（3 步）

**2-A：`.gitignore` + README**
- 排除 `node_modules/` `dist/` `.env`
- README 包含：快速启动、API 一览、环境变量说明

**2-B：GitLab API 集成（关键新增）**

在 `src/gitlab.ts` 中封装：
```
createBranch(repoId, branchName)   → 在 douhua-spec 仓库创建 branch
commitFile(branchName, path, content, message) → 提交文件变更
createMR(branchName, title, description, assigneeId) → 创建 MR 并指定 Reviewer
```
新增路由 `PUT /api/docs/*/mr`：写文档 + 自动创建 MR（供 Agent 调用）

**2-C：端到端验证脚本 `scripts/test-api.ps1`**
- 签发 `frontend` token → 能读 `frontend/**`，不能读 `android/**`
- 签发 `test` token → 只能读 `T0-部署信息.md`
- 签发 `admin` token → 能读写全部

---

## Phase 3：各端 GitLab CI 集成

**目标**：各端仓库 CI 打包完成后，自动更新 `douhua-spec` 的 AUTO 区域。

### 3.1 通用脚本（放在 douhua-spec 仓库）
- 位置：`douhua-spec/.gitlab/scripts/sync-deploy-info.sh`
- 接收参数：`--role android --version 2.1.0 --apk-url https://...`
- 调用 `docspec-server PUT /api/docs/*/auto`（直接写 main，无 MR）

### 3.2 各端 `.gitlab-ci.yml` 片段（示例：android-repo）
```yaml
sync-docs:
  stage: post-deploy
  script:
    - curl -X PUT $DOCSPEC_SERVER_URL/api/docs/.../T0.md/auto
        -H "Authorization: Bearer $DOCSPEC_TOKEN_ANDROID"
        -d '{"source":"android-ci","version":"$VERSION","apkUrl":"$APK_URL"}'
  only:
    - main
```

### 3.3 GitLab CI 触发 MR 文档起草
- 代码 push 后触发 Paperclip Agent（通过 GitLab webhook → Paperclip API）
- Agent 分析 diff，调用 `PUT /api/docs/*/mr` 起草文档并创建 MR

---

## Phase 4：Paperclip douhua-spec 插件

**目标**：Agent 执行开发任务时，自动读取权限内文档；代码变更后自动起草文档更新 MR。

### 插件位置
`d:\GitHub\Douhua\douhua-spec-plugin\`

### 工具注册

| 工具 | 调用方 | 权限 |
|------|--------|------|
| `spec.list` | 任意 Agent | 列出自己角色可访问的文档 |
| `spec.read(path)` | 任意 Agent | 按角色过滤，403 有明确提示 |
| `spec.draft(path, content)` | 任意 Agent | 创建 MR，触发人工 Review |
| `spec.search(keyword)` | 任意 Agent | 在权限内全文搜索 |

### 事件钩子
- `issue.created` / `issue.assigned` → 自动在任务评论注入相关规范文档目录
- `issue.completed` → 提示 Agent 检查文档是否需要更新

### GitLab Webhook → Paperclip 联动
```
GitLab push event
  → douhua-spec-plugin onWebhook
  → 分析 diff（哪些接口/路由变了）
  → Agent 起草文档
  → 调用 spec.draft → docspec-server 创建 MR
  → GitLab 通知对应角色 Review
```

---

## 执行顺序

```
[当前] Phase 2-A → 2-B（GitLab API）→ 2-C（验证）
         → Phase 3.1 → 3.2 示例 → 3.3
         → Phase 4
```

## 关键约束

- docspec-server **写 main** 仅限 AUTO 区域；手写区域改动**必须走 MR**
- GitLab token 配置在 `GITLAB_TOKEN` 环境变量，不提交代码
- 各端 CI 使用各自角色的 JWT（`DOCSPEC_TOKEN_ANDROID` 等），最小权限原则
