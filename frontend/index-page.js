document.addEventListener("DOMContentLoaded", function () {
  const API_BASE = window.location.origin;

  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const showRegisterLink = document.getElementById("show-register");
  const showLoginLink = document.getElementById("show-login");

  if (showRegisterLink) {
    showRegisterLink.addEventListener("click", function (e) {
      e.preventDefault();

      if (loginForm) loginForm.classList.add("d-none");
      if (registerForm) registerForm.classList.remove("d-none");
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener("click", function (e) {
      e.preventDefault();

      if (registerForm) registerForm.classList.add("d-none");
      if (loginForm) loginForm.classList.remove("d-none");
    });
  }

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-log")?.value || "";
    const password = document.getElementById("pass-log")?.value || "";

    // self-note: try admin login FIRST (server validates email + password)
    const adminRes = await fetch(`${API_BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    if (adminRes.ok) {
      window.location.href = "/admin";
      return;
    }

    // self-note: fallback to normal user login
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      // self-note: store customer id for QStatus polling
      localStorage.setItem("userId", String(result.user?.id ?? result.id));
      alert(result.message);
      window.location.href = "/home";
    } else {
      alert(result.error || "Login failed");
    }
  });
}


if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name")?.value || "";
    const email = document.getElementById("email-reg")?.value || "";
    const phone = document.getElementById("phone")?.value || "";
    const password = document.getElementById("pass-reg")?.value || "";

    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, phone, password })
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      alert(result.message);
      registerForm.classList.add("d-none");
      loginForm.classList.remove("d-none");
    } else {
      alert(result.error || "Register failed");
    }
  });
}
});
