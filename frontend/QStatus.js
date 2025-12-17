function QStatusPage() {
  return {
    data: {
      business: { name: '', address: '' },
      services: [],
      totals: { totalWithTax: '0.00' },
      queue: { position: 1, totalPeople: 5, estMinutes: 5 }
    },
    progress: 0,
    dots: '',
    _startTs: 0,
    _durationMs: 0,

    init() {
      try {
        const raw = localStorage.getItem('queueStatus');
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
          this.data.queue.estimationMinutes ?? (this.data.queue.waitMinutes + this.data.queue.travelMinutes)
        );

        // self-note: keep estMinutes synced so UI doesn't break anywhere else
        this.data.queue.estMinutes = this.data.queue.waitMinutes;
      }
    }
  } catch (e) {}
 
  // SIMULATION: 1 min == 1 sec (change to *60000 for real time)
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
      if (pct < 100) {
        requestAnimationFrame(this._tick.bind(this));
      } else {
        this.progress = 100;
      }
    },

    _animateDots() {
      let i = 0;
      setInterval(() => {
        this.dots = '.'.repeat((i % 3) + 1);
        i++;
      }, 500);
    },

    confirmLeave() {
      localStorage.removeItem('queueStatus');
      window.location.href = 'home_page.html';
    },

    confirmDone() {
      alert('تم إكمال خدمتك بنجاح 🎉');
      localStorage.removeItem('queueStatus');
      window.location.href = 'home_page.html';
    }
  };
}
