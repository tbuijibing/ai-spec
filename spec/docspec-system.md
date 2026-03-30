# DocSpec 文档权限与代码自动生成架构设计

一套面向开发团队的文档权限隔离系统与「代码即文档」自动生成体系，支持 RBAC 角色访问控制和代码驱动的文档增量更新。

---

## 一、核心需求拆解

| 需求 | 说明 |
|------|------|
| **文档权限隔离** | 不同角色只能访问与自己相关的文档目录 |
| **全局调度角色** | admin 角色可看所有内容，统一协调 |
| **测试特殊权限** | 测试只能看部署信息（安装包/地址），不能看代码文档 |
| **代码即文档** | 代码变更自动触发文档更新，保持同步 |
| **增量更新** | CI/CD 每次提交只更新变更部分，不全量重写 |

---

## 二、RBAC 权限模型

### 2.1 角色定义

| 角色 | 说明 |
|------|------|
| `admin` | 全局管理员，所有内容可读写，统一调度 |
| `product` | 产品经理 |
| `design` | UI/UX 设计师 |
| `frontend` | 前端开发工程师 |
| `android` | Android 开发工程师 |
| `ios` | iOS 开发工程师 |
| `backend` | 后端开发工程师 |
| `test` | 测试工程师（特殊限制） |

### 2.2 目录访问权限矩阵

> R=只读，W=可写，-=无权限访问

| 资源路径 | admin | product | design | frontend | android | ios | backend | test |
|---------|-------|---------|--------|----------|---------|-----|---------|------|
| `README.md` | RW | R | R | R | R | R | R | R |
| `SPEC-*-1-需求文档.md` | RW | RW | R | R | R | R | R | R |
| `SPEC-*-2-技术设计文档.md` | RW | R | - | R | R | R | RW | - |
| `SPEC-*-3-UI-UX设计文档.md` | RW | R | RW | R | R | R | - | - |
| `SPEC-*-4-任务文档.md` | RW | RW | R | R | R | R | R | R |
| `SPEC-*-5-验收文档.md` | RW | R | - | - | - | - | - | RW |
| `SPEC-*-6-数据库文档.md` | RW | - | - | - | - | - | RW | - |
| `SPEC-*-7-快速排查手册.md` | RW | - | - | - | - | - | RW | R |
| `SPEC-*-8-可追溯性矩阵.md` | RW | R | - | - | - | - | R | R |
| `SPEC-*-9-验收报告.md` | RW | R | - | - | - | - | - | RW |
| `product/**` | RW | RW | R | R | R | R | R | R |
| `design/**` | RW | R | RW | R | R | R | - | - |
| `frontend/**` | RW | - | R | RW | - | - | R | - |
| `android/**` | RW | - | R | - | RW | - | R | - |
| `ios/**` | RW | - | R | - | - | RW | R | - |
| `test/T0-部署信息.md` ⭐新增 | RW | - | - | - | - | - | - | R |
| `test/T1~T4-测试文档` | RW | R | - | - | - | - | R | RW |
| `03-api-docs/**` | RW | - | - | R | R | R | RW | R |
| `00-conventions/**` | RW | R | R | R | R | R | R | R |

> ⭐ `test/T0-部署信息.md`：新增文件，由 CI/CD 自动生成，是测试访问的核心文件

### 2.3 权限配置文件（`.spec-permissions.yaml`）

存放于 `douhua-spec/.spec-permissions.yaml`，作为权限系统的唯一配置源：

