import { Router, Request, Response } from "express";
import { signToken } from "../auth";
import { listAllRoles } from "../permissions";

const router = Router();

// POST /api/auth/token  签发 JWT（开发/测试用，生产环境应对接 SSO）
// Body: { sub: string, role: string, secret: string }
router.post("/token", (req: Request, res: Response) => {
  const { sub, role, secret } = req.body as {
    sub?: string;
    role?: string;
    secret?: string;
  };

  if (!sub || !role) {
    res.status(400).json({ error: "sub and role are required" });
    return;
  }

  const validRoles = listAllRoles();
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Valid roles: ${validRoles.join(", ")}` });
    return;
  }

  // 简单密钥校验（生产环境请对接真实认证）
  const expectedSecret = process.env.TOKEN_ISSUE_SECRET ?? "dev-token-secret";
  if (secret !== expectedSecret) {
    res.status(403).json({ error: "Invalid secret" });
    return;
  }

  const token = signToken(sub, role);
  res.json({ token, sub, role, expiresIn: "8h" });
});

export default router;
