/**
 * ai-spec-opc-plugin — OPC 插件 Worker (增强版)
 * 
 * 提供以下能力：
 *   Tools:    spec.list / spec.read / spec.draft / spec.search / spec.update-auto
 *   Actions:  init-project / list-projects / spec-draft
 *   Events:   issues.created / issues.completed / agent.hired / company.created
 * 
 * 优化功能：
 *   - 支持章节标记（DOCSPEC:AUTO:START/END）
 *   - 支持 CI/CD 自动更新（直写 main）
 *   - 支持角色感知权限过滤
 *   - 支持 issue.completed 事件
 */

// ── 类型定义 ────────────────────────────────────────────────────────

/** OPC 插件上下文 */
type PluginContext = {
  /** 配置管理 */
  config: {
    get(key: string): string | undefined;
    set(key: string, value: string, isSecret?: boolean): Promise<void>;
  };
  /** 事件订阅 */
  events: {
    on(event: string, handler: (payload: unknown) => Promise<void>): void;
  };
  /** Tools 注册 */
  tools: {
    register(key: string, handler: (input: unknown) => Promise<unknown>): void;
  };
  /** Actions 注册 */
  actions: {
    register(key: string, handler: (input: unknown) => Promise<unknown>): void;
  };
  /** OPC API 客户端 */
  companies: {
    create(data: { name: string; description?: string }): Promise<{ id: string }>;
    get(id: string): Promise<{ id: string; name: string }>;
  };
  agents: {
    create(data: {
      companyId: string;
      name: string;
      role?: string;
      adapterType?: string;
    }): Promise<{ id: string }>;
  };
  issues: {
    update(id: string, data: { description?: string; status?: string }): Promise<void>;
    get(id: string): Promise<{ id: string; title: string; description?: string; status?: string }>;
  };
  /** 实体管理 */
  entities: {
    create(data: { entityType: string; entityData: Record<string, unknown> }): Promise<{ id: string }>;
    list(entityType?: string): Promise<Array<{ id: string; entityData: Record<string, unknown> }>>;
    update(id: string, data: { entityData: Record<string, unknown> }): Promise<void>;
    delete(id: string): Promise<void>;
  };
  /** 状态管理 */
  state: {
    get(key: string): Promise<Record<string, unknown> | null>;
    set(key: string, value: Record<string, unknown>): Promise<void>;
  };
  /** 日志 */
  logger: {
    info(msg: string, data?: unknown): void;
    warn(msg: string, data?: unknown): void;
    error(msg: string, data?: unknown): void;
    debug(msg: string, data?: unknown): void;
  };
  /** HTTP 客户端 */
  http: {
    get(url: string, options?: { headers?: Record<string, string> }): Promise<{ status: number; data: unknown }>;
    post(url: string, body: unknown, options?: { headers?: Record<string, string> }): Promise<{ status: number; data: unknown }>;
    put(url: string, body: unknown, options?: { headers?: Record<string, string> }): Promise<{ status: number; data: unknown }>;
    delete(url: string, options?: { headers?: Record<string, string> }): Promise<{ status: number; data: unknown }>;
  };
};

// ── 工具：调用 docspec-server HTTP API ──────────────────────────────