```yaml
version: "1.0"
roles:
  admin:
    access: all

  product:
    include:
      - "README.md"
      - "product/**"
      - "design/**"           # 可看设计
      - "SPEC-*-1-*.md"
      - "SPEC-*-3-*.md"
      - "SPEC-*-4-*.md"
      - "SPEC-*-8-*.md"
      - "SPEC-*-9-*.md"
      - "00-conventions/**"

  design:
    include:
      - "README.md"
      - "product/**"
      - "design/**"
      - "SPEC-*-1-*.md"
      - "SPEC-*-3-*.md"
      - "00-conventions/06-设计系统规范.md"
      - "00-conventions/07-设计资产规范.md"

  frontend:
    include:
      - "README.md"
      - "product/**"
      - "design/**"
      - "frontend/**"
      - "SPEC-*-1-*.md"
      - "SPEC-*-2-*.md"
      - "03-api-docs/**"
      - "00-conventions/**"

  android:
    include:
      - "README.md"
      - "product/**"
      - "design/**"
      - "android/**"
      - "SPEC-*-1-*.md"
      - "SPEC-*-2-*.md"
      - "03-api-docs/**"
      - "00-conventions/**"

  ios:
    include:
      - "README.md"
      - "product/**"
      - "design/**"
      - "ios/**"
      - "SPEC-*-1-*.md"
      - "SPEC-*-2-*.md"
      - "03-api-docs/**"
      - "00-conventions/**"

  backend:
    include:
      - "README.md"
      - "frontend/**"         # 只读：了解前端接口期望
      - "android/**"          # 只读
      - "ios/**"              # 只读
      - "SPEC-*-1-*.md"
      - "SPEC-*-2-*.md"
      - "SPEC-*-6-*.md"
      - "SPEC-*-7-*.md"
      - "SPEC-*-8-*.md"
      - "test/T1-*.md"
      - "test/T3-*.md"
      - "03-api-docs/**"
      - "00-conventions/**"

  test:
    include:
      - "README.md"           # 只看模块概述
      - "test/T0-部署信息.md" # 安装包/环境地址（核心）
      - "test/T1-*.md"
      - "test/T2-*.md"
      - "test/T3-*.md"
      - "test/T4-*.md"
      - "SPEC-*-1-*.md"      # 需求（测试依据）
      - "SPEC-*-5-*.md"      # 验收标准
      - "SPEC-*-9-*.md"      # 验收报告
```

---

## 三、新增文件：test/T0-部署信息.md（CI/CD 自动生成）

```markdown
# SPEC-201-T0 部署信息（测试专用）
> ⚠️ 此文件由 CI/CD 自动生成，禁止手动修改

## 测试环境
- Web 访问地址：http://test.douhuakj.cn
- API Base URL：http://test-api.douhuakj.cn
- Swagger UI：http://test-api.douhuakj.cn/swagger-ui.html

## 各服务 Swagger
| 服务 | 地址 |
|------|------|
| video-front | http://test-api.douhuakj.cn/api/video/front/v2/api-docs |
| video-admin | http://test-api.douhuakj.cn/api/video/admin/v2/api-docs |

## 安装包下载
| 平台 | 版本 | 下载链接 | 构建时间 |
|------|------|----------|----------|
| Android APK | v1.2.3 (build 456) | http://cdn/app.apk | 2026-03-30 22:00 |
| iOS IPA | v1.2.3 (build 456) | TestFlight 邀请码: XXXX | 2026-03-30 22:00 |

## 当前版本
- Git Commit: abc1234
- Branch: release/1.2.3
- 构建状态: ✅ 成功
```

---

## 四、「代码即文档」自动生成体系

### 4.1 代码→文档映射关系

| 解析来源（代码） | 生成/更新目标文档 | 触发条件 |
|----------------|-----------------|----------|
| Swagger JSON（后端注解） | `03-api-docs/SPEC-XXX/xxx-api.md` | 后端代码 push |
| MyBatis Entity / DDL SQL | `SPEC-*-6-数据库文档.md` | DB 迁移文件变更 |
| Vue Router `routes.ts` | `frontend/F1-页面清单与路由.md` | 前端路由文件变更 |
| `src/api/*.ts`（Axios 定义） | `frontend/F4-接口对接清单.md` | 前端 API 文件变更 |
| `AndroidManifest.xml` + Navigation Graph | `android/A1-页面清单与导航.md` | Android 代码 push |
| iOS Storyboard / SwiftUI 入口 | `ios/I1-页面清单与导航.md` | iOS 代码 push |
| CI/CD 构建产物（APK/IPA） | `test/T0-部署信息.md` | 每次成功构建后 |

### 4.2 解析器模块（docspec-parser）

```
docspec-parser/
├── parsers/
│   ├── swagger-parser.ts        # Swagger JSON → API Markdown（已有基础）
│   ├── database-parser.ts       # Entity 注解 / DDL → 数据库文档
│   ├── vue-router-parser.ts     # routes.ts AST → 页面清单
│   ├── android-manifest-parser.ts  # Manifest XML → 导航清单
│   ├── ios-entry-parser.ts      # Storyboard/SwiftUI → 导航清单
│   └── deploy-info-generator.ts # 构建环境变量 → T0 部署信息
├── core/
│   ├── diff-merger.ts           # 增量合并（只更新变更的章节，保留手写内容）
│   ├── section-marker.ts        # 章节标记（区分自动生成区 vs 手写区）
│   └── git-writer.ts            # 写入 douhua-spec 仓库并 commit
└── cli.ts                       # CLI 入口：docspec parse --type=swagger --module=201
```

**关键设计：增量合并（章节标记）**

自动生成区域用注释标记，保护手写内容不被覆盖：

