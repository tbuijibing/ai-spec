export interface RepoConfig {
  role: string;
  gitlabPath: string;
  techStack: string;
  hasCi: boolean;
  hasDocs: "true" | "false" | "partial" | "swagger";
}

export interface MemberConfig {
  name: string;
  gitlabUser: string;
  role: string;
}

export interface OnboardInput {
  projectName: string;
  moduleId: string;
  gitlabUrl: string;
  specRepo: string;
  repos: RepoConfig[];
  members: MemberConfig[];
}

export function generateInventory(input: OnboardInput): string {
  const reposYaml = input.repos
    .map(
      (r) =>
        `  - name: ${r.gitlabPath.split("/").pop() ?? r.role}\n` +
        `    gitlab_url: ${input.gitlabUrl}/${r.gitlabPath}\n` +
        `    tech_stack: ${r.techStack || "未填写"}\n` +
        `    has_ci: ${r.hasCi}\n` +
        `    has_docs: ${r.hasDocs}`
    )
    .join("\n");

  const membersYaml = input.members
    .map(
      (m) =>
        `  - { name: "${m.name}", role: ${m.role}, gitlab_user: ${m.gitlabUser} }`
    )
    .join("\n");

  return `# 项目接入清单 — 由 DocSpec 接入向导自动生成
# 生成时间：${new Date().toISOString()}

project_name: "${input.projectName}"
module_id: "${input.moduleId}"
gitlab_url: "${input.gitlabUrl}"
spec_repo: "${input.specRepo}"

repos:
${reposYaml}

team_roles:
${membersYaml}
`;
}