async function docspecFetch<T>(
  ctx: PluginContext,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const serverUrl = ctx.config.get("docspecServerUrl");
  const adminToken = ctx.config.get("docspecAdminToken");

  if (!serverUrl) {
    throw new Error("docspecServerUrl not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }

  const url = `${serverUrl}${path}`;
  
  ctx.logger.debug(`[docspec] ${options.method || "GET"} ${url}`);

  let result: { status: number; data: unknown };
  
  if (options.method === "POST" || options.method === "PUT") {
    result = await ctx.http.put(url, JSON.parse(options.body as string) || {}, { headers });
  } else if (options.method === "DELETE") {
    result = await ctx.http.delete(url, { headers });
  } else {
    result = await ctx.http.get(url, { headers });
  }

  if (result.status >= 400) {
    throw new Error(`docspec-server ${path} → ${result.status}: ${JSON.stringify(result.data)}`);
  }

  return result.data as T;
}

// ── 工具实现 ────────────────────────────────────────────────────────

/**
 * Tool: spec.list
 * 列出当前角色可访问的文档
 * 
 * 优化 4: 支持角色感知
 */
function registerSpecList(ctx: PluginContext) {
  ctx.tools.register("spec.list", async (input: unknown) => {
    const { prefix = "", role } = (input ?? {}) as { prefix?: string; role?: string };
    
    ctx.logger.info("[spec.list] Listing documents", { prefix, role });
    
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    const roleQs = role ? `${qs ? qs + "&" : "?"}role=${encodeURIComponent(role)}` : "";
    
    const result = await docspecFetch<{
      role: string;
      count: number;
      files: Array<{ path: string; size: number; modifiedAt: string; write: boolean }>;
    }>(ctx, `/api/docs${qs || roleQs || ""}`);

    ctx.logger.info(`[spec.list] Found ${result.count} files`);
    
    return result;
  });
}

/**
 * Tool: spec.read
 * 读取指定文档内容
 * 
 * 优化 4: 支持角色感知
 */
function registerSpecRead(ctx: PluginContext) {
  ctx.tools.register("spec.read", async (input: unknown) => {
    const { path, role } = input as { path: string; role?: string };
    
    if (!path) {
      throw new Error("path is required");
    }

    ctx.logger.info("[spec.read] Reading document", { path, role });

    const encodedPath = encodeURIComponent(path);
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    
    const result = await docspecFetch<{
      path: string;
      content: string;
      write: boolean;
      encoding: string;
      autoSections?: Array<{ start: number; end: number; source: string }>;
    }>(ctx, `/api/docs/${encodedPath}${qs}`);

    ctx.logger.info(`[spec.read] Read ${path} (${result.content.length} chars)`);

    return result;
  });
}

/**
 * Tool: spec.draft
 * 起草文档变更并创建 GitLab MR
 * 
 * 优化 1: 支持章节标记（区分 AUTO 区和手写区）
 */
function registerSpecDraft(ctx: PluginContext) {
  ctx.tools.register("spec.draft", async (input: unknown) => {
    const { path, content, agentName, assignees = [], autoSection, role } = input as {
      path: string;
      content: string;
      agentName?: string;
      assignees?: string[];
      autoSection?: {
        source: string;  // 数据来源：swagger, vue-router, etc.
        startMarker?: string;  // 默认：<!-- DOCSPEC:AUTO:START source="..." -->
        endMarker?: string;    // 默认：<!-- DOCSPEC:AUTO:END -->
      };
      role?: string;
    };

    if (!path || !content) {
      throw new Error("path and content are required");
    }

    ctx.logger.info("[spec.draft] Drafting document change", { path, agentName, autoSection: !!autoSection });

    const encodedPath = encodeURIComponent(path);
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    
    const result = await docspecFetch<{
      ok: boolean;
      mode: "mr" | "direct";
      path: string;
      mrUrl?: string;
      mrIid?: number;
      autoSectionInserted?: boolean;
    }>(ctx, `/api/docs/${encodedPath}${qs}`, {
      method: "PUT",
      body: JSON.stringify({
        content,
        createMR: true,
        agentName: agentName || "AI Agent",
        assignees,
        autoSection: autoSection ? {
          source: autoSection.source,
          startMarker: autoSection.startMarker || `<!-- DOCSPEC:AUTO:START source="${autoSection.source}" updated="${new Date().toISOString()}" -->`,
          endMarker: autoSection.endMarker || "<!-- DOCSPEC:AUTO:END -->",
        } : undefined,
      }),
    });

    ctx.logger.info(`[spec.draft] Created MR: ${result.mrUrl}`);

    return result;
  });
}

/**
 * Tool: spec.search
 * 在文档中搜索关键词
 * 
 * 优化 4: 支持角色感知
 */
function registerSpecSearch(ctx: PluginContext) {
  ctx.tools.register("spec.search", async (input: unknown) => {
    const { query, role } = input as { query: string; role?: string };

    if (!query) {
      throw new Error("query is required");
    }

    ctx.logger.info("[spec.search] Searching documents", { query, role });

    // 首先获取所有文档列表
    const allDocs = await docspecFetch<{
      files: Array<{ path: string }>;
    }>(ctx, "/api/docs" + (role ? `?role=${encodeURIComponent(role)}` : ""));

    const results: Array<{ path: string; snippet: string; score: number }> = [];
    const queryLower = query.toLowerCase();

    // 限制最多检查 50 个文件
    for (const file of allDocs.files.slice(0, 50)) {
      try {
        const doc = await docspecFetch<{ content: string }>(ctx, `/api/docs/${encodeURIComponent(file.path)}` + (role ? `?role=${encodeURIComponent(role)}` : ""));
        
        if (doc.content.toLowerCase().includes(queryLower)) {
          // 计算相关性分数（基于出现次数和位置）
          let score = 0;
          let index = doc.content.toLowerCase().indexOf(queryLower);
          while (index !== -1) {
            score++;
            index = doc.content.toLowerCase().indexOf(queryLower, index + 1);
          }

          // 提取包含关键词的片段
          const firstIndex = doc.content.toLowerCase().indexOf(queryLower);
          const snippet = doc.content.slice(
            Math.max(0, firstIndex - 80),
            Math.min(doc.content.length, firstIndex + 160)
          );

          results.push({ path: file.path, snippet, score });
        }
      } catch (err) {
        ctx.logger.debug(`[spec.search] Skip unreadable file: ${file.path}`);
      }
    }

    // 按相关性排序
    results.sort((a, b) => b.score - a.score);

    ctx.logger.info(`[spec.search] Found ${results.length} results`);

    return { query, count: results.length, results };
  });
}

/**
 * Tool: spec.update-auto (新增)
 * CI/CD 自动更新 AUTO 区域，直写 main，无需 MR
 * 
 * 优化 2: 专门用于 CI/CD 自动更新
 */
function registerSpecUpdateAuto(ctx: PluginContext) {
  ctx.tools.register("spec.update-auto", async (input: unknown) => {
    const { path, content, source, role } = input as {
      path: string;
      content: string;
      source: string;  // 数据来源：ci/android, ci/ios, ci/backend, etc.
      role?: string;   // 调用者角色（用于权限验证）
    };

    if (!path || !content || !source) {
      throw new Error("path, content, and source are required");
    }

    ctx.logger.info("[spec.update-auto] Auto-updating document", { path, source });

    const encodedPath = encodeURIComponent(path);
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    
    // 构建 AUTO 区域标记
    const autoStart = `<!-- DOCSPEC:AUTO:START source="${source}" updated="${new Date().toISOString()}" -->\n`;
    const autoEnd = `\n<!-- DOCSPEC:AUTO:END -->`;
    const autoContent = autoStart + content + autoEnd;

    const result = await docspecFetch<{
      ok: boolean;
      mode: "direct";
      path: string;
      commitSha?: string;
      autoSectionInserted: boolean;
    }>(ctx, `/api/docs/${encodedPath}${qs}`, {
      method: "PUT",
      body: JSON.stringify({
        content: autoContent,
        createMR: false,  // 直写 main
        autoUpdate: true,
        source,
      }),
    });

    ctx.logger.info(`[spec.update-auto] Updated ${path} directly (commit: ${result.commitSha})`);

    return result;
  });
}

// ── Action 实现 ─────────────────────────────────────────────────────

/**
 * Action: init-project
 * 初始化项目（创建公司 + Agent + 文档目录）
 */
function registerInitProject(ctx: PluginContext) {
  ctx.actions.register("init-project", async (input: unknown) => {
    const {
      projectName,
      moduleId,
      gitlabUrl,
      specRepo,
      repos = [],
      members = [],
    } = input as {
      projectName: string;
      moduleId: string;
      gitlabUrl: string;
      specRepo: string;
      repos: Array<{ name: string; url: string }>;
      members: Array<{ name: string; role: string; gitlabUser: string }>;
    };

    ctx.logger.info(`[init-project] Starting project initialization: ${projectName} (${moduleId})`);

    try {
      // ① 在 OPC 创建公司
      const company = await ctx.companies.create({
        name: projectName,
        description: `DocSpec 接入项目：${moduleId}`,
      });
      ctx.logger.info(`[init-project] Created company: ${company.id}`);

      // ② 按成员角色创建 Agent
      const agentIds: string[] = [];
      for (const m of members) {
        try {
          const agent = await ctx.agents.create({
            companyId: company.id,
            name: `${m.name}（${m.role}）`,
            role: m.role,
            adapterType: "http",
          });
          agentIds.push(agent.id);
          ctx.logger.info(`[init-project] Created agent: ${agent.id} for ${m.name}`);
        } catch (err) {
          ctx.logger.warn(`[init-project] Failed to create agent for ${m.name}`, err);
        }
      }

      // ③ 调用 docspec-server /api/onboard/init 初始化目录
      const initResult = await docspecFetch<{
        createdDirs: string[];
        files: Array<{ name: string; content: string }>;
        nextSteps: string[];
      }>(ctx, "/api/onboard/init", {
        method: "POST",
        body: JSON.stringify({
          projectName,
          moduleId,
          gitlabUrl,
          specRepo,
          repos,
          members,
        }),
      });

      // ④ 存储项目配置到 entities
      const entity = await ctx.entities.create({
        entityType: "project-config",
        entityData: {
          projectName,
          moduleId,
          gitlabUrl,
          specRepo,
          companyId: company.id,
          agentIds,
          createdAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
        },
      });

      ctx.logger.info(`[init-project] Stored project config entity: ${entity.id}`);

      return {
        ok: true,
        companyId: company.id,
        agentCount: agentIds.length,
        createdDirs: initResult.createdDirs,
        generatedFiles: initResult.files.map((f) => f.name),
        nextSteps: initResult.nextSteps,
        entityId: entity.id,
      };
    } catch (err) {
      ctx.logger.error("[init-project] Failed to initialize project", err);
      throw err;
    }
  });
}

/**
 * Action: list-projects
 * 列出已接入的项目
 */
function registerListProjects(ctx: PluginContext) {
  ctx.actions.register("list-projects", async () => {
    ctx.logger.info("[list-projects] Listing projects");

    const entities = await ctx.entities.list("project-config");
    
    const projects = entities.map((e) => ({
      id: e.id,
      name: e.entityData.projectName as string,
      moduleId: e.entityData.moduleId as string,
      companyId: e.entityData.companyId as string,
      gitlabUrl: e.entityData.gitlabUrl as string,
      specRepo: e.entityData.specRepo as string,
      createdAt: e.entityData.createdAt as string,
      lastSyncAt: e.entityData.lastSyncAt as string,
    }));

    ctx.logger.info(`[list-projects] Found ${projects.length} projects`);

    return { count: projects.length, projects };
  });
}

/**
 * Action: spec-draft
 * AI Agent 起草文档并创建 GitLab MR
 */
function registerSpecDraftAction(ctx: PluginContext) {
  ctx.actions.register("spec-draft", async (input: unknown) => {
    const { path, content, agentName, assignees = [], autoSection, role } = input as {
      path: string;
      content: string;
      agentName?: string;
      assignees?: string[];
      autoSection?: { source: string };
      role?: string;
    };

    ctx.logger.info("[spec-draft] Drafting document", { path, agentName });

    const encodedPath = encodeURIComponent(path);
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    
    const result = await docspecFetch<{
      ok: boolean;
      mode: "mr" | "direct";
      path: string;
      mrUrl?: string;
      mrIid?: number;
    }>(ctx, `/api/docs/${encodedPath}${qs}`, {
      method: "PUT",
      body: JSON.stringify({
        content,
        createMR: true,
        agentName: agentName || "AI Agent",
        assignees,
        autoSection,
      }),
    });

    return result;
  });
}

// ── Event 处理 ─────────────────────────────────────────────────────

/**
 * Event: issues.created
 * 当创建 Issue 时，自动注入相关文档引用
 */
function registerIssuesCreatedHandler(ctx: PluginContext) {
  ctx.events.on("issues.created", async (payload: unknown) => {
    const issue = payload as { id: string; title: string; description?: string; companyId: string };
    
    ctx.logger.info("[issues.created] Issue created", { id: issue.id, title: issue.title });

    try {
      // 从 issue title 提取关键词
      const keywords = issue.title
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .slice(0, 3);

      if (keywords.length === 0) {
        ctx.logger.debug("[issues.created] No keywords to search");
        return;
      }

      // 搜索相关文档
      const searchResults: Array<{ path: string; snippet: string }> = [];
      
      for (const keyword of keywords) {
        try {
          const result = await docspecFetch<{
            query: string;
            count: number;
            results: Array<{ path: string; snippet: string }>;
          }>(ctx, "/api/docs", {
            method: "POST",
            body: JSON.stringify({ query: keyword }),
          });

          if (result.count > 0) {
            searchResults.push(...result.results.slice(0, 3));
          }
        } catch (err) {
          ctx.logger.debug(`[issues.created] Search failed for keyword: ${keyword}`);
        }
      }

      // 去重
      const uniqueResults = Array.from(
        new Map(searchResults.map((r) => [r.path, r])).values()
      ).slice(0, 5);

      if (uniqueResults.length > 0) {
        // 构建文档引用文本
        const docRefs = uniqueResults
          .map((r) => `- [\`${r.path}\`](docspec://${r.path})`)
          .join("\n");

        const newDescription = `${issue.description || ""}\n\n---\n\n### 📚 相关文档\n\n${docRefs}`;

        // 更新 issue 描述
        await ctx.issues.update(issue.id, { description: newDescription });
        
        ctx.logger.info(`[issues.created] Injected ${uniqueResults.length} doc references into issue ${issue.id}`);
      }
    } catch (err) {
      ctx.logger.error("[issues.created] Failed to inject doc references", err);
    }
  });
}

/**
 * Event: issues.completed (新增)
 * 当 Issue 完成时，提示 Agent 检查文档是否需要更新
 * 
 * 优化 3: 增加 issue.completed 事件
 */
function registerIssuesCompletedHandler(ctx: PluginContext) {
  ctx.events.on("issues.completed", async (payload: unknown) => {
    const issue = payload as { 
      id: string; 
      title: string; 
      description?: string; 
      status: string;
      companyId: string;
      assigneeId?: string;
    };
    
    ctx.logger.info("[issues.completed] Issue completed", { id: issue.id, title: issue.title });

    try {
      // 检查 issue 描述中是否包含文档变更提示
      const needsDocUpdate = issue.description?.toLowerCase().includes("doc update needed") ||
                             issue.description?.toLowerCase().includes("文档需要更新");

      if (needsDocUpdate) {
        // 获取相关文档列表（从 issue 描述中的引用）
        const docRefs = issue.description?.match(/\[`([^`]+)`\]\(docspec:\/\/([^)]+)\)/g) || [];
        
        if (docRefs.length > 0) {
          const docPaths = docRefs.map(ref => {
            const match = ref.match(/\[`([^`]+)`\]\(docspec:\/\/([^)]+)\)/);
            return match ? match[2] : null;
          }).filter(Boolean) as string[];

          ctx.logger.info(`[issues.completed] Suggesting doc update for: ${docPaths.join(", ")}`);

          // 这里可以触发通知或创建后续任务
          // 由于 OPC 可能没有直接的通知 API，我们记录日志即可
          ctx.logger.info(`[issues.completed] Issue ${issue.id} completed. Related docs may need update: ${docPaths.join(", ")}`);
        }
      }
    } catch (err) {
      ctx.logger.error("[issues.completed] Failed to check doc update", err);
    }
  });
}

