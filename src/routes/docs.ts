import { Router, Request, Response } from "express";
import { authMiddleware, TokenPayload } from "../auth";
import { checkPermission, listAccessiblePaths } from "../permissions";
import { readFile, writeFile, fileExists, listFiles } from "../gitfs";
import { pushFileAsMR } from "../gitlab";
import { config } from "../config";

const router = Router();

type AuthRequest = Request & { auth: TokenPayload };

router.use(authMiddleware);

// GET /api/docs?prefix=02-modules  列出角色可访问的文件
router.get("/", (req: Request, res: Response) => {
  const { role } = (req as AuthRequest).auth;
  const prefix = (req.query.prefix as string) ?? "";

  try {
    const allFiles = listFiles(prefix);
    const accessible = allFiles.filter((f) => checkPermission(role, f.path).allowed);
    res.json({
      role,
      count: accessible.length,
      files: accessible.map((f) => ({
        path: f.path,
        size: f.size,
        modifiedAt: f.modifiedAt,
        write: checkPermission(role, f.path).write,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/docs/*  读取单个文件
router.get("/*", (req: Request, res: Response) => {
  const filePath = req.params[0];
  const { role } = (req as AuthRequest).auth;

  const perm = checkPermission(role, filePath);
  if (!perm.allowed) {
    res.status(403).json({
      error: "Permission denied",
      role,
      path: filePath,
    });
    return;
  }

  if (!fileExists(filePath)) {
    res.status(404).json({ error: "File not found", path: filePath });
    return;
  }

  try {
    const content = readFile(filePath);
    res.json({
      path: filePath,
      content,
      write: perm.write,
      encoding: "utf-8",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/docs/*
// Body: { content, message?, createMR?, agentName?, assignees? }
// createMR=false → 直写文件系统（CI AUTO 区域用）
// createMR=true  → 创建 GitLab MR（AI Agent 起草手写文档用）
router.put("/*", async (req: Request, res: Response) => {
  const filePath = req.params[0];
  const { role, sub } = (req as AuthRequest).auth;
  const {
    content,
    message,
    createMR: wantMR = false,
    agentName,
    assignees,
  } = req.body as {
    content?: string;
    message?: string;
    createMR?: boolean;
    agentName?: string;
    assignees?: string[];
  };

  if (typeof content !== "string") {
    res.status(400).json({ error: "Request body must contain { content: string }" });
    return;
  }

  const perm = checkPermission(role, filePath);
  if (!perm.allowed) {
    res.status(403).json({ error: "Permission denied", role, path: filePath });
    return;
  }
  if (!perm.write) {
    res.status(403).json({ error: "Write permission denied", role, path: filePath });
    return;
  }

  if (wantMR) {
    if (!config.gitlabUrl || !config.gitlabToken || !config.gitlabSpecRepoId) {
      res.status(501).json({ error: "GitLab integration not configured (GITLAB_URL / GITLAB_TOKEN / GITLAB_SPEC_REPO_ID)" });
      return;
    }
    try {
      const { mrUrl, mrIid } = await pushFileAsMR({
        filePath,
        content,
        role,
        agentName: agentName ?? sub,
        assigneeUsernames: assignees ?? [],
      });
      res.json({ ok: true, mode: "mr", path: filePath, mrUrl, mrIid });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  try {
    const commitMsg = message ?? `docs: update ${filePath} by ${role}(${sub})`;
    writeFile(filePath, content, commitMsg);
    res.json({ ok: true, mode: "direct", path: filePath, message: commitMsg });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
