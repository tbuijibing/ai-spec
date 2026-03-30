import type { OnboardInput } from "./inventory";

const ROLE_DEFAULTS: Record<string, { description: string; paths: string[] }> = {
  admin: {
    description: "全局管理员，拥有所有文档的读写权限",
    paths: ["**"],
  },
  product: {
    description: "产品经理，可读写产品文档，只读其他文档",
    paths: ["product/**", "README.md"],
  },
  design: {
    description: "设计师，可读写设计文档",
    paths: ["design/**", "product/**", "README.md"],
  },
  frontend: {
    description: "前端开发，可读写前端文档",
    paths: ["frontend/**", "backend/B4-*.md", "design/**", "product/**", "README.md"],
  },
  android: {
    description: "Android 开发，可读写 Android 文档",
    paths: ["android/**", "backend/B4-*.md", "design/**", "product/**", "README.md"],
  },
  ios: {
    description: "iOS 开发，可读写 iOS 文档",
    paths: ["ios/**", "backend/B4-*.md", "design/**", "product/**", "README.md"],
  },
  backend: {
    description: "后端开发，可读写后端文档",
    paths: ["backend/**", "product/**", "README.md"],
  },
  test: {
    description: "测试人员，只读测试文档和部署信息",
    paths: ["test/**", "README.md"],
  },
};

export function generatePermissions(input: OnboardInput): string {
  const presentRoles = new Set(input.members.map((m) => m.role));
  presentRoles.add("admin");

  const rolesYaml = Array.from(presentRoles)
    .map((role) => {
      const def = ROLE_DEFAULTS[role];
      if (!def) return `  ${role}:\n    description: "${role} 角色"\n    include: []`;

      if (role === "admin") {
        return `  admin:\n    description: "${def.description}"\n    access: all`;
      }

      const paths = def.paths
        .map((p) => `      - path: "${input.moduleId.toLowerCase()}/${p}"\n        write: ${p.startsWith(role) ? "true" : "false"}`)
        .join("\n");

      return `  ${role}:\n    description: "${def.description}"\n    include:\n${paths}`;
    })
    .join("\n\n");

  return `# DocSpec 权限配置 — ${input.projectName}
# 由接入向导自动生成，可按需调整
# 生成时间：${new Date().toISOString()}

version: "1.0"

roles:
${rolesYaml}

special_rules:
  deploy_info_pattern: "${input.moduleId.toLowerCase()}/**/T0-*.md"
  deploy_info_allowed_roles: [admin, test, product]
`;
}
