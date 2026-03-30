// DocSpec Onboard Wizard - Frontend Logic
(function () {
  "use strict";

  let currentStep = 1;
  const totalSteps = 4;

  // State
  const state = {
    projectName: "",
    moduleId: "",
    gitlabUrl: "",
    specRepo: "",
    repos: [],
    members: [],
    generatedFiles: [],
  };

  // DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Step navigation
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
    $(".btn-next").textContent = step === totalSteps - 1 ? "Start Now" : step === totalSteps ? "" : "Next";
    $(".btn-next").style.display = step === totalSteps ? "none" : "";
    window.scrollTo(0, 0);
  }

  // Step 1
  function readStep1() {
    state.projectName = $("#projectName").value.trim();
    state.moduleId    = $("#moduleId").value.trim();
    state.gitlabUrl   = $("#gitlabUrl").value.trim().replace(/\/$/, "");
    state.specRepo    = $("#specRepo").value.trim();
  }

  function validateStep1() {
    readStep1();
    if (!state.projectName) { alert("Please enter project name"); return false; }
    if (!state.moduleId)    { alert("Please enter module ID (e.g., SPEC-201)"); return false; }
    if (!state.gitlabUrl)   { alert("Please enter GitLab URL"); return false; }
    if (!state.specRepo)    { alert("Please enter spec repo path"); return false; }
    return true;
  }

  // Step 2 - Repos
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
        <div class="card-title">Repo ${idx + 1} <span class="role-tag">${repo.role}</span></div>
        <button class="remove-btn" data-idx="${idx}" title="Remove">X</button>
        <div class="field-row">
          <div class="field">
            <label>GitLab Repo Path</label>
            <input type="text" value="${repo.gitlabPath}" data-idx="${idx}" data-field="gitlabPath" placeholder="group/repo-name" />
          </div>
          <div class="field">
            <label>Tech Stack</label>
            <input type="text" value="${repo.techStack}" data-idx="${idx}" data-field="techStack" placeholder="${STACKS[repo.role] || ""}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Has CI</label>
            <select data-idx="${idx}" data-field="hasCi">
              <option value="true"  ${repo.hasCi ? "selected" : ""}>Yes</option>
              <option value="false" ${!repo.hasCi ? "selected" : ""}>No</option>
            </select>
          </div>
          <div class="field">
            <label>Has Docs</label>
            <select data-idx="${idx}" data-field="hasDocs">
              <option value="false"   ${repo.hasDocs==="false"   ?"selected":""}>None</option>
              <option value="partial" ${repo.hasDocs==="partial" ?"selected":""}>Partial</option>
              <option value="true"    ${repo.hasDocs==="true"    ?"selected":""}>Complete</option>
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
    if (state.repos.length === 0) { alert("Please add at least one repo"); return false; }
    if (state.repos.some((r) => !r.gitlabPath)) { alert("Please fill in GitLab path for all repos"); return false; }
    return true;
  }

  // Step 3 - Members
  function renderMembers() {
    const list = $("#memberList");
    list.innerHTML = "";
    state.members.forEach((m, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-title">Member ${idx + 1} <span class="role-tag">${m.role}</span></div>
        <button class="remove-btn" data-idx="${idx}" title="Remove">X</button>
        <div class="field-row">
          <div class="field">
            <label>Name</label>
            <input type="text" value="${m.name}" data-idx="${idx}" data-field="name" placeholder="John Doe" />
          </div>
          <div class="field">
            <label>GitLab Username</label>
            <input type="text" value="${m.gitlabUser}" data-idx="${idx}" data-field="gitlabUser" placeholder="johndoe" />
          </div>
        </div>
        <div class="field" style="max-width:50%">
          <label>Role</label>
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
    if (state.members.length === 0) { alert("Please add at least one member"); return false; }
    if (state.members.some((m) => !m.name || !m.gitlabUser)) { alert("Please fill in name and GitLab username for all members"); return false; }
    return true;
  }

  // Step 4 - Generate
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
    panel.innerHTML = `<div class="loading"><div class="spinner"></div>Generating config files...</div>`;

    try {
      const res = await fetch("/api/onboard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      state.generatedFiles = data.files;
      renderResult(panel);
    } catch (err) {
      panel.innerHTML = `<div class="error-box">Error: ${err.message}</div>
        <button class="btn btn-secondary" id="retryBtn">Retry</button>`;
      $("#retryBtn").addEventListener("click", generateFiles);
    }
  }

  function renderResult(panel) {
    const filesHtml = state.generatedFiles
      .map(
        (f) => `
      <div class="file-card">
        <div class="file-card-header">
          <span class="name">${f.name}</span>
          <div class="actions">
            <button class="btn-copy" data-name="${f.name}">Copy</button>
            <button class="btn-dl"   data-name="${f.name}">Download</button>
          </div>
        </div>
        <pre class="file-preview">${escHtml(f.content.slice(0, 500))}</pre>
      </div>`
      )
      .join("");

    panel.innerHTML = `
      <h2>Config Files Generated</h2>
      <div class="result-grid">${filesHtml}</div>
      <div class="zip-btn-wrap">
        <button class="btn-zip" id="downloadZip">Download All (.zip)</button>
      </div>
      <div class="next-steps">
        <h3>Next Steps</h3>
        <ol>
          <li>Copy <code>.spec-permissions.yaml</code> to douhua-spec repo root</li>
          <li>Run <code>init-spec-dirs.sh</code> to create module directory structure</li>
          <li>Add <code>gitlab-ci-snippet.yaml</code> fragments to each repo's <code>.gitlab-ci.yml</code></li>
          <li>Create Company and Agents in Paperclip using <code>paperclip-company.yaml</code></li>
          <li>Fill <code>plugin-config.yaml</code> into Paperclip plugin settings</li>
        </ol>
      </div>`;

    panel.querySelectorAll(".btn-copy").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const file = state.generatedFiles.find((f) => f.name === e.currentTarget.dataset.name);
        if (file) navigator.clipboard.writeText(file.content).then(() => { btn.textContent = "Copied!"; setTimeout(() => (btn.textContent = "Copy"), 1500); });
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
    if (typeof JSZip === "undefined") {
      alert("JSZip not loaded. Please check network connection and refresh page.");
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
    return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
  }

  // Init
  function init() {
    goTo(1);

    // Role quick-add buttons (Step 2)
    $$(".add-repo-btn").forEach((btn) =>
      btn.addEventListener("click", () => addRepo(btn.dataset.role))
    );

    // Add member button (Step 3)
    $("#addMemberBtn").addEventListener("click", () => {
      state.members.push({ name: "", gitlabUser: "", role: "frontend" });
      renderMembers();
    });

    // Navigation buttons
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
