import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import micromatch from "micromatch";
import { config } from "./config";

export type RoleName = string;

interface IncludeEntry {
  path?: string;
  write?: boolean;
}

interface SpecialRules {
  sensitive_files?: string[];
  deny_roles?: RoleName[];
  deploy_info_pattern?: string;
  deploy_info_allowed_roles?: RoleName[];
}

interface RoleConfig {
  description: string;
  access?: "all";
  include?: Array<string | IncludeEntry>;
}

interface PermissionsFile {
  version: string;
  roles: Record<RoleName, RoleConfig>;
  special_rules?: SpecialRules;
}

let _cache: { mtime: number; data: PermissionsFile } | null = null;

function loadPermissions(): PermissionsFile {
  const filePath = path.join(config.specRepoPath, config.permissionsFile);
  const stat = fs.statSync(filePath);
  const mtime = stat.mtimeMs;

  if (_cache && _cache.mtime === mtime) return _cache.data;

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = yaml.load(raw) as PermissionsFile;
  _cache = { mtime, data };
  return data;
}

function normalizeIncludes(entries: Array<string | IncludeEntry>): Array<{ glob: string; write: boolean }> {
  return entries.map((entry) => {
    if (typeof entry === "string") return { glob: entry, write: false };
    return { glob: entry.path ?? "", write: entry.write ?? false };
  });
}

export interface PermissionCheckResult {
  allowed: boolean;
  write: boolean;
}

export function checkPermission(role: RoleName, filePath: string): PermissionCheckResult {
  const perms = loadPermissions();
  const roleConfig = perms.roles[role];

  if (!roleConfig) return { allowed: false, write: false };

  if (roleConfig.access === "all") return { allowed: true, write: true };

  const specialRules = perms.special_rules;

  if (specialRules?.sensitive_files && specialRules.deny_roles?.includes(role)) {
    const isSensitive = micromatch.isMatch(filePath, specialRules.sensitive_files);
    if (isSensitive) return { allowed: false, write: false };
  }

  if (
    specialRules?.deploy_info_pattern &&
    specialRules.deploy_info_allowed_roles &&
    micromatch.isMatch(filePath, specialRules.deploy_info_pattern)
  ) {
    const allowed = specialRules.deploy_info_allowed_roles.includes(role);
    return { allowed, write: false };
  }

  if (!roleConfig.include) return { allowed: false, write: false };

  const normalized = normalizeIncludes(roleConfig.include);
  for (const { glob, write } of normalized) {
    if (glob && micromatch.isMatch(filePath, glob)) {
      return { allowed: true, write };
    }
  }

  return { allowed: false, write: false };
}

export function listAccessiblePaths(role: RoleName): Array<{ glob: string; write: boolean }> {
  const perms = loadPermissions();
  const roleConfig = perms.roles[role];

  if (!roleConfig) return [];
  if (roleConfig.access === "all") return [{ glob: "**", write: true }];
  if (!roleConfig.include) return [];

  return normalizeIncludes(roleConfig.include).filter((e) => e.glob);
}

export function listAllRoles(): RoleName[] {
  const perms = loadPermissions();
  return Object.keys(perms.roles);
}

export function getRoleDescription(role: RoleName): string {
  const perms = loadPermissions();
  return perms.roles[role]?.description ?? "";
}
