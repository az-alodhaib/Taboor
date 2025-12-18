document.addEventListener('DOMContentLoaded', function () {
  // note: base URL for backend API
  const API_BASE = window.location.origin;


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

      // self-note: init Google map when opening register card
      initGoogleBusinessMap();
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
      const BusinessLatitude = document.getElementById('latitude').value;
      const BusinessLongitude = document.getElementById('longitude').value;

      // note: simple empty check
      if (!BusinessName || !BusinessEmail || !BusinessPhone || !BusinessCategory || !BusinessAddress || !BusinessPassword) {
        alert("يرجى ملء جميع الحقول.");
        return;
      }

      const businessData = {
        name: BusinessName,
        email: BusinessEmail,
        phone: BusinessPhone,
        category: BusinessCategory,
        address: BusinessAddress,
        password: BusinessPassword,
        owner_user_id: null,
        latitude: BusinessLatitude || null,
        longitude: BusinessLongitude || null
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

        const businessObj = result.business || result.data || result;

        if (businessObj) {
          localStorage.setItem('businessId', businessObj.id);
          localStorage.setItem('businessName', businessObj.name);
          localStorage.setItem('businessEmail', businessObj.email);
        }

        const rawStatus = result.status || result.business_status || businessObj?.status;
        const status = String(rawStatus || "").toLowerCase();

        if (status === "approved" || status === "active" || status === "1") {
          window.location.href = "/business/dashboard";
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

// ==========================
// Google Maps (Business Register)
// ==========================
let gBusinessMap = null;
let gBusinessMarker = null;
let gBusinessMapInitialized = false;

function initGoogleBusinessMap() {
  // self-note: map script may still be loading
  if (!window.google || !google.maps) {
    // try again shortly
    setTimeout(initGoogleBusinessMap, 200);
    return;
  }

  // self-note: avoid re-initializing the map
  if (gBusinessMapInitialized && gBusinessMap) {
    // self-note: fix layout if card was hidden before
    setTimeout(() => {
      google.maps.event.trigger(gBusinessMap, "resize");
      if (gBusinessMarker) gBusinessMap.setCenter(gBusinessMarker.getPosition());
    }, 200);
    return;
  }

  const mapContainer = document.getElementById('business-map');
  if (!mapContainer) return;

  // self-note: Riyadh center as default
  const defaultCenter = { lat: 24.7136, lng: 46.6753 };

  gBusinessMap = new google.maps.Map(mapContainer, {
    center: defaultCenter,
    zoom: 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });

  gBusinessMarker = new google.maps.Marker({
    position: defaultCenter,
    map: gBusinessMap,
    draggable: true
  });

  updateBusinessLatLng(defaultCenter.lat, defaultCenter.lng);

  // self-note: click on map to move marker
  gBusinessMap.addListener("click", (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    gBusinessMarker.setPosition({ lat, lng });
    updateBusinessLatLng(lat, lng);
  });

  // self-note: drag marker to update coords
  gBusinessMarker.addListener("dragend", () => {
    const pos = gBusinessMarker.getPosition();
    updateBusinessLatLng(pos.lat(), pos.lng());
  });

  gBusinessMapInitialized = true;

  // self-note: ensure correct render after the card becomes visible
  setTimeout(() => {
    google.maps.event.trigger(gBusinessMap, "resize");
    gBusinessMap.setCenter(defaultCenter);
  }, 200);
}

function updateBusinessLatLng(lat, lng) {
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  if (!latInput || !lngInput) return;

  latInput.value = lat;
  lngInput.value = lng;
}
