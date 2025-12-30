const API_BASE = window.location.origin;

// ============================================
// ETA HELPER (Backend call only)
// ============================================

async function getTrafficEtaMinutes(origin, destination) {
  try {
    const res = await fetch(`${API_BASE}/eta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination })
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "ETA failed");

    const sec = json.durationInTrafficSeconds ?? json.durationSeconds ?? null;
    if (sec == null) return null;

    return Math.max(1, Math.round(sec / 60));
  } catch (e) {
    console.error("ETA API error:", e);
    return null;
  }
}

// ============================================
// MAIN ALPINE COMPONENT
// ============================================

function QStatusPage() {
  return {
    data: {
      business: { name: "", address: "", latitude: null, longitude: null },
      services: [],
      totals: { totalWithTax: "0.00" },
      queue: { 
        position: null, 
        totalPeople: 0, 
        waitMinutes: 0,
        etaMinutes: null,
        estimationMinutes: null,
        waitLabel: "جاري التحميل...",
        status: "waiting",
        queueId: null,
        memberId: null
      }
    },
    
    dots: "",
    
    // Wait time countdown state
    _waitServerBaseMinutes: null,
    _waitSyncTimestamp: null,
    _waitCountdownTimer: null,
    
    // Polling state
    _pollTimer: null,
    _etaPollCounter: 0,
    _notifiedNext: false,
    
    // User location (from home page)
    _userLocation: null,

    // ============================================
    // INIT - Load data and start systems
    // ============================================
    
    init() {
      console.log("🚀 QStatus page initializing...");
      
      // Load saved queue data
      this.loadQueueDataFromStorage();
      
      // Get user location FROM localStorage (home page already asked)
      this._loadUserLocationFromStorage();
      
      // Start polling queue status
      this.startAutoRefresh();
      
      // Start wait time countdown
      this._startWaitCountdown();
      
      // Animate dots
      this._animateDots();
      
      console.log("✅ QStatus page ready");
    },

    // ============================================
    // LOAD USER LOCATION (from home page)
    // ============================================
    
    _loadUserLocationFromStorage() {
      try {
        const raw = localStorage.getItem("userLocation");
        if (raw) {
          this._userLocation = JSON.parse(raw);
          console.log("✅ User location loaded from storage:", this._userLocation);
        }
      } catch (e) {
        console.warn("⚠️ Failed to load user location:", e);
      }
    },

    // ============================================
    // LOAD SAVED DATA
    // ============================================
    
    loadQueueDataFromStorage() {
      try {
        const raw = localStorage.getItem("queueStatus");
        if (!raw) {
          console.warn("⚠️ No queue data in localStorage");
          return;
        }
        
        const parsed = JSON.parse(raw);
        this.data = parsed;
        
        // Ensure queue object exists
        this.data.queue = this.data.queue || {};
        
        // Initialize all timing fields
        this.data.queue.waitMinutes = Number(this.data.queue.waitMinutes || 0);
        this.data.queue.etaMinutes = this.data.queue.etaMinutes || null;
        this.data.queue.estimationMinutes = Number(this.data.queue.estimationMinutes || 0);
        this.data.queue.position = this.data.queue.position || null;
        this.data.queue.status = this.data.queue.status || "waiting";
        this.data.queue.waitLabel = this.data.queue.waitLabel || "قياسي";
        this.data.queue.queueId = this.data.queue.queueId || null;
        this.data.queue.memberId = this.data.queue.memberId || null;
        
        console.log("✅ Loaded queue data:", this.data.queue);
        
      } catch (e) {
        console.error("❌ Failed to load queue data:", e);
      }
    },

    // ============================================
    // HELPERS
    // ============================================
    
    _animateDots() {
      let i = 0;
      setInterval(() => {
        this.dots = ".".repeat((i % 3) + 1);
        i++;
      }, 500);
    },

    _getUserId() {
      const direct = localStorage.getItem("userId") || localStorage.getItem("user_id");
      if (direct) return Number(direct);

      try {
        const rawUser = localStorage.getItem("user");
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u?.id != null) return Number(u.id);
        }
      } catch (_) {}

      return null;
    },

    _getQueueId() {
      const qid = this.data?.queue?.queueId ?? null;
      return qid != null ? String(qid) : null;
    },

    // ============================================
    // AUTO-REFRESH POLLING
    // ============================================
    
    startAutoRefresh() {
      if (this._pollTimer) clearInterval(this._pollTimer);

      // Poll every 5 seconds
      this._pollTimer = setInterval(() => {
        this.refreshQueueStatusFromServer();
      }, 5000);

      // Run immediately
      this.refreshQueueStatusFromServer();
    },

    stopAutoRefresh() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    },

    // ============================================
    // REFRESH QUEUE STATUS (MAIN LOGIC)
    // ============================================
    
    async refreshQueueStatusFromServer() {
      try {
        const queueId = this._getQueueId();
        const userId = this._getUserId();
        
        if (!queueId || !userId) {
          console.warn("⚠️ Missing queueId or userId");
          return;
        }

        const res = await fetch(
          `${API_BASE}/queues/${queueId}/user-status?user_id=${encodeURIComponent(userId)}`
        );
        
        const json = await res.json().catch(() => ({}));

        // Handle errors
        if (!res.ok) {
          if (res.status === 404) {
            console.warn("❌ Ticket not found (user left or queue reset)");
            this.stopAutoRefresh();
            localStorage.removeItem("queueStatus");
            window.location.href = "home_page.html";
            return;
          }
          
          console.warn("⚠️ Server error:", res.status, json);
          return;
        }

        console.log("📥 Server response:", json);

        // ============================================
        // UPDATE WAIT TIME (ML vs LINEAR LOGIC)
        // ============================================
        
        const mlWait = Number(json.wait_minutes_ml);
        const linearWait = Number(json.wait_minutes);
        
        // Use ML if available and valid, otherwise linear
        const effectiveWait = 
          (Number.isFinite(mlWait) && mlWait >= 0) ? mlWait : 
          (Number.isFinite(linearWait) && linearWait >= 0) ? linearWait : 
          0;
        
        // Set label based on source
        this.data.queue.waitLabel = 
          (Number.isFinite(mlWait) && mlWait >= 0) ? "تقدير ذكي" : "تقدير قياسي";

        console.log("⏱️ Wait calculation:", {
          ml: mlWait,
          linear: linearWait,
          effective: effectiveWait,
          label: this.data.queue.waitLabel
        });

        // ============================================
        // SYNC COUNTDOWN ONLY IF ESTIMATE CHANGED
        // ============================================
        
        const prevBase = Number(this._waitServerBaseMinutes);
        const estimateChanged = !Number.isFinite(prevBase) || Math.abs(prevBase - effectiveWait) >= 1;
        
        if (estimateChanged) {
          console.log("🔄 Wait estimate changed:", prevBase, "→", effectiveWait);
          this._waitServerBaseMinutes = effectiveWait;
          this._waitSyncTimestamp = Date.now();
        }

        // Update UI with current countdown value
        const remainingNow = this._computeRemainingWaitMinutes();
        this.data.queue.waitMinutes = remainingNow;

        // ============================================
        // UPDATE OTHER FIELDS
        // ============================================
        
        this.data.queue.position = json.position != null ? Number(json.position) : null;
        this.data.queue.totalPeople = Number(json.people_in_line || 0);
        this.data.queue.status = json.status || "waiting";

        // Update business data (needed for ETA)
        if (json.business) {
          this.data.business.name = json.business.name || this.data.business.name;
          this.data.business.latitude = json.business.latitude || this.data.business.latitude;
          this.data.business.longitude = json.business.longitude || this.data.business.longitude;
        }

        // ============================================
        // NOTIFICATION: YOU ARE NEXT
        // ============================================
        
        if (this.data.queue.position === 1 && !this._notifiedNext) {
          this._notifiedNext = true;
          alert("🔔 أنت التالي في الطابور! يرجى الاستعداد.");
        }

        // ============================================
        // CHECK IF TICKET FINISHED
        // ============================================
        
        if (json.is_finished) {
          this.stopAutoRefresh();
          this._stopWaitCountdown();
          
          const status = String(json.status || "").toLowerCase();
          
          if (status === "done") {
            alert("✅ تم إكمال خدمتك بنجاح");
          } else if (status === "left") {
            alert("ℹ️ تم إنهاء تذكرتك (تم الخروج من الطابور).");
          } else if (status === "skipped") {
            alert("ℹ️ تم تخطي تذكرتك.");
          }
          
          localStorage.removeItem("queueStatus");
          window.location.href = "home_page.html";
          return;
        }

        // ============================================
        // REFRESH ETA EVERY 3 POLLS (15 seconds)
        // ============================================
        
        this._etaPollCounter++;
        if (this._etaPollCounter % 3 === 1) {
          this.refreshEtaTravelOnly();
        }

      } catch (e) {
        console.error("❌ refreshQueueStatusFromServer error:", e);
      }
    },

    // ============================================
    // WAIT TIME COUNTDOWN
    // ============================================
    
    _computeRemainingWaitMinutes() {
      const base = Number(this._waitServerBaseMinutes);
      if (!Number.isFinite(base) || base <= 0) return 0;

      const syncTs = Number(this._waitSyncTimestamp);
      if (!Number.isFinite(syncTs) || syncTs <= 0) return Math.max(0, Math.ceil(base));

      const elapsedMs = Math.max(0, Date.now() - syncTs);
      const elapsedMin = elapsedMs / 60000;
      const remaining = base - elapsedMin;

      return Math.max(0, Math.floor(remaining));
    },

    _startWaitCountdown() {
      if (this._waitCountdownTimer) clearInterval(this._waitCountdownTimer);

      this._waitCountdownTimer = setInterval(() => {
        const remaining = this._computeRemainingWaitMinutes();
        this.data.queue.waitMinutes = remaining;

        // Update total estimation (wait + travel)
        const travel = Number(this.data.queue.etaMinutes || 0);
        this.data.queue.estimationMinutes = remaining + travel;
      }, 1000);
    },

    _stopWaitCountdown() {
      if (this._waitCountdownTimer) {
        clearInterval(this._waitCountdownTimer);
        this._waitCountdownTimer = null;
      }
    },

    // ============================================
    // ETA (TRAVEL TIME) CALCULATION
    // ============================================
    
    async refreshEtaTravelOnly() {
      try {
        const b = this.data?.business;
        const destLat = Number(b?.latitude);
        const destLng = Number(b?.longitude);

        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
          console.warn("⚠️ Business coordinates missing");
          this.data.queue.etaMinutes = null;
          return;
        }

        // Use cached location from home page
        const origin = this._userLocation;

        if (!origin || !origin.lat || !origin.lng) {
          console.warn("⚠️ User location unavailable (home page didn't save it)");
          this.data.queue.etaMinutes = null;
          return;
        }

        const destination = { lat: destLat, lng: destLng };
        
        console.log("🚗 Calculating ETA:", { origin, destination });
        
        const eta = await getTrafficEtaMinutes(origin, destination);
        
        this.data.queue.etaMinutes = eta;
        
        console.log("✅ ETA calculated:", eta, "minutes");

        // Update total estimation
        const wait = this._computeRemainingWaitMinutes();
        this.data.queue.estimationMinutes = wait + (eta || 0);

      } catch (e) {
        console.error("❌ ETA calculation error:", e);
        this.data.queue.etaMinutes = null;
      }
    },

    // ============================================
    // USER ACTIONS
    // ============================================
    
    async confirmLeave() {
      const queueId = this._getQueueId();
      const userId = this._getUserId();

      if (!queueId || !userId) {
        localStorage.removeItem("queueStatus");
        window.location.href = "home_page.html";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/queues/${queueId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          
          if (res.status === 404) {
            localStorage.removeItem("queueStatus");
            window.location.href = "home_page.html";
            return;
          }
          
          throw new Error(err?.error || "Failed to leave queue");
        }

      } catch (e) {
        console.error(e);
        alert("تعذر مغادرة الطابور. حاول مرة أخرى.");
        return;
      }

      localStorage.removeItem("queueStatus");
      window.location.href = "home_page.html";
    },

    async confirmDone() {
      const queueId = this._getQueueId();
      const userId = this._getUserId();

      if (!queueId || !userId) {
        alert("تم إكمال خدمتك بنجاح 🎉");
        localStorage.removeItem("queueStatus");
        window.location.href = "home_page.html";
        return;
      }

      try {
        let memberId = this.data?.queue?.memberId;

        if (!memberId) {
          const posRes = await fetch(
            `${API_BASE}/queues/${queueId}/position?user_id=${encodeURIComponent(userId)}`
          );
          
          if (!posRes.ok) throw new Error("Failed to get position");

          const posData = await posRes.json();
          if (!posData?.member_id) throw new Error("No active ticket");

          memberId = posData.member_id;
        }

        const patchRes = await fetch(`${API_BASE}/queue_members/${memberId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "done" })
        });

        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({}));
          throw new Error(err?.error || "Failed to mark done");
        }

      } catch (e) {
        console.error(e);
        alert("تعذر تحديث حالتك إلى (تم). حاول مرة أخرى.");
        return;
      }

      alert("تم إكمال خدمتك بنجاح 🎉");
      localStorage.removeItem("queueStatus");
      window.location.href = "home_page.html";
    }
  };
}