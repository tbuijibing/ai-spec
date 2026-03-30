# douhua-spec-plugin

Paperclip 插件，将 DocSpec 文档权限系统集成到 Paperclip AI 代理平台。

## 功能

- **接入向导**：在 Paperclip 侧边栏点击 "新建项目接入"，填表自动完成老项目接入
- **4 个 AI 工具**：`spec.list` / `spec.read` / `spec.draft` / `spec.search`
- **自动文档起草**：监听 `issues.created` 事件，注入相关文档引用
- **MR 自动创建**：Agent 起草文档时自动创建 GitLab MR，等待人工 Review

## 安装

```bash
# 1. 在 Paperclip 管理页面安装插件
# Settings → Plugins → Install → Local Path → D:/GitHub/Douhua/douhua-spec-plugin

# 2. 配置插件参数（Settings → Plugins → douhua-spec → Configure）
docspecServerUrl   = http://localhost:4000
docspecAdminToken  = <admin 角色 JWT>
gitlabUrl          = https://gitlab.example.com        （可选）
gitlabToken        = <GitLab Personal Access Token>    （可选）
specRepoId         = your-group/douhua-spec            （可选）
```

## AI 工具用法（Agent 调用）

### spec.list — 列出可访问文档

```json
{ "prefix": "02-modules/SPEC-201" }
```

### spec.read — 读取文档

```json
{ "path": "02-modules/SPEC-201/README.md", "token": "<role-jwt>" }
```

### spec.draft — 起草文档并创建 MR

```json
{
  "path": "02-modules/SPEC-201/backend/B4-接口清单.md",
  "content": "# 接口清单\n...",
  "agentName": "Android Agent",
  "assignees": ["zhangsan", "admin"]
}
```

返回：`{ "mrUrl": "https://gitlab.../merge_requests/42", "mrIid": 42 }`

### spec.search — 搜索文档

```json
{ "query": "登录接口", "token": "<role-jwt>" }
```

## GitLab Webhook 配置

在各端仓库（frontend / android / ios / backend）的 GitLab 项目设置中添加 Webhook：

| 字段 | 值 |
|------|-----|
| URL | `http://<paperclip-host>/api/webhooks/gitlab` |
| Secret Token | `<webhook-secret>` |
| Triggers | Push events ✅ + Merge request events ✅ |

配置完成后，工程师 push 代码时，Paperclip 对应 Agent 会自动唤醒并分析 diff，触发文档起草流程。

## 目录结构

```
douhua-spec-plugin/
├── manifest.json      插件声明（capabilities、launchers、tools、config）
├── src/
│   └── worker.ts      Worker 逻辑（tools、actions、event handlers）
├── package.json
└── tsconfig.json
```

## 依赖关系

```
Paperclip Launcher UI
    └── init-project action
            └── docspec-server /api/onboard/init
                    └── douhua-spec 仓库（本地 spec 目录）

Paperclip Agent (push event)
    └── spec.draft tool
            └── docspec-server /api/docs/:path (createMR=true)
                    └── GitLab API (创建 branch + commit + MR)
```
