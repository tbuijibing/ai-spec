import { config } from "./config";

interface GitLabCommitAction {
  action: "create" | "update" | "delete";
  file_path: string;
  content: string;
  encoding?: "text" | "base64";
}

interface GitLabMRResponse {
  iid: number;
  web_url: string;
  title: string;
}

async function glFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = config.gitlabUrl.replace(/\/$/, "");
  const url = `${base}/api/v4${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "PRIVATE-TOKEN": config.gitlabToken,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitLab API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function branchExists(
  repoId: string,
  branchName: string
): Promise<boolean> {
  try {
    await glFetch(`/projects/${encodeURIComponent(repoId)}/repository/branches/${encodeURIComponent(branchName)}`);
    return true;
  } catch {
    return false;
  }
}

export async function createBranch(
  repoId: string,
  branchName: string,
  ref = "main"
): Promise<void> {
  await glFetch(`/projects/${encodeURIComponent(repoId)}/repository/branches`, {
    method: "POST",
    body: JSON.stringify({ branch: branchName, ref }),
  });
}

export async function commitFiles(
  repoId: string,
  branchName: string,
  message: string,
  actions: GitLabCommitAction[]
): Promise<void> {
  await glFetch(`/projects/${encodeURIComponent(repoId)}/repository/commits`, {
    method: "POST",
    body: JSON.stringify({
      branch: branchName,
      commit_message: message,
      actions,
    }),
  });
}

export async function fileExistsInRepo(
  repoId: string,
  filePath: string,
  ref = "main"
): Promise<boolean> {
  try {
    await glFetch(
      `/projects/${encodeURIComponent(repoId)}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`
    );
    return true;
  } catch {
    return false;
  }
}

export async function createMR(
  repoId: string,
  sourceBranch: string,
  title: string,
  description: string,
  assigneeUsernames: string[] = []
): Promise<GitLabMRResponse> {
  const body: Record<string, unknown> = {
    source_branch: sourceBranch,
    target_branch: "main",
    title,
    description,
    remove_source_branch: true,
  };
  if (assigneeUsernames.length > 0) {
    const users = await Promise.all(
      assigneeUsernames.map((u) =>
        glFetch<{ id: number }[]>(`/users?username=${encodeURIComponent(u)}`)
      )
    );
    const ids = users.flatMap((arr) => arr.map((u) => u.id));
    if (ids.length > 0) body.assignee_ids = ids;
  }
  return glFetch<GitLabMRResponse>(
    `/projects/${encodeURIComponent(repoId)}/merge_requests`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function pushFileAsMR(params: {
  filePath: string;
  content: string;
  role: string;
  agentName: string;
  assigneeUsernames?: string[];
}): Promise<{ mrUrl: string; mrIid: number }> {
  const repoId = config.gitlabSpecRepoId;
  const ts = Date.now();
  const branchName = `agent/${params.role}-update-${ts}`;

  const exists = await fileExistsInRepo(repoId, params.filePath);
  await createBranch(repoId, branchName);
  await commitFiles(repoId, branchName, `docs: update ${params.filePath} by ${params.role} agent`, [
    {
      action: exists ? "update" : "create",
      file_path: params.filePath,
      content: params.content,
    },
  ]);

  const mr = await createMR(
    repoId,
    branchName,
    `[${params.role}] Update ${params.filePath}`,
    `由 ${params.agentName}（${params.role} Agent）自动起草，请人工 Review 后合并。`,
    params.assigneeUsernames ?? []
  );

  return { mrUrl: mr.web_url, mrIid: mr.iid };
}