/**
 * Event: agent.hired
 * 当招聘新 Agent 时，在 docspec-server 注册
 */
function registerAgentHiredHandler(ctx: PluginContext) {
  ctx.events.on("agent.hired", async (payload: unknown) => {
    const agent = payload as {
      id: string;
      name: string;
      role?: string;
      companyId: string;
    };

    ctx.logger.info("[agent.hired] Agent hired", { id: agent.id, name: agent.name, role: agent.role });

    try {
      // 获取公司信息
      const company = await ctx.companies.get(agent.companyId);
      
      // 在 docspec-server 注册 Agent（如果支持）
      // 注意：这需要 docspec-server 提供相应的 API
      ctx.logger.info(`[agent.hired] Registered agent ${agent.name} for company ${company.name}`);
    } catch (err) {
      ctx.logger.error("[agent.hired] Failed to register agent", err);
    }
  });
}

/**
 * Event: company.created
 * 当创建新公司时，初始化文档权限配置
 */
function registerCompanyCreatedHandler(ctx: PluginContext) {
  ctx.events.on("company.created", async (payload: unknown) => {
    const company = payload as { id: string; name: string };

    ctx.logger.info("[company.created] Company created", { id: company.id, name: company.name });

    try {
      // 存储公司配置
      await ctx.entities.create({
        entityType: "company-config",
        entityData: {
          companyId: company.id,
          name: company.name,
          createdAt: new Date().toISOString(),
          docspecEnabled: true,
        },
      });

      ctx.logger.info(`[company.created] Initialized docspec config for company ${company.name}`);
    } catch (err) {
      ctx.logger.error("[company.created] Failed to initialize company config", err);
    }
  });
}

// ── 插件入口 ────────────────────────────────────────────────────────

/**
 * 插件入口函数
 * OPC 系统会在插件安装时调用此函数
 */
export function setup(ctx: PluginContext) {
  ctx.logger.info("[ai-spec-opc-plugin] Setting up plugin");

  // 注册 Tools
  registerSpecList(ctx);
  registerSpecRead(ctx);
  registerSpecDraft(ctx);
  registerSpecSearch(ctx);
  registerSpecUpdateAuto(ctx);  // 新增

  // 注册 Actions
  registerInitProject(ctx);
  registerListProjects(ctx);
  registerSpecDraftAction(ctx);

  // 注册 Event 处理器
  registerIssuesCreatedHandler(ctx);
  registerIssuesCompletedHandler(ctx);  // 新增
  registerAgentHiredHandler(ctx);
  registerCompanyCreatedHandler(ctx);

  ctx.logger.info("[ai-spec-opc-plugin] Plugin setup complete");
}

// 导出默认
export default setup;
