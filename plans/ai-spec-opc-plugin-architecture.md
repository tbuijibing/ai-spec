# AI-Spec 作为 OPC 插件的集成架构

## 1. 概述

本文档描述如何将 ai-spec（DocSpec 文档权限系统）作为插件集成到 OPC（JiGongOpc AI 员工管理平台）系统中。

## 2. 系统对比

| 特性 | ai-spec (DocSpec) | OPC (JiGongOpc) |
|------|------------------|-----------------|
| 定位 | 文档权限网关 | AI 员工管理平台 |
| 核心功能 | 文档权限、GitLab MR、项目接入 | 公司/Agent/任务管理、审批、预算 |
| 插件格式 | Paperclip 插件 SDK | 自有插件系统 |
| 数据模型 | 本地文件系统 | PostgreSQL + Drizzle ORM |
| 认证 | JWT Token | Better Auth + API Keys |

## 3. 架构设计

### 3.1 组件关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        OPC 系统                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  OPC UI     │  │  OPC API    │  │  OPC 插件系统            │  │
│  │  (React)    │──│  (Express)  │──│  - plugins 表           │  │
│  └─────────────┘  └─────────────┘  │  - plugin_config 表     │  │
│                                     │  - plugin_state 表      │  │
│                                     │  - plugin_entities 表   │  │
│                                     └───────────┬─────────────┘  │
└─────────────────────────────────────────────────┼────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ai-spec OPC 插件                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Plugin Worker (setup 入口)                              │    │
│  │  ├── Tools API (spec.list/spec.read/spec.draft/search)  │    │
│  │  ├── Actions API (init-project/list-projects)           │    │
│  │  └── Events Handler (issues.created/agent.hired)        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    docspec-server 服务                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │  JWT Auth   │  │  权限引擎               │  │
│  │  /api/docs  │  │  /api/auth  │  │  .spec-permissions.yaml │  │
│  │  /api/onboard          │  │  │  glob 路径匹配            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │  Git 文件系统  │  │  GitLab 集成 │                               │
│  │  读/写/搜索    │  │  MR 创建     │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 插件 Manifest

```json
{
  "pluginId": "ai-spec-docs",
  "displayName": "AI-Spec 文档权限系统",
  "description": "集成 douhua-spec 文档仓库，提供角色权限管理、AI 文档起草和项目接入向导",
  "version": "1.0.0",
  "capabilities": [
    "companies:read",
    "companies:create",
    "agents:read",
    "agents:create",
    "issues:read",
    "issues:comment",
    "events:subscribe",
    "http:external"
  ],
  "launchers": [
    {
      "key": "onboard",
      "displayName": "新建项目接入",
      "description": "将老项目接入 DocSpec AI 开发系统",
      "icon": "📋"
    }
  ],
  "actions": [
    {"key": "init-project", "description": "初始化项目（创建 Paperclip 公司 + Agent + 文档目录）"},
    {"key": "list-projects", "description": "列出已接入的项目"},
    {"key": "spec-draft", "description": "AI Agent 起草文档并创建 GitLab MR"}
  ],
  "tools": [
    {
      "key": "spec.list",
      "description": "列出当前角色可访问的文档",
      "inputSchema": {
        "type": "object",
        "properties": {
          "prefix": {"type": "string", "description": "目录前缀过滤"}
        }
      }
    },
    {
      "key": "spec.read",
      "description": "读取指定文档内容",
      "inputSchema": {
        "type": "object",
        "required": ["path"],
        "properties": {
          "path": {"type": "string", "description": "文档路径"}
        }
      }
    },
    {
      "key": "spec.draft",
      "description": "起草文档变更并创建 GitLab MR",
      "inputSchema": {
        "type": "object",
        "required": ["path", "content"],
        "properties": {
          "path": {"type": "string", "description": "文档路径"},
          "content": {"type": "string", "description": "新的文档内容"},
          "agentName": {"type": "string", "description": "起草者名称"},
          "assignees": {"type": "array", "items": {"type": "string"}, "description": "MR Review 人"}
        }
      }
    },
    {
      "key": "spec.search",
      "description": "在文档中搜索关键词",
      "inputSchema": {
        "type": "object",
        "required": ["query"],
        "properties": {
          "query": {"type": "string", "description": "搜索关键词"}
        }
      }
    }
  ],
  "config": {
    "docspecServerUrl": {
      "type": "string",
      "required": true,
      "description": "docspec-server 地址，如 http://localhost:4000"
    },
    "docspecAdminToken": {
      "type": "secret",
      "required": true,
      "description": "docspec-server 管理员 Token"
    }
  },
  "entrypoints": {
    "worker": "./dist/worker.js"
  }
}
```

## 5. 数据模型映射

### 5.1 OPC 插件表结构

