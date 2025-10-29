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
     window.location.showLoginLink="home_page.html";
    });

    // Show login form  
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
    });
     //here we are connect the "front-end" to the "back-end"

     //first the log in 
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); //prevent reload
    
    const email = document.getElementById('email-log').value;
    const password = document.getElementById('pass-log').value;
    const response = await fetch("http://localhost:3000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    if(response.ok){
        alert(result.message);
        //redirect to home/service page
        window.location.href='home_page.html';
    } else{
        alert(result.error);
    }
     });
    
     //second the register
     registerForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email-reg').value;
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('pass-reg').value;

        //send post request
        const response= await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name,email,phone,password})
        });
       //handle the respnse
       const result = await response.json();

       if (response.ok) {
        alert(result.message);
       } else {
        alert(result.error);
        }
    });
});
