# AI-Spec OPC Plugin

AI-Spec 文档权限系统 OPC 插件 - 将 douhua-spec 文档仓库集成到 JiGongOpc (OPC) AI 员工管理平台。

## 功能特性

### Tools

| Tool | 描述 | 状态 |
|------|------|------|
| `spec.list` | 列出角色可访问的文档 | ✅ 支持角色参数 |
| `spec.read` | 读取文档内容 | ✅ 支持角色参数 |
| `spec.draft` | 起草文档变更并创建 GitLab MR | ✅ 支持章节标记 |
| `spec.search` | 搜索文档关键词 | ✅ 支持角色参数 |
| `spec.update-auto` | CI/CD 自动更新 AUTO 区域 | ✅ 直写 main |
| `spec.get-template` | 获取规范模板 | 🆕 规范模板系统 |
| `spec.save-memory` | 保存经验到长期记忆 | 🆕 记忆系统 |
| `spec.load-memory` | 加载相关记忆 | 🆕 记忆系统 |
| `spec.list-memories` | 列出记忆分类 | 🆕 记忆系统 |

### Actions

| Action | 描述 |
|--------|------|
| `init-project` | 初始化项目（创建 OPC 公司 + Agent + 文档目录） |
| `list-projects` | 列出已接入的项目 |
| `spec-draft` | AI Agent 起草文档并创建 GitLab MR |

### Events

| Event | 触发时机 | 响应 |
|-------|---------|------|
| `issues.created` | 创建 Issue 时 | 自动注入相关文档引用 |
| `issues.completed` | Issue 完成时 | 检查文档是否需要更新 |
| `issues.assigned` | Issue 分配给 Agent 时 | 🆕 自动加载规范模板和相关记忆 |
| `agent.hired` | 招聘 Agent 时 | 在 docspec-server 注册 Agent |
| `company.created` | 创建公司时 | 初始化文档权限配置 |

## 安装

### 1. 构建插件

```bash
cd ai-spec-opc-plugin
npm install
npm run build
```

### 2. 在 OPC 系统中安装

通过 OPC 插件管理界面或 API 安装：

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/plugins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "AI-Spec 文档权限系统",
    "slug": "ai-spec-docs",
    "version": "1.1.0",
    "manifest": { ... }
  }'
```

### 3. 配置插件

在 OPC 插件管理界面配置以下参数：

| 配置项 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `docspecServerUrl` | string | 是 | docspec-server 地址 | `http://localhost:4000` |
| `docspecAdminToken` | secret | 是 | 管理员 Token | `eyJhbGc...` |

## 使用示例

### 使用 Tool: spec.list

```typescript
// 列出所有可访问的文档
const result = await tools.call("spec.list", {});
// 返回：{ role: "developer", count: 10, files: [...] }

// 列出指定目录的文档（带角色过滤）
const result = await tools.call("spec.list", { prefix: "02-modules", role: "frontend" });
```

### 使用 Tool: spec.read

```typescript
// 读取文档内容
const result = await tools.call("spec.read", {
  path: "SPEC-001-项目总规.md"
});
// 返回：{ path: "...", content: "...", write: true }

// 带角色过滤读取
const result = await tools.call("spec.read", {
  path: "SPEC-001-项目总规.md",
  role: "frontend"
});
```

### 使用 Tool: spec.draft（支持章节标记）

```typescript
// 起草文档变更并创建 MR
const result = await tools.call("spec.draft", {
  path: "SPEC-001-项目总规.md",
  content: "# 更新后的内容",
  agentName: "CTO Agent",
  assignees: ["zhangsan", "lisi"]
});
// 返回：{ ok: true, mode: "mr", mrUrl: "https://gitlab/.../merge_requests/1" }

// 使用章节标记（AUTO 区域）
const result = await tools.call("spec.draft", {
  path: "03-api-docs/SPEC-201-api.md",
  content: "## API 列表\n...",
  agentName: "Backend Agent",
  autoSection: {
    source: "swagger",
    startMarker: "<!-- DOCSPEC:AUTO:START source=\"swagger\" -->",
    endMarker: "<!-- DOCSPEC:AUTO:END -->"
  }
});
```

### 使用 Tool: spec.update-auto

```typescript
// CI/CD 自动更新 AUTO 区域（直写 main，无需 MR）
const result = await tools.call("spec.update-auto", {
  path: "test/T0-部署信息.md",
  content: "## Android APK\n- 版本：v1.2.3\n- 下载：http://...",
  source: "ci/android",
  role: "backend"
});
// 返回：{ ok: true, mode: "direct", commitSha: "abc123" }
```

### 使用 Tool: spec.get-template（规范模板系统）

