import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

export interface FileEntry {
  path: string;
  size: number;
  modifiedAt: Date;
}

function absPath(relPath: string): string {
  const resolved = path.resolve(config.specRepoPath, relPath);
  if (!resolved.startsWith(path.resolve(config.specRepoPath))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export function readFile(relPath: string): string {
  return fs.readFileSync(absPath(relPath), "utf-8");
}

export function writeFile(relPath: string, content: string, _commitMessage?: string): void {
  const abs = absPath(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

export function fileExists(relPath: string): boolean {
  try {
    fs.statSync(absPath(relPath));
    return true;
  } catch {
    return false;
  }
}

export function listFiles(baseDir: string = ""): FileEntry[] {
  const results: FileEntry[] = [];
  const abs = absPath(baseDir);

  function walk(dir: string, relBase: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".spec-permissions.yaml") continue;
      const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else {
        const stat = fs.statSync(fullPath);
        results.push({ path: relPath, size: stat.size, modifiedAt: stat.mtime });
      }
    }
  }

  walk(abs, baseDir);
  return results;
}

export function updateAutoSection(
  relPath: string,
  source: string,
  newContent: string,
): boolean {
  if (!fileExists(relPath)) return false;
  const original = readFile(relPath);
  const startTag = `<!-- DOCSPEC:AUTO:START source="${source}"`;
  const endTag = "<!-- DOCSPEC:AUTO:END -->";

  const startIdx = original.indexOf(startTag);
  const endIdx = original.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) return false;

  const updated =
    original.slice(0, startIdx) +
    `<!-- DOCSPEC:AUTO:START source="${source}" updated="${new Date().toISOString()}" -->\n` +
    newContent +
    "\n" +
    original.slice(endIdx);

  writeFile(relPath, updated);
  return true;
}
