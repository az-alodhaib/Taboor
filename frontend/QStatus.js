const API_BASE = "http://localhost:3000";


async function getTrafficEtaMinutes(origin, destination) {
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
}

function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function QStatusPage() {
  return {
    data: {
      business: { name: "", address: "" },
      services: [],
      totals: { totalWithTax: "0.00" },
      queue: { position: 1, totalPeople: 0, estMinutes: 0 }
    },
    progress: 0,
    dots: "",
    _startTs: 0,
    _durationMs: 0,

    init() {
  try {
    const raw = localStorage.getItem("queueStatus");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        this.data = parsed;
        this.data.queue = this.data.queue || {};

        // self-note: backward compatibility (old payload only had estMinutes)
        const legacy = Number(this.data.queue.estMinutes || 0);

        this.data.queue.waitMinutes = Number(this.data.queue.waitMinutes ?? legacy);
        this.data.queue.submissionMinutes = Number(this.data.queue.submissionMinutes || 0);
        this.data.queue.travelMinutes = Number(this.data.queue.travelMinutes || 0);
        this.data.queue.estimationMinutes = Number(
          this.data.queue.estimationMinutes ??
          (this.data.queue.waitMinutes + this.data.queue.travelMinutes)
        );

        // self-note: keep estMinutes synced so UI doesn't break anywhere else
        this.data.queue.estMinutes = this.data.queue.waitMinutes;
        // calculate ETA (travel time only)
        this.refreshEtaTravelOnly();

      }
    }
  } catch (e) {}

  // self-note: start polling immediately (even if I'm next)
  this.startAutoRefresh();

  // self-note: progress is based on waitMinutes (time until my turn), not submissionMinutes.
  const pos = Number(this.data.queue.position || 0);
  const wait = Number(this.data.queue.waitMinutes ?? this.data.queue.estMinutes ?? 0);

  if (pos <= 1 || wait <= 0) {
    this.progress = 100;
    return;
  }

  const est = Math.max(1, wait);
  this._durationMs = est * 60 * 1000;
  this._startTs = performance.now();
  requestAnimationFrame(this._tick.bind(this));
  this._animateDots();
  
},

    _tick(ts) {
      const elapsed = ts - this._startTs;
      const pct = Math.min(100, (elapsed / this._durationMs) * 100);
      this.progress = pct;
      if (pct < 100) requestAnimationFrame(this._tick.bind(this));
      else this.progress = 100;
    },

    _animateDots() {
      let i = 0;
      setInterval(() => {
        this.dots = ".".repeat((i % 3) + 1);
        i++;
      }, 500);
    },

    _getUserId() {
      // self-note: support multiple storage keys to avoid breaking older login pages
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
      // self-note: queueId must be stored in payload, otherwise backend calls can't work
      const qid = this.data?.queue?.queueId ?? null;
      return qid != null ? String(qid) : null;
    },
    _pollTimer: null,
_lastWaitMinutes: null,

startAutoRefresh() {
  // self-note: refresh queue status frequently; ETA less frequently
  if (this._pollTimer) clearInterval(this._pollTimer);

  this._pollTimer = setInterval(() => {
    this.refreshQueueStatusFromServer();
  }, 5000); // every 5 seconds

  // run immediately
  this.refreshQueueStatusFromServer();
},

stopAutoRefresh() {
  if (this._pollTimer) clearInterval(this._pollTimer);
  this._pollTimer = null;
},

async refreshQueueStatusFromServer() {
  try {
    const queueId = this._getQueueId();
    const userId = this._getUserId();
    if (!queueId || !userId) return;

    const res = await fetch(`${API_BASE}/queues/${queueId}/user-status?user_id=${encodeURIComponent(userId)}`);
    const json = await res.json().catch(() => ({}));

    // if ticket not active anymore (done/left/skipped/rejected), stop polling
    if (!res.ok) {
      // self-note: ticket ended or user not in queue anymore
      this.stopAutoRefresh();
      return;
    }

    this.data.queue = this.data.queue || {};

    // update live values
    this.data.queue.position = Number(json.position ?? this.data.queue.position ?? 1);
    this.data.queue.waitMinutes = Number(json.wait_minutes ?? this.data.queue.waitMinutes ?? 0);
    this.data.queue.estMinutes = this.data.queue.waitMinutes; // backward compatibility
    this.data.queue.totalPeople = Number(json.people_in_line ?? this.data.queue.totalPeople ?? 0);

    // keep business coords synced (ETA needs it)
    if (json.business) {
      this.data.business = this.data.business || {};
      this.data.business.name = json.business.name ?? this.data.business.name;
      this.data.business.latitude = json.business.latitude ?? this.data.business.latitude;
      this.data.business.longitude = json.business.longitude ?? this.data.business.longitude;
    }

    // self-note: restart progress animation only if waitMinutes changed
    if (this._lastWaitMinutes !== this.data.queue.waitMinutes) {
      this._lastWaitMinutes = this.data.queue.waitMinutes;
      this._restartProgress();
    }

    
    // self-note: refresh ETA sometimes (every 3 polls)
    this._etaPollCounter = (this._etaPollCounter || 0) + 1;
      if (this._etaPollCounter % 3 === 1) {
        if (typeof this.refreshEtaTravelOnly === "function") {
          this.refreshEtaTravelOnly();
          }
      }

  } catch (e) {
    console.error(e);
  }
},

_restartProgress() {
  const pos = Number(this.data.queue.position || 0);
  const wait = Number(this.data.queue.waitMinutes ?? this.data.queue.estMinutes ?? 0);

  if (pos <= 1 || wait <= 0) {
    this.progress = 100;
    return;
  }

  const est = Math.max(1, wait);
  this._durationMs = est * 60 * 1000;
  this._startTs = performance.now();
  requestAnimationFrame(this._tick.bind(this));
},

    async refreshEtaTravelOnly() {
  try {
    const b = this.data?.business;
    const destLat = Number(b?.latitude);
    const destLng = Number(b?.longitude);

    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) {
      console.log("ETA debug: missing business coords", b);
      this.data.queue.etaMinutes = null;
      return;
    }

    const origin = await getBrowserLocation();
    if (!origin) {
      console.log("ETA debug: missing user location");
      this.data.queue.etaMinutes = null;
      return;
    }

    const destination = { lat: destLat, lng: destLng };

    console.log("ETA debug: calling /eta", { origin, destination });

    const eta = await getTrafficEtaMinutes(origin, destination);
    this.data.queue.etaMinutes = eta;
  } catch (e) {
    console.error("ETA debug error:", e);
    this.data.queue.etaMinutes = null;
  }
},

    async confirmLeave() {
      const queueId = this._getQueueId();
      const userId = this._getUserId();

      // self-note: fallback to old behavior if IDs are missing
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

      // self-note: fallback to old behavior if IDs are missing
      if (!queueId || !userId) {
        alert("تم إكمال خدمتك بنجاح 🎉");
        localStorage.removeItem("queueStatus");
        window.location.href = "home_page.html";
        return;
      }

      try {
        // self-note: ask backend for my active member_id, then mark it done
        const posRes = await fetch(`${API_BASE}/queues/${queueId}/position?user_id=${encodeURIComponent(userId)}`);
        if (!posRes.ok) throw new Error("Failed to get my position");

        const posData = await posRes.json();
        if (!posData?.member_id) throw new Error("No active ticket found");

        const patchRes = await fetch(`${API_BASE}/queue_members/${posData.member_id}/status`, {
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
