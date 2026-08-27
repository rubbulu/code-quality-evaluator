// theme toggle (same pattern as rest of app)
const themeToggle = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeToggle.innerText = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("cqe-theme", theme);
}
applyTheme(localStorage.getItem("cqe-theme") || "dark");
themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("light") ? "dark" : "light");
});

function scoreColor(score) {
  if (score >= 80) return "#6fcf97";
  if (score >= 50) return "#e8a33d";
  return "#f2637a";
}

async function loadHistory() {
  const list = document.getElementById("historyList");
  const token = localStorage.getItem("cqe-token");

  if (!token) {
    list.innerHTML = `<div class="issue-empty">Please <a href="login.html" style="color: var(--teal);">log in</a> to view your analysis history.</div>`;
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/history", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const data = await res.json();
    const analyses = Array.isArray(data) ? data : (data.history || []);

    if (analyses.length === 0) {
      list.innerHTML = `<div class="issue-empty">No saved analyses yet. Run an analysis on the <a href="index.html" style="color: var(--teal);">Editor</a> page to get started.</div>`;
      return;
    }

    list.innerHTML = analyses.map(a => {
      const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "Unknown date";
      const language = a.language || "unknown";
      const score = a.score ?? "—";
      return `
        <div class="issue-item" style="justify-content: space-between; align-items: center;">
          <span>${language} — ${date}</span>
          <span style="color: ${scoreColor(score)}; font-weight: 700;">${score}/100</span>
        </div>
      `;
    }).join("");

  } catch (err) {
    list.innerHTML = `<div class="issue-empty">Could not load history. Is the backend running?</div>`;
  }
}

loadHistory();