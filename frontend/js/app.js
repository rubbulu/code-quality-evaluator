const editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
  lineNumbers: true,
  mode: "javascript",
  theme: "dracula",
});

// theme toggle
const themeToggle = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  editor.setOption("theme", theme === "light" ? "default" : "dracula");
  themeToggle.innerText = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("cqe-theme", theme);
}
applyTheme(localStorage.getItem("cqe-theme") || "dark");
themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light") ? "dark" : "light");
});

// language tabs
const tabs = document.querySelectorAll(".tab");
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    editor.setOption("mode", tab.dataset.mode);
    document.getElementById("statusLang").innerText = tab.dataset.label;
  });
});

function currentLanguage() {
  return document.querySelector(".tab.active").dataset.mode;
}

// quality ring
const RING_CIRCUMFERENCE = 377;
function updateRing(score) {
  const ring = document.getElementById("ringFill");
  const scoreLabel = document.getElementById("ringScore");
  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * score) / 100;

  ring.style.strokeDashoffset = offset;
  scoreLabel.innerText = score;

  let color = "#8b93a7";
  if (score >= 80) color = "#6fcf97";
  else if (score >= 50) color = "#e8a33d";
  else color = "#f2637a";
  ring.style.stroke = color;
}

// issues list
function renderIssues(errors) {
  const list = document.getElementById("issuesList");
  if (!errors || errors.length === 0) {
    list.innerHTML = `<div class="issue-empty">No issues found. Clean code.</div>`;
    return;
  }
  list.innerHTML = errors.map(e => `
    <div class="issue-item ${e.type || 'warning'}">
      <span class="dot">●</span>
      <span>Line ${e.line ?? '?'}: ${e.message}</span>
    </div>
  `).join("");
}

// backend connectivity check
async function checkBackend() {
  const statusEl = document.getElementById("connStatus");
  try {
    const res = await fetch("http://localhost:5000");
    if (res.ok) {
      statusEl.innerText = "● backend connected";
      statusEl.className = "titlebar-status online";
    } else throw new Error();
  } catch {
    statusEl.innerText = "● backend offline";
    statusEl.className = "titlebar-status offline";
  }
}
checkBackend();

// analyze
async function runAnalysis() {
  const code = editor.getValue();
  const language = currentLanguage();
  const statusReady = document.getElementById("statusReady");
  statusReady.innerText = "Analyzing…";

  try {
    const response = await fetch("http://localhost:5000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code })
    });
    const result = await response.json();
    updateRing(result.score ?? 0);
    renderIssues(result.errors);
    statusReady.innerText = "Ready";
  } catch (err) {
    statusReady.innerText = "Backend not reachable";
    document.getElementById("issuesList").innerHTML =
      `<div class="issue-empty">Could not reach the backend. Is the server running?</div>`;
  }
}

document.getElementById("analyzeBtn").addEventListener("click", runAnalysis);
editor.setOption("extraKeys", {
  "Ctrl-Enter": runAnalysis
});