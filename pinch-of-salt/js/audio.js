// Tiny procedural sound engine (WebAudio) — no audio files needed.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const A = (CK.Audio = { ctx: null, muted: false, loops: null });

  function load() { try { return localStorage.getItem('pinch-muted') === '1'; } catch (e) { return false; } }
  A.muted = load();

  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.6;
    A.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    const loop = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(A.master);
      src.start();
      return { g, f };
    };
    A.loops = {
      sizzle: loop('highpass', 3500, 0.5),
      boil: loop('lowpass', 380, 1.5),
      tap: loop('bandpass', 1500, 0.6),
      flame: loop('lowpass', 160, 0.7),
    };
  };

  A.setMuted = function (m) {
    A.muted = m;
    try { localStorage.setItem('pinch-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (A.master) A.master.gain.value = m ? 0 : 0.6;
  };

  A.setLoops = function (lv) {
    if (!A.loops) return;
    const t = A.ctx.currentTime;
    const crackle = 0.6 + Math.random() * 0.8;
    const set = (k, v) => A.loops[k].g.gain.setTargetAtTime(v, t, 0.12);
    set('sizzle', (lv.sizzle || 0) * 0.16 * crackle);
    set('boil', (lv.boil || 0) * 0.35 * (0.6 + Math.random() * 0.7));
    set('tap', (lv.tap || 0) * 0.12);
    set('flame', (lv.flame || 0) * 0.08);
  };

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(freq, type, peak, dec, delay, glide) {
    const ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dec);
    o.connect(g); g.connect(A.master);
    env(g, t, 0.005, peak, dec);
    o.start(t); o.stop(t + dec + 0.05);
  }
  function noise(ftype, freq, peak, dec, delay, q) {
    const ctx = A.ctx, t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = A.noise;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(A.master);
    env(g, t, 0.004, peak, dec);
    s.start(t, Math.random()); s.stop(t + dec + 0.05);
  }

  A.play = function (name) {
    if (!A.ctx || A.muted) return;
    switch (name) {
      case 'click': tone(1400, 'square', 0.05, 0.03); break;
      case 'pick': tone(520, 'sine', 0.08, 0.08, 0, 700); break;
      case 'drop': tone(300, 'sine', 0.12, 0.1, 0, 180); noise('lowpass', 800, 0.06, 0.06); break;
      case 'clank': [620, 931, 1410].forEach((f, i) => tone(f, 'triangle', 0.07 / (i + 1), 0.35)); noise('bandpass', 2500, 0.05, 0.05); break;
      case 'chop': noise('bandpass', 1800, 0.25, 0.04, 0, 2); tone(140, 'sine', 0.25, 0.06, 0, 70); break;
      case 'crack': noise('bandpass', 2600, 0.35, 0.03, 0, 3); noise('bandpass', 1400, 0.2, 0.05, 0.03, 2); tone(500, 'sine', 0.05, 0.12, 0.06, 260); break;
      case 'flip': noise('bandpass', 900, 0.12, 0.15, 0, 0.8); tone(240, 'sine', 0.08, 0.08, 0.12, 120); break;
      case 'bell': tone(1318, 'sine', 0.3, 1.6); tone(2637, 'sine', 0.08, 1.0); tone(1975, 'sine', 0.05, 0.8); break;
      case 'pop': noise('bandpass', 700, 0.3, 0.08, 0, 3); tone(380, 'triangle', 0.15, 0.1, 0, 760); break;
      case 'lever': tone(220, 'square', 0.06, 0.06); noise('lowpass', 500, 0.15, 0.08); break;
      case 'slurp': noise('bandpass', 600, 0.15, 0.3, 0, 4); tone(300, 'sine', 0.05, 0.25, 0, 700); break;
      case 'trash': noise('lowpass', 400, 0.3, 0.2); tone(110, 'sine', 0.2, 0.15); break;
      case 'pourLiquid': noise('bandpass', 500 + Math.random() * 600, 0.07, 0.08, 0, 4); break;
      case 'pourDry': noise('highpass', 4000, 0.05, 0.05); break;
      case 'sizzleHit': noise('highpass', 3000, 0.3, 0.6); break;
      case 'ignite': tone(2000, 'square', 0.03, 0.02); tone(2000, 'square', 0.03, 0.02, 0.08); noise('lowpass', 300, 0.25, 0.4, 0.15); break;
      case 'open': noise('lowpass', 300, 0.2, 0.15); tone(160, 'sine', 0.06, 0.2); break;
      case 'close': tone(120, 'sine', 0.25, 0.12); noise('lowpass', 250, 0.2, 0.08); break;
      case 'stir': noise('bandpass', 1200, 0.03, 0.12, 0, 2); break;
      case 'whisk': noise('bandpass', 2800, 0.05, 0.08, 0, 2); break;
      case 'star': tone(880, 'triangle', 0.15, 0.3); tone(1320, 'triangle', 0.1, 0.4, 0.06); break;
      case 'score': tone(660 + Math.random() * 30, 'sine', 0.03, 0.04); break;
      case 'sad': tone(330, 'triangle', 0.12, 0.4, 0, 220); tone(262, 'triangle', 0.1, 0.5, 0.25, 180); break;
      case 'yay': [523, 659, 784, 1046].forEach((f, i) => tone(f, 'triangle', 0.12, 0.25, i * 0.08)); break;
    }
  };
})();
