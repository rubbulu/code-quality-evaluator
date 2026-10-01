// theme toggle (same pattern as main app)
const themeToggle = document.getElementById("themeToggle");
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  if (themeToggle) themeToggle.innerText = theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("cqe-theme", theme);
}
applyTheme(localStorage.getItem("cqe-theme") || "dark");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    applyTheme(document.body.classList.contains("light") ? "dark" : "light");
  });
}

// tab switching between login, signup, and reset
const authTabs = document.querySelectorAll("#authTabs .tab");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

function setAuthMode(mode) {
  authTabs.forEach(tab => {
    const isActive = tab.dataset.form === mode;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const resetForm = document.getElementById("resetForm");

  if (loginForm) loginForm.classList.toggle("hidden", mode !== "login");
  if (signupForm) signupForm.classList.toggle("hidden", mode !== "signup");
  if (resetForm) resetForm.classList.toggle("hidden", mode !== "reset");

  if (mode === "login") {
    authTitle.textContent = "Sign in";
    authSubtitle.textContent = "Continue analysing code and keep your work in one place.";
  } else if (mode === "signup") {
    authTitle.textContent = "Create your account";
    authSubtitle.textContent = "Create an account to save and revisit your analysis history.";
  } else if (mode === "reset") {
    authTitle.textContent = "Reset Password";
    authSubtitle.textContent = "Enter your email address and choose a new password.";
  }
}

authTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    setAuthMode(tab.dataset.form);
  });
});

const forgotLink = document.getElementById("forgotPasswordLink");
if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    setAuthMode("reset");
    const loginEmail = document.getElementById("loginEmail").value;
    if (loginEmail) {
      document.getElementById("resetEmail").value = loginEmail;
    }
  });
}

// login submit
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMessage");

    msg.textContent = "Checking credentials…";
    msg.className = "auth-message";
    msg.style.display = "block";

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("cqe-token", data.token || "");
        localStorage.setItem("cqe-userId", data.userId || "");
        msg.textContent = `Welcome back, ${data.name || 'User'}! Redirecting to Editor…`;
        msg.className = "auth-message success";
        setTimeout(() => { window.location.href = "index.html"; }, 900);
      } else {
        msg.textContent = data.message || "Invalid email or password.";
        msg.className = "auth-message error";
      }
    } catch {
      msg.textContent = "Backend server not reachable on http://localhost:5000";
      msg.className = "auth-message error";
    }
  });
}

// signup submit
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const msg = document.getElementById("signupMessage");

    msg.textContent = "Creating account…";
    msg.className = "auth-message";
    msg.style.display = "block";

    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        msg.textContent = "Account created successfully! Logging you in…";
        msg.className = "auth-message success";

        // Auto login right after registration
        const loginRes = await fetch("http://localhost:5000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem("cqe-token", loginData.token || "");
          localStorage.setItem("cqe-userId", loginData.userId || "");
          setTimeout(() => { window.location.href = "index.html"; }, 900);
        } else {
          setAuthMode("login");
          document.getElementById("loginEmail").value = email;
        }
      } else {
        msg.textContent = data.message || "Signup failed.";
        msg.className = "auth-message error";
      }
    } catch {
      msg.textContent = "Backend server not reachable on http://localhost:5000";
      msg.className = "auth-message error";
    }
  });
}

// reset password submit
const resetForm = document.getElementById("resetForm");
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("resetEmail").value.trim();
    const newPassword = document.getElementById("resetPassword").value;
    const msg = document.getElementById("resetMessage");

    msg.textContent = "Updating password…";
    msg.className = "auth-message";
    msg.style.display = "block";

    try {
      const res = await fetch("http://localhost:5000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("cqe-token", data.token || "");
        localStorage.setItem("cqe-userId", data.userId || "");
        msg.textContent = "Password updated! Redirecting to Editor…";
        msg.className = "auth-message success";
        setTimeout(() => { window.location.href = "index.html"; }, 900);
      } else {
        msg.textContent = data.message || "Could not reset password.";
        msg.className = "auth-message error";
      }
    } catch {
      msg.textContent = "Backend server not reachable on http://localhost:5000";
      msg.className = "auth-message error";
    }
  });
}
