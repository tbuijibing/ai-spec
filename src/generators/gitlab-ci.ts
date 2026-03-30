import type { OnboardInput, RepoConfig } from "./inventory";

export function generateGitlabCiSnippet(input: OnboardInput): string {
  const snippets = input.repos.map((repo) => generateRepoSnippet(repo, input));
  return snippets.join("\n---\n\n");
}

function generateRepoSnippet(repo: RepoConfig, input: OnboardInput): string {
  const tokenVar = `DOCSPEC_TOKEN_${repo.role.toUpperCase()}`;
  return `# ===================================================
# 复制以下片段到 ${repo.gitlabPath} 仓库的 .gitlab-ci.yml 末尾
# 项目：${input.projectName}（${input.moduleId}）
# ===================================================

sync-spec-docs:
  stage: .post
  image: curlimages/curl:latest
  variables:
    DOCSPEC_SERVER_URL: "\${DOCSPEC_SERVER_URL}"   # 在 GitLab CI/CD Variables 中设置
    DOCSPEC_TOKEN: "\${${tokenVar}}"               # 在 GitLab CI/CD Variables 中设置
  script:
    - |
      PAYLOAD=$(cat <<EOF
      {
        "source": "${repo.role}-ci",
        "version": "$CI_COMMIT_TAG",
        "commit": "$CI_COMMIT_SHORT_SHA",
        "branch": "$CI_COMMIT_BRANCH",
        "pipelineUrl": "$CI_PIPELINE_URL",
        "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      }
      EOF
      )
      curl -sf -X PUT \\
        "$DOCSPEC_SERVER_URL/api/docs/${input.moduleId.toLowerCase()}-${input.projectName.replace(/\s+/g, "")}/test/${input.moduleId}-T0-部署信息.md" \\
        -H "Authorization: Bearer $DOCSPEC_TOKEN" \\
        -H "Content-Type: application/json" \\
        -d "{
              \\"source\\": \\"${repo.role}-ci\\",
              \\"version\\": \\"$CI_COMMIT_TAG\\",
              \\"commit\\": \\"$CI_COMMIT_SHORT_SHA\\",
              \\"branch\\": \\"$CI_COMMIT_BRANCH\\",
              \\"pipelineUrl\\": \\"$CI_PIPELINE_URL\\"
            }" || echo "[WARN] DocSpec 文档同步失败，不影响主流程"
  rules:
    - if: '$CI_COMMIT_BRANCH == "main" || $CI_COMMIT_BRANCH == "master"'
      when: on_success
  allow_failure: true

# CI/CD Variables 配置说明（在 GitLab 项目 Settings → CI/CD → Variables 中添加）:
# DOCSPEC_SERVER_URL = http://your-docspec-server:4000
# ${tokenVar}        = <${repo.role} 角色的 JWT Token>
#   获取方式：POST http://your-docspec-server:4000/api/auth/token
#             Body: { "sub": "ci-bot", "role": "${repo.role}", "secret": "<TOKEN_ISSUE_SECRET>" }
`;
}