```typescript
// 获取开发规范模板
const result = await tools.call("spec.get-template", {
  templateType: "dev-spec"
});
// 返回：{ templateType: "dev-spec", content: "## 开发规范\n\n### 1. 代码风格..." }

// 获取 API 设计规范模板
const result = await tools.call("spec.get-template", {
  templateType: "api-design"
});
```

### 使用 Tool: spec.save-memory（长期记忆存储）

```typescript
// 保存架构决策到长期记忆
const result = await tools.call("spec.save-memory", {
  memoryType: "architecture",
  title: "使用 Redis 缓存热点数据",
  content: "## 背景\n...\n## 决策\n...\n## 效果\n...",
  tags: ["redis", "cache", "performance"],
  relatedIssueId: "ISSUE-123",
  relatedModuleId: "module-001"
});
// 返回：{ ok: true, memoryPath: "01-architecture-decisions/2026-03-30-redis-cache.md", mrUrl: "..." }

// 保存经验教训
const result = await tools.call("spec.save-memory", {
  memoryType: "lesson-learned",
  title: "数据库连接池配置不当导致性能问题",
  content: "## 问题描述\n...\n## 根因分析\n...\n## 解决方案\n...",
  tags: ["database", "performance", "connection-pool"]
});
```

### 使用 Tool: spec.load-memory（加载相关记忆）

```typescript
// 搜索与性能相关的记忆
const result = await tools.call("spec.load-memory", {
  query: "性能优化 缓存",
  limit: 5
});
// 返回：{ memories: [{ path: "...", title: "...", excerpt: "..." }, ...] }

// 按类型过滤记忆
const result = await tools.call("spec.load-memory", {
  query: "数据库",
  memoryType: "troubleshooting",
  limit: 3
});
```

### 使用 Tool: spec.list-memories（查看记忆分类）

```typescript
// 列出所有记忆分类和数量
const result = await tools.call("spec.list-memories", {});
// 返回：{
//   categories: [
//     { type: "architecture", count: 5, path: "01-architecture-decisions" },
//     { type: "lesson-learned", count: 12, path: "02-lessons-learned" },
//     { type: "best-practice", count: 8, path: "03-best-practices" },
//     { type: "troubleshooting", count: 15, path: "04-troubleshooting" }
//   ]
// }
```

### 事件：issues.assigned（自动加载规范）

当 Issue 分配给 Agent 时，插件自动：

1. 分析 Issue 类型和标签
2. 确定需要的规范模板（如 feature 需要 api-design，bug 需要 troubleshooting）
3. 搜索相关记忆（基于 Issue 标题关键词）
4. 更新 Issue 描述，添加模板和记忆引用

```typescript
// 示例：Issue 分配给 Agent 后，描述自动添加
// ## 相关规范
// - [开发规范](00-conventions/01-开发规范.md)
// - [API 设计规范](00-conventions/08-API 设计规范.md)
//
// ## 相关记忆
// - [使用 Redis 缓存热点数据](01-architecture-decisions/2026-03-30-redis-cache.md)
// - [数据库连接池配置不当导致性能问题](02-lessons-learned/db-connection-pool.md)
```

### 使用 Action: init-project

```typescript
// 初始化新项目接入
const result = await actions.call("init-project", {
  projectName: "我的项目",
  moduleId: "module-001",
  gitlabUrl: "https://gitlab.example.com",
  specRepo: "myorg/my-spec",
  repos: [{ name: "frontend", url: "https://..." }],
  members: [
    { name: "张三", role: "CEO", gitlabUser: "zhangsan" },
    { name: "李四", role: "CTO", gitlabUser: "lisi" }
  ]
});
// 返回：{ ok: true, companyId: "...", agentCount: 2, createdDirs: [...], nextSteps: [...] }
```

## 项目结构

