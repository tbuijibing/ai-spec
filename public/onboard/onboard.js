// DocSpec 接入向导 — 前端逻辑
(function () {
  "use strict";

  let currentStep = 1;
  const totalSteps = 4;

  // ── 状态 ──
  const state = {
    projectName: "",
    moduleId: "",
    gitlabUrl: "",
    specRepo: "",
    repos: [],
    members: [],
    generatedFiles: [],
  };

  // ── DOM 工具 ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── 步骤切换 ──
  function goTo(step) {
    if (step < 1 || step > totalSteps) return;
    currentStep = step;
    $$(".step-panel").forEach((p) => p.classList.remove("active"));
    $$(".step-tab").forEach((t, i) => {
      t.classList.remove("active", "done");
      if (i + 1 < step) t.classList.add("done");
      if (i + 1 === step) t.classList.add("active");
    });
    $(`.step-panel[data-step="${step}"]`).classList.add("active");
    $(".btn-back").style.display = step === 1 ? "none" : "";
    $(".btn-next").textContent = step === totalSteps - 1 ? "立即接入 →" : step === totalSteps ? "" : "下一步 →";
    $(".btn-next").style.display = step === totalSteps ? "none" : "";
    window.scrollTo(0, 0);
  }

  // ── Step 1 ──
  function readStep1() {
    state.projectName = $("#projectName").value.trim();
    state.moduleId    = $("#moduleId").value.trim();
    state.gitlabUrl   = $("#gitlabUrl").value.trim().replace(/\/$/, "");
    state.specRepo    = $("#specRepo").value.trim();
  }

  function validateStep1() {
    readStep1();
    if (!state.projectName) { alert("请填写项目名称"); return false; }
    if (!state.moduleId)    { alert("请填写模块编号（如 SPEC-201）"); return false; }
    if (!state.gitlabUrl)   { alert("请填写 GitLab 地址"); return false; }
    if (!state.specRepo)    { alert("请填写 spec 仓库路径"); return false; }
    return true;
  }

  // ── Step 2 — 仓库 ──
  const ROLES = ["product","design","frontend","android","ios","backend","test"];
  const STACKS = {
    frontend: "Vue3 / React + TypeScript",
    android:  "Kotlin + Jetpack",
    ios:      "Swift + UIKit",
    backend:  "Go / Java / Node.js",
    product:  "-",
    design:   "Figma",
    test:     "-",
  };

  function renderRepos() {
    const list = $("#repoList");
    list.innerHTML = "";
    state.repos.forEach((repo, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">仓库 ${idx + 1} <span class="role-tag">${repo.role}</span></div>
        <button class="remove-btn" data-idx="${idx}" title="删除">✕</button>
        <div class="field-row">
          <div class="field">
            <label>GitLab 仓库路径</label>
            <input type="text" value="${repo.gitlabPath}" data-idx="${idx}" data-field="gitlabPath" placeholder="group/repo-name" />
          </div>
          <div class="field">
            <label>技术栈</label>
            <input type="text" value="${repo.techStack}" data-idx="${idx}" data-field="techStack" placeholder="${STACKS[repo.role] || ""}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>已有 CI</label>
            <select data-idx="${idx}" data-field="hasCi">
              <option value="true"  ${repo.hasCi ? "selected" : ""}>是</option>
              <option value="false" ${!repo.hasCi ? "selected" : ""}>否</option>
            </select>
          </div>
          <div class="field">
            <label>已有文档</label>
            <select data-idx="${idx}" data-field="hasDocs">
              <option value="false"   ${repo.hasDocs==="false"   ?"selected":""}>无</option>
              <option value="partial" ${repo.hasDocs==="partial" ?"selected":""}>有（部分）</option>
              <option value="true"    ${repo.hasDocs==="true"    ?"selected":""}>完整</option>
              <option value="swagger" ${repo.hasDocs==="swagger" ?"selected":""}>Swagger</option>
            </select>
          </div>
        </div>`;
      list.appendChild(card);
    });

    list.querySelectorAll(".remove-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        state.repos.splice(Number(e.currentTarget.dataset.idx), 1);
        renderRepos();
      })
    );
    list.querySelectorAll("input[data-field], select[data-field]").forEach((el) =>
      el.addEventListener("change", (e) => {
        const { idx, field } = e.currentTarget.dataset;
        let val = e.currentTarget.value;
        if (field === "hasCi") val = val === "true";
        state.repos[Number(idx)][field] = val;
      })
    );
  }

  function addRepo(role) {
    state.repos.push({ role, gitlabPath: "", techStack: STACKS[role] || "", hasCi: true, hasDocs: "false" });
    renderRepos();
  }

  function validateStep2() {
    if (state.repos.length === 0) { alert("请至少添加一个仓库"); return false; }
    if (state.repos.some((r) => !r.gitlabPath)) { alert("请填写所有仓库的 GitLab 路径"); return false; }
    return true;
  }

  // ── Step 3 — 成员 ──
  function renderMembers() {
    const list = $("#memberList");
    list.innerHTML = "";
    state.members.forEach((m, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">成员 ${idx + 1} <span class="role-tag">${m.role}</span></div>
        <button class="remove-btn" data-idx="${idx}" title="删除">✕</button>
        <div class="field-row">
          <div class="field">
            <label>姓名</label>
            <input type="text" value="${m.name}" data-idx="${idx}" data-field="name" placeholder="张三" />
          </div>
          <div class="field">
            <label>GitLab 用户名</label>
            <input type="text" value="${m.gitlabUser}" data-idx="${idx}" data-field="gitlabUser" placeholder="zhangsan" />
          </div>
        </div>
        <div class="field" style="max-width:50%">
          <label>角色</label>
          <select data-idx="${idx}" data-field="role">
            ${ROLES.map((r) => `<option value="${r}" ${m.role===r?"selected":""}>${r}</option>`).join("")}
          </select>
        </div>`;
      list.appendChild(card);
    });

    list.querySelectorAll(".remove-btn").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        state.members.splice(Number(e.currentTarget.dataset.idx), 1);
        renderMembers();
      })
    );
    list.querySelectorAll("input[data-field], select[data-field]").forEach((el) =>
      el.addEventListener("change", (e) => {
        const { idx, field } = e.currentTarget.dataset;
        state.members[Number(idx)][field] = e.currentTarget.value;
        if (field === "role") renderMembers();
      })
    );
  }

  function validateStep3() {
    if (state.members.length === 0) { alert("请至少添加一位成员"); return false; }
    if (state.members.some((m) => !m.name || !m.gitlabUser)) { alert("请填写所有成员的姓名和 GitLab 用户名"); return false; }
    return true;
  }

  // ── Step 4 — 生成 & 下载 ──
  async function generateFiles() {
    const body = {
      projectName: state.projectName,
      moduleId:    state.moduleId,
      gitlabUrl:   state.gitlabUrl,
      specRepo:    state.specRepo,
      repos:       state.repos,
      members:     state.members,
    };

    const panel = $(`.step-panel[data-step="4"]`);
    panel.innerHTML = `<div class="loading"><div class="spinner"></div>正在生成配置文件...</div>`;

    try {
      const res = await fetch("/api/onboard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      state.generatedFiles = data.files;
      renderResult(panel);
    } catch (err) {
      panel.innerHTML = `<div class="error-box">❌ 生成失败：${err.message}</div>
        <button class="btn btn-secondary" id="retryBtn">重试</button>`;
      $("#retryBtn").addEventListener("click", generateFiles);
    }
  }

  function renderResult(panel) {
    const filesHtml = state.generatedFiles
      .map(
        (f) => `
      <div class="file-card">
        <div class="file-card-header">
          <span class="name">📄 ${f.name}</span>
          <div class="actions">
            <button class="btn-copy" data-name="${f.name}">复制</button>
            <button class="btn-dl"   data-name="${f.name}">下载</button>
          </div>
        </div>
        <pre class="file-preview">${escHtml(f.content.slice(0, 500))}</pre>
      </div>`
      )
      .join("");

    panel.innerHTML = `
      <h2>✅ 配置文件已生成</h2>
      <div class="result-grid">${filesHtml}</div>
      <div class="zip-btn-wrap">
        <button class="btn-zip" id="downloadZip">⬇ 打包下载全部文件（.zip）</button>
      </div>
      <div class="next-steps">
        <h3>📋 下一步操作</h3>
        <ol>
          <li>将 <code>.spec-permissions.yaml</code> 复制到 douhua-spec 仓库根目录</li>
          <li>运行 <code>init-spec-dirs.sh</code> 创建模块目录结构</li>
          <li>将 <code>gitlab-ci-snippet.yaml</code> 各端片段添加到 <code>.gitlab-ci.yml</code></li>
          <li>按 <code>paperclip-company.yaml</code> 在 Paperclip 创建 Company 和 Agent</li>
          <li>将 <code>plugin-config.yaml</code> 填入 Paperclip 插件配置</li>
        </ol>
      </div>`;

    panel.querySelectorAll(".btn-copy").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const file = state.generatedFiles.find((f) => f.name === e.currentTarget.dataset.name);
        if (file) navigator.clipboard.writeText(file.content).then(() => { btn.textContent = "已复制 ✓"; setTimeout(() => (btn.textContent = "复制"), 1500); });
      })
    );
    panel.querySelectorAll(".btn-dl").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const file = state.generatedFiles.find((f) => f.name === e.currentTarget.dataset.name);
        if (file) downloadText(file.name, file.content);
      })
    );
    $("#downloadZip").addEventListener("click", downloadAllAsZip);
  }

  function downloadText(filename, content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function downloadAllAsZip() {
    // 使用 JSZip（CDN 引入）
    if (typeof JSZip === "undefined") {
      alert("JSZip 未加载，请检查网络连接后刷新页面重试。\n\n也可以逐个点击"下载"按钮单独下载每个文件。");
      return;
    }
    const zip = new JSZip();
    state.generatedFiles.forEach((f) => zip.file(f.name, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `docspec-onboard-${state.moduleId}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── 事件绑定 ──
  function init() {
    goTo(1);

    // 角色快捷添加按钮（Step 2）
    $$(".add-repo-btn").forEach((btn) =>
      btn.addEventListener("click", () => addRepo(btn.dataset.role))
    );

    // 添加成员按钮（Step 3）
    $("#addMemberBtn").addEventListener("click", () => {
      state.members.push({ name: "", gitlabUser: "", role: "frontend" });
      renderMembers();
    });

    // 导航按钮
    $(".btn-next").addEventListener("click", () => {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateStep2()) return;
      if (currentStep === 3 && !validateStep3()) return;
      if (currentStep === 3) {
        goTo(4);
        generateFiles();
        return;
      }
      goTo(currentStep + 1);
    });

    $(".btn-back").addEventListener("click", () => goTo(currentStep - 1));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
