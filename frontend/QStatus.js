const API_BASE = window.location.origin;


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
    if (!navigator.geolocation) {
      console.log("ETA debug: geolocation not supported");
      return resolve(null);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // self-note: show why location failed (permission/timeout/etc)
        console.log("ETA debug: geolocation error", {
          code: err?.code,
          message: err?.message
        });
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
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
      // self-note: keep join timestamp so progress survives page refresh
      this.data.queue.joinedAt = Number(this.data.queue.joinedAt || Date.now());

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
    const joinedAt = Number(this.data.queue.joinedAt || Date.now());
    const elapsedReal = Math.max(0, Date.now() - joinedAt);
    const elapsedCapped = Math.min(elapsedReal, this._durationMs);
    this._startTs = performance.now() - elapsedCapped;
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

    // if request failed, handle carefully (don't silently kill the UI)
  if (!res.ok) {
  // self-note: 404 usually means no active ticket (user already left / queue reset)
  if (res.status === 404) {
    this.stopAutoRefresh();
    localStorage.removeItem("queueStatus");
    window.location.href = "home_page.html";
    return;
  }

  // self-note: temporary/server errors should NOT stop polling
  console.warn("refreshQueueStatusFromServer failed:", json);
  return;
}


    this.data.queue = this.data.queue || {};

    // update live values
    this.data.queue.status = json.status ?? this.data.queue.status ?? "waiting";

      // self-note: prefer ML wait if available, fallback to linear wait
      const mlWait = Number(json.wait_minutes_ml);
      const linearWait = Number(json.wait_minutes);

      const effectiveWait =
       Number.isFinite(mlWait) && mlWait >= 0 ? mlWait :
      (Number.isFinite(linearWait) && linearWait >= 0 ? linearWait : 0);

    // self-note: position might be null if ticket finished
    this.data.queue.position = json.position != null ? Number(json.position) : null;

    this.data.queue.waitMinutes = effectiveWait;
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

    // self-note: if backend says ticket finished, show it clearly
  if (json.is_finished) {
    this.stopAutoRefresh();
    this.progress = 100;

    const st = String(json.status || "").toLowerCase();

    if (st === "done") {
      alert("✅ تم إكمال خدمتك بنجاح");
    } else if (st === "left") {
      alert("ℹ️ تم إنهاء تذكرتك (تم الخروج من الطابور).");
    } else if (st === "skipped") {
      alert("ℹ️ تم تخطي تذكرتك.");
    }

  localStorage.removeItem("queueStatus");
  window.location.href = "home_page.html";
  return;
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
  const joinedAt = Number(this.data.queue.joinedAt || Date.now());
  const elapsedReal = Math.max(0, Date.now() - joinedAt);
  const elapsedCapped = Math.min(elapsedReal, this._durationMs);
  this._startTs = performance.now() - elapsedCapped;

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

  // self-note: fallback to saved travelMinutes (approx) if available
  const fallback = Number(this.data?.queue?.travelMinutes ?? 0);
  this.data.queue.etaMinutes = fallback > 0 ? fallback : null;

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

      // self-note: if backend says I'm not in queue anymore, just treat as success
      if (res.status === 404 && String(err?.error || "").includes("No active ticket")) {
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

      // self-note: fallback to old behavior if IDs are missing
      if (!queueId || !userId) {
        alert("تم إكمال خدمتك بنجاح 🎉");
        localStorage.removeItem("queueStatus");
        window.location.href = "home_page.html";
        return;
      }

      try {
        // self-note: ask backend for my active member_id, then mark it done
        const memberId = this.data?.queue?.memberId;

        let idToPatch = memberId;

      if (!idToPatch) {
      const posRes = await fetch(`${API_BASE}/queues/${queueId}/position?user_id=${encodeURIComponent(userId)}`);
      if (!posRes.ok) throw new Error("Failed to get my position");

      const posData = await posRes.json();
      if (!posData?.member_id) throw new Error("No active ticket found");

     idToPatch = posData.member_id;
      }

      const patchRes = await fetch(`${API_BASE}/queue_members/${idToPatch}/status`, {
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
