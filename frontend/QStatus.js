const API_BASE = window.location.origin;

// ============================================
// ETA HELPER
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
    console.error("❌ ETA error:", e);
    return null;
  }
}

// ============================================
// MAIN COMPONENT
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
    
    // ============================================
    // COUNTDOWN STATE (persisted in localStorage)
    // ============================================
    // These variables control the wait time countdown.
    // They are stored in localStorage so countdown survives page refresh.
    // They are reset ONLY when position changes (someone ahead leaves/finishes).
    _baseWaitMinutes: null,        // Initial wait time from server
    _countdownStartTime: null,     // When countdown started (timestamp)
    _countdownTimer: null,         // Interval timer for countdown
    
    _pollTimer: null,              // Auto-refresh timer (polls server every 5s)
    _etaPollCounter: 0,            // Counter to refresh ETA every 15s (3 polls)
    _notifiedNext: false,          // Track if "you're next" notification was shown
    _userLocation: null,           // User's GPS location (from home page)
    _lastPosition: null,           // Track last position to detect queue changes
    
    // LocalStorage keys for countdown persistence
    _STORAGE_KEY_BASE_WAIT: "qstatus_baseWaitMinutes",
    _STORAGE_KEY_START_TIME: "qstatus_countdownStartTime",
    _STORAGE_KEY_POSITION: "qstatus_lastPosition",

    // ============================================
    // INIT
    // ============================================
    
    init() {
      console.log("🚀 QStatus initializing...");
      
      this.loadQueueDataFromStorage();
      this._loadUserLocationFromStorage();
      this._loadCountdownStateFromStorage();  // Load persisted countdown
      this.startAutoRefresh();
      this._startWaitCountdown();
      this._animateDots();
      this.refreshEtaTravelOnly();
      
      console.log("✅ QStatus ready");
    },
    
    // ============================================
    // LOAD/SAVE COUNTDOWN STATE (for page refresh)
    // ============================================
    
    _loadCountdownStateFromStorage() {
      try {
        const baseWait = localStorage.getItem(this._STORAGE_KEY_BASE_WAIT);
        const startTime = localStorage.getItem(this._STORAGE_KEY_START_TIME);
        const lastPos = localStorage.getItem(this._STORAGE_KEY_POSITION);
        
        if (baseWait !== null) {
          this._baseWaitMinutes = Number(baseWait);
        }
        if (startTime !== null) {
          this._countdownStartTime = Number(startTime);
        }
        if (lastPos !== null) {
          this._lastPosition = Number(lastPos);
        }
        
        console.log("✅ Countdown state loaded:", {
          baseWait: this._baseWaitMinutes,
          startTime: this._countdownStartTime,
          lastPos: this._lastPosition
        });
      } catch (e) {
        console.warn("⚠️ Countdown state load failed:", e);
      }
    },
    
    _saveCountdownStateToStorage() {
      try {
        if (this._baseWaitMinutes !== null) {
          localStorage.setItem(this._STORAGE_KEY_BASE_WAIT, String(this._baseWaitMinutes));
        }
        if (this._countdownStartTime !== null) {
          localStorage.setItem(this._STORAGE_KEY_START_TIME, String(this._countdownStartTime));
        }
        if (this._lastPosition !== null) {
          localStorage.setItem(this._STORAGE_KEY_POSITION, String(this._lastPosition));
        }
      } catch (e) {
        console.warn("⚠️ Countdown state save failed:", e);
      }
    },
    
    _clearCountdownStateFromStorage() {
      try {
        localStorage.removeItem(this._STORAGE_KEY_BASE_WAIT);
        localStorage.removeItem(this._STORAGE_KEY_START_TIME);
        localStorage.removeItem(this._STORAGE_KEY_POSITION);
      } catch (e) {}
    },

    // ============================================
    // LOAD USER LOCATION (from home page)
    // ============================================
    // Location was requested on home page and saved to localStorage.
    // We just read it here (no permission prompt on QStatus).
    
    _loadUserLocationFromStorage() {
      try {
        const raw = localStorage.getItem("userLocation");
        if (raw) {
          this._userLocation = JSON.parse(raw);
          console.log("✅ Location loaded:", this._userLocation);
        }
      } catch (e) {
        console.warn("⚠️ Location load failed:", e);
      }
    },

    // ============================================
    // LOAD QUEUE DATA (without wait time)
    // ============================================
    // We load business/services info from localStorage,
    // but NEVER load waitMinutes (it must come from server).
    
    loadQueueDataFromStorage() {
      try {
        const raw = localStorage.getItem("queueStatus");
        if (!raw) return;
        
        const parsed = JSON.parse(raw);
        this.data = parsed;
        this.data.queue = this.data.queue || {};
        
        //  CRITICAL: DO NOT load waitMinutes from storage
        // Server will provide fresh wait time on first poll
        this.data.queue.waitMinutes = 0;
        this.data.queue.etaMinutes = this.data.queue.etaMinutes || null;
        this.data.queue.estimationMinutes = 0;
        this.data.queue.position = this.data.queue.position || null;
        this.data.queue.status = this.data.queue.status || "waiting";
        this.data.queue.waitLabel = "جاري التحميل...";
        this.data.queue.queueId = this.data.queue.queueId || null;
        this.data.queue.memberId = this.data.queue.memberId || null;
        
        console.log("✅ Queue data loaded (wait time will come from server)");
      } catch (e) {
        console.error("❌ Load failed:", e);
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
    // Poll server every 5 seconds to get fresh queue status.
    
    startAutoRefresh() {
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(() => this.refreshQueueStatusFromServer(), 5000);
      this.refreshQueueStatusFromServer();
    },

    stopAutoRefresh() {
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = null;
    },

    // ============================================
    // REFRESH QUEUE STATUS (MAIN LOGIC)
    // ============================================
    
    async refreshQueueStatusFromServer() {
      try {
        const queueId = this._getQueueId();
        const userId = this._getUserId();
        
        if (!queueId || !userId) return;

        const res = await fetch(
          `${API_BASE}/queues/${queueId}/user-status?user_id=${encodeURIComponent(userId)}`
        );
        
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 404) {
            this.stopAutoRefresh();
            localStorage.removeItem("queueStatus");
            window.location.href = "home_page.html";
            return;
          }
          return;
        }

        console.log("📥 Server:", json);

        // ============================================
        // WAIT TIME FROM SERVER 
        // ============================================
        // Server already calculates the final wait time using:
        // - Position 1 (no one ahead) = 0 wait time
        // - Position 2+ = max(linear, ml) where linear = peopleAhead × service_duration
        //
        // We use wait_minutes_final directly from server
        
        const finalWait = Number(json.wait_minutes_final);  // Server's final decision
        const mlWait = json.wait_minutes_ml;                 // For label display only
        
        // Use server's calculation (already handles position 1 = 0)
        const effectiveWait = Number.isFinite(finalWait) ? finalWait : 0;
        
        // Set label based on whether ML was used
        this.data.queue.waitLabel = 
          (mlWait !== null && Number.isFinite(mlWait) && mlWait >= 0) ? "تقدير ذكي" : "تقدير قياسي";

        console.log("⏱️ Wait from server:", {
          position: json.position,
          peopleAhead: json.people_ahead,
          linear: json.wait_minutes,
          ml: mlWait,
          final: effectiveWait,
          label: this.data.queue.waitLabel
        });

        // ============================================
        // COUNTDOWN RESET LOGIC (with localStorage persistence)
        // ============================================
        // Only reset countdown if:
        // 1. First poll AND no saved state (truly fresh start)
        // 2. Position changed (someone ahead finished/left)
        //
        // Countdown survives page refresh because state is in localStorage!
        
        const newPosition = Number(json.position || 0);
        const positionChanged = this._lastPosition !== null && this._lastPosition !== newPosition;
        
        // Check if this is truly first time (no saved countdown state)
        const isFirstTimeEver = this._baseWaitMinutes === null && this._countdownStartTime === null;
        
        if (isFirstTimeEver || positionChanged) {
          console.log("🔄 Countdown reset:", {
            reason: isFirstTimeEver ? "first time (no saved state)" : "position changed",
            oldPosition: this._lastPosition,
            newPosition,
            newWaitMinutes: effectiveWait
          });
          
          this._baseWaitMinutes = effectiveWait;
          this._countdownStartTime = Date.now();
          this._lastPosition = newPosition;
          
          // Save to localStorage so it survives refresh
          this._saveCountdownStateToStorage();
        } else {
          // Just update position tracking (don't reset countdown)
          this._lastPosition = newPosition;
          this._saveCountdownStateToStorage();
        }

        // Update current countdown value
        const remainingNow = this._computeRemainingWaitMinutes();
        this.data.queue.waitMinutes = remainingNow;

        // ============================================
        // UPDATE OTHER FIELDS
        // ============================================
        
        this.data.queue.position = newPosition || null;
        this.data.queue.totalPeople = Number(json.people_in_line || 0);
        this.data.queue.status = json.status || "waiting";

        if (json.business) {
          this.data.business.name = json.business.name || this.data.business.name;
          this.data.business.latitude = json.business.latitude || this.data.business.latitude;
          this.data.business.longitude = json.business.longitude || this.data.business.longitude;
        }

        // ============================================
        // NOTIFICATION: YOU ARE NEXT
        // ============================================
        
        if (this.data.queue.position === 1 && this.data.queue.status === "called" && !this._notifiedNext) {
          this._notifiedNext = true;
          alert("🔔 أنت التالي في الطابور! يرجى الاستعداد.");
        }

        // ============================================
        // CHECK IF TICKET FINISHED
        // ============================================
        
        if (json.is_finished) {
          this.stopAutoRefresh();
          this._stopWaitCountdown();
          this._clearCountdownStateFromStorage();  // Clear countdown state
          
          const status = String(json.status || "").toLowerCase();
          
          if (status === "done") alert("✅ تم إكمال خدمتك بنجاح");
          else if (status === "left") alert("ℹ️ تم إنهاء تذكرتك.");
          else if (status === "skipped") alert("ℹ️ تم تخطي تذكرتك.");
          
          localStorage.removeItem("queueStatus");
          window.location.href = "home_page.html";
          return;
        }

        // ============================================
        //  UPDATE ESTIMATION (wait + travel)
        // ============================================
        //  "total_eta_minutes = remaining_wait_minutes + travel_minutes"
        //
        // This is the TOTAL time until service starts:
        // - Wait time: time until your turn
        // - Travel time: drive time from current location to business
        
        const currentWait = this._computeRemainingWaitMinutes();
        const currentTravel = Number(this.data.queue.etaMinutes || 0);
        this.data.queue.estimationMinutes = currentWait + currentTravel;

        // ============================================
        // REFRESH ETA EVERY 3 POLLS (15 seconds)
        // ============================================
        
        this._etaPollCounter++;
        if (this._etaPollCounter % 3 === 1) {
          this.refreshEtaTravelOnly();
        }

      } catch (e) {
        console.error("❌ Refresh error:", e);
      }
    },

    // ============================================
    // WAIT TIME COUNTDOWN
    // ============================================
    // Calculate remaining wait time based on elapsed time since countdown started.
    // This is called every second by the countdown timer.
    
    _computeRemainingWaitMinutes() {
      const base = Number(this._baseWaitMinutes);
      if (!Number.isFinite(base) || base <= 0) return 0;

      const startTime = Number(this._countdownStartTime);
      if (!Number.isFinite(startTime) || startTime <= 0) return Math.max(0, Math.ceil(base));

      const elapsedMs = Math.max(0, Date.now() - startTime);
      const elapsedMin = elapsedMs / 60000;
      const remaining = base - elapsedMin;

      return Math.max(0, Math.floor(remaining));
    },

    // Start countdown timer (updates UI every second)
    _startWaitCountdown() {
      if (this._countdownTimer) clearInterval(this._countdownTimer);

      this._countdownTimer = setInterval(() => {
        const remaining = this._computeRemainingWaitMinutes();
        this.data.queue.waitMinutes = remaining;

        //  UPDATE ESTIMATION = wait + travel
        //  "total_eta_minutes = remaining_wait_minutes + travel_minutes"
        const travel = Number(this.data.queue.etaMinutes || 0);
        this.data.queue.estimationMinutes = remaining + travel;
      }, 1000);
    },

    _stopWaitCountdown() {
      if (this._countdownTimer) clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    },

    // ============================================
    // ETA (TRAVEL TIME) CALCULATION
    // ============================================
    // Calculate drive time from user's current location to business.
    // Uses Google Distance Matrix API with real-time traffic data.
    //  "travel_minutes = Google ETA (updates with traffic; no countdown)"
    
    async refreshEtaTravelOnly() {
      try {
        const b = this.data?.business;
        const destLat = Number(b?.latitude);
        const destLng = Number(b?.longitude);

        if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
          this.data.queue.etaMinutes = null;
          return;
        }

        const origin = this._userLocation;

        if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
          this.data.queue.etaMinutes = null;
          return;
        }

        const destination = { lat: destLat, lng: destLng };
        
        console.log("🚗 Calculating ETA:", { origin, destination });
        
        const eta = await getTrafficEtaMinutes(origin, destination);
        
        this.data.queue.etaMinutes = eta;
        
        console.log("✅ ETA:", eta, "min");

        //  UPDATE ESTIMATION = wait + travel
        const wait = this._computeRemainingWaitMinutes();
        this.data.queue.estimationMinutes = wait + (eta || 0);

      } catch (e) {
        console.error("❌ ETA error:", e);
        this.data.queue.etaMinutes = null;
      }
    },

    // ============================================
    // USER ACTIONS
    // ============================================
    
    // Leave queue: marks ticket as "left" status
    async confirmLeave() {
      const queueId = this._getQueueId();
      const userId = this._getUserId();

      if (!queueId || !userId) {
        localStorage.removeItem("queueStatus");
        this._clearCountdownStateFromStorage();  // Clear countdown state
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
            this._clearCountdownStateFromStorage();  // Clear countdown state
            window.location.href = "home_page.html";
            return;
          }
          
          throw new Error(err?.error || "Failed to leave");
        }

      } catch (e) {
        console.error(e);
        alert("تعذر مغادرة الطابور.");
        return;
      }

      localStorage.removeItem("queueStatus");
      this._clearCountdownStateFromStorage();  // Clear countdown state
      window.location.href = "home_page.html";
    },

    // Confirm service done: marks ticket as "done" status
    // Only available when status = "called" (business called you)
    async confirmDone() {
      const queueId = this._getQueueId();
      const userId = this._getUserId();

      if (!queueId || !userId) {
        alert("تم إكمال خدمتك بنجاح 🎉");
        localStorage.removeItem("queueStatus");
        this._clearCountdownStateFromStorage();  // Clear countdown state
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
        alert("تعذر تحديث حالتك.");
        return;
      }

      alert("تم إكمال خدمتك بنجاح 🎉");
      localStorage.removeItem("queueStatus");
      this._clearCountdownStateFromStorage();  // Clear countdown state
      window.location.href = "home_page.html";
    }
  };
}