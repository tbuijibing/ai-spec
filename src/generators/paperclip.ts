import type { OnboardInput } from "./inventory";

export function generatePaperclipConfig(input: OnboardInput): string {
  const agents = input.members
    .map(
      (m) =>
        `  - name: "${m.name}（${m.role}）"\n` +
        `    role: ${m.role}\n` +
        `    gitlabUser: ${m.gitlabUser}\n` +
        `    adapterType: http\n` +
        `    description: "${m.name} - ${m.role} 角色"`
    )
    .join("\n");

  const repoWebhooks = input.repos
    .map(
      (r) =>
        `  - repo: "${input.gitlabUrl}/${r.gitlabPath}"\n` +
        `    role: ${r.role}\n` +
        `    events: [push, merge_request]`
    )
    .join("\n");

  return `# Paperclip Company 配置 — ${input.projectName}
# 由 DocSpec 接入向导自动生成
# 使用方式：在 Paperclip 管理页面导入此配置，或手动创建对应公司和 Agent

company:
  name: "${input.projectName}"
  description: "DocSpec 接入项目：${input.moduleId}"
  moduleId: "${input.moduleId}"

agents:
${agents}

gitlab_webhooks:
${repoWebhooks}

# 导入说明：
# 1. 登录 Paperclip 管理后台
# 2. 创建新 Company，名称填写上方 company.name
# 3. 按 agents 列表逐一添加 Agent，设置对应 role
# 4. 在各 GitLab 仓库配置 Webhook：
#    URL: http://<paperclip-host>/api/webhooks/gitlab
#    Secret: <webhook-secret>
#    Events: Push + Merge Request
`;
}
