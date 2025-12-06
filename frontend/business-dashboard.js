// self-note: base API URL for all backend calls
const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  // self-note: businessId priority = URL → localStorage → null
  let businessId =
    params.get("businessId") ||
    localStorage.getItem("businessId") ||
    null;

  // self-note: queueId optional (we'll pick open queue if missing)
  let queueId = params.get("queueId") || null;

  const callNextBtn = document.getElementById("btn-call-next");
  const serviceForm = document.getElementById("service-form");
  const logoutBtn = document.getElementById("logout-btn");

  // ----------------- SESSION GUARD -----------------
  // self-note: if no business is logged in, force them back to login
  if (!businessId) {
    alert("لا يوجد حساب منشأة مسجل الدخول.");
    window.location.href = "businesses_index.html";
    return;
  }

  // self-note: show stored business name immediately for better UX
  const storedName = localStorage.getItem("businessName");
  if (storedName) {
    const nameEl = document.getElementById("business-name");
    if (nameEl) nameEl.textContent = storedName;
  }

  // self-note: logout clears session for business
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("businessId");
      localStorage.removeItem("businessName");
      localStorage.removeItem("businessEmail");
      window.location.href = "businesses_index.html";
    });
  }

  try {
    // ----------------- LOAD OR SELECT QUEUE -----------------
    if (!queueId) {
      // self-note: get all queues for this business (from backend)
      const res = await fetch(`${API_BASE}/businesses/${businessId}/queues`);
      if (!res.ok) throw new Error("فشل تحميل الطوابير.");

      const data = await res.json();
      const queues = data.queues || [];

      // self-note: prefer an open queue, otherwise first one
      const openQueue =
        queues.find((q) => q.status === "open") || queues[0] || null;

      if (openQueue) {
        queueId = openQueue.id;
        setBusinessHeader(openQueue); // self-note: set header with business & service
      } else {
        // self-note: no queues → show empty state and disable button
        const emptyState = document.getElementById("empty-state");
        if (emptyState) emptyState.classList.remove("d-none");

        if (callNextBtn) {
          callNextBtn.disabled = true;
          callNextBtn.textContent = "لا يوجد طابور مفتوح";
        }
      }
    }

    // ----------------- INITIAL DATA LOAD -----------------
    if (queueId) {
      await loadStats(queueId, true);      // self-note: initial = also hide empty state
      await loadQueueMembers(queueId);     // self-note: fill queue table

      if (callNextBtn) {
        callNextBtn.addEventListener("click", () => handleCallNext(queueId));
      }

      // self-note: optional simple auto-refresh every 7 seconds
      setInterval(() => {
        loadStats(queueId);
        loadQueueMembers(queueId);
      }, 7000);
    }

    // self-note: load services owned by logged-in business
    await loadServicesForBusiness(businessId);

    // self-note: create new service on form submit
    if (serviceForm) {
      serviceForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createNewService(businessId);
      });
    }
  } catch (err) {
    console.error(err);
    alert("فشل في تحميل لوحة التحكم. تأكد أن الخادم يعمل.");
  }
});


// =============================
// ===== HEADER FUNCTIONS =====
// =============================

function setBusinessHeader(queueOverview) {
  const nameEl = document.getElementById("business-name");
  const serviceEl = document.getElementById("business-service");

  // self-note: name from localStorage is more reliable than queue.business_name
  const storedName = localStorage.getItem("businessName");

  if (nameEl) {
    if (storedName) nameEl.textContent = storedName;
    else if (queueOverview?.business_name)
      nameEl.textContent = queueOverview.business_name;
  }

  // self-note: service name usually comes from queueOverview
  if (serviceEl && queueOverview?.service_name) {
    serviceEl.textContent = queueOverview.service_name;
  }
}


// ===================================
// ===== QUEUE STATS + MEMBERS =======
// ===================================

async function loadStats(queueId, initialLoad = false) {
  // self-note: get stats for the cards
  const res = await fetch(`${API_BASE}/queues/${queueId}/stats`);
  if (!res.ok) throw new Error("فشل تحميل الإحصائيات.");

  const stats = await res.json();

  const currentNumberEl = document.getElementById("current-number");
  const waitingCountEl = document.getElementById("waiting-count");
  const servedCountEl = document.getElementById("served-count");
  const cancelledCountEl = document.getElementById("cancelled-count");
  const avgWaitEl = document.getElementById("avg-wait-time");

  if (currentNumberEl) currentNumberEl.textContent = stats.current_number ?? "-";
  if (waitingCountEl) waitingCountEl.textContent = stats.waiting_count ?? "0";
  if (servedCountEl) servedCountEl.textContent = stats.served_count ?? "0";
  if (cancelledCountEl) cancelledCountEl.textContent = stats.cancelled_count ?? "0";

  if (avgWaitEl) {
    const avg = stats.avg_wait_time_minutes;
    avgWaitEl.textContent = avg != null ? `${avg} دقيقة` : "غير متوفر";
  }

  // self-note: first load → hide "empty" banner if needed
  if (initialLoad) {
    const emptyState = document.getElementById("empty-state");
    if (emptyState) emptyState.classList.add("d-none");
  }
}

