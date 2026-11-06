// Shared helpers. Classic script (no modules) so the game also works from file:// and
// can be inlined into a single HTML file.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = (root.CK = root.CK || {});

  CK.ROOM = 21; // °C
  CK.TIME_SCALE = 10; // kitchen seconds per real second (before fast-forward)

  let _uid = 1;
  CK.uid = () => _uid++;

  CK.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  CK.lerp = (a, b, t) => a + (b - a) * t;
  CK.invLerp = (a, b, x) => CK.clamp((x - a) / (b - a), 0, 1);
  CK.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  CK.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  CK.approach = (cur, target, dt, tau) => target + (cur - target) * Math.exp(-dt / Math.max(1e-6, tau));

  // Deterministic pseudo random from a seed (for stable visuals).
  CK.hash = function (n) {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // ---------- colours ----------
  CK.hex2rgb = function (h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  CK.rgb2hex = function (r, g, b) {
    const f = (v) => CK.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
  };
  CK.mix = function (a, b, t) {
    const A = CK.hex2rgb(a), B = CK.hex2rgb(b);
    t = CK.clamp(t, 0, 1);
    return CK.rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  CK.mixMany = function (pairs) {
    // pairs: [[hex, weight], ...]
    let r = 0, g = 0, b = 0, w = 0;
    for (const [hex, wt] of pairs) {
      if (wt <= 0) continue;
      const c = CK.hex2rgb(hex);
      r += c[0] * wt; g += c[1] * wt; b += c[2] * wt; w += wt;
    }
    if (w <= 0) return '#ffffff';
    return CK.rgb2hex(r / w, g / w, b / w);
  };
  CK.rgba = function (hex, a) {
    const c = CK.hex2rgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };
  // Browning colour ramp: base -> golden -> brown -> charcoal
  CK.browned = function (base, brown) {
    if (brown <= 0.05) return base;
    if (brown < 1) return CK.mix(base, '#d9a04a', brown * 0.85);
    if (brown < 2) return CK.mix(CK.mix(base, '#d9a04a', 0.85), '#7b4a22', brown - 1);
    if (brown < 3) return CK.mix('#7b4a22', '#2a1c14', brown - 2);
    return '#221812';
  };

  // ---------- amounts ----------
  function frac(x) {
    // nice fraction text for spoon measures
    const whole = Math.floor(x + 1e-6);
    const r = x - whole;
    const table = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'], [1, '']];
    let best = table[0], bd = 9;
    for (const t of table) { const d = Math.abs(r - t[0]); if (d < bd) { bd = d; best = t; } }
    let w = whole + (best[0] === 1 ? 1 : 0);
    const f = best[0] === 1 ? '' : best[1];
    if (w === 0 && !f) return null;
    return (w ? String(w) : '') + f;
  }
  CK.fmtGrams = function (g) {
    if (g < 0.05) return '0 g';
    if (g < 10) return (Math.round(g * 10) / 10).toString() + ' g';
    if (g < 1000) return Math.round(g) + ' g';
    return (Math.round(g / 10) / 100).toString() + ' kg';
  };
  // Human measure for a given ingredient amount, e.g. "≈ ½ tsp"
  CK.measure = function (ingId, g) {
    const d = CK.ING && CK.ING[ingId];
    if (!d) return '';
    const liquid = d.phase === 'liquid' || ingId === 'oil';
    const main = liquid ? (Math.round(g) + ' ml') : CK.fmtGrams(g);
    if (!d.perTsp) return main;
    const tsp = g / d.perTsp;
    let hint = '';
    if (d.pinch && g < d.pinch * 2.5) {
      const p = Math.max(1, Math.round(g / d.pinch));
      hint = p === 1 ? 'a pinch' : (p === 2 ? '2 pinches' : p + ' pinches');
    } else if (tsp < 2.5) {
      const f = frac(tsp);
      hint = f ? f + ' tsp' : '';
    } else if (tsp < 12) {
      const f = frac(tsp / 3);
      hint = f ? f + ' tbsp' : '';
    } else {
      const f = frac(tsp / 48);
      hint = f ? f + ' cup' : '';
    }
    return hint ? `${main} (≈ ${hint})` : main;
  };

  CK.plural = (n, one, many) => (Math.abs(n - 1) < 0.01 ? one : many);
  CK.listJoin = function (arr) {
    if (arr.length === 0) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  };
  CK.cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  CK.aOrAn = (w) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
  CK.pick = (arr, seed) => arr[Math.floor((seed == null ? Math.random() : seed) * arr.length) % arr.length];
})();