```markdown
<!-- DOCSPEC:AUTO:START source="swagger" updated="2026-03-30T22:00:00" -->
## API 清单
...（自动生成，每次 CI 覆盖此区域）
<!-- DOCSPEC:AUTO:END -->

## 补充说明
...（手写区，CI 不会修改）
```

---

## 五、系统整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    代码仓库（GitHub）                       │
│  douhua-video / douhua-frontend / douhua-android / ios    │
└──────────────────────┬───────────────────────────────────┘
                       │ push / PR merge
                       ▼
┌──────────────────────────────────────────────────────────┐
│               CI/CD Pipeline（GitHub Actions）             │
│  1. 识别变更文件类型                                        │
│  2. 调用 docspec-parser 对应解析器                         │
│  3. 增量更新 douhua-spec 文档仓库                          │
│  4. 构建完成后写入 T0-部署信息.md                          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│           douhua-spec（文档 Git 仓库）                      │
│  .spec-permissions.yaml  ← 权限配置唯一来源               │
│  02-modules/ 03-api-docs/ 00-conventions/                 │
└──────────────────────┬───────────────────────────────────┘
                       │ 读取文件 + 权限配置
                       ▼
┌──────────────────────────────────────────────────────────┐
│              docspec-server（权限网关）                     │
│  ├── JWT 认证（用户登录获取角色 token）                    │
│  ├── RBAC 中间件（解析 .spec-permissions.yaml）           │
│  ├── 文件服务（根据角色过滤可见文件列表）                   │
│  └── REST API：/api/files /api/tree /api/search          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              docspec-ui（Web 文档门户）                     │
│  ├── VitePress 渲染（Markdown → 美观页面）                │
│  ├── 左侧导航：仅显示当前角色有权限的文件树               │
│  ├── 搜索：仅搜索有权限的内容                             │
│  └── 角色切换（admin 可切换视角查看其他角色视图）          │
└──────────────────────┬───────────────────────────────────┘
                       │
           各角色用户通过浏览器访问
    产品 / 设计 / 前端 / Android / iOS / 后端 / 测试
```

---

## 六、技术选型

| 组件 | 技术 | 理由 |
|------|------|------|
| 权限网关 | Node.js + Fastify + JWT | 轻量、高性能，JSON 文件权限配置无需数据库 |
| 文档渲染 | VitePress | 原生 Markdown 支持，可定制主题 |
| 代码解析器 | TypeScript | 统一语言，支持 XML/JSON/AST 解析 |
| 权限配置 | YAML 文件（Git 版本管理） | 权限变更可追溯，无需数据库 |
| CI/CD | GitHub Actions | 与现有 GitHub 仓库集成 |
| 部署 | Docker + Nginx | 简单可靠 |
| 认证 | JWT（无状态） + 企业 SSO 可选 | 与现有用户体系解耦 |

---

## 七、实施路径（分3阶段）

### Phase 1：目录结构 + 权限配置（1天）
- [ ] 新增 `test/T0-部署信息.md`（占位文件，含模板）
- [ ] 在 `douhua-spec/` 根目录创建 `.spec-permissions.yaml`
- [ ] 在 `douhua-spec/README.md` 补充权限说明章节

### Phase 2：docspec-server 权限网关（3-5天）
- [ ] 实现 JWT 认证 + 用户角色绑定
- [ ] 解析 `.spec-permissions.yaml` 的 RBAC 中间件
- [ ] 文件树过滤 API（`GET /api/modules/:moduleId/tree`）
- [ ] VitePress 集成，基于角色动态生成侧边栏
- [ ] Docker 化部署

### Phase 3：docspec-parser 代码解析器（5-7天）
- [ ] `swagger-parser.ts`（利用已有 Swagger 抓取基础）
- [ ] `vue-router-parser.ts`（解析 `routes.ts` 路由配置）
- [ ] `android-manifest-parser.ts`（解析 Manifest + Navigation XML）
- [ ] `deploy-info-generator.ts`（CI 环境变量 → T0 文件）
- [ ] GitHub Actions 工作流（各端 push 触发对应解析器）
- [ ] 章节标记 + 增量合并（保护手写内容）

---

## 八、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 权限配置存放位置 | `douhua-spec/.spec-permissions.yaml` | Git 版本控制，权限变更可审计 |
| 数据库 vs 文件 | 无数据库，纯文件 + Git | 文档仓库本身已是 Git，无需额外存储 |
| 自动生成 vs 手写混合 | 章节标记隔离 | 自动生成区每次覆盖，手写区永久保留 |
| 测试访问限制实现 | `test/T0` 独立文件 + 权限矩阵排除其他目录 | 最小权限原则，清晰可配置 |
| admin 调度能力 | 角色切换视角 + 全文搜索 | admin 可用任意角色视角审查文档完整性 |
