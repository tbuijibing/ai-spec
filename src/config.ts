import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-in-prod",
  specRepoPath: process.env.SPEC_REPO_PATH ?? path.resolve(__dirname, "../../douhua-spec"),
  permissionsFile: process.env.PERMISSIONS_FILE ?? ".spec-permissions.yaml",
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  gitlabUrl: process.env.GITLAB_URL ?? "",
  gitlabToken: process.env.GITLAB_TOKEN ?? "",
  gitlabSpecRepoId: process.env.GITLAB_SPEC_REPO_ID ?? "",
};
