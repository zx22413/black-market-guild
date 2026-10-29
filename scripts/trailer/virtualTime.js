// Injected into the page before any of its scripts (scripts/trailer/capture.ts): the page's clock
// only moves when the capture calls `__vt.step(ms)`, so every frame of the trailer is rendered at an
// exact time however long the frame takes to draw. It replaces performance.now, Date.now, timers and
// requestAnimationFrame, and seeks CSS and Web Animations by hand. Loading (fetch, decoding,
// shader compiles) still happens in real time between steps.
(() => {
  const realDateNow = Date.now.bind(Date);
  const epoch = realDateNow();
  let now = 0;
  let nextId = 1;
  /** id → { at, run, every } */
  const timers = new Map();
  let frames = new Map();
  /** Animations already paused and seeked by hand, with the time they were first seen. */
  const seen = new WeakSet();

  // Seeded too, so the storm's bolts and the rain fall the same way in every take (mulberry32).
  let seed = 0x5eed;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => now;
  Date.now = () => epoch + now;
  window.setTimeout = (run, ms = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(ms) || 0), run: () => (typeof run === 'function' ? run(...args) : undefined), every: 0 });
    return id;
  };
  window.setInterval = (run, ms = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(ms) || 0);
    timers.set(id, { at: now + every, run: () => run(...args), every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestAnimationFrame = (run) => {
    const id = nextId++;
    frames.set(id, run);
    return id;
  };
  window.cancelAnimationFrame = (id) => void frames.delete(id);

  function fireTimers(until) {
    for (;;) {
      let due = null;
      for (const [id, t] of timers) if (t.at <= until && (!due || t.at < due[1].at)) due = [id, t];
      if (!due) return;
      const [id, t] = due;
      now = Math.max(now, t.at);
      if (t.every) t.at += t.every;
      else timers.delete(id);
      try {
        t.run();
      } catch (error) {
        console.error(error);
      }
    }
  }

  function seekAnimations(ms) {
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) {
        seen.add(a);
        a.pause();
        // Started since the last step: from its beginning.
        a.currentTime = 0;
      }
      if (a.currentTime !== null) a.currentTime += ms;
    }
  }

  window.__vt = {
    get now() {
      return now;
    },
    /** Moves the clock by `ms`, fires what fell due and draws one animation frame. */
    step(ms) {
      const until = now + ms;
      fireTimers(until);
      now = until;
      seekAnimations(ms);
      const run = frames;
      frames = new Map();
      for (const cb of run.values()) {
        try {
          cb(now);
        } catch (error) {
          console.error(error);
        }
      }
      return now;
    },
  };
})();
