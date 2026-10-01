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
  if (score >= 85) return "#6fcf97";
  if (score >= 65) return "#4fd1c5";
  if (score >= 40) return "#e8a33d";
  return "#f2637a";
}

function openInEditor(code, language) {
  localStorage.setItem("cqe-restore-code", code || "");
  localStorage.setItem("cqe-restore-lang", language || "javascript");
  window.location.href = "index.html";
}

function clearLocalHistory() {
  if (confirm("Are you sure you want to clear your local analysis history?")) {
    localStorage.removeItem("cqe-local-history");
    loadHistory();
  }
}

async function loadHistory() {
  const list = document.getElementById("historyList");
  const notification = document.getElementById("historyNotification");
  const actions = document.getElementById("historyActions");
  const sourceLabel = document.getElementById("historySourceLabel");
  const token = localStorage.getItem("cqe-token");

  const rawLocal = localStorage.getItem("cqe-local-history");
  let localHistory = [];
  try {
    localHistory = rawLocal ? JSON.parse(rawLocal) : [];
  } catch (e) {
    localHistory = [];
  }

  let analyses = [];
  let isCloud = false;

  if (token) {
    try {
      const res = await fetch("http://localhost:5000/api/history", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        // Token has expired or is invalid
        localStorage.removeItem("cqe-token");
        if (notification) {
          notification.innerHTML = `
            <div style="background: rgba(232, 163, 61, 0.15); border: 1px solid #e8a33d; border-radius: 6px; padding: 12px 16px; margin-bottom: 15px; font-size: 13px; color: #f0e6d2; display: flex; justify-content: space-between; align-items: center;">
              <span>⚠️ Your login session has expired. Showing local browser history.</span>
              <a href="login.html" style="background: #e8a33d; color: #1a1e29; padding: 4px 10px; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 11px;">Log In Again</a>
            </div>
          `;
        }
      } else if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      } else {
        const cloudData = await res.json();
        analyses = Array.isArray(cloudData) ? cloudData : (cloudData.history || []);
        isCloud = true;
        if (notification) {
          notification.innerHTML = `
            <div style="background: rgba(79, 209, 197, 0.12); border: 1px solid #4fd1c5; border-radius: 6px; padding: 10px 14px; margin-bottom: 15px; font-size: 13px; color: #e6fffb; display: flex; justify-content: space-between; align-items: center;">
              <span>☁️ Cloud History Synced (${analyses.length} report${analyses.length !== 1 ? 's' : ''})</span>
              <a href="login.html" style="color: #8b93a7; font-size: 11px; text-decoration: underline;">Switch Account</a>
            </div>
          `;
        }
      }
    } catch (err) {
      if (notification) {
        notification.innerHTML = `
          <div style="background: rgba(232, 163, 61, 0.15); border: 1px solid #e8a33d; border-radius: 6px; padding: 10px 14px; margin-bottom: 15px; font-size: 13px; color: #f0e6d2;">
            ℹ️ Cloud sync unavailable. Showing analyses saved locally in this browser.
          </div>
        `;
      }
    }
  } else {
    if (notification) {
      notification.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid #2d3748; border-radius: 6px; padding: 10px 14px; margin-bottom: 15px; font-size: 13px; color: #8b93a7; display: flex; justify-content: space-between; align-items: center;">
          <span>👤 Guest Mode — Showing analyses saved in this browser.</span>
          <a href="login.html" style="color: #4fd1c5; text-decoration: underline; font-weight: 600;">Log in / Sign up to sync</a>
        </div>
      `;
    }
  }

  // Fallback to local history if cloud history is empty or user is guest
  if (analyses.length === 0 && localHistory.length > 0) {
    analyses = localHistory;
    isCloud = false;
  }

  if (sourceLabel) {
    sourceLabel.innerText = isCloud ? "Cloud Saved Reports" : "Local Browser Reports";
  }

  // Setup header action buttons
  if (actions) {
    if (localHistory.length > 0 && !isCloud) {
      actions.innerHTML = `<button onclick="clearLocalHistory()" style="background: transparent; border: 1px solid #3e4459; color: #8b93a7; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">Clear Local</button>`;
    } else {
      actions.innerHTML = "";
    }
  }

  if (analyses.length === 0) {
    list.innerHTML = `
      <div class="issue-empty">
        <span class="empty-icon" style="font-size: 28px; display: block; margin-bottom: 8px;">📂</span>
        <p style="font-weight: 600; color: #e2e8f0;">No saved analyses yet.</p>
        <p style="margin-top: 8px; font-size: 12px; color: #8b93a7;">Run an analysis on the <a href="index.html" style="color: var(--teal); font-weight: 600; text-decoration: underline;">Editor</a> page to save reports here.</p>
      </div>
    `;
    return;
  }

  window.__historyItems = analyses;
  list.innerHTML = analyses.map((a, idx) => {
    const date = a.timestamp ? new Date(a.timestamp).toLocaleString() : "Recent analysis";
    const language = a.language || "code";
    const score = a.score ?? "—";
    const snippet = (a.code || "")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"))
      .slice(0, 2)
      .join(" ")
      .slice(0, 85);

    return `
      <div class="issue-item" style="display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; margin-bottom: 12px; border: 1px solid #2d3748; border-radius: 6px; background: rgba(22, 27, 34, 0.7);">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: #252b3d; color: #4fd1c5; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${language}</span>
            <span style="color: #8b93a7; font-size: 12px;">${date}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="color: ${scoreColor(score)}; font-weight: 800; font-size: 17px;">
              ${score}<span style="font-size: 11px; color: #8b93a7; font-weight: 400;">/100</span>
            </span>
            <button onclick="openHistoryItem(${idx})" style="background: #1e2638; border: 1px solid #4fd1c5; color: #4fd1c5; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px; transition: all 0.15s ease;">
              <span>↗</span> Open in Editor
            </button>
          </div>
        </div>
        ${snippet ? `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a0aec0; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${snippet}</div>` : ''}
      </div>
    `;
  }).join("");
}

function openHistoryItem(idx) {
  const item = (window.__historyItems || [])[idx];
  if (item && item.code) {
    openInEditor(item.code, item.language || "javascript");
  }
}

loadHistory();