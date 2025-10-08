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
    
});