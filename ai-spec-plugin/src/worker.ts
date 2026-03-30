/**
 * douhua-spec-plugin — Paperclip Worker
 *
 * 提供以下能力：
 *   Tools:    spec.list / spec.read / spec.draft / spec.search
 *   Actions:  init-project / list-projects / spec-draft
 *   Events:   issues.created → 注入相关文档引用
 */

// NOTE: @paperclipai/plugin-sdk 尚未在本地安装，
// 以下使用接口类型占位。实际使用时将 import { setup } from "@paperclipai/plugin-sdk"
type SetupCtx = {
  config: { get(key: string): string };
  events: {
    on(event: string, handler: (payload: unknown) => Promise<void>): void;
  };
  tools: {
    register(key: string, handler: (input: unknown) => Promise<unknown>): void;
  };
  actions: {
    register(key: string, handler: (input: unknown) => Promise<unknown>): void;
  };
  companies: {
    create(data: { name: string; description: string }): Promise<{ id: string }>;
  };
  agents: {
    create(data: {
      companyId: string;
      name: string;
      role: string;
      adapterType: string;
    }): Promise<{ id: string }>;
  };
  logger: { info(msg: string): void; error(msg: string): void };
};

// ── 工具：调用 docspec-server HTTP API ──────────────────────────────
async function docspecFetch(
  serverUrl: string,
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`docspec-server ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

// ── 插件入口 ────────────────────────────────────────────────────────
export function setup(ctx: SetupCtx) {
  const serverUrl = () => ctx.config.get("docspecServerUrl");
  const adminToken = () => ctx.config.get("docspecAdminToken");

  // ── Tool: spec.list ─────────────────────────────────────────────
  ctx.tools.register("spec.list", async (input: unknown) => {
    const { prefix = "", token } = (input ?? {}) as { prefix?: string; token?: string };
    const tok = token ?? adminToken();
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    return docspecFetch(serverUrl(), tok, `/api/docs${qs}`);
  });

  // ── Tool: spec.read ─────────────────────────────────────────────
  ctx.tools.register("spec.read", async (input: unknown) => {
    const { path, token } = input as { path: string; token?: string };
    const tok = token ?? adminToken();
    return docspecFetch(serverUrl(), tok, `/api/docs/${path}`);
  });

  // ── Tool: spec.draft ─────────────────────────────────────────────
  // AI Agent 调用此 tool 起草文档变更，自动创建 GitLab MR
  ctx.tools.register("spec.draft", async (input: unknown) => {
    const { path, content, agentName, assignees = [], token } = input as {
      path: string;
      content: string;
      agentName?: string;
      assignees?: string[];
      token?: string;
    };
    const tok = token ?? adminToken();
    return docspecFetch(serverUrl(), tok, `/api/docs/${path}`, {
      method: "PUT",
      body: JSON.stringify({ content, createMR: true, agentName, assignees }),
    });
  });

  // ── Tool: spec.search ────────────────────────────────────────────
  ctx.tools.register("spec.search", async (input: unknown) => {
    const { query, token } = input as { query: string; token?: string };
    const tok = token ?? adminToken();
    const allDocs = (await docspecFetch(serverUrl(), tok, "/api/docs")) as {
      files: Array<{ path: string }>;
    };
    const results: Array<{ path: string; snippet: string }> = [];
    for (const file of allDocs.files.slice(0, 50)) {
      try {
        const doc = (await docspecFetch(serverUrl(), tok, `/api/docs/${file.path}`)) as {
          content: string;
        };
        if (doc.content.toLowerCase().includes(query.toLowerCase())) {
          const idx = doc.content.toLowerCase().indexOf(query.toLowerCase());
          results.push({
            path: file.path,
            snippet: doc.content.slice(Math.max(0, idx - 80), idx + 160),
          });
        }
      } catch { /* skip unreadable files */ }
    }
    return { query, count: results.length, results };
  });

  // ── Action: init-project ─────────────────────────────────────────
  // Paperclip 向导 UI 调用此 action 完成完整的接入初始化
  ctx.actions.register("init-project", async (input: unknown) => {
    const { projectName, moduleId, gitlabUrl, specRepo, repos = [], members = [] } = input as {
      projectName: string;
      moduleId: string;
      gitlabUrl: string;
      specRepo: string;
      repos: unknown[];
      members: Array<{ name: string; role: string; gitlabUser: string }>;
    };

    ctx.logger.info(`[douhua-spec] init-project: ${projectName} (${moduleId})`);

    // ① 在 Paperclip 创建公司
    const company = await ctx.companies.create({
      name: projectName,
      description: `DocSpec 接入项目：${moduleId}`,
    });
    ctx.logger.info(`[douhua-spec] created company: ${company.id}`);

    // ② 按成员角色创建 Agent
    const agentIds: string[] = [];
    for (const m of members) {
      const agent = await ctx.agents.create({
        companyId: company.id,
        name: `${m.name}（${m.role}）`,
        role: m.role,
        adapterType: "http",
      });
      agentIds.push(agent.id);
    }

    // ③ 调用 docspec-server /api/onboard/init 初始化目录
    const initResult = await docspecFetch(serverUrl(), adminToken(), "/api/onboard/init", {
      method: "POST",
      body: JSON.stringify({ projectName, moduleId, gitlabUrl, specRepo, repos, members }),
    }) as { createdDirs: string[]; files: Array<{ name: string; content: string }>; nextSteps: string[] };

    return {
      ok: true,
      companyId: company.id,
      agentCount: agentIds.length,
      createdDirs: initResult.createdDirs,
      generatedFiles: initResult.files.map((f) => f.name),
      nextSteps: initResult.nextSteps,
    };
  });

  // ── Action: list-projects ─────────────────────────────────────────
  ctx.actions.register("list-projects", async () => {
    return docspecFetch(serverUrl(), adminToken(), "/api/onboard/projects");
  });

  // ── Action: spec-draft ───────────────────────────────────────────
  ctx.actions.register("spec-draft", async (input: unknown) => {
    const { path, content, agentName, assignees = [], token } = input as {
      path: string;
      content: string;
      agentName?: string;
      assignees?: string[];
      token?: string;
    };
    const tok = token ?? adminToken();
    return docspecFetch(serverUrl(), tok, `/api/docs/${path}`, {
      method: "PUT",
      body: JSON.stringify({ content, createMR: true, agentName, assignees }),
    });
  });

  // ── Event: issues.created → 注入相关文档引用 ─────────────────────
  ctx.events.on("issues.created", async (payload: unknown) => {
    const issue = payload as { id: string; title: string; companyId: string };
    ctx.logger.info(`[douhua-spec] issue created: ${issue.title}`);
    // 根据 issue title 关键词搜索相关文档，注入到 issue 描述
    // （具体实现待 @paperclipai/plugin-sdk API 确认后补充）
  });
}
