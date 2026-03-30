import express from "express";
import cors from "cors";
import * as path from "path";
import { config } from "./config";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import docsRouter from "./routes/docs";
import rolesRouter from "./routes/roles";
import onboardRouter from "./routes/onboard";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/docs", docsRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/onboard", onboardRouter);

app.use("/onboard", express.static(path.join(__dirname, "../public/onboard")));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(config.port, () => {
  console.log(`[docspec-server] running on http://localhost:${config.port}`);
  console.log(`[docspec-server] spec repo: ${config.specRepoPath}`);
  console.log(`[docspec-server] permissions: ${config.permissionsFile}`);
});

export default app;