```
ai-spec-opc-plugin/
├── manifest.json          # 插件清单
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── .env.example           # 环境变量模板
├── README.md              # 本文档
└── src/
    └── worker.ts          # 插件入口
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 清理

```bash
npm run clean
```

## 依赖

- **TypeScript** ^5.7.3
- **OPC 插件系统** - JiGongOpc 插件运行时
- **docspec-server** - 文档权限网关服务

## 权限说明

插件需要以下 OPC 权限：

- `companies:read/create` - 读取/创建公司
- `agents:read/create` - 读取/创建 Agent
- `issues:read/update` - 读取/更新 Issue
- `events:subscribe` - 订阅系统事件
- `http:external` - 调用外部 HTTP API

## 安全

1. **Token 加密**: `docspecAdminToken` 在 OPC 数据库中加密存储
2. **公司隔离**: 所有操作都通过 OPC 的公司访问检查
3. **权限验证**: 调用 docspec-server 时使用 JWT Token 验证
4. **审计日志**: 所有文档操作记录到 OPC 活动日志

## 记忆系统设计

### 长期记忆 vs 短期记忆

| 特性 | 长期记忆 | 短期记忆 |
|------|---------|---------|
| 存储位置 | douhua-spec 文档仓库 | OPC Issue/Agent 状态 |
| 生命周期 | 永久保存，随项目积累 | 任务完成后清除 |
| 内容类型 | 架构决策、经验教训、最佳实践 | 当前任务上下文、临时决策 |
| 访问方式 | `spec.save-memory` / `spec.load-memory` | OPC Issue/Agent API |
| 目录结构 | `01-architecture-decisions/`, `02-lessons-learned/` 等 | OPC 数据库 |

### 记忆分类

| 类型 | 目录 | 说明 |
|------|------|------|
| `architecture` | `01-architecture-decisions/` | 架构决策记录（ADR） |
| `lesson-learned` | `02-lessons-learned/` | 经验教训、踩坑记录 |
| `best-practice` | `03-best-practices/` | 最佳实践、推荐做法 |
| `troubleshooting` | `04-troubleshooting/` | 故障排查手册 |

### 规范模板类型

| 类型 | 文件路径 | 说明 |
|------|---------|------|
| `dev-spec` | `00-conventions/01-开发规范.md` | 开发规范模板 |
| `code-review` | `00-conventions/02-代码审查规范.md` | 代码审查清单 |
| `doc-writing` | `00-conventions/03-文档编写规范.md` | 文档编写指南 |
| `test-spec` | `00-conventions/04-测试规范.md` | 测试规范模板 |
| `git-flow` | `00-conventions/05-Git 工作流规范.md` | Git 工作流规范 |
| `api-design` | `00-conventions/08-API 设计规范.md` | API 设计规范 |

### 记忆文档格式

```markdown
---
type: architecture
title: 使用 Redis 缓存热点数据
date: 2026-03-30T10:00:00Z
tags: [redis, cache, performance]
relatedIssue: ISSUE-123
relatedModule: module-001
---

## 背景
描述问题的上下文和原因

## 决策
详细说明架构决策内容

## 效果
实施后的效果和数据

## 参考
相关链接和文档
```

## 章节标记设计

根据 docspec-system.md 规范，AUTO 区域使用 HTML 注释标记：

```markdown
<!-- DOCSPEC:AUTO:START source="swagger" updated="2026-03-30T22:00:00Z" -->
## API 清单
...（自动生成，每次 CI 覆盖此区域）
<!-- DOCSPEC:AUTO:END -->

## 补充说明
...（手写区，CI 不会修改）
```

### 支持的 source 类型

| source | 说明 | 触发来源 |
|--------|------|---------|
| `swagger` | Swagger API 文档 | 后端代码 push |
| `vue-router` | Vue 路由配置 | 前端路由文件变更 |
| `android-manifest` | Android 导航配置 | Android 代码 push |
| `ios-swiftui` | iOS 导航配置 | iOS 代码 push |
| `ci/android` | Android CI 构建信息 | Android CI 成功 |
| `ci/ios` | iOS CI 构建信息 | iOS CI 成功 |
| `ci/backend` | 后端 CI 构建信息 | 后端 CI 成功 |

## 故障排除

### 问题：插件安装后无法调用 Tools

**解决方案**:
1. 检查插件状态是否为 `active`
2. 检查 `docspecServerUrl` 和 `docspecAdminToken` 配置
3. 查看 OPC 插件日志

### 问题：spec.list 返回空列表

**解决方案**:
1. 确认 docspec-server 正常运行
2. 检查 JWT Token 是否有效
3. 确认角色权限配置正确

### 问题：spec.update-auto 失败

**解决方案**:
1. 确认 docspec-server 支持 AUTO 区域更新
2. 检查 source 参数是否合法
3. 确认调用者角色有写权限

## 版本历史

### v1.2.0（记忆与模板系统）

- 🆕 新增 `spec.get-template` Tool（规范模板系统）
- 🆕 新增 `spec.save-memory` Tool（长期记忆存储）
- 🆕 新增 `spec.load-memory` Tool（记忆检索）
- 🆕 新增 `spec.list-memories` Tool（记忆分类浏览）
- 🆕 新增 `issues.assigned` 事件处理（自动加载规范和记忆）
- ✅ 增强 AI 自动了解项目能力
- ✅ 增强 Agent 按规范工作能力

### v1.1.0（增强版）

- 🆕 新增 `spec.update-auto` Tool（CI/CD 自动更新）
- ✅ 增强 `spec.draft` 支持章节标记（AUTO 区域）
- ✅ 增强所有 Tools 支持 `role` 参数（角色感知）
- ✅ 新增 `issues.completed` 事件处理

### v1.0.0

- 初始版本
- 支持 Tools: spec.list, spec.read, spec.draft, spec.search
- 支持 Actions: init-project, list-projects, spec-draft
- 支持 Events: issues.created, agent.hired, company.created

## 许可证

MIT License
