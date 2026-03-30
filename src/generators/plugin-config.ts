import type { OnboardInput } from "./inventory";

export function generatePluginConfig(input: OnboardInput): string {
  const roleMapping = input.members
    .map((m) => `    ${m.role}: ${m.role}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join("\n");

  return `# douhua-spec-plugin 配置 — ${input.projectName}
# 由 DocSpec 接入向导自动生成
# 将此配置填写到 Paperclip 插件设置页面（Settings → Plugins → douhua-spec → Configure）

plugin: douhua-spec
version: "1.0"

config:
  docspecServerUrl: "http://localhost:4000"
  docspecAdminToken: "<从 /api/auth/token 获取的 admin JWT>"

  gitlabUrl: "${input.gitlabUrl}"
  gitlabToken: "<GitLab Personal Access Token，需要 api scope>"
  specRepoId: "${input.specRepo}"

  moduleId: "${input.moduleId}"
  projectName: "${input.projectName}"

  roleMapping:
    # Paperclip Agent role → docspec 角色（通常相同）
${roleMapping}

# 注意事项：
# 1. docspecAdminToken 每 8 小时过期，建议配置为服务账号的长期 Token
# 2. gitlabToken 需要 api scope（创建 branch/commit/MR 权限）
# 3. 以上 Token 不要提交到代码仓库，通过环境变量或密钥管理工具注入
`;
}
