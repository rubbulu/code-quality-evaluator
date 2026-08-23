// theme toggle (same pattern as main app)
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

// tab switching between login/signup
const authTabs = document.querySelectorAll("#authTabs .tab");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

function setAuthMode(mode) {
  const isLogin = mode === "login";

  authTabs.forEach(tab => {
    const isActive = tab.dataset.form === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("signupForm").classList.toggle("hidden", isLogin);
  authTitle.textContent = isLogin ? "Sign in" : "Create your account";
  authSubtitle.textContent = isLogin
    ? "Continue analysing code and keep your work in one place."
    : "Create an account to save and revisit your analysis history.";
}

authTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    setAuthMode(tab.dataset.form);
  });
});

// login submit (backend route comes from Person 5 — this just wires up the request)
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const msg = document.getElementById("loginMessage");

  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("cqe-token", data.token);
      localStorage.setItem("cqe-user-name", data.name);

      msg.textContent = "Login successful! Redirecting...";
      msg.className = "auth-message success";

      window.location.href = "index.html";
  } else {
    msg.textContent = data.message || "Login failed";
    msg.className = "auth-message error";
  }
  } catch {
    msg.textContent = "Backend not reachable";
    msg.className = "auth-message error";
  }
});

// signup submit
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signupName").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const msg = document.getElementById("signupMessage");

  try {
    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = "Account created! You can log in now.";
      msg.className = "auth-message success";
    } else {
      msg.textContent = data.message || "Signup failed";
      msg.className = "auth-message error";
    }
  } catch {
    msg.textContent = "Backend not reachable";
    msg.className = "auth-message error";
  }
});