async function loadQueueMembers(queueId) {
  const res = await fetch(`${API_BASE}/queues/${queueId}/members`);
  if (!res.ok) throw new Error("فشل تحميل قائمة المنتظرين.");

  const data = await res.json();
  const members = data.members || [];

  const tbody = document.getElementById("queue-members-body");
  const emptyState = document.getElementById("empty-state");
  if (!tbody) return;

  tbody.innerHTML = ""; // self-note: clear old rows

  if (members.length === 0) {
    // self-note: show empty state if no members
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  } else if (emptyState) {
    emptyState.classList.add("d-none");
  }

  // self-note: each member becomes a table row
  members.forEach((m) => {
    const row = document.createElement("tr");

    const position = document.createElement("td");
    const name = document.createElement("td");
    const status = document.createElement("td");
    const joinedAt = document.createElement("td");
    const servedAt = document.createElement("td");

    position.textContent = m.position ?? "-";
    name.textContent = m.customer_name || "عميل";

    const statusMap = {
      waiting: "منتظر",
      serving: "جاري الخدمة",
      served: "تمت الخدمة",
      cancelled: "ملغى",
    };
    status.textContent = statusMap[m.status] || m.status || "-";

    // self-note: times formatted for Arabic locale
    joinedAt.textContent = m.joined_at
      ? new Date(m.joined_at).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    servedAt.textContent = m.served_at
      ? new Date(m.served_at).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    row.appendChild(position);
    row.appendChild(name);
    row.appendChild(status);
    row.appendChild(joinedAt);
    row.appendChild(servedAt);

    tbody.appendChild(row);
  });
}


// ========================================
// ===== HANDLE CALL NEXT CUSTOMER ========
// ========================================

async function handleCallNext(queueId) {
  const callNextBtn = document.getElementById("btn-call-next");

  if (callNextBtn) {
    callNextBtn.disabled = true;
    callNextBtn.textContent = "جاري النداء...";
  }

  try {
    const res = await fetch(`${API_BASE}/queues/${queueId}/call-next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error("فشل نداء العميل.");

    const data = await res.json();
    if (data.message) alert(data.message);

    // self-note: refresh stats + members after calling next
    await loadStats(queueId);
    await loadQueueMembers(queueId);
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء نداء العميل.");
  } finally {
    if (callNextBtn) {
      callNextBtn.disabled = false;
      callNextBtn.textContent = "نداء العميل التالي";
    }
  }
}


// =================================
// ===== LOAD BUSINESS SERVICES ====
// =================================

async function loadServicesForBusiness(businessId) {
  const listEl = document.getElementById("services-list");
  const emptyEl = document.getElementById("services-empty");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (emptyEl) emptyEl.classList.add("d-none");

  try {
    // self-note: route adjusted to match backend: GET /businesses/:id/services?all=1
    const res = await fetch(
      `${API_BASE}/businesses/${businessId}/services?all=1`
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "فشل تحميل الخدمات.");
    }

    const services = data.services || [];

    if (services.length === 0) {
      if (emptyEl) emptyEl.classList.remove("d-none");
      return;
    }

    // self-note: render each service item as a nice row
    services.forEach((s) => {
      const li = document.createElement("li");
      li.className = "services-list-item";

      const left = document.createElement("div");
      const right = document.createElement("div");
      right.className = "text-end";

      const title = document.createElement("div");
      title.className = "services-list-item-title";
      title.textContent = s.name || "خدمة";

      left.appendChild(title);

      if (s.description) {
        const desc = document.createElement("div");
        desc.className = "services-list-item-meta";
        desc.textContent = s.description;
        left.appendChild(desc);
      }

      if (s.duration_minutes != null) {
        const d = document.createElement("div");
        d.className = "services-list-item-meta";
        d.textContent = `${s.duration_minutes} دقيقة`;
        right.appendChild(d);
      }

      if (s.price != null) {
        const p = document.createElement("div");
        p.className = "services-list-item-meta";
        p.textContent = `${s.price} ريال`;
        right.appendChild(p);
      }

      li.appendChild(left);
      li.appendChild(right);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    if (emptyEl) emptyEl.classList.remove("d-none");
  }
}


// ===============================
// ===== CREATE NEW SERVICE =====
// ===============================

// self-note: create new service for this business
async function createNewService(businessId) {
  // self-note: grab form fields
  const nameInput = document.getElementById("service-name");
  const durationInput = document.getElementById("service-duration");
  const priceInput = document.getElementById("service-price");
  const descInput = document.getElementById("service-description");

  const name = nameInput?.value.trim();
  const duration = Number(durationInput?.value || 0);
  const price = Number(priceInput?.value || 0);
  const description = descInput?.value.trim();

  // self-note: basic required fields check
  if (!name) {
    alert("يرجى إدخال اسم الخدمة.");
    return;
  }

  try {
    // self-note: backend uses /services + business_id field
    const res = await fetch(`${API_BASE}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_id: businessId,        // self-note: backend uses this to link to business
        name,
        description,
        duration_minutes: duration,
        price
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "فشل في إضافة الخدمة.");
    }

    alert("تم إرسال طلب إضافة الخدمة بنجاح. سيتم مراجعتها من قبل المشرف.");

    // self-note: reset fields after success
    if (nameInput) nameInput.value = "";
    if (durationInput) durationInput.value = "";
    if (priceInput) priceInput.value = "";
    if (descInput) descInput.value = "";

    await loadServicesForBusiness(businessId); // self-note: refresh list
  } catch (err) {
    console.error(err);
    alert(err.message || "خطأ أثناء إضافة الخدمة.");
  }
}
