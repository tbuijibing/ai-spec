import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import { generateInventory, type OnboardInput } from "../generators/inventory";
import { generatePermissions } from "../generators/permissions";
import { generateInitScript } from "../generators/init-script";
import { generateGitlabCiSnippet } from "../generators/gitlab-ci";
import { generatePaperclipConfig } from "../generators/paperclip";
import { generatePluginConfig } from "../generators/plugin-config";
import { writeFile } from "../gitfs";

const router = Router();

export interface GeneratedFile {
  name: string;
  content: string;
}

function buildFiles(input: OnboardInput): GeneratedFile[] {
  return [
    { name: "project-inventory.yaml",    content: generateInventory(input) },
    { name: ".spec-permissions.yaml",    content: generatePermissions(input) },
    { name: "init-spec-dirs.sh",          content: generateInitScript(input) },
    { name: "gitlab-ci-snippet.yaml",    content: generateGitlabCiSnippet(input) },
    { name: "paperclip-company.yaml",    content: generatePaperclipConfig(input) },
    { name: "plugin-config.yaml",        content: generatePluginConfig(input) },
  ];
}

// POST /api/onboard/generate  — 只生成文件内容，不写磁盘
router.post("/generate", (req: Request, res: Response) => {
  const input = req.body as OnboardInput;
  if (!input.projectName || !input.moduleId) {
    res.status(400).json({ error: "projectName and moduleId are required" });
    return;
  }
  try {
    const files = buildFiles(input);
    res.json({ ok: true, files });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/onboard/init  — 生成文件并在 specRepo 创建目录结构
router.post("/init", (req: Request, res: Response) => {
  const input = req.body as OnboardInput;
  if (!input.projectName || !input.moduleId) {
    res.status(400).json({ error: "projectName and moduleId are required" });
    return;
  }
  try {
    const files = buildFiles(input);

    const moduleDirName = `${input.moduleId}-${input.projectName.replace(/\s+/g, "")}`;
    const moduleRelPath = `02-modules/${moduleDirName}`;
    const moduleAbsPath = path.join(config.specRepoPath, moduleRelPath);
    fs.mkdirSync(moduleAbsPath, { recursive: true });

    const subDirs = ["product", "design", "frontend", "android", "ios", "backend", "test"];
    const createdDirs: string[] = [];
    for (const role of input.repos.map((r) => r.role)) {
      if (subDirs.includes(role)) {
        const dirPath = path.join(moduleAbsPath, role);
        fs.mkdirSync(dirPath, { recursive: true });
        createdDirs.push(`${moduleRelPath}/${role}`);
      }
    }
    const testDir = path.join(moduleAbsPath, "test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      createdDirs.push(`${moduleRelPath}/test`);
    }

    const t0RelPath = `${moduleRelPath}/test/${input.moduleId}-T0-部署信息.md`;
    writeFile(
      t0RelPath,
      `# ${input.moduleId} 部署信息\n\n<!-- DOCSPEC:AUTO:START source="ci" updated="" -->\n| 字段 | 值 |\n|------|-----|\n| 版本 | - |\n| 环境 | - |\n<!-- DOCSPEC:AUTO:END -->\n\n## 手动维护区域\n\n> 在此填写需要人工维护的补充说明。\n`
    );

    const permRelPath = `${moduleRelPath}/.spec-permissions.yaml`;
    writeFile(permRelPath, files.find((f) => f.name === ".spec-permissions.yaml")!.content);

    res.json({
      ok: true,
      moduleDir: moduleRelPath,
      createdDirs,
      files,
      nextSteps: [
        `1. 运行生成的 init-spec-dirs.sh 补全各端目录（如需）`,
        `2. 将 gitlab-ci-snippet.yaml 片段复制到各端 .gitlab-ci.yml`,
        `3. 按 paperclip-company.yaml 在 Paperclip 创建 Company 和 Agent`,
        `4. 将 plugin-config.yaml 填入 Paperclip 插件配置`,
      ],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/onboard/projects  — 列出已接入的项目（读取 02-modules 目录）
router.get("/projects", (_req: Request, res: Response) => {
  const modulesDir = path.join(config.specRepoPath, "02-modules");
  try {
    if (!fs.existsSync(modulesDir)) {
      res.json({ projects: [] });
      return;
    }
    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    const projects = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const parts = e.name.match(/^(SPEC-\d+)-(.+)$/);
        return {
          dir: e.name,
          moduleId: parts?.[1] ?? e.name,
          projectName: parts?.[2] ?? e.name,
        };
      });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
