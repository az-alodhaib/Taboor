document.addEventListener('DOMContentLoaded', function () {
    // note: base URL for backend API
    const API_BASE = "http://localhost:3000";

    // note: get DOM elements for both cards
    const loginCard = document.getElementById('business-login-card');
    const registerCard = document.getElementById('business-register-card');

    const loginForm = document.getElementById('business-login-form');
    const registerForm = document.getElementById('businesses-register-form');

    const showLoginLink = document.getElementById('show-login');
    const showRegisterLink = document.getElementById('show-register');

    // ===== toggle between login and register =====
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (loginCard && registerCard) {
                loginCard.classList.remove('d-none');
                registerCard.classList.add('d-none');
            }
        });
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (loginCard && registerCard) {
                loginCard.classList.add('d-none');
                registerCard.classList.remove('d-none');
            }
        });
    }

    // ===== business register handler (existing behavior) =====
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // note: read register form fields
            const BusinessName = document.getElementById('business-name').value.trim();
            const BusinessEmail = document.getElementById('business-email-reg').value.trim();
            const BusinessPhone = document.getElementById('business-phone').value.trim();
            const BusinessCategory = document.getElementById('service-type').value.trim();
            const BusinessAddress = document.getElementById('business-address').value.trim();
            const BusinessPassword = document.getElementById('pass-reg').value;

            // note: simple empty check
            if (!BusinessName || !BusinessEmail || !BusinessPhone || !BusinessCategory || !BusinessAddress || !BusinessPassword) {
                alert("يرجى ملء جميع الحقول.");
                return;
            }

            // note: payload for backend
            const businessData = {
                name: BusinessName,
                email: BusinessEmail,
                phone: BusinessPhone,
                category: BusinessCategory,
                address: BusinessAddress,
                password: BusinessPassword,
                owner_user_id: null,
                latitude: null,
                longitude: null
            };

            try {
                const response = await fetch(`${API_BASE}/business/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(businessData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert("تم إرسال طلب إنشاء المنشأة للمراجعة بنجاح! ✅");
                    registerForm.reset();

                    // note: after register, show login card
                    if (loginCard && registerCard) {
                        loginCard.classList.remove('d-none');
                        registerCard.classList.add('d-none');
                    }
                } else {
                    alert("حدث خطأ أثناء إنشاء الحساب: " + (result.error || 'يرجى المحاولة لاحقًا.'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert("تعذر الاتصال بالخادم. تأكد أن السيرفر يعمل على المنفذ 3000.");
            }
        });
    }

    // ===== business login handler with status check =====
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // note: read login fields
            const email = document.getElementById('business-email-login').value.trim();
            const password = document.getElementById('business-pass-login').value;

            if (!email || !password) {
                alert("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/business/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (!response.ok) {
    alert(result.error || "فشل تسجيل الدخول، يرجى التحقق من البيانات.");
    return;
}

                // self-note: backend payload might be { business: {...} } or flat object
                const businessObj = result.business || result.data || result;

                // self-note: store current business identity in browser
                if (businessObj) {
                    localStorage.setItem('businessId', businessObj.id);
                    localStorage.setItem('businessName', businessObj.name);
                    localStorage.setItem('businessEmail', businessObj.email);
                    }

                // self-note: try to read status safely
                const rawStatus = result.status || result.business_status || businessObj?.status;
                const status = String(rawStatus || "").toLowerCase();

                // handle approved / pending / rejected
                if (status === "approved" || status === "active" || status === "1") {
                    // self-note: redirect to real dashboard file, NOT the login page
                    window.location.href = "business_dashboard.html"; // use your real file name
                    } else if (status === "pending" || status === "binding" || status === "under_review" || status === "0") {
                         alert("طلب إنشاء المنشأة الخاص بك قيد المراجعة، يرجى المحاولة لاحقًا.");
                    } else if (status === "rejected" || status === "denied") {
                        alert("تم رفض طلب إنشاء منشأتك. يرجى التواصل مع الدعم أو إعادة التقديم لاحقًا.");
                    } else {
                        alert("لا يمكن تحديد حالة حساب المنشأة حاليًا، يرجى التواصل مع الدعم.");
                    }
            } catch (error) {
                console.error('Error:', error);
                alert("تعذر الاتصال بالخادم. تأكد أن السيرفر يعمل على المنفذ 3000.");
            }
        });
    }
});
