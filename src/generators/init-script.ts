import type { OnboardInput } from "./inventory";

const ROLE_DIRS: Record<string, string[]> = {
  product: ["product"],
  design: ["design"],
  frontend: ["frontend"],
  android: ["android"],
  ios: ["ios"],
  backend: ["backend"],
  test: ["test"],
};

export function generateInitScript(input: OnboardInput): string {
  const moduleDir = `02-modules/${input.moduleId}-${input.projectName.replace(/\s+/g, "")}`;

  const presentRoles = new Set(input.repos.map((r) => r.role));
  const subDirs = Array.from(presentRoles)
    .flatMap((role) => ROLE_DIRS[role] ?? [])
    .filter((v, i, a) => a.indexOf(v) === i);

  subDirs.push("test");

  const mkdirLines = subDirs.map((d) => `mkdir -p "$BASE_DIR/${d}"`).join("\n");

  const readmeLines = subDirs
    .map(
      (d) =>
        `cat > "$BASE_DIR/${d}/README.md" <<EOF\n# ${input.projectName} — ${d} 文档\n\n> 由 DocSpec 接入向导自动生成，请补充具体内容。\nEOF`
    )
    .join("\n\n");

  return `#!/bin/bash
# init-spec-dirs.sh — 初始化 ${input.projectName} 文档目录
# 由 DocSpec 接入向导自动生成
# 使用方式：bash init-spec-dirs.sh <douhua-spec 仓库根目录>

set -e

SPEC_ROOT="\${1:-$(pwd)}"
BASE_DIR="\$SPEC_ROOT/${moduleDir}"

echo "📁 创建文档目录：\$BASE_DIR"
mkdir -p "\$BASE_DIR"

# 创建子目录
${mkdirLines}

# 生成 README 占位文件
${readmeLines}

# 生成部署信息模板
cat > "\$BASE_DIR/test/${input.moduleId}-T0-部署信息.md" <<'EOF'
# ${input.moduleId} 部署信息

<!-- DOCSPEC:AUTO:START source="ci" updated="" -->
| 字段 | 值 |
|------|-----|
| 版本 | - |
| 环境 | - |
<!-- DOCSPEC:AUTO:END -->

## 手动维护区域

> 在此填写需要人工维护的补充说明。
EOF

# 复制权限配置
if [ -f ".spec-permissions-${input.moduleId.toLowerCase()}.yaml" ]; then
  cp ".spec-permissions-${input.moduleId.toLowerCase()}.yaml" "\$BASE_DIR/.spec-permissions.yaml"
fi

echo "✅ 目录初始化完成：\$BASE_DIR"
echo "📋 下一步：进入 \$BASE_DIR 补充各端文档内容"
`;
}
