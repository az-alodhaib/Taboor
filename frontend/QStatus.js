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
          if (parsed?.queue?.estMinutes) this.data = parsed;
        }
      } catch (e) {}

      // SIMULATION: 1 min == 1 sec (change to *60000 for real time)
      const est = Math.max(1, Number(this.data.queue.estMinutes) || 5);
      this._durationMs = est * 1000;
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
