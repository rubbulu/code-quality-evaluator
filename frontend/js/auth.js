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
authTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    authTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("loginForm").classList.toggle("hidden", tab.dataset.form !== "login");
    document.getElementById("signupForm").classList.toggle("hidden", tab.dataset.form !== "signup");
  });
});

// login submit (backend route comes from Person 5 — this just wires up the request)
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const msg = document.getElementById("loginMessage");

  try {
    const res = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = "Login successful!";
      msg.className = "auth-message success";
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
    const res = await fetch("http://localhost:5000/api/register", {
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