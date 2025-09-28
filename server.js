// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {

    // Get form elements
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // Show register form
    showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginForm.classList.add('d-none');
        registerForm.classList.remove('d-none');
    });

    // Show login form  
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
    });

    // Handle login submit
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('Login failed: ' + data.error);
            } else {
                alert('Login successful! User ID: ' + data.userId);
                loginForm.reset();
            }
        })
        .catch(err => alert('Error: ' + err));
    });

    // Handle register submit
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const username = registerForm.username.value;
        const password = registerForm.password.value;

        fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert('Registration failed: ' + data.error);
            } else {
                alert('Registration successful! User ID: ' + data.userId);
                registerForm.reset();
                // Switch back to login form
                registerForm.classList.add('d-none');
                loginForm.classList.remove('d-none');
            }
        })
        .catch(err => alert('Error: ' + err));
    });

});
