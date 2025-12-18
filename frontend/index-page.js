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

      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);
        window.location.href = "/home";
      } else {
        alert(result.error);
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
        body: JSON.stringify({ name, email, phone, password }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);

        // go back to login after successful register (optional)
        registerForm.classList.add("d-none");
        loginForm.classList.remove("d-none");
      } else {
        alert(result.error);
      }
    });
  }
});
