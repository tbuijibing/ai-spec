import { Router, Request, Response } from "express";
import { authMiddleware, TokenPayload } from "../auth";
import { listAllRoles, listAccessiblePaths, getRoleDescription } from "../permissions";

const router = Router();
type AuthRequest = Request & { auth: TokenPayload };

router.use(authMiddleware);

// GET /api/roles  列出所有角色（admin 可见全部，其他只见自己）
router.get("/", (req: Request, res: Response) => {
  const { role } = (req as AuthRequest).auth;
  const allRoles = listAllRoles();
  const visible = role === "admin" ? allRoles : [role];

  res.json({
    roles: visible.map((r) => ({
      name: r,
      description: getRoleDescription(r),
    })),
  });
});

// GET /api/roles/:role/paths  获取指定角色的可访问路径列表
router.get("/:role/paths", (req: Request, res: Response) => {
  const requester = (req as AuthRequest).auth.role;
  const targetRole = req.params.role;

  if (requester !== "admin" && requester !== targetRole) {
    res.status(403).json({ error: "Can only view your own role paths unless admin" });
    return;
  }

  const paths = listAccessiblePaths(targetRole);
  res.json({
    role: targetRole,
    description: getRoleDescription(targetRole),
    paths,
  });
});

export default router;
