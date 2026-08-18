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
    renderDashboard(result);
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


/* ===== DASHBOARD CHARTS ===== */

Chart.defaults.color = "#e8eaf0";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";

let errorBreakdownChartInstance = null;
let languageBreakdownChartInstance = null;
let scoreDistributionChartInstance = null;

function destroyChart(chartInstance) {
  if (chartInstance) {
    chartInstance.destroy();
  }
}

function renderErrorBreakdownChart(errors) {
  const ctx = document.getElementById("errorBreakdownChart").getContext("2d");

  const errorCounts = {};
  errors.forEach(e => {
    const type = e.type || "warning";
    errorCounts[type] = (errorCounts[type] || 0) + 1;
  });

  destroyChart(errorBreakdownChartInstance);

  errorBreakdownChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(errorCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [{
        data: Object.values(errorCounts),
        backgroundColor: ["#f2637a", "#e8a33d", "#4fd1c5", "#6fcf97"],
        borderColor: "#191c27",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#e8eaf0",
            font: { size: 11 },
            padding: 12
          }
        }
      }
    }
  });
}

function renderLanguageBreakdownChart(language) {
  const ctx = document.getElementById("languageBreakdownChart").getContext("2d");

  destroyChart(languageBreakdownChartInstance);

  const languages = ["JavaScript", "Python", "Java", "C", "C++", "HTML", "CSS"];
  const languageMap = { javascript: "JavaScript", python: "Python", clike: "Java", htmlmixed: "HTML", css: "CSS" };
  const selected = languageMap[language] || "Unknown";

  languageBreakdownChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: languages,
      datasets: [{
        label: "Analysis Count",
        data: languages.map(l => l === selected ? 1 : 0),
        backgroundColor: languages.map(l => l === selected ? "#4fd1c5" : "#2c3040"),
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 1,
          ticks: { color: "#8b93a7" },
          grid: { color: "#2c3040" }
        },
        y: {
          ticks: { color: "#8b93a7" },
          grid: { display: false }
        }
      }
    }
  });
}

function renderScoreDistributionChart(score) {
  const ctx = document.getElementById("scoreDistributionChart").getContext("2d");

  destroyChart(scoreDistributionChartInstance);

  const ranges = ["0-20", "21-40", "41-60", "61-80", "81-100"];
  const distribution = [0, 0, 0, 0, 0];

  if (score <= 20) distribution[0] = 1;
  else if (score <= 40) distribution[1] = 1;
  else if (score <= 60) distribution[2] = 1;
  else if (score <= 80) distribution[3] = 1;
  else distribution[4] = 1;

  scoreDistributionChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ranges,
      datasets: [{
        label: "Score Range",
        data: distribution,
        backgroundColor: "#4fd1c5",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1,
          ticks: { display: false },
          grid: { display: false }
        },
        x: {
          ticks: { color: "#8b93a7" },
          grid: { display: false }
        }
      }
    }
  });
}

function updateComplexityMetrics(result) {
  const complexityEl = document.getElementById("metricComplexity");
  const duplicatesEl = document.getElementById("metricDuplicates");
  const issuesEl = document.getElementById("metricIssues");

  const complexity = result.complexity ? result.complexity.toString() : "—";
  const duplicates = result.duplicates ? result.duplicates.length.toString() : "0";
  const totalIssues = result.errors ? result.errors.length.toString() : "0";

  complexityEl.innerText = complexity;
  duplicatesEl.innerText = duplicates;
  issuesEl.innerText = totalIssues;
}

function renderDashboard(result) {
  if (result.errors && result.errors.length > 0) {
    renderErrorBreakdownChart(result.errors);
  }
  renderLanguageBreakdownChart(currentLanguage());
  renderScoreDistributionChart(result.score || 0);
  updateComplexityMetrics(result);
}