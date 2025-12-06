const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  loadPendingBusinesses();
  loadPendingServices();
});


// ==========================
// Business requests
// ==========================

// Load pending businesses
async function loadPendingBusinesses() {
  const listContainer = document.getElementById("admin-business-list");
  const messageContainer = document.getElementById("admin-business-message");

  listContainer.innerHTML = "";
  messageContainer.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/admin/businesses?status=pending`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "فشل في جلب المنشآت");

    const businesses = json.businesses || [];

    if (businesses.length === 0) {
      messageContainer.innerHTML = `
        <div class="alert alert-info mb-0">لا توجد منشآت بانتظار الموافقة.</div>
      `;
      return;
    }

    businesses.forEach((b) => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";

      const card = document.createElement("div");
      card.className = "card shadow-sm h-100";

      const body = document.createElement("div");
      body.className = "card-body";

      // Card content for one business
      body.innerHTML = `
        <h5 class="card-title mb-1">${b.name}</h5>
        <p class="card-subtitle text-muted mb-2">${b.category || "بدون تصنيف"}</p>
        <p class="mb-1"><i class="bi bi-geo-alt-fill"></i> ${b.address || "بدون عنوان"}</p>
        <p class="mb-3"><i class="bi bi-telephone"></i> ${b.phone || "بدون رقم"}</p>
        <button class="btn btn-success w-100 mb-2 btn-approve" data-id="${b.id}">
          <i class="bi bi-check-circle"></i> الموافقة على المنشأة
        </button>
        <button class="btn btn-outline-danger w-100 btn-reject" data-id="${b.id}">
          <i class="bi bi-x-circle"></i> رفض المنشأة
        </button>
      `;

      card.appendChild(body);
      col.appendChild(card);
      listContainer.appendChild(col);

      // Approve and Reject buttons for this business
      const approveBtn = body.querySelector(".btn-approve");
      const rejectBtn = body.querySelector(".btn-reject");

      approveBtn.addEventListener("click", () => approveBusiness(b.id));
      rejectBtn.addEventListener("click", () => rejectBusiness(b.id));
    });
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger mb-0">
        حدث خطأ أثناء تحميل المنشآت: ${error.message}
      </div>
    `;
  }
}

// Approve one business
async function approveBusiness(id) {
  const messageContainer = document.getElementById("admin-business-message");

  if (!confirm("هل أنت متأكد من الموافقة على هذه المنشأة؟")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/businesses/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();

    if (!res.ok) throw new Error(json.error || "فشل في الموافقة على المنشأة");

    messageContainer.innerHTML = `
      <div class="alert alert-success">تم قبول المنشأة بنجاح.</div>
    `;

    await loadPendingBusinesses();
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger">تعذر الموافقة على المنشأة: ${error.message}</div>
    `;
  }
}

// Reject one business
async function rejectBusiness(id) {
  const messageContainer = document.getElementById("admin-business-message");

  if (!confirm("هل أنت متأكد من رفض هذه المنشأة؟")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/businesses/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();

    if (!res.ok) throw new Error(json.error || "فشل في رفض المنشأة");

    messageContainer.innerHTML = `
      <div class="alert alert-warning">تم رفض المنشأة.</div>
    `;

    await loadPendingBusinesses();
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger">تعذر رفض المنشأة: ${error.message}</div>
    `;
  }
}


// ==========================
// Service requests
// ==========================

// Load pending services
async function loadPendingServices() {
  const listContainer = document.getElementById("admin-service-list");
  const messageContainer = document.getElementById("admin-service-message");

  listContainer.innerHTML = "";
  messageContainer.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/admin/services?status=pending`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "فشل في جلب الخدمات");

    const services = json.services || [];

    if (services.length === 0) {
      messageContainer.innerHTML = `
        <div class="alert alert-info mb-0">لا توجد خدمات بانتظار الموافقة.</div>
      `;
      return;
    }

    services.forEach((s) => {
      const col = document.createElement("div");
      col.className = "col-md-6 col-lg-4";

      const card = document.createElement("div");
      card.className = "card shadow-sm h-100";

      const body = document.createElement("div");
      body.className = "card-body";

      // Card content for one service
      body.innerHTML = `
        <h5 class="card-title mb-1">${s.name}</h5>
        <p class="card-subtitle text-muted mb-2">
          ${s.business_name || "منشأة غير معروفة"}
        </p>
        <p class="mb-1">المدة: ${s.duration_minutes || 0} دقيقة</p>
        <p class="mb-1">السعر: ${s.price || 0} ريال</p>
        <p class="mb-3 text-muted">${s.description || ""}</p>
        <button class="btn btn-success w-100 mb-2 btn-approve" data-id="${s.id}">
          <i class="bi bi-check-circle"></i> الموافقة على الخدمة
        </button>
        <button class="btn btn-outline-danger w-100 btn-reject" data-id="${s.id}">
          <i class="bi bi-x-circle"></i> رفض الخدمة
        </button>
      `;

      card.appendChild(body);
      col.appendChild(card);
      listContainer.appendChild(col);

      // Approve and Reject buttons for this service
      const approveBtn = body.querySelector(".btn-approve");
      const rejectBtn = body.querySelector(".btn-reject");

      approveBtn.addEventListener("click", () => approveService(s.id));
      rejectBtn.addEventListener("click", () => rejectService(s.id));
    });
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger mb-0">
        حدث خطأ أثناء تحميل الخدمات: ${error.message}
      </div>
    `;
  }
}

// Approve one service
async function approveService(id) {
  const messageContainer = document.getElementById("admin-service-message");

  if (!confirm("هل أنت متأكد من الموافقة على هذه الخدمة؟")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/services/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "فشل في الموافقة على الخدمة");

    messageContainer.innerHTML = `
      <div class="alert alert-success">تم قبول الخدمة بنجاح.</div>
    `;

    await loadPendingServices();
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger">تعذر الموافقة على الخدمة: ${error.message}</div>
    `;
  }
}

// Reject one service
async function rejectService(id) {
  const messageContainer = document.getElementById("admin-service-message");

  if (!confirm("هل أنت متأكد من رفض هذه الخدمة؟")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/services/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "فشل في رفض الخدمة");

    messageContainer.innerHTML = `
      <div class="alert alert-warning">تم رفض الخدمة.</div>
    `;

    await loadPendingServices();
  } catch (error) {
    console.error(error);
    messageContainer.innerHTML = `
      <div class="alert alert-danger">تعذر رفض الخدمة: ${error.message}</div>
    `;
  }
}