| OPC 表 | 用途 | ai-spec 映射 |
|--------|------|-------------|
| `plugins` | 插件注册 | 插件安装记录 |
| `plugin_config` | 配置存储 | docspecServerUrl, docspecAdminToken |
| `plugin_state` | 状态存储 | 接入状态、最后同步时间 |
| `plugin_entities` | 自定义实体 | 项目配置、Agent-角色映射 |
| `plugin_jobs` | 异步任务 | 文档同步任务、MR 状态检查 |
| `plugin_logs` | 日志 | 文档操作审计日志 |

### 5.2 项目配置实体结构

```typescript
interface ProjectConfigEntity {
  entityType: "project-config";
  entityData: {
    projectName: string;
    moduleId: string;
    gitlabUrl: string;
    specRepo: string;
    companyId: string;  // OPC 公司 ID
    agentIds: string[]; // OPC Agent IDs
    createdAt: string;
    lastSyncAt: string;
  };
}
```

## 6. 事件集成

### 6.1 订阅的 OPC 事件

| 事件 | 触发时机 | 插件响应 |
|------|---------|---------|
| `issues.created` | 创建 Issue 时 | 搜索相关文档，注入引用到描述 |
| `agent.hired` | 招聘 Agent 时 | 在 docspec-server 注册 Agent，分配角色 |
| `company.created` | 创建公司时 | 初始化文档权限配置 |

### 6.2 事件处理流程

```
issues.created 事件处理:
1. 接收事件 payload (issue.id, issue.title, issue.companyId)
2. 根据 issue title 关键词搜索相关文档
3. 调用 docspec-server /api/docs?prefix= 搜索
4. 更新 issue 描述，注入文档引用链接
5. 记录日志到 plugin_logs
```

## 7. API 调用流程

### 7.1 Tool 调用流程

```
1. OPC UI 中 Agent 调用 spec.read tool
2. OPC API 验证权限，转发到插件
3. 插件 worker 调用 docspec-server /api/docs/:path
4. docspec-server 验证 JWT，检查权限
5. 返回文档内容给插件
6. 插件返回结果给 OPC
7. OPC UI 显示文档内容
```

### 7.2 Action 调用流程

```
1. 用户在 OPC UI 点击"新建项目接入"
2. OPC UI 调用插件 action: init-project
3. 插件执行:
   a. 调用 OPC API 创建公司
   b. 调用 OPC API 创建 Agent
   c. 调用 docspec-server /api/onboard/init
   d. 存储项目配置到 plugin_entities
4. 返回结果：companyId, agentCount, createdDirs, nextSteps
```

## 8. 配置管理

### 8.1 必需配置

| 配置项 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `docspecServerUrl` | string | docspec-server 地址 | `http://localhost:4000` |
| `docspecAdminToken` | secret | 管理员 Token | `eyJhbGc...` |

### 8.2 配置存储

```sql
-- plugin_config 表
INSERT INTO plugin_config (company_id, plugin_id, config_key, config_value, is_secret)
VALUES 
  ('uuid-company', 'uuid-plugin', 'docspecServerUrl', '"http://localhost:4000"', false),
  ('uuid-company', 'uuid-plugin', 'docspecAdminToken', '"eyJhbGc..."', true);
```

## 9. 实施步骤

1. **创建插件目录结构**
   ```
   ai-spec-opc-plugin/
   ├── manifest.json
   ├── package.json
   ├── tsconfig.json
   └── src/
       └── worker.ts
   ```

2. **实现 Worker 入口**
   - 适配 OPC 插件 SDK API
   - 实现 Tools 注册
   - 实现 Actions 注册
   - 实现 Events 订阅

3. **实现 HTTP 客户端**
   - 调用 docspec-server API
   - 处理 JWT 认证
   - 错误处理

4. **实现数据持久化**
   - 使用 OPC plugin_entities API
   - 存储项目配置
   - 存储状态

5. **测试与部署**
   - 本地测试插件安装
   - 验证 Tools/Actions 调用
   - 验证事件处理

## 10. 安全考虑

1. **Token 管理**: docspecAdminToken 存储在 plugin_config 表中，is_secret=true 加密存储
2. **公司隔离**: 所有插件操作必须通过 OPC 的公司访问检查
3. **权限验证**: 调用 docspec-server 时使用 JWT Token 验证角色权限
4. **审计日志**: 所有文档操作记录到 plugin_logs

## 11. 后续扩展

1. **双向同步**: docspec 文档变更同步到 OPC Issue/Goal
2. **AI 起草增强**: 支持多 Agent 协作起草、版本对比
3. **权限同步**: OPC 角色与 docspec 权限自动同步
4. **通知集成**: MR 状态变更通知到 OPC Inbox
