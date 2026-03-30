import { Router } from "express";
import { config } from "../config";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    specRepoPath: config.specRepoPath,
    permissionsFile: config.permissionsFile,
    timestamp: new Date().toISOString(),
  });
});

export default router;
