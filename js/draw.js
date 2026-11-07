// Procedural drawing of food, containers and the diner. Everything is drawn from the simulation
// state, so cooking changes are visible: whites setting, browning, liquid reducing, etc.
// Style: warm storybook illustration — soft shading toward warm browns (never black), gentle
// highlights from the top-left, and small seeded details (CK.hash) so nothing flickers.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, hash, mix, browned, rgba } = CK;
  const D = (CK.D = {});
  const TAU = Math.PI * 2;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  D.rr = function (ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  D.circle = function (ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); };
  D.ellipse = function (ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); };
  // wobbly blob (seeded)
  D.blob = function (ctx, x, y, r, seed, wob, n) {
    n = n || 14;
    wob = wob == null ? 0.18 : wob;
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 - wob / 2 + wob * hash(seed * 31 + i));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p = pts[0], q = pts[1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.closePath();
  };

  // ---------------------------------------------------------------- colour helpers
  // Memoised: these run for every piece of every pile, every frame.
  const _mc = new Map();
  function memo(k, f) {
    let v = _mc.get(k);
    if (v === undefined) { if (_mc.size > 8000) _mc.clear(); v = f(); _mc.set(k, v); }
    return v;
  }
  function mixc(a, b, t) { t = Math.round(clamp(t, 0, 1) * 200) / 200; return memo(a + b + t, () => mix(a, b, t)); }
  function shadeHex(hex, f) {
    f = Math.round(f * 100) / 100;
    return memo(hex + '*' + f, () => { const [r, g, b] = CK.hex2rgb(hex); return CK.rgb2hex(r * f, g * f, b * f); });
  }
  function brownedc(base, b) { b = Math.round(b * 100) / 100; return memo(base + '^' + b, () => browned(base, b)); }
  const WARM = '#4a2814', CREAM = '#fff9ec';
  const lighten = (h, f) => mixc(h, CREAM, f);
  const deepen = (h, f) => mixc(h, WARM, f);
  D.lighten = lighten; D.deepen = deepen; D.shadeHex = shadeHex;

  // soft warm contact shadow
  function shadow(ctx, x, y, rx, ry, a, rot) {
    ctx.fillStyle = `rgba(74,40,18,${a})`;
    D.ellipse(ctx, x, y, rx, ry, rot);
    ctx.fill();
  }
  D.shadow = shadow;
  function shine(ctx, x, y, rx, ry, rot, a) {
    ctx.fillStyle = `rgba(255,252,240,${a})`;
    D.ellipse(ctx, x, y, rx, ry, rot);
    ctx.fill();
  }
  // a rounded "dome" gradient lit from the top-left
  function dome(ctx, x, y, r, col, hi, lo) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.06, x, y, r * 1.04);
    g.addColorStop(0, lighten(col, hi == null ? 0.35 : hi));
    g.addColorStop(0.55, col);
    g.addColorStop(1, deepen(col, lo == null ? 0.22 : lo));
    return g;
  }
  D.dome = dome;
  // rotated rectangle with chamfered corners (cheap rounded-ish pieces, no save/restore)
  function chamf(ctx, cx, cy, w, h, rot, k) {
    const co = Math.cos(rot), si = Math.sin(rot), a = w / 2, b = h / 2, c = Math.min(k, a, b);
    const u = [-a + c, a - c, a, a, a - c, -a + c, -a, -a], v = [-b, -b, -b + c, b - c, b, b, b - c, -b + c];
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const X = cx + u[i] * co - v[i] * si, Y = cy + u[i] * si + v[i] * co;
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    }
    ctx.closePath();
  }
  // a little chunk seen slightly from above: darker side band, lit top, tiny highlight
  function chunk(ctx, px, py, w, h, rot, top, s, round, depth) {
    const d = (depth == null ? 0.22 : depth) * Math.min(w, h);
    const k = Math.min(w, h) * (round == null ? 0.22 : round);
    ctx.fillStyle = deepen(top, 0.32);
    chamf(ctx, px + 0.3 * s, py + d, w, h, rot, k); ctx.fill();
    ctx.fillStyle = top;
    chamf(ctx, px, py, w, h, rot, k); ctx.fill();
    ctx.fillStyle = 'rgba(255,251,236,0.38)';
    chamf(ctx, px - w * 0.12, py - h * 0.14, w * 0.5, h * 0.3, rot, k * 0.5); ctx.fill();
  }
  // pointed leaf from its base
  function leafPath(ctx, x, y, len, wid, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const tx = x + c * len, ty = y + s * len;
    const mx = x + c * len * 0.45, my = y + s * len * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx - s * wid, my + c * wid, tx, ty);
    ctx.quadraticCurveTo(mx + s * wid, my - c * wid, x, y);
    ctx.closePath();
  }
  function leaf(ctx, x, y, len, wid, a, col, s) {
    leafPath(ctx, x, y, len, wid, a);
    ctx.fillStyle = col; ctx.fill();
    // lighter half
    const c = Math.cos(a), sn = Math.sin(a);
    const mx = x + c * len * 0.45, my = y + sn * len * 0.45;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx + sn * wid, my - c * wid, x + c * len, y + sn * len);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,220,0.16)'; ctx.fill();
    // midrib
    ctx.strokeStyle = 'rgba(230,245,200,0.35)'; ctx.lineWidth = 0.7 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + c * len * 0.85, y + sn * len * 0.85); ctx.stroke();
  }

  function topBrown(it) {
    // what you see from above
    if (CK.isFlippable(it)) return it.brownUp;
    return (it.brownDown + it.brownUp) / 2;
  }

  // draw seasoning specks on top of a solid
  function specks(ctx, it, x, y, R, s) {
    const c = it.comp;
    const groups = [['salt', '#ffffff', 25], ['pepper', '#2b2523', 60], ['chili', '#c9321c', 40], ['parmesan', '#f4e7b0', 6], ['sugar', '#fffdf4', 4]];
    for (const [k, col, per] of groups) {
      const g = c[k] || 0;
      if (g <= 0.02) continue;
      const n = Math.min(40, Math.ceil(g * per));
      const big = k === 'parmesan' ? 1.6 : k === 'chili' ? 1.25 : 1;
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = hash(it.id * 7 + i * 3.1 + k.length) * Math.PI * 2;
        const rr = Math.sqrt(hash(it.id * 11 + i * 1.7 + k.length)) * R * 0.85;
        const w = (1.3 + hash(i * 5.7 + k.length) * 0.8) * s * big, h = w * (0.6 + hash(i * 2.9) * 0.5);
        ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, w, h);
      }
      ctx.fill();
      if (k === 'pepper' || k === 'chili') {
        // a faint glint on the darker flakes so they read on dark browned food too
        ctx.fillStyle = k === 'pepper' ? 'rgba(170,160,150,0.5)' : 'rgba(255,170,120,0.6)';
        ctx.beginPath();
        for (let i = 0; i < n; i += 3) {
          const a = hash(it.id * 7 + i * 3.1 + k.length) * Math.PI * 2;
          const rr = Math.sqrt(hash(it.id * 11 + i * 1.7 + k.length)) * R * 0.85;
          ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.6 * s, 0.6 * s);
        }
        ctx.fill();
      }
    }
  }

  // pile of small pieces
  function pile(ctx, it, x, y, s, opt) {
    const n = Math.round(clamp(opt.n, 3, opt.max || 60));
    const R = opt.R;
    for (let i = 0; i < n; i++) {
      const a = hash(it.id * 3 + i * 7.13) * Math.PI * 2;
      const rr = Math.sqrt(hash(it.id * 5 + i * 3.77)) * R;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      const rot = hash(i * 9.1 + it.id) * Math.PI;
      const shade = 0.85 + hash(i * 1.3 + it.id * 2) * 0.3;
      opt.piece(px, py, rot, shade, i);
    }
  }

  // ---------------------------------------------------------------- items
  // Returns an approximate radius for hit testing.
  D.item = function (ctx, it, x, y, s, inPool) {
    s = s || 1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let R = 14 * s;
    const crepe = it.lump && (it.kind === 'set' ? it.cls : CK.classify(it.comp)) === 'batter' && CK.isCrepe(it.comp);
    if (crepe && it.form !== 'scrambled') {
      // thin batter spreads across the pan into a wide, flat crêpe
      ctx.save(); ctx.translate(x, y); ctx.scale(1.9, 1.9);
      R = (it.kind === 'set' ? drawSet : drawThinFluid)(ctx, it, 0, 0, s) * 1.9;
      ctx.restore();
    } else if (it.lump && !(it.kind === 'set' && it.form === 'scrambled')) R = drawLump(ctx, it, x, y, s);
    else if (it.kind === 'fat') R = drawFat(ctx, it, x, y, s);
    else if (it.kind === 'powder') R = drawPowder(ctx, it, x, y, s);
    else if (it.kind === 'fluid') R = drawThinFluid(ctx, it, x, y, s);
    else if (it.kind === 'set') R = drawSet(ctx, it, x, y, s);
    else R = drawSolid(ctx, it, x, y, s);
    ctx.restore();
    return R;
  };

  function butterPat(ctx, px, py, w, h, s, soft) {
    // a pat of butter: soft shadow, a deeper front face, a creamy top
    const r = Math.min(w, h) * (0.18 + soft * 0.3);
    shadow(ctx, px + 1.5 * s, py + 3 * s, w * 0.56, h * 0.48, 0.16);
    ctx.fillStyle = '#e3bf55'; D.rr(ctx, px - w / 2, py - h / 2 + 2.4 * s * (1 - soft * 0.6), w, h, r); ctx.fill();
    const g = ctx.createLinearGradient(px - w / 2, py - h / 2, px + w / 2, py + h / 2);
    g.addColorStop(0, '#fbe895'); g.addColorStop(1, '#f2d36a');
    ctx.fillStyle = g; D.rr(ctx, px - w / 2, py - h / 2, w, h, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,222,0.85)';
    D.rr(ctx, px - w / 2 + w * 0.14, py - h / 2 + h * 0.16, w * 0.55, h * 0.2, h * 0.1); ctx.fill();
  }

  // the colour of liquid fat (oils, melted lard), butter aside
  function oilColor(it) {
    const pairs = [];
    for (const k in it.comp) if (k !== 'butter') pairs.push([k === 'lard' ? '#f0d890' : (CK.ING[k] || {}).color || '#d8c24c', it.comp[k]]);
    return pairs.length ? CK.mixMany(pairs) : '#d8c24c';
  }
  function drawFat(ctx, it, x, y, s) {
    const m = it.mass, b = it.comp.butter || 0, o = m - b;
    const R = clamp(10 + Math.sqrt(m) * 5, 10, 70) * s;
    const isB = b > o;
    if (!isB && (it.comp.lard || 0) > m * 0.5 && it.temp < 34) {
      // set lard: a soft white lump
      const r = clamp(6 + Math.sqrt(m) * 2.2, 6, 26) * s;
      shadow(ctx, x + 1.5 * s, y + 2.5 * s, r, r * 0.85, 0.16);
      ctx.fillStyle = dome(ctx, x, y, r, '#f6f0e2', 0.4, 0.1); D.blob(ctx, x, y, r, it.id, 0.25, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; D.ellipse(ctx, x - r * 0.3, y - r * 0.35, r * 0.3, r * 0.15, -0.5); ctx.fill();
      return r;
    }
    if (isB && it.temp < 30) {
      // butter pats
      const n = clamp(Math.round(b / 5), 1, 4);
      for (let i = 0; i < n; i++) {
        const px = x + (i - (n - 1) / 2) * 13 * s, py = y + (i % 2) * 6 * s;
        butterPat(ctx, px, py, 12 * s, 10 * s, s, 0);
      }
      return 14 * s;
    }
    const t = now() / 1000;
    const bd = it.brownDown;
    const col = brownedc(isB ? '#f2d36a' : oilColor(it), bd * 0.9);
    // the pool
    ctx.globalAlpha = isB ? 0.78 : 0.44;
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.05, x, y, R);
    g.addColorStop(0, lighten(col, 0.4)); g.addColorStop(0.7, col); g.addColorStop(1, deepen(col, 0.14));
    ctx.fillStyle = g;
    D.blob(ctx, x, y, R, it.id, 0.25, 12);
    ctx.fill();
    ctx.globalAlpha = isB ? 0.45 : 0.4;
    ctx.strokeStyle = deepen(col, 0.25); ctx.lineWidth = 1.3 * s; ctx.stroke();
    ctx.globalAlpha = 1;
    // a pat still melting in the middle
    if (isB && it.temp < 60) {
      const k = clamp((60 - it.temp) / 30, 0, 1);
      if (k > 0.04) butterPat(ctx, x - R * 0.05, y - R * 0.05, (5 + 8 * k) * s, (4 + 6 * k) * s, s, 1 - k * 0.7);
    }
    // browned milk solids (brown butter → burnt butter)
    if (isB && bd > 0.25) {
      const n = Math.round(clamp((bd - 0.25) * 30, 0, 38));
      ctx.fillStyle = rgba(brownedc('#c98a3c', bd + 0.5), 0.8);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = hash(i * 5.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 2.1 + it.id)) * R * 0.82;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr, r = (0.6 + hash(i * 3.7) * 0.9) * s;
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
      }
      ctx.fill();
    }
    // foaming butter
    if (b > 0 && it.temp > 95 && it.temp < 170) {
      const fa = clamp((it.temp - 95) / 10, 0, 1) * clamp((170 - it.temp) / 14, 0, 1) * clamp(1.4 - bd * 0.5, 0.4, 1);
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = hash(i * 3 + it.id) * TAU + t * 0.33;
        const rr = Math.sqrt(hash(i * 7 + it.id)) * R * 0.82;
        const r = (1 + hash(i * 1.7 + it.id) * 1.8 + Math.sin(t * 3.3 + i) * 0.6) * s;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        ctx.moveTo(px + r, py); ctx.arc(px, py, Math.max(0.3, r), 0, TAU);
      }
      ctx.fillStyle = `rgba(255,251,232,${0.78 * fa})`; ctx.fill();
      ctx.strokeStyle = `rgba(214,172,90,${0.45 * fa})`; ctx.lineWidth = 0.6 * s; ctx.stroke();
    }
    // hot oil shimmers
    if (!isB && it.temp > 130) {
      const k = clamp((it.temp - 130) / 60, 0, 1);
      ctx.strokeStyle = `rgba(255,248,220,${0.22 * k})`; ctx.lineWidth = 1.2 * s;
      for (let i = 0; i < 3; i++) {
        const ph = t * 1.6 + i * 2.1;
        const yy = y + (i - 1) * R * 0.32 + Math.sin(ph) * 2 * s;
        ctx.beginPath();
        ctx.moveTo(x - R * 0.45, yy);
        ctx.bezierCurveTo(x - R * 0.15, yy - 3 * s * Math.sin(ph * 1.3), x + R * 0.15, yy + 3 * s, x + R * 0.45, yy);
        ctx.stroke();
      }
    }
    // shine
    ctx.strokeStyle = 'rgba(255,255,250,0.45)';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(x - R * 0.2, y - R * 0.2, R * 0.5, 3.6, 4.6);
    ctx.stroke();
    shine(ctx, x + R * 0.28, y + R * 0.22, 1.6 * s, 1.1 * s, 0, 0.5);
    return R;
  }

  function drawPowder(ctx, it, x, y, s) {
    const m = it.mass;
    if ((it.comp.tvorog || 0) > m * 0.5) {
      // farmer's cheese: a heap of soft white crumbs
      const R = clamp(6 + Math.sqrt(m) * 2.6, 6, 50) * s;
      const col = brownedc('#fbf8f0', it.brownDown * 0.8);
      shadow(ctx, x + 1.2 * s, y + 2.2 * s, R * 0.98, R * 0.86, 0.14);
      pile(ctx, it, x, y, s, {
        n: m / 2.2, R: R * 0.9, max: 70, piece(px, py, r, sh, i) {
          const rr = (2.2 + sh * 1.8) * s;
          ctx.fillStyle = 'rgba(160,140,110,0.25)'; D.blob(ctx, px + 0.4 * s, py + 0.8 * s, rr, i + it.id, 0.5, 6); ctx.fill();
          ctx.fillStyle = shadeHex(col, 0.93 + sh * 0.08); D.blob(ctx, px, py, rr, i + it.id, 0.5, 6); ctx.fill();
          if (i % 3 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; D.circle(ctx, px - rr * 0.3, py - rr * 0.3, rr * 0.35); ctx.fill(); }
        },
      });
      return Math.max(R, 8 * s);
    }
    const pairs = Object.keys(it.comp).map((k) => [(CK.ING[k] || {}).color || '#eeeeee', it.comp[k]]);
    const col = brownedc(CK.mixMany(pairs), it.brownDown * 0.8);
    const R = clamp(4 + Math.sqrt(m) * 3.2, 4, 46) * s;
    shadow(ctx, x + 1.2 * s, y + 2.2 * s, R * 0.98, R * 0.86, 0.13);
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 1, x, y, R);
    g.addColorStop(0, mix(col, '#ffffff', 0.45));
    g.addColorStop(0.6, col);
    g.addColorStop(1, shadeHex(col, 0.84));
    ctx.fillStyle = g;
    D.blob(ctx, x, y, R, it.id, 0.3, 10);
    ctx.fill();
    // fine grain texture
    const nt = Math.min(24, Math.round(R / s));
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    for (let i = 0; i < nt; i++) {
      const a = hash(i * 4.1 + it.id) * TAU, rr = Math.sqrt(hash(i * 1.9 + it.id * 3)) * R * 0.85;
      ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.9 * s, 0.9 * s);
    }
    ctx.fill();
    ctx.fillStyle = rgba(shadeHex(col, 0.78), 0.5);
    ctx.beginPath();
    for (let i = 0; i < nt; i++) {
      const a = hash(i * 6.7 + it.id) * TAU, rr = Math.sqrt(hash(i * 3.3 + it.id * 5)) * R * 0.85;
      ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.9 * s, 0.9 * s);
    }
    ctx.fill();
    // grains
    const dark = (it.comp.pepper || 0) + (it.comp.chili || 0);
    if (dark > 0) {
      for (let i = 0; i < Math.min(50, dark * 60); i++) {
        ctx.fillStyle = hash(i * 5 + it.id) < (it.comp.chili || 0) / dark ? '#c9321c' : '#2b2523';
        const a = hash(i + it.id * 3) * 6.28, rr = Math.sqrt(hash(i * 2.3 + it.id)) * R;
        ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.6 * s, 1.6 * s);
      }
    }
    return Math.max(R, 8 * s);
  }

  function fluidColor(it) {
    const c = it.comp;
    const pairs = [];
    for (const k in c) {
      if (k === 'salt' || k === 'sugar' || k === 'bakingpowder') continue;
      let col = (CK.ING[k] || {}).color || '#dddddd';
      if (k === 'egg') col = '#f4c13d';
      if (k === 'tomato') col = '#c3301f';
      if (k === 'potato') col = '#e2d29e';
      let w = c[k];
      if (k === 'beet') w *= 4; // beet colour is strong: a little turns the whole pot ruby
      if (k === 'water') continue; // water is clear: it only dilutes the other colours
      if (k === 'pepper' || k === 'chili') w *= 0.3;
      pairs.push([col, w]);
    }
    if (!pairs.length) return CK.ING.water.color;
    const tot = CK.sum(Object.values(c)) || 1;
    // beet juice stains everything: a beet broth stays deep ruby however much water is in it
    return mix(CK.mixMany(pairs), '#ffffff', clamp(((c.water || 0) / tot - 0.5) * 0.5, 0, 0.3) * (c.beet ? 0.15 : 1));
  }
  D.fluidColor = fluidColor;

  // batter bubbles: little craters with a dark hole and a lit rim (batched for speed)
  function batterBubbles(ctx, it, x, y, R, s, n, col) {
    const hole = rgba(deepen(col, 0.45), 0.55), rim = 'rgba(255,248,226,0.7)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = hash(i * 2.7 + it.id) * 6.28, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.85;
      const r = (1.2 + hash(i * 7) * 1.8) * s;
      const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr;
      ctx.moveTo(bx + r * 0.7, by); ctx.arc(bx, by, r * 0.7, 0, TAU);
    }
    ctx.fillStyle = hole; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = hash(i * 2.7 + it.id) * 6.28, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.85;
      const r = (1.2 + hash(i * 7) * 1.8) * s;
      const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr;
      ctx.moveTo(bx + r * Math.cos(0.1), by + r * Math.sin(0.1)); ctx.arc(bx, by, r, 0.1, 2.6);
    }
    ctx.strokeStyle = rim; ctx.lineWidth = 0.9 * s; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = hash(i * 2.7 + it.id) * 6.28, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.85;
      const r = (1.2 + hash(i * 7) * 1.8) * s;
      const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr;
      ctx.moveTo(bx + r * Math.cos(3.3), by + r * Math.sin(3.3)); ctx.arc(bx, by, r, 3.3, 5.6);
    }
    ctx.strokeStyle = rgba(deepen(col, 0.3), 0.5); ctx.stroke();
  }

  // a thin fluid (batter/eggs/small puddle) lying in a pan
  function drawThinFluid(ctx, it, x, y, s) {
    const m = it.mass;
    const R = clamp(10 + Math.sqrt(m) * 3.1, 8, 76) * s;
    const cls = CK.classify(it.comp);
    let col = fluidColor(it);
    let alpha = 0.92;
    if (cls === 'water') alpha = 0.45;
    if (cls === 'eggs' || cls === 'batter') col = mix(col, cls === 'eggs' ? '#f7d36b' : '#f6e3b0', clamp(it.cook * 1.8, 0, 0.6));
    ctx.globalAlpha = alpha;
    // browned, lacy edge from the pan
    if (it.brownDown > 0.2) {
      ctx.fillStyle = brownedc(col, it.brownDown + 0.25);
      D.blob(ctx, x, y, R + 3.5 * s, it.id + 7, 0.2, 22);
      ctx.fill();
      ctx.fillStyle = brownedc(col, it.brownDown);
      D.blob(ctx, x, y, R + 2.5 * s, it.id, 0.12, 16);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(x - R * 0.25, y - R * 0.3, R * 0.05, x, y, R);
    g.addColorStop(0, lighten(col, cls === 'water' ? 0.3 : 0.16));
    g.addColorStop(0.75, col);
    g.addColorStop(1, deepen(col, cls === 'water' ? 0.05 : 0.1));
    ctx.fillStyle = g;
    D.blob(ctx, x, y, R, it.id, 0.12, 16);
    ctx.fill();
    // thin eggs and batter set from the edge in: a paler, opaque ring creeping inward
    if ((cls === 'eggs' || cls === 'batter') && it.cook > 0.06) {
      const k = clamp(it.cook * 2.2, 0, 1);
      ctx.globalAlpha = 0.35 * k;
      ctx.strokeStyle = lighten(col, cls === 'eggs' ? 0.35 : 0.25);
      ctx.lineWidth = R * 0.22 * k;
      D.blob(ctx, x, y, R * (1 - 0.11 * k), it.id, 0.12, 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (it.smooth < 0.6 && (cls === 'batter' || cls === 'dough')) {
      // flour lumps
      const n = (1 - it.smooth) * 20;
      for (let i = 0; i < n; i++) {
        const a = hash(i * 3.3 + it.id) * 6.28, rr = Math.sqrt(hash(i * 1.9 + it.id)) * R * 0.85;
        const r = (1.5 + hash(i) * 2) * s, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        ctx.fillStyle = 'rgba(150,115,60,0.25)'; D.circle(ctx, px + 0.5 * s, py + 0.9 * s, r); ctx.fill();
        ctx.fillStyle = '#f7f2e6'; D.circle(ctx, px, py, r); ctx.fill();
        ctx.fillStyle = '#ffffff'; D.circle(ctx, px - r * 0.3, py - r * 0.3, r * 0.4); ctx.fill();
      }
    }
    if (cls === 'eggs' && it.smooth < 0.6) {
      // unbeaten white: glossy, clear-ish streaks
      for (let i = 0; i < 6; i++) {
        const a = hash(i * 4.3 + it.id) * 6.28, rr = hash(i * 2.9 + it.id) * R * 0.7;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        ctx.fillStyle = 'rgba(255,255,240,0.62)';
        D.blob(ctx, px, py, 5 * s, i + it.id, 0.4, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        D.circle(ctx, px - 1.5 * s, py - 1.5 * s, 1.2 * s); ctx.fill();
      }
      // and a few orange yolk swirls
      ctx.strokeStyle = 'rgba(240,150,20,0.45)'; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) {
        const a = hash(i * 8.1 + it.id) * TAU, rr = R * 0.35;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, R * 0.22, a, a + 1.6); ctx.stroke();
      }
    }
    if (cls === 'batter' && it.cook > 0.12) {
      // bubbles appear as the pancake cooks
      const n = Math.round(clamp((it.cook - 0.12) * 80, 0, 25));
      if (n) batterBubbles(ctx, it, x, y, R, s, n, col);
    }
    if (cls === 'curd') curdTexture(ctx, it, x, y, R * 0.85, s);
    if (cls === 'potato') potatoShreds(ctx, it, x, y, R * 0.85, s, col);
    if (cls === 'cream' || cls === 'syrup') {
      // a thick dollop: soft rim shadow and a glossy swirl so it reads even on a white plate
      ctx.strokeStyle = rgba(deepen(col, 0.25), 0.45); ctx.lineWidth = 1.4 * s;
      D.blob(ctx, x, y, R, it.id, 0.12, 16); ctx.stroke();
      ctx.strokeStyle = rgba(lighten(col, 0.6), 0.7); ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.arc(x + R * 0.1, y + R * 0.05, R * 0.45, 0.6, 3.6); ctx.stroke();
      if ((it.comp.cherryjam || 0) > 0.5) {
        ctx.fillStyle = '#8e1a2c';
        for (let i = 0; i < 4; i++) { const a = hash(i * 3.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.6; D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2.4 * s); ctx.fill(); }
      }
    }
    if (cls === 'tomato') {
      // pulp and little bits of tomato
      ctx.fillStyle = rgba(deepen(col, 0.3), 0.45);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = hash(i * 2.2 + it.id) * TAU, rr = Math.sqrt(hash(i * 3.9 + it.id)) * R * 0.8, r = (1 + hash(i * 1.1) * 1.4) * s;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
      }
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(x - R * 0.15, y - R * 0.15, R * 0.6, 3.5, 4.5);
    ctx.stroke();
    shine(ctx, x - R * 0.48, y - R * 0.2, 1.4 * s, 1 * s, 0, 0.55);
    return R;
  }


  // a loose heap of grated shreds (potato, beetroot, carrot)
  function shredMound(ctx, it, x, y, R, s, col) {
    shadow(ctx, x + 1.2 * s, y + 2.4 * s, R * 0.95, R * 0.85, 0.12);
    ctx.fillStyle = deepen(col, 0.12); D.blob(ctx, x, y + 1 * s, R * 0.92, it.id + 3, 0.3, 12); ctx.fill();
    ctx.fillStyle = col; D.blob(ctx, x, y, R * 0.86, it.id, 0.3, 12); ctx.fill();
    ctx.lineCap = 'round';
    const n = Math.round(clamp(it.mass * 0.45, 20, 110));
    for (let i = 0; i < n; i++) {
      const a = hash(i * 2.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 4.9 + it.id)) * R * 0.88;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr, b = hash(i * 7.7 + it.id) * Math.PI, l = (2.5 + hash(i) * 3) * s;
      ctx.strokeStyle = i % 3 === 0 ? deepen(col, 0.2) : i % 3 === 1 ? lighten(col, 0.25) : col;
      ctx.lineWidth = (1 + hash(i * 1.3) * 0.6) * s;
      ctx.beginPath(); ctx.moveTo(px - Math.cos(b) * l, py - Math.sin(b) * l); ctx.quadraticCurveTo(px, py + 1.2 * s, px + Math.cos(b) * l, py + Math.sin(b) * l); ctx.stroke();
    }
  }
  // crumbs of farmer's cheese showing in a curd dough
  function curdTexture(ctx, it, x, y, R, s) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = hash(i * 3.7 + it.id) * TAU, rr = Math.sqrt(hash(i * 1.3 + it.id)) * R, r = (0.8 + hash(i * 2.1) * 1.3) * s;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(190,170,130,0.3)';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = hash(i * 5.1 + it.id) * TAU, rr = Math.sqrt(hash(i * 2.7 + it.id)) * R, r = 0.7 * s;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
    }
    ctx.fill();
  }
  // shreds of grated potato (and onion) showing in a batter
  function potatoShreds(ctx, it, x, y, R, s, col, n) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1 * s;
    for (let i = 0; i < (n || 22); i++) {
      const a = hash(i * 2.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 4.9 + it.id)) * R;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr, b = hash(i * 7.7 + it.id) * Math.PI, l = (2.5 + hash(i) * 3) * s;
      ctx.strokeStyle = i % 3 ? rgba(lighten(col, 0.35), 0.8) : rgba(deepen(col, 0.18), 0.6);
      ctx.beginPath(); ctx.moveTo(px - Math.cos(b) * l, py - Math.sin(b) * l); ctx.quadraticCurveTo(px, py + 1 * s, px + Math.cos(b) * l, py + Math.sin(b) * l); ctx.stroke();
    }
  }

  // a dollop: raw it's a soft glossy mound; set in a pan it's a patty (syrnyk, derun, small pancake),
  // set in boiling water it's a pale dumpling (lazy varenyk)
  function drawLump(ctx, it, x, y, s) {
    const m = it.mass;
    const cls = it.kind === 'set' ? it.cls : CK.classify(it.comp);
    const raw = it.kind === 'fluid';
    const R = clamp(6 + Math.sqrt(m) * 2.2, 8, 34) * s * (raw ? 1.04 : 1);
    const BASE = { curd: '#f6edd6', potato: '#e3d39e', batter: '#f2dfae', eggs: '#f8d65a', dough: '#efe4c8' };
    let base = BASE[cls] || '#e8d6ae';
    if (raw && cls === 'potato') base = '#ddd2ae';
    if (it.method === 'boiled' && !raw) {
      // a pillowy dumpling: rounded oblong, glossy and pale (it can still be browned in butter later)
      const top = brownedc(lighten(base, 0.15), it.brownUp);
      ctx.save(); ctx.translate(x, y); ctx.rotate(it.rot);
      const w = R * 1.35, h = R * 0.95;
      ctx.fillStyle = 'rgba(74,40,18,0.16)'; D.rr(ctx, -w / 2 + 1.5 * s, -h / 2 + 2.5 * s, w, h, h * 0.45); ctx.fill();
      ctx.fillStyle = brownedc(base, it.brownDown); D.rr(ctx, -w / 2, -h / 2 + 1.2 * s, w, h, h * 0.45); ctx.fill();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, lighten(top, 0.35)); g.addColorStop(0.6, top); g.addColorStop(1, deepen(top, 0.08));
      ctx.fillStyle = g; D.rr(ctx, -w / 2, -h / 2, w, h, h * 0.45); ctx.fill();
      // the cut ends and a wet sheen
      ctx.strokeStyle = rgba(deepen(top, 0.12), 0.5); ctx.lineWidth = 0.8 * s;
      ctx.beginPath(); ctx.moveTo(-w * 0.32, -h * 0.4); ctx.quadraticCurveTo(-w * 0.4, 0, -w * 0.32, h * 0.4); ctx.moveTo(w * 0.32, -h * 0.4); ctx.quadraticCurveTo(w * 0.4, 0, w * 0.32, h * 0.4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; D.ellipse(ctx, -w * 0.1, -h * 0.22, w * 0.26, h * 0.1, -0.1); ctx.fill();
      if (cls === 'curd') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 4; i++) { D.circle(ctx, (hash(i + it.id) - 0.5) * w * 0.6, (hash(i * 3 + it.id) - 0.5) * h * 0.5, 0.9 * s); ctx.fill(); } }
      ctx.restore();
      specks(ctx, it, x, y, R * 0.6, s);
      return R;
    }
    shadow(ctx, x + 1.5 * s, y + 2.6 * s, R + 1.5 * s, R * 0.92, raw ? 0.1 : 0.16);
    // the underside rim shows how brown the bottom is
    const under = brownedc(base, it.brownDown);
    ctx.fillStyle = under;
    if (cls === 'potato' && !raw) {
      // lacy, crisp potato edge
      D.blob(ctx, x, y, R + 2.6 * s, it.id + 5, 0.28, 18); ctx.fill();
      ctx.fillStyle = brownedc(base, it.brownDown + 0.35);
      ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + hash(i + it.id) * 0.3, px = x + Math.cos(a) * (R + 1.5 * s), py = y + Math.sin(a) * (R + 1.5 * s), r = (1.2 + hash(i * 3 + it.id)) * s; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU); }
      ctx.fill();
    } else { D.blob(ctx, x, y + 1 * s, R + 1.4 * s, it.id, raw ? 0.16 : 0.08, 16); ctx.fill(); }
    const top = brownedc(base, it.brownUp);
    ctx.fillStyle = dome(ctx, x, y, R, top, raw ? 0.3 : 0.22, raw ? 0.06 : 0.12);
    D.blob(ctx, x, y, R, it.id, raw ? 0.16 : 0.08, 16); ctx.fill();
    if (raw) {
      // still soft: glossy, the cooked edge creeping in from the bottom
      if (it.cook > 0.05) { ctx.strokeStyle = rgba(lighten(top, 0.3), 0.45 * clamp(it.cook * 3, 0, 1)); ctx.lineWidth = R * 0.18; D.blob(ctx, x, y, R * 0.9, it.id, 0.16, 16); ctx.stroke(); }
      if (cls === 'curd') curdTexture(ctx, it, x, y, R * 0.8, s);
      if (cls === 'potato') potatoShreds(ctx, it, x, y, R * 0.8, s, top);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; D.ellipse(ctx, x - R * 0.3, y - R * 0.35, R * 0.32, R * 0.14, -0.5); ctx.fill();
      return R;
    }
    // set patty: a lightly domed top, the colour deeper toward the middle
    if (it.brownUp > 0.25) {
      const cg = ctx.createRadialGradient(x, y, R * 0.1, x, y, R * 0.92);
      cg.addColorStop(0, rgba(brownedc(base, it.brownUp + 0.3), 0.5));
      cg.addColorStop(1, rgba(brownedc(base, it.brownUp), 0));
      ctx.fillStyle = cg; D.circle(ctx, x, y, R * 0.92); ctx.fill();
    }
    if (cls === 'curd') {
      // floury, slightly cracked top with little curd pores
      if (it.brownUp < 0.3) curdTexture(ctx, it, x, y, R * 0.75, s);
      ctx.fillStyle = rgba(deepen(top, 0.3), 0.28);
      ctx.beginPath();
      for (let i = 0; i < 14; i++) { const a = hash(i * 6.1 + it.id) * TAU, rr = Math.sqrt(hash(i * 2.3 + it.id)) * R * 0.8; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; ctx.moveTo(px + 0.8 * s, py); ctx.arc(px, py, 0.8 * s, 0, TAU); }
      ctx.fill();
      ctx.strokeStyle = rgba(deepen(top, 0.25), 0.35); ctx.lineWidth = 0.8 * s;
      for (let i = 0; i < 3; i++) { const a = hash(i * 4.4 + it.id) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.3, R * 0.35, a, a + 0.9); ctx.stroke(); }
    } else if (cls === 'potato') {
      potatoShreds(ctx, it, x, y, R * 0.8, s, top);
    } else if (cls === 'batter' && it.brownUp < 0.3) {
      batterBubbles(ctx, it, x, y, R, s, 7, top);
    }
    ctx.strokeStyle = 'rgba(255,253,240,0.35)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(x, y, R * 0.72, 3.5, 4.5); ctx.stroke();
    specks(ctx, it, x, y, R * 0.75, s);
    return R;
  }

  function drawSet(ctx, it, x, y, s) {
    const m = it.mass;
    if (it.form === 'scrambled') {
      const R = clamp(8 + Math.sqrt(m) * 3, 8, 60) * s;
      const base = it.cls === 'eggs'
        ? mix('#f9dc6b', '#f3e4a0', clamp((it.cook - 0.5) / 1.2, 0, 1))
        : it.cls === 'batter' ? '#f0d39a' : '#e7d3a8';
      const tb = topBrown(it);
      // soft, fluffy folds: a gentle shadow, the curd, a lighter fold on top
      pile(ctx, it, x, y, s, {
        n: m / 3, R, max: 45,
        piece(px, py, rot, sh, i) {
          const r = (5.5 + sh * 3) * s;
          const col = brownedc(shadeHex(base, sh), tb * (0.6 + sh * 0.4));
          ctx.fillStyle = 'rgba(150,100,30,0.22)';
          D.blob(ctx, px + 0.6 * s, py + 1.4 * s, r, px + py, 0.5, 7); ctx.fill();
          ctx.fillStyle = col;
          D.blob(ctx, px, py, r, px + py, 0.5, 7); ctx.fill();
          ctx.strokeStyle = rgba(lighten(col, 0.45), 0.7); ctx.lineWidth = 1.4 * s;
          ctx.beginPath(); ctx.arc(px + r * 0.15, py + r * 0.2, r * 0.6, 3.3 + rot * 0.5, 4.6 + rot * 0.5); ctx.stroke();
          if (it.cls === 'eggs' && i % 4 === 0) { ctx.fillStyle = 'rgba(255,255,248,0.5)'; D.circle(ctx, px + r * 0.25, py - r * 0.1, r * 0.22); ctx.fill(); }
        },
      });
      if (it.cls === 'eggs' && it.cook < 1.1) {
        // still glossy and wet
        const a = clamp((1.1 - it.cook) * 0.9, 0.15, 0.5);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        for (let i = 0; i < 6; i++) { D.ellipse(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 3 + it.id) - 0.5) * R, 2.6 * s, 1.6 * s, -0.5); ctx.fill(); }
      }
      specks(ctx, it, x, y, R, s);
      return R;
    }
    const R = clamp(10 + Math.sqrt(m) * 3.0, 10, 72) * s;
    let base;
    if (it.cls === 'batter') base = '#f2dfae';
    else if (it.cls === 'eggs') base = '#f8d65a';
    else if (it.cls === 'curd') base = '#f6edd6';
    else if (it.cls === 'potato') base = '#e6d6a2';
    else base = '#e8d6ae';
    shadow(ctx, x + 1.5 * s, y + 3 * s, R + 2 * s, R + 1 * s, 0.14);
    // underside edge shows through
    ctx.fillStyle = brownedc(base, it.brownDown);
    D.blob(ctx, x, y, R + 2 * s, it.id, 0.08, 18);
    ctx.fill();
    const top = brownedc(base, it.brownUp);
    ctx.fillStyle = dome(ctx, x, y, R, top, 0.2, 0.1);
    D.blob(ctx, x, y, R, it.id, 0.08, 18);
    ctx.fill();
    if (it.cls === 'batter' && it.brownUp < 0.3) {
      // uncooked side up: matte, dries from the edge, covered in bubbles
      ctx.strokeStyle = rgba(lighten(top, 0.3), 0.45);
      ctx.lineWidth = R * 0.12;
      D.blob(ctx, x, y, R * 0.92, it.id, 0.08, 18); ctx.stroke();
      batterBubbles(ctx, it, x, y, R, s, 18, top);
    }
    if (it.cls === 'batter' && it.brownUp >= 0.3) {
      // golden mottling: deeper in the middle, a paler lacy ring near the edge
      const cg = ctx.createRadialGradient(x, y, R * 0.1, x, y, R * 0.88);
      cg.addColorStop(0, rgba(brownedc(base, it.brownUp + 0.35), 0.5));
      cg.addColorStop(0.7, rgba(brownedc(base, it.brownUp + 0.2), 0.2));
      cg.addColorStop(1, rgba(brownedc(base, it.brownUp), 0));
      ctx.fillStyle = cg; D.circle(ctx, x, y, R * 0.9); ctx.fill();
      ctx.fillStyle = rgba(brownedc(base, it.brownUp + 0.4), 0.14);
      for (let i = 0; i < 10; i++) {
        D.blob(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 2 + it.id) - 0.5) * R, R * 0.2, i, 0.5, 8);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(lighten(top, 0.35), 0.45);
      ctx.lineWidth = R * 0.1;
      D.blob(ctx, x, y, R * 0.9, it.id, 0.08, 18); ctx.stroke();
      // tiny pores
      ctx.fillStyle = rgba(deepen(top, 0.35), 0.35);
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = hash(i * 6.1 + it.id) * TAU, rr = Math.sqrt(hash(i * 2.3 + it.id)) * R * 0.8;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        ctx.moveTo(px + 0.7 * s, py); ctx.arc(px, py, 0.7 * s, 0, TAU);
      }
      ctx.fill();
    }
    if (it.cls === 'eggs') {
      // omelette: soft folds and curd ripples
      ctx.strokeStyle = rgba(lighten(top, 0.5), 0.45);
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) {
        const a = hash(i * 3.7 + it.id) * TAU, rr = R * (0.25 + hash(i) * 0.3);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr * 0.5, y + Math.sin(a) * rr * 0.5, rr, a, a + 1.4); ctx.stroke();
      }
      if (it.brownUp > 0.25) {
        ctx.fillStyle = rgba(brownedc(base, it.brownUp + 0.35), 0.35);
        for (let i = 0; i < 7; i++) {
          D.blob(ctx, x + (hash(i * 1.3 + it.id) - 0.5) * R * 1.1, y + (hash(i * 2.9 + it.id) - 0.5) * R * 1.1, R * 0.16, i + 3, 0.5, 7);
          ctx.fill();
        }
      }
      ctx.strokeStyle = rgba('#d9a43a', 0.5);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(x, y, R * 0.6, 0.5, 2.6); ctx.stroke();
    }
    // a soft sheen
    ctx.strokeStyle = 'rgba(255,253,240,0.35)'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x, y, R * 0.75, 3.5, 4.5); ctx.stroke();
    specks(ctx, it, x, y, R, s);
    return R;
  }

  function drawSolid(ctx, it, x, y, s) {
    const d = CK.ING[it.ing];
    const tb = topBrown(it);
    const m = it.mass;
    const form = it.form;
    const ck = it.cook;
    let R = 14 * s;
    const rot = it.rot;
    switch (it.ing) {
      case 'egg': {
        if (form === 'whole' || form === 'peeled') {
          const peeled = form === 'peeled';
          shadow(ctx, x + 2.5 * s, y + 4 * s, 13 * s, 16.5 * s, 0.17, rot);
          const col = peeled ? '#fbf8f0' : brownedc('#efd9bd', tb);
          const g = ctx.createRadialGradient(x - 4 * s, y - 6 * s, 1, x, y, 18.5 * s);
          g.addColorStop(0, mix(col, '#ffffff', 0.55));
          g.addColorStop(0.55, col);
          g.addColorStop(1, peeled ? mixc(col, '#c9cdd3', 0.35) : deepen(col, 0.16));
          ctx.fillStyle = g;
          D.ellipse(ctx, x, y, 13 * s, 17 * s, rot);
          ctx.fill();
          if (!peeled) {
            // faint shell freckles
            ctx.fillStyle = 'rgba(160,110,70,0.22)';
            ctx.beginPath();
            for (let i = 0; i < 9; i++) {
              const a = hash(i * 3.1 + it.id) * TAU, rr = Math.sqrt(hash(i * 1.7 + it.id)) * 10 * s;
              const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 1.25, r = (0.5 + hash(i * 9.1) * 0.6) * s;
              ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
            }
            ctx.fill();
          }
          shine(ctx, x - 4 * s, y - 7 * s, 3.2 * s, 5.2 * s, rot, peeled ? 0.75 : 0.5);
          if (form === 'whole' && it.method === 'boiled') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            D.ellipse(ctx, x - 3 * s, y - 6 * s, 4 * s, 6 * s, rot); ctx.fill();
            shine(ctx, x + 5 * s, y + 7 * s, 1.5 * s, 2.5 * s, rot, 0.4);
          }
          R = 17 * s;
        } else if (form === 'cracked') {
          const r = 26 * Math.sqrt(m / 50) * s;
          const flipped = it.flips % 2 === 1;
          const setA = clamp(0.35 + ck * 0.9, 0.35, 1);
          const raw = ck < 0.3 && !flipped;
          // lacy browned edge from the bottom
          if (it.brownDown > 0.15 && !flipped) {
            ctx.fillStyle = brownedc('#f6eedd', it.brownDown * 1.1 + 0.5);
            D.blob(ctx, x, y, r + 4.5 * s, it.id + 3, 0.42, 26);
            ctx.fill();
            ctx.fillStyle = brownedc('#f6eedd', it.brownDown * 1.1);
            D.blob(ctx, x, y, r + 3 * s, it.id, 0.28, 18);
            ctx.fill();
          }
          if (flipped) {
            ctx.fillStyle = dome(ctx, x, y, r, brownedc('#fffdf6', it.brownUp), 0.2, 0.08);
          } else if (raw) {
            ctx.fillStyle = rgba('#f4f0e2', 0.55);
          } else {
            const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
            g.addColorStop(0, rgba('#ffffff', setA));
            g.addColorStop(0.7, rgba('#fffdf6', setA));
            g.addColorStop(1, rgba('#f1e8d6', setA));
            ctx.fillStyle = g;
          }
          D.blob(ctx, x, y, r, it.id, 0.22, 18);
          ctx.fill();
          if (flipped) { ctx.strokeStyle = rgba(deepen(brownedc('#fffdf6', it.brownUp), 0.3), 0.5); ctx.lineWidth = 1 * s; ctx.stroke(); }
          if (raw) {
            // clear, glossy raw white: a thicker inner albumen and a wet rim highlight
            ctx.fillStyle = 'rgba(250,246,232,0.35)';
            D.blob(ctx, x, y, r * 0.66, it.id + 1, 0.2, 12); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4 * s;
            ctx.beginPath(); ctx.arc(x, y, r * 0.8, 3.4, 4.4); ctx.stroke();
          } else if (!flipped && it.method === 'fried' && ck > 0.5) {
            // little blisters on a fried white
            ctx.strokeStyle = 'rgba(225,210,185,0.55)'; ctx.lineWidth = 0.8 * s;
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
              const a = hash(i * 7.7 + it.id) * TAU, rr = r * (0.6 + hash(i * 2.2) * 0.3), br = (1.2 + hash(i * 4.4) * 1.5) * s;
              const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
              ctx.moveTo(px + br, py); ctx.arc(px, py, br, 0, TAU);
            }
            ctx.stroke();
          }
          // yolk
          const yx = x + (hash(it.id) - 0.5) * r * 0.4, yy = y + (hash(it.id * 2) - 0.5) * r * 0.4;
          const yr = 10 * Math.sqrt(m / 50) * s;
          let yc = ck < 1.3 ? '#f7a90d' : mix('#f7a90d', '#f3cf61', clamp((ck - 1.3) / 0.8, 0, 1));
          if (flipped) yc = mix(yc, '#fffdf2', 0.55);
          if (it.method === 'poached') yc = mix(yc, '#fffdf2', 0.5);
          const runny = ck < 1.3 && !flipped;
          shadow(ctx, yx + 0.8 * s, yy + 1.6 * s, yr * 1.05, yr * 1.0, runny ? 0.16 : 0.1);
          if (runny) {
            const g = ctx.createRadialGradient(yx - yr * 0.35, yy - yr * 0.4, yr * 0.1, yx, yy, yr);
            g.addColorStop(0, '#ffc844'); g.addColorStop(0.6, yc); g.addColorStop(1, '#e48a06');
            ctx.fillStyle = g;
          } else ctx.fillStyle = yc;
          D.circle(ctx, yx, yy, yr);
          ctx.fill();
          if (runny) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            D.circle(ctx, yx - yr * 0.35, yy - yr * 0.35, yr * 0.3);
            ctx.fill();
            shine(ctx, yx + yr * 0.35, yy + yr * 0.4, yr * 0.14, yr * 0.09, 0, 0.45);
          } else if (!flipped) {
            // set yolk: matte, a little crumbly
            ctx.fillStyle = rgba(lighten(yc, 0.4), 0.5);
            D.circle(ctx, yx - yr * 0.25, yy - yr * 0.25, yr * 0.45); ctx.fill();
            ctx.fillStyle = rgba(deepen(yc, 0.15), 0.4);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) { const a = hash(i * 3 + it.id) * TAU, px = yx + Math.cos(a) * yr * 0.55, py = yy + Math.sin(a) * yr * 0.55; ctx.moveTo(px + 0.7 * s, py); ctx.arc(px, py, 0.7 * s, 0, TAU); }
            ctx.fill();
          } else {
            // over easy: a thin veil of white over the yolk
            ctx.fillStyle = 'rgba(255,253,244,0.35)';
            D.ellipse(ctx, yx - yr * 0.1, yy - yr * 0.1, yr * 0.85, yr * 0.75, 0.3); ctx.fill();
          }
          specks(ctx, it, x, y, r, s);
          R = r;
        } else if (form === 'halved') {
          for (const sgn of [-1, 1]) {
            const px = x + sgn * 9 * s;
            shadow(ctx, px + 1.5 * s, y + 2.5 * s, 9 * s, 14 * s, 0.15);
            ctx.fillStyle = dome(ctx, px, y, 14 * s, '#fbf8f0', 0.6, 0.1);
            D.ellipse(ctx, px, y, 9 * s, 14 * s, 0); ctx.fill();
            const jammy = ck < 1.2;
            const yc = jammy ? '#f6a81a' : '#f2cf5c';
            ctx.fillStyle = jammy ? '#f6a81a' : '#eec653';
            D.circle(ctx, px, y, 5.6 * s); ctx.fill();
            ctx.fillStyle = yc; D.circle(ctx, px, y, 5 * s); ctx.fill();
            if (jammy) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; D.circle(ctx, px - 1.6 * s, y - 1.6 * s, 1.4 * s); ctx.fill(); }
            else { ctx.fillStyle = 'rgba(255,240,190,0.6)'; D.circle(ctx, px - 1.2 * s, y - 1.2 * s, 2.2 * s); ctx.fill(); }
          }
          R = 18 * s;
        } else {
          R = 14 * s + Math.sqrt(m) * s;
          pile(ctx, it, x, y, s, {
            n: 24, R, piece(px, py, r, sh, i) {
              chunk(ctx, px, py, 5 * s, 5 * s, r, i % 3 === 0 ? '#f3cd52' : shadeHex('#fbf8f0', Math.min(1, sh)), s);
            },
          });
        }
        break;
      }
      case 'onion': {
        const flesh = brownedc(mix('#f5eedf', '#ead9a5', clamp(ck / 1.5, 0, 1)), tb);
        if (form === 'whole') {
          shadow(ctx, x + 2.5 * s, y + 4 * s, 24 * s, 23 * s, 0.17);
          const g = ctx.createRadialGradient(x - 7 * s, y - 8 * s, 2, x, y, 25 * s);
          g.addColorStop(0, '#f2cd92'); g.addColorStop(0.5, '#dca465'); g.addColorStop(1, brownedc('#a8682f', tb * 0.6));
          ctx.fillStyle = g; D.circle(ctx, x, y, 24 * s); ctx.fill();
          // papery skin lines running from the top to the edge
          ctx.strokeStyle = 'rgba(120,70,30,0.28)'; ctx.lineWidth = 1 * s;
          for (let i = 0; i < 11; i++) {
            const a = (i / 11) * TAU + hash(i + it.id) * 0.3, bend = 0.35;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 3 * s, y + Math.sin(a) * 3 * s);
            ctx.quadraticCurveTo(x + Math.cos(a + bend) * 14 * s, y + Math.sin(a + bend) * 14 * s, x + Math.cos(a + 0.15) * 23.5 * s, y + Math.sin(a + 0.15) * 23.5 * s);
            ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 2.5 * s;
          ctx.beginPath(); ctx.arc(x, y, 19 * s, 3.5, 4.5); ctx.stroke();
          // dry tip
          ctx.fillStyle = '#7a4a22'; D.circle(ctx, x, y, 3 * s); ctx.fill();
          ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.2 * s;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 * s, y - 5 * s); ctx.moveTo(x, y); ctx.lineTo(x - 2 * s, y - 5.5 * s); ctx.stroke();
          ctx.fillStyle = '#c99a62'; D.circle(ctx, x - 0.8 * s, y - 0.8 * s, 1.1 * s); ctx.fill();
          R = 24 * s;
        } else if (form === 'halved') {
          shadow(ctx, x + 2 * s, y + 3.5 * s, 23 * s, 22 * s, 0.17);
          ctx.fillStyle = '#c98a48'; D.circle(ctx, x, y, 23 * s); ctx.fill();
          ctx.fillStyle = '#e2b47a'; D.circle(ctx, x, y, 21.8 * s); ctx.fill();
          ctx.fillStyle = dome(ctx, x, y, 21 * s, flesh, 0.25, 0.08); D.circle(ctx, x, y, 21 * s); ctx.fill();
          ctx.strokeStyle = rgba(shadeHex(flesh, 0.82), 0.8); ctx.lineWidth = 1.2 * s;
          for (let r = 4; r < 21; r += 4) { D.circle(ctx, x + (21 - r) * 0.04 * s, y + (21 - r) * 0.06 * s, r * s); ctx.stroke(); }
          ctx.strokeStyle = 'rgba(255,255,248,0.45)'; ctx.lineWidth = 0.8 * s;
          for (let r = 6; r < 21; r += 4) { ctx.beginPath(); ctx.arc(x, y, r * s, 3.4, 4.6); ctx.stroke(); }
          ctx.fillStyle = rgba('#d8e2b0', 0.7); D.circle(ctx, x + 0.4 * s, y + 0.6 * s, 2.2 * s); ctx.fill();
          R = 23 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.2, 10, 50) * s;
          const sz = form === 'sliced' ? 7 : form === 'chopped' ? 4.5 : form === 'diced' ? 3.5 : 2;
          const edge = deepen(flesh, 0.22), hl = lighten(flesh, 0.5);
          if (sz <= 2) {
            // minced: a moist little heap under the bits
            shadow(ctx, x + 1 * s, y + 2 * s, R * 0.85, R * 0.75, 0.1);
            ctx.fillStyle = rgba(shadeHex(flesh, 0.94), 0.95); D.blob(ctx, x, y, R * 0.8, it.id, 0.3, 10); ctx.fill();
          }
          pile(ctx, it, x, y, s, {
            n: m / (sz * 0.8), R, max: 70, piece(px, py, r, sh) {
              const col = shadeHex(flesh, sh);
              if (form === 'sliced') {
                // half-rings: a shadowed edge, the flesh, a glossy inner line
                ctx.strokeStyle = edge; ctx.lineWidth = 2.8 * s;
                ctx.beginPath(); ctx.arc(px + 0.4 * s, py + 0.9 * s, 7 * s, r, r + 2.2); ctx.stroke();
                ctx.strokeStyle = col; ctx.lineWidth = 2.2 * s;
                ctx.beginPath(); ctx.arc(px, py, 7 * s, r, r + 2.2); ctx.stroke();
                ctx.strokeStyle = hl; ctx.lineWidth = 0.6 * s;
                ctx.beginPath(); ctx.arc(px, py, 6.4 * s, r + 0.3, r + 1.6); ctx.stroke();
              } else if (sz > 2) {
                chunk(ctx, px, py, sz * s, sz * 0.85 * s, r, col, s, 0.3, 0.18);
              } else {
                ctx.fillStyle = edge; ctx.fillRect(px - s + 0.3 * s, py - s + 0.6 * s, 2 * s, 2 * s);
                ctx.fillStyle = col; ctx.fillRect(px - s, py - s, 2 * s, 2 * s);
              }
            },
          });
        }
        break;
      }
      case 'garlic': {
        const flesh = brownedc(mix('#f7f1df', '#efe0b0', clamp(ck, 0, 1)), tb);
        if (form === 'clove') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          const path = () => { ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.quadraticCurveTo(8 * s, 0, 0, 9 * s); ctx.quadraticCurveTo(-5 * s, 0, 0, -10 * s); ctx.closePath(); };
          ctx.save(); ctx.translate(1.2 * s, 2 * s); path(); ctx.fillStyle = 'rgba(74,40,18,0.16)'; ctx.fill(); ctx.restore();
          const g = ctx.createLinearGradient(-5 * s, 0, 7 * s, 0);
          g.addColorStop(0, '#f8f1de'); g.addColorStop(0.6, '#efe3c6'); g.addColorStop(1, '#d9c7a2');
          path(); ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = 'rgba(150,120,80,0.4)'; ctx.lineWidth = 0.8 * s; ctx.stroke();
          // papery stripes, a blush of purple, the root end
          ctx.strokeStyle = 'rgba(170,140,100,0.3)'; ctx.lineWidth = 0.6 * s;
          ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.quadraticCurveTo(4 * s, 0, 0.5 * s, 8 * s); ctx.moveTo(0, -8 * s); ctx.quadraticCurveTo(-2 * s, 0, -0.5 * s, 7 * s); ctx.stroke();
          ctx.fillStyle = 'rgba(190,120,150,0.18)'; D.ellipse(ctx, 2 * s, 3 * s, 2 * s, 4 * s, 0.2); ctx.fill();
          ctx.fillStyle = '#c4a77a'; D.ellipse(ctx, 0, 8.4 * s, 2.4 * s, 1 * s, 0); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,250,0.6)'; D.ellipse(ctx, -1.5 * s, -2 * s, 0.9 * s, 3.5 * s, 0.15); ctx.fill();
          ctx.restore();
          R = 10 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 3, 6, 34) * s;
          const sz = form === 'sliced' ? 4 : form === 'chopped' ? 2.4 : 1.6;
          const edge = deepen(flesh, 0.2);
          pile(ctx, it, x, y, s, {
            n: m * (form === 'sliced' ? 1.6 : 4), R, max: 60, piece(px, py, r, sh) {
              const col = shadeHex(flesh, sh);
              if (form === 'sliced') {
                ctx.fillStyle = edge; D.ellipse(ctx, px + 0.3 * s, py + 0.7 * s, sz * s, sz * 0.7 * s, r); ctx.fill();
                ctx.fillStyle = col; D.ellipse(ctx, px, py, sz * s, sz * 0.7 * s, r); ctx.fill();
                ctx.strokeStyle = rgba(deepen(col, 0.15), 0.6); ctx.lineWidth = 0.6 * s;
                ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * sz * 0.5 * s, py - Math.sin(r) * sz * 0.5 * s); ctx.lineTo(px + Math.cos(r) * sz * 0.5 * s, py + Math.sin(r) * sz * 0.5 * s); ctx.stroke();
              } else {
                ctx.fillStyle = edge; ctx.fillRect(px - sz * s / 2 + 0.3 * s, py - sz * s / 2 + 0.6 * s, sz * s, sz * s);
                ctx.fillStyle = col; ctx.fillRect(px - sz * s / 2, py - sz * s / 2, sz * s, sz * s);
              }
            },
          });
        }
        break;
      }
      case 'potato': {
        const flesh = mix('#f3e6b8', '#f0d58a', clamp(ck / 1.2, 0, 1));
        if (form === 'whole') {
          shadow(ctx, x + 2.5 * s, y + 4.5 * s, 26 * s, 24 * s, 0.17);
          const skin = brownedc('#c8975a', tb * 0.6);
          ctx.fillStyle = dome(ctx, x, y, 26 * s, skin, 0.3, 0.2);
          D.blob(ctx, x, y, 26 * s, it.id, 0.15, 12); ctx.fill();
          // skin speckles
          ctx.fillStyle = 'rgba(110,70,35,0.3)';
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = hash(i * 2.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 4.1 + it.id)) * 20 * s, r = (0.5 + hash(i * 1.9) * 0.7) * s;
            const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
            ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
          }
          ctx.fill();
          // eyes
          for (let i = 0; i < 4; i++) {
            const px = x + (hash(i + it.id) - 0.5) * 30 * s, py = y + (hash(i * 3 + it.id) - 0.5) * 24 * s;
            ctx.fillStyle = '#8f6537'; D.ellipse(ctx, px, py, 1.8 * s, 1.1 * s, i); ctx.fill();
            ctx.strokeStyle = 'rgba(240,210,160,0.5)'; ctx.lineWidth = 0.7 * s;
            ctx.beginPath(); ctx.arc(px, py + 0.4 * s, 2.4 * s, 0.3, 2.8); ctx.stroke();
          }
          shine(ctx, x - 9 * s, y - 10 * s, 6 * s, 3.5 * s, -0.6, 0.22);
          R = 26 * s;
        } else if (form === 'halved' || form === 'wedges') {
          const n = form === 'halved' ? 2 : 6;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.28 + rot;
            const px = x + Math.cos(a) * (n === 2 ? 10 : 13) * s, py = y + Math.sin(a) * (n === 2 ? 10 : 13) * s;
            const rx = (n === 2 ? 20 : 12) * s, ry = (n === 2 ? 12 : 6) * s, ang = a + Math.PI / 2;
            const fc = brownedc(flesh, n === 2 ? it.brownUp : tb);
            shadow(ctx, px + 1.5 * s, py + 2.5 * s, rx, ry, 0.14, ang);
            // skin shows along the outer side
            ctx.fillStyle = brownedc('#b8874c', tb * 0.5);
            D.ellipse(ctx, px, py, rx, ry, ang); ctx.fill();
            const ix = px - Math.cos(a) * ry * 0.22, iy = py - Math.sin(a) * ry * 0.22;
            ctx.fillStyle = fc; D.ellipse(ctx, ix, iy, rx * 0.95, ry * 0.8, ang); ctx.fill();
            ctx.fillStyle = 'rgba(255,252,235,0.35)'; D.ellipse(ctx, ix - Math.cos(a) * ry * 0.2 - 1 * s, iy - Math.sin(a) * ry * 0.2 - 1 * s, rx * 0.6, ry * 0.3, ang); ctx.fill();
            if (n === 2) {
              // starchy texture on the cut face
              ctx.fillStyle = rgba(deepen(fc, 0.15), 0.3);
              ctx.beginPath();
              for (let j = 0; j < 6; j++) { const qx = ix + (hash(j * 3 + i + it.id) - 0.5) * rx, qy = iy + (hash(j * 5 + i + it.id) - 0.5) * ry; ctx.moveTo(qx + 0.6 * s, qy); ctx.arc(qx, qy, 0.6 * s, 0, TAU); }
              ctx.fill();
            }
          }
          R = 28 * s;
        } else if (form === 'mashed') {
          // a creamy mound with spoon swirls
          R = clamp(12 + Math.sqrt(m) * 2.4, 12, 58) * s;
          const butter = clamp(((it.comp.butter || 0) + (it.comp.milk || 0)) / m * 4, 0, 1);
          const cream = brownedc(mix('#efe3bd', '#f6e7a6', butter), (it.brownDown + it.brownUp) / 2);
          ctx.fillStyle = shadeHex(cream, 0.86); D.blob(ctx, x + 2 * s, y + 3 * s, R, it.id, 0.18, 14); ctx.fill();
          ctx.fillStyle = dome(ctx, x, y, R, cream, 0.3, 0.12); D.blob(ctx, x, y, R, it.id, 0.18, 14); ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const cx = x + (i - 1) * R * 0.25, cy = y + (hash(i + it.id) - 0.5) * R * 0.4, rr = R * (0.55 - i * 0.12);
            ctx.strokeStyle = rgba(shadeHex(cream, 0.8), 0.7); ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.arc(cx, cy, rr, 0.3 + i, 2.2 + i); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,253,240,0.6)'; ctx.lineWidth = 1.2 * s;
            ctx.beginPath(); ctx.arc(cx, cy, rr - 2 * s, 0.4 + i, 2.0 + i); ctx.stroke();
          }
          // a soft peak
          ctx.fillStyle = 'rgba(255,253,240,0.5)'; D.ellipse(ctx, x - R * 0.2, y - R * 0.3, R * 0.16, R * 0.09, -0.6); ctx.fill();
          if (butter > 0.3) {
            const bx = x - R * 0.1, by = y - R * 0.15;
            ctx.fillStyle = 'rgba(250,215,90,0.75)'; D.blob(ctx, bx, by, R * 0.18, it.id + 3, 0.3, 8); ctx.fill();
            ctx.fillStyle = 'rgba(255,248,210,0.8)'; D.ellipse(ctx, bx - R * 0.05, by - R * 0.06, R * 0.06, R * 0.035, -0.5); ctx.fill();
          }
          specks(ctx, it, x, y, R * 0.85, s);
        } else if (form === 'grated') {
          R = clamp(10 + Math.sqrt(m) * 2.1, 10, 52) * s;
          shredMound(ctx, it, x, y, R, s, brownedc(mix(ck < 0.3 ? '#efe2b8' : flesh, '#e6dcc0', 0.2), tb));
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.3, 10, 50) * s;
          const sz = form === 'diced' ? 7 : form === 'small dice' ? 4.5 : 3;
          const soft = clamp((ck - 0.9) * 0.3, 0, 0.2);
          pile(ctx, it, x, y, s, {
            n: m / (sz * 0.55), R, max: 70, piece(px, py, r, sh, i) {
              // each cube shows a mix of browned faces
              const b = (i % 2 ? it.brownDown : it.brownUp) * (0.7 + sh * 0.3);
              chunk(ctx, px, py, sz * s, sz * s, r, brownedc(shadeHex(flesh, sh), b), s, 0.22 + soft);
            },
          });
        }
        break;
      }
      case 'tomato': {
        const red = mix('#d8392c', '#b8301f', clamp(ck, 0, 1));
        if (form === 'whole') {
          shadow(ctx, x + 2.5 * s, y + 4 * s, 21 * s, 20 * s, 0.17);
          const g = ctx.createRadialGradient(x - 7 * s, y - 7 * s, 2, x, y, 22 * s);
          g.addColorStop(0, '#f77d6c'); g.addColorStop(0.45, brownedc(red, tb * 0.3)); g.addColorStop(1, deepen(brownedc(red, tb * 0.5), 0.25));
          ctx.fillStyle = g; D.circle(ctx, x, y, 21 * s); ctx.fill();
          // soft lobes
          ctx.strokeStyle = 'rgba(120,20,10,0.15)'; ctx.lineWidth = 1.2 * s;
          for (let i = 0; i < 5; i++) { const a = i * 1.256 + 0.6; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); ctx.quadraticCurveTo(x + Math.cos(a + 0.2) * 14 * s, y + Math.sin(a + 0.2) * 14 * s, x + Math.cos(a + 0.1) * 19 * s, y + Math.sin(a + 0.1) * 19 * s); ctx.stroke(); }
          if (ck > 0.8) {
            // blistered, wrinkly skin when cooked
            ctx.strokeStyle = 'rgba(255,190,170,0.35)'; ctx.lineWidth = 0.9 * s;
            for (let i = 0; i < 5; i++) { const a = hash(i * 3.3 + it.id) * TAU, rr = (8 + hash(i) * 9) * s; ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 3 * s, a, a + 2); ctx.stroke(); }
          }
          shine(ctx, x - 9 * s, y - 9 * s, 4.5 * s, 2.6 * s, -0.7, 0.55);
          shine(ctx, x - 4 * s, y - 13 * s, 1.4 * s, 1 * s, 0, 0.7);
          // calyx
          for (let i = 0; i < 5; i++) {
            const a = i * 1.256 + rot * 0.2;
            leafPath(ctx, x, y, 8 * s, 3.2 * s, a);
            ctx.fillStyle = i % 2 ? '#3f8a35' : '#4a9a3c'; ctx.fill();
          }
          ctx.fillStyle = '#5f9a3e'; D.circle(ctx, x, y, 2.2 * s); ctx.fill();
          ctx.fillStyle = '#87b85a'; D.circle(ctx, x - 0.6 * s, y - 0.6 * s, 0.9 * s); ctx.fill();
          R = 21 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.4, 10, 46) * s;
          const sz = form === 'halved' ? 0 : form === 'sliced' ? 9 : 4.5;
          const gel = '#f08a68', seed = '#f5d68a';
          if (form === 'halved') {
            for (const sg of [-1, 1]) {
              const px = x + sg * 11 * s;
              shadow(ctx, px + 1.5 * s, y + 3 * s, 19 * s, 18 * s, 0.15);
              ctx.fillStyle = red; D.circle(ctx, px, y, 19 * s); ctx.fill();
              const face = brownedc('#e86c50', tb);
              ctx.fillStyle = dome(ctx, px, y, 16 * s, face, 0.2, 0.1); D.circle(ctx, px, y, 16.5 * s); ctx.fill();
              // seed chambers
              for (let i = 0; i < 3; i++) {
                const a = i * 2.09 + sg;
                ctx.fillStyle = rgba(gel, 0.85); D.ellipse(ctx, px + Math.cos(a) * 7.5 * s, y + Math.sin(a) * 7.5 * s, 5.2 * s, 3.6 * s, a + Math.PI / 2); ctx.fill();
                ctx.fillStyle = seed;
                for (let j = -1; j <= 1; j++) { D.ellipse(ctx, px + Math.cos(a) * 7.5 * s + Math.cos(a + 1.57) * j * 2.6 * s, y + Math.sin(a) * 7.5 * s + Math.sin(a + 1.57) * j * 2.6 * s, 1.1 * s, 0.7 * s, a); ctx.fill(); }
              }
              ctx.fillStyle = rgba('#f7a98c', 0.8); D.circle(ctx, px, y, 3 * s); ctx.fill();
              ctx.strokeStyle = 'rgba(255,240,230,0.4)'; ctx.lineWidth = 1.4 * s;
              ctx.beginPath(); ctx.arc(px, y, 14 * s, 3.5, 4.6); ctx.stroke();
            }
            R = 30 * s;
          } else {
            const stewed = ck > 1;
            pile(ctx, it, x, y, s, {
              n: m / (sz * 0.9), R, max: 50, piece(px, py, r, sh, i) {
                const col = brownedc(shadeHex(red, sh), tb);
                if (form === 'sliced') {
                  ctx.fillStyle = deepen(col, 0.3); D.circle(ctx, px + 0.5 * s, py + 1.2 * s, sz * s); ctx.fill();
                  ctx.fillStyle = col; D.circle(ctx, px, py, sz * s); ctx.fill();
                  ctx.fillStyle = brownedc(shadeHex('#e0503a', sh), tb); D.circle(ctx, px, py, sz * 0.84 * s); ctx.fill();
                  ctx.fillStyle = rgba(brownedc('#f2856a', tb), 0.95);
                  for (let j = 0; j < 3; j++) { const a = r + j * 2.09; D.ellipse(ctx, px + Math.cos(a) * sz * 0.45 * s, py + Math.sin(a) * sz * 0.45 * s, sz * 0.26 * s, sz * 0.17 * s, a + 1.57); ctx.fill(); }
                  ctx.fillStyle = 'rgba(245,214,138,0.9)';
                  for (let j = 0; j < 3; j++) { const a = r + j * 2.09; ctx.fillRect(px + Math.cos(a) * sz * 0.45 * s - 0.5 * s, py + Math.sin(a) * sz * 0.45 * s - 0.4 * s, 1 * s, 0.8 * s); }
                  ctx.fillStyle = 'rgba(248,170,140,0.8)'; D.circle(ctx, px, py, sz * 0.18 * s); ctx.fill();
                  ctx.strokeStyle = 'rgba(255,240,230,0.45)'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.arc(px, py, sz * 0.72 * s, 3.5, 4.6); ctx.stroke();
                } else {
                  chunk(ctx, px, py, sz * s, sz * s, r, col, s, stewed ? 0.45 : 0.2);
                  if (i % 3 === 0) { ctx.fillStyle = seed; D.ellipse(ctx, px + 0.5 * s, py, 0.9 * s, 0.6 * s, r); ctx.fill(); }
                }
              },
            });
          }
        }
        break;
      }
      case 'parsley': {
        const green = brownedc(mix('#3f8f3a', '#5c7a32', clamp(ck, 0, 1)), tb);
        if (form === 'bunch') {
          ctx.strokeStyle = '#6aa04e'; ctx.lineWidth = 1.5 * s;
          for (let i = 0; i < 5; i++) {
            const a = rot + (i - 2) * 0.25;
            ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 18 * s, y - Math.sin(a) * 18 * s); ctx.lineTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); ctx.stroke();
          }
          for (let i = 0; i < 5; i++) {
            const a = rot + (i - 2) * 0.25;
            const cx = x + Math.cos(a) * 12 * s, cy = y + Math.sin(a) * 12 * s;
            const col = shadeHex(green, 0.9 + i * 0.05);
            shadow(ctx, cx + 1 * s, cy + 2 * s, 7 * s, 6 * s, 0.14);
            // frilly cluster of little lobes
            for (let j = 0; j < 4; j++) {
              const b = j * 1.57 + i;
              ctx.fillStyle = j % 2 ? col : shadeHex(col, 1.08);
              D.blob(ctx, cx + Math.cos(b) * 3 * s, cy + Math.sin(b) * 3 * s, 4.2 * s, i * 4 + j + it.id, 0.55, 8); ctx.fill();
            }
            ctx.fillStyle = 'rgba(230,255,200,0.25)'; D.circle(ctx, cx - 2 * s, cy - 2 * s, 2 * s); ctx.fill();
          }
          R = 20 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 4, 6, 30) * s;
          const sz = form === 'chopped' ? 2.6 : 1.6;
          const dk = deepen(green, 0.25);
          pile(ctx, it, x, y, s, {
            n: m * 6, R, max: 70, piece(px, py, r, sh, i) {
              ctx.fillStyle = i % 4 === 0 ? dk : shadeHex(green, sh);
              chamf(ctx, px, py, sz * s * (1 + (i % 3) * 0.2), sz * s, r, 0.5 * s); ctx.fill();
            },
          });
        }
        break;
      }
      case 'bread':
      case 'ryebread': {
        const rye = it.ing === 'ryebread';
        const soaked = it.hyd > 8 ? clamp(((it.comp.egg || 0) + (it.comp.milk || 0)) / m * 2, 0, 0.6) : 0;
        const crumb = brownedc(mix(rye ? '#8a6248' : '#f5e3b8', '#f2cf6a', soaked), it.brownUp * (rye ? 0.7 : 1));
        const crust = brownedc(rye ? '#4e2e1b' : '#c98b4c', it.brownUp * 0.7 + 0.2);
        if (form === 'cubes') {
          R = clamp(10 + Math.sqrt(m) * 2.5, 10, 40) * s;
          const cc = brownedc(rye ? '#8a6248' : '#f2dfb0', (it.brownUp + it.brownDown) / 2);
          pile(ctx, it, x, y, s, {
            n: m / 2.5, R, max: 30, piece(px, py, r, sh, i) {
              chunk(ctx, px, py, 8 * s, 8 * s, r * 0.3, shadeHex(cc, sh), s, 0.2, 0.3);
              if (i % 2) { ctx.strokeStyle = rgba(crust, 0.8); ctx.lineWidth = 1.4 * s; ctx.beginPath(); ctx.moveTo(px - 4 * s, py - 4 * s); ctx.lineTo(px + 4 * s, py - 4 * s); ctx.stroke(); }
            },
          });
          break;
        }
        const w = (form === 'halved' ? 15 : 30) * s, h = 30 * s;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.15);
        const slice = (ox, oy, ww, hh, rr) => {
          // a loaf-shaped slice: straight sides, a domed top
          ctx.beginPath();
          ctx.moveTo(ox, oy + hh * 0.3);
          ctx.lineTo(ox, oy + hh - rr);
          ctx.quadraticCurveTo(ox, oy + hh, ox + rr, oy + hh);
          ctx.lineTo(ox + ww - rr, oy + hh);
          ctx.quadraticCurveTo(ox + ww, oy + hh, ox + ww, oy + hh - rr);
          ctx.lineTo(ox + ww, oy + hh * 0.3);
          ctx.bezierCurveTo(ox + ww + 1.5 * s, oy - hh * 0.08, ox + ww * 0.55, oy - hh * 0.12, ox + ww / 2, oy + hh * 0.04);
          ctx.bezierCurveTo(ox + ww * 0.45, oy - hh * 0.12, ox - 1.5 * s, oy - hh * 0.08, ox, oy + hh * 0.3);
          ctx.closePath();
        };
        slice(-w / 2 + 2 * s, -h / 2 + 3.5 * s, w, h, 6 * s); ctx.fillStyle = 'rgba(74,40,18,0.17)'; ctx.fill();
        const cg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        cg.addColorStop(0, lighten(crust, 0.15)); cg.addColorStop(1, deepen(crust, 0.2));
        slice(-w / 2, -h / 2, w, h, 6 * s); ctx.fillStyle = cg; ctx.fill();
        const g = ctx.createRadialGradient(-w * 0.15, -h * 0.1, 1, 0, 0, Math.max(w, h) * 0.62);
        g.addColorStop(0, lighten(crumb, 0.2)); g.addColorStop(0.65, crumb); g.addColorStop(1, brownedc(crumb, Math.min(it.brownUp, 2) * 0.5 + 0.12));
        slice(-w / 2 + 2.8 * s, -h / 2 + 3.2 * s, w - 5.6 * s, h - 6 * s, 4.5 * s); ctx.fillStyle = g; ctx.fill();
        // airy crumb
        ctx.fillStyle = rgba(deepen(crumb, 0.25), 0.3);
        ctx.beginPath();
        const np = form === 'halved' ? 7 : 14;
        for (let i = 0; i < np; i++) {
          const px = (hash(i * 3.1 + it.id) - 0.5) * (w - 10 * s), py = (hash(i * 5.3 + it.id) - 0.4) * (h - 12 * s);
          const r = (0.5 + hash(i * 1.7) * 0.8) * s;
          ctx.moveTo(px + r * 1.4, py); ctx.ellipse(px, py, r * 1.4, r, hash(i) * 3, 0, TAU);
        }
        ctx.fill();
        if (rye) {
          // caraway / coriander seeds in dark rye
          ctx.fillStyle = 'rgba(200,170,120,0.7)';
          for (let i = 0; i < 9; i++) { D.ellipse(ctx, (hash(i * 4.3 + it.id) - 0.5) * (w - 10 * s), (hash(i * 6.1 + it.id) - 0.4) * (h - 12 * s), 1.2 * s, 0.6 * s, hash(i) * 3); ctx.fill(); }
        }
        if (soaked > 0.05) {
          // custardy French-toast patches
          ctx.fillStyle = rgba(brownedc('#f2c443', it.brownUp), 0.35 * soaked / 0.6);
          for (let i = 0; i < 4; i++) { D.blob(ctx, (hash(i * 7 + it.id) - 0.5) * w * 0.5, (hash(i * 9 + it.id) - 0.5) * h * 0.5, 4.5 * s, i + it.id, 0.4, 8); ctx.fill(); }
        }
        ctx.strokeStyle = 'rgba(255,250,235,0.35)'; ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 4 * s, h * 0.3); ctx.lineTo(-w / 2 + 4 * s, -h * 0.15); ctx.stroke();
        ctx.restore();
        specks(ctx, it, x, y, 12 * s, s);
        R = 22 * s;
        break;
      }
      case 'chicken': {
        const base = mix('#f2b5ab', '#f0e2cc', clamp((ck - 0.2) / 0.9, 0, 1));
        const rawish = clamp(1 - (ck - 0.2) / 0.9, 0, 1);
        if (form === 'whole' || form === 'halved') {
          const n = form === 'whole' ? 1 : 2;
          for (let i = 0; i < n; i++) {
            const px = x + (n === 2 ? (i - 0.5) * 30 * s : 0);
            const hw = (n === 1 ? 44 : 22) * s, hh = 24 * s;
            ctx.save(); ctx.translate(px, y); ctx.rotate(rot * 0.3);
            // a plump, tapered breast shape
            const breast = (ex) => {
              const a = hw + ex, b = hh + ex;
              ctx.beginPath();
              ctx.moveTo(-a, -b * 0.05);
              ctx.bezierCurveTo(-a, -b * 0.95, a * 0.35, -b * 1.05, a * 0.85, -b * 0.45);
              ctx.bezierCurveTo(a * 1.08, -b * 0.15, a * 1.02, b * 0.45, a * 0.7, b * 0.72);
              ctx.bezierCurveTo(a * 0.25, b * 1.08, -a * 0.75, b * 0.95, -a, -b * 0.05);
              ctx.closePath();
            };
            ctx.save(); ctx.translate(2 * s, 4 * s); breast(2 * s); ctx.fillStyle = 'rgba(74,40,18,0.17)'; ctx.fill(); ctx.restore();
            breast(2 * s); ctx.fillStyle = brownedc(base, it.brownDown * 0.9); ctx.fill();
            const top = brownedc(base, it.brownUp);
            const g = ctx.createRadialGradient(-hw * 0.3, -hh * 0.4, 1, 0, 0, hw * 1.05);
            g.addColorStop(0, lighten(top, 0.28)); g.addColorStop(0.6, top); g.addColorStop(1, deepen(top, 0.14));
            breast(0); ctx.fillStyle = g; ctx.fill();
            // fibres
            ctx.strokeStyle = rgba(deepen(top, 0.25), 0.18 + rawish * 0.08); ctx.lineWidth = 0.9 * s;
            for (let j = 0; j < 5; j++) {
              const yy = (-0.5 + j * 0.25) * hh;
              ctx.beginPath(); ctx.moveTo(-hw * 0.7, yy + 3 * s); ctx.quadraticCurveTo(0, yy - 4 * s, hw * 0.65, yy + 2 * s); ctx.stroke();
            }
            if (it.brownUp > 0.35) {
              // a mottled sear
              ctx.fillStyle = rgba(brownedc(base, it.brownUp + 0.4), 0.22);
              for (let j = 0; j < 14; j++) { D.blob(ctx, (hash(j * 2.1 + it.id + i) - 0.5) * hw * 1.3, (hash(j * 3.7 + it.id + i) - 0.5) * hh * 1.1, hw * (0.07 + hash(j * 1.3) * 0.06), j + i, 0.5, 7); ctx.fill(); }
            }
            // raw chicken glistens; cooked is matte
            ctx.strokeStyle = rgba('#ffffff', 0.18 + rawish * 0.25); ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.ellipse(-6 * s, -6 * s, hw * 0.45, 9 * s, -0.2, 3.5, 5.2); ctx.stroke();
            if (rawish > 0.3) shine(ctx, hw * 0.25, -hh * 0.45, 3 * s, 1.4 * s, -0.3, 0.35 * rawish);
            ctx.restore();
          }
          specks(ctx, it, x, y, 30 * s, s);
          R = 44 * s;
        } else {
          R = clamp(12 + Math.sqrt(m) * 2.4, 10, 50) * s;
          const sz = form === 'strips' ? 12 : 6;
          pile(ctx, it, x, y, s, {
            n: m / sz, R, max: 40, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(base, sh), (i % 2 ? it.brownDown : it.brownUp));
              chunk(ctx, px, py, sz * s, 6 * s, r, col, s, 0.4, 0.25);
              if (form === 'strips') { ctx.strokeStyle = rgba(deepen(col, 0.2), 0.3); ctx.lineWidth = 0.7 * s; ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * 4 * s, py - Math.sin(r) * 4 * s); ctx.lineTo(px + Math.cos(r) * 4 * s, py + Math.sin(r) * 4 * s); ctx.stroke(); }
            },
          });
          specks(ctx, it, x, y, R * 0.8, s);
        }
        break;
      }
      case 'bacon': {
        const meat = mix('#e07b74', '#b5552f', clamp(ck, 0, 1));
        const fat = mix('#fbe6dc', '#f2d29a', clamp(ck, 0, 1));
        if (form === 'strip') {
          const shrink = 1 - clamp(ck * 0.12, 0, 0.25);
          const wav = 2.5 + clamp(ck, 0, 1.5) * 1.6;
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          // sampled finer than the wave so curls stay smooth
          const wy = (i) => Math.sin(i * 0.65 + it.id) * wav * s;
          const wx = (i) => (-36 + i * 3.6) * s * shrink;
          const outline = (dx, dy) => {
            ctx.beginPath();
            for (let i = 0; i <= 20; i++) { if (i === 0) ctx.moveTo(wx(i) + dx, wy(i) - 7 * s + dy); else ctx.lineTo(wx(i) + dx, wy(i) - 7 * s + dy); }
            for (let i = 20; i >= 0; i--) ctx.lineTo(wx(i) + dx, wy(i) + 7 * s + dy);
            ctx.closePath();
          };
          outline(1.5 * s, 3 * s); ctx.fillStyle = 'rgba(74,40,18,0.15)'; ctx.fill();
          outline(0, 0); ctx.fillStyle = brownedc(fat, it.brownUp); ctx.fill();
          const band = (off, wdt, col) => {
            ctx.strokeStyle = col; ctx.lineWidth = wdt;
            ctx.beginPath();
            for (let i = 0; i <= 20; i++) { const px = wx(i) * 0.95, py = wy(i) + off; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
            ctx.stroke();
          };
          const mc = brownedc(meat, it.brownUp);
          band(-2.5 * s, 3.2 * s, mc);
          band(3.2 * s, 2.6 * s, mc);
          band(-2 * s, 1 * s, rgba(deepen(mc, 0.25), 0.5));
          band(-5 * s, 0.9 * s, 'rgba(255,250,235,0.45)');
          band(0.6 * s, 0.7 * s, rgba(lighten(brownedc(fat, it.brownUp), 0.4), 0.6));
          if (ck > 0.5) {
            // rendered fat glints
            ctx.fillStyle = 'rgba(255,240,190,0.6)';
            for (let i = 2; i < 20; i += 6) { D.circle(ctx, wx(i), wy(i) + 5 * s, 0.9 * s); ctx.fill(); }
          }
          ctx.restore();
          R = 36 * s;
        } else {
          R = clamp(8 + Math.sqrt(m) * 2.5, 8, 36) * s;
          pile(ctx, it, x, y, s, {
            n: m / 2, R, max: 30, piece(px, py, r, sh, i) {
              const fc = brownedc(shadeHex(fat, sh), tb), mc = brownedc(shadeHex(meat, sh), tb);
              chunk(ctx, px, py, 6 * s, 4 * s, r * 0.3, i % 3 ? mc : fc, s, 0.3, 0.3);
              if (i % 3) { ctx.fillStyle = fc; ctx.fillRect(px - 3 * s, py - 0.5 * s, 6 * s, 1 * s); }
            },
          });
        }
        break;
      }
      case 'spaghetti': {
        const cookedLook = clamp(it.hyd / Math.max(1, (it.comp.spaghetti || 1) * 0.6), 0, 1);
        const col = brownedc(mix('#e8cf86', '#f4de9c', cookedLook), tb);
        const n = clamp(Math.round(m / 3), 6, 45);
        ctx.lineCap = 'round';
        if (cookedLook < 0.3) {
          const L = (it.form === 'broken' ? 30 : 70) * s;
          const ca = Math.cos(rot), sa = Math.sin(rot);
          ctx.strokeStyle = 'rgba(74,40,18,0.14)'; ctx.lineWidth = 2.2 * s;
          ctx.beginPath(); ctx.moveTo(x - ca * L + 1.5 * s, y - sa * L + 3 * s); ctx.lineTo(x + ca * L + 1.5 * s, y + sa * L + 3 * s); ctx.stroke();
          for (let i = 0; i < n; i++) {
            const off = (hash(i + it.id) - 0.5) * 14 * s;
            const a = rot + (hash(i * 3 + it.id) - 0.5) * 0.15;
            const x0 = x - Math.cos(a) * L + Math.sin(a) * off, y0 = y - Math.sin(a) * L - Math.cos(a) * off;
            const x1 = x + Math.cos(a) * L + Math.sin(a) * off, y1 = y + Math.sin(a) * L - Math.cos(a) * off;
            ctx.strokeStyle = shadeHex(col, 0.9 + hash(i * 2.2 + it.id) * 0.15); ctx.lineWidth = 1.6 * s;
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            if (i % 3 === 0) { ctx.strokeStyle = 'rgba(255,250,225,0.55)'; ctx.lineWidth = 0.5 * s; ctx.beginPath(); ctx.moveTo(x0 - 0.4 * s, y0 - 0.4 * s); ctx.lineTo(x1 - 0.4 * s, y1 - 0.4 * s); ctx.stroke(); }
          }
          R = 40 * s;
        } else {
          R = clamp(14 + Math.sqrt(m) * 2.3, 14, 58) * s;
          // each strand wanders in soft curls and turns back at the edge of the nest
          const strands = [];
          const step = R * 0.17, lim = R * 0.86;
          for (let i = 0; i < n; i++) {
            const a0 = hash(i + it.id) * TAU, r0 = Math.sqrt(hash(i * 7 + it.id)) * lim;
            let px = x + Math.cos(a0) * r0, py = y + Math.sin(a0) * r0;
            let ang = hash(i * 3.7 + it.id) * TAU;
            const turn = (hash(i * 5.3 + it.id) - 0.5) * 1.1;
            const p = [[px, py]];
            for (let j = 0; j < 11; j++) {
              ang += turn + (hash(i * 31 + j * 7 + it.id) - 0.5) * 1.2;
              let nx = px + Math.cos(ang) * step, ny = py + Math.sin(ang) * step;
              if (Math.hypot(nx - x, ny - y) > lim) { ang = Math.atan2(y - py, x - px) + turn; nx = px + Math.cos(ang) * step; ny = py + Math.sin(ang) * step; }
              px = nx; py = ny; p.push([px, py]);
            }
            strands.push(p);
          }
          const trace = (p, dx, dy) => {
            ctx.beginPath(); ctx.moveTo(p[0][0] + dx, p[0][1] + dy);
            for (let j = 1; j < p.length - 1; j++) ctx.quadraticCurveTo(p[j][0] + dx, p[j][1] + dy, (p[j][0] + p[j + 1][0]) / 2 + dx, (p[j][1] + p[j + 1][1]) / 2 + dy);
          };
          // a soft nest shadow, then the strands, then glossy highlights
          ctx.fillStyle = 'rgba(74,40,18,0.07)'; D.blob(ctx, x + 1.5 * s, y + 2.5 * s, R * 0.82, it.id, 0.2, 10); ctx.fill();
          ctx.strokeStyle = rgba(deepen(col, 0.35), 0.45); ctx.lineWidth = 2.6 * s;
          for (let i = 0; i < n; i += 2) { trace(strands[i], 0.6 * s, 1.2 * s); ctx.stroke(); }
          ctx.lineWidth = 1.8 * s;
          for (let i = 0; i < n; i++) {
            ctx.strokeStyle = shadeHex(col, 0.88 + hash(i * 2 + it.id) * 0.2);
            trace(strands[i], 0, 0); ctx.stroke();
          }
          ctx.strokeStyle = 'rgba(255,252,232,0.5)'; ctx.lineWidth = 0.6 * s;
          for (let i = 0; i < n; i += 3) { trace(strands[i], -0.5 * s, -0.5 * s); ctx.stroke(); }
        }
        specks(ctx, it, x, y, R * 0.8, s);
        break;
      }
      case 'rice': {
        R = clamp(10 + Math.sqrt(m) * 2.2, 10, 56) * s;
        const col = brownedc(mix('#efe9d6', '#fbf9f2', clamp(ck, 0, 1)), tb);
        const plump = 1 + clamp(ck - 0.5, 0, 1) * 0.2;
        const gw = 2.4 * s * plump, gh = 1.1 * s * plump;
        const dk = rgba(deepen(col, 0.3), 0.45);
        pile(ctx, it, x, y, s, {
          n: m * 1.5, R, max: 90, piece(px, py, r, sh) {
            ctx.fillStyle = dk; D.ellipse(ctx, px + 0.3 * s, py + 0.7 * s, gw, gh, r); ctx.fill();
            ctx.fillStyle = shadeHex(col, sh); D.ellipse(ctx, px, py, gw, gh, r); ctx.fill();
          },
        });
        // sparkle on a few grains
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        for (let i = 0; i < 14; i++) { const a = hash(i * 3.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 7.1 + it.id)) * R * 0.9; ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1 * s, 0.6 * s); }
        ctx.fill();
        specks(ctx, it, x, y, R * 0.8, s);
        break;
      }
      case 'bellpepper': {
        const red = mix('#d8342a', '#b52a22', clamp(ck / 1.5, 0, 1));
        if (form === 'whole') {
          // four-lobed pepper seen from above, with a fat green stem
          const body = brownedc(red, tb * 0.6);
          shadow(ctx, x + 2.5 * s, y + 4 * s, 24 * s, 23 * s, 0.17);
          const g = ctx.createRadialGradient(x - 9 * s, y - 10 * s, 2, x, y, 25 * s);
          g.addColorStop(0, lighten(body, 0.35)); g.addColorStop(0.5, body); g.addColorStop(1, deepen(body, 0.3));
          for (let i = 0; i < 4; i++) {
            const a = rot + i * Math.PI / 2;
            ctx.fillStyle = g;
            D.circle(ctx, x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s, 15 * s); ctx.fill();
          }
          ctx.strokeStyle = 'rgba(90,10,10,0.35)'; ctx.lineWidth = 1.5 * s;
          for (let i = 0; i < 4; i++) { const a = rot + Math.PI / 4 + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); ctx.quadraticCurveTo(x + Math.cos(a + 0.1) * 14 * s, y + Math.sin(a + 0.1) * 14 * s, x + Math.cos(a) * 20 * s, y + Math.sin(a) * 20 * s); ctx.stroke(); }
          // a glossy highlight on each lobe
          for (let i = 0; i < 4; i++) {
            const a = rot + i * Math.PI / 2;
            const lx = x + Math.cos(a) * 11 * s - 4 * s, ly = y + Math.sin(a) * 11 * s - 5 * s;
            shine(ctx, lx, ly, 3.4 * s, 1.8 * s, -0.7, 0.3);
          }
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; D.ellipse(ctx, x - 9 * s, y - 9 * s, 3 * s, 6 * s, 0.6); ctx.fill();
          if (tb > 0.6) {
            // charred blisters
            ctx.fillStyle = rgba(brownedc(red, tb + 0.8), 0.45);
            for (let i = 0; i < 6; i++) { D.blob(ctx, x + (hash(i * 2 + it.id) - 0.5) * 36 * s, y + (hash(i * 5 + it.id) - 0.5) * 36 * s, 3.5 * s, i + it.id, 0.5, 7); ctx.fill(); }
          }
          ctx.fillStyle = '#2f6e2a'; D.blob(ctx, x, y, 6.5 * s, it.id + 2, 0.35, 8); ctx.fill();
          ctx.fillStyle = '#3f8434'; D.circle(ctx, x, y, 4.4 * s); ctx.fill();
          ctx.fillStyle = '#5aa043'; D.rr(ctx, x - 2.5 * s, y - 9 * s, 5 * s, 10 * s, 2 * s); ctx.fill();
          ctx.fillStyle = '#86c063'; D.rr(ctx, x - 1.6 * s, y - 8.4 * s, 1.4 * s, 7 * s, 0.7 * s); ctx.fill();
          ctx.fillStyle = '#a9cf7a'; D.ellipse(ctx, x, y - 9 * s, 2.5 * s, 1.1 * s, 0); ctx.fill();
          R = 24 * s;
        } else if (form === 'halved') {
          for (const sg of [-1, 1]) {
            const px = x + sg * 13 * s;
            shadow(ctx, px + 1.5 * s, y + 3 * s, 12 * s, 21 * s, 0.15);
            ctx.fillStyle = dome(ctx, px, y, 21 * s, brownedc(red, it.brownUp), 0.3, 0.2); D.ellipse(ctx, px, y, 12 * s, 21 * s, 0); ctx.fill();
            ctx.fillStyle = '#f4ecd6'; D.ellipse(ctx, px, y, 8 * s, 16 * s, 0); ctx.fill();
            ctx.fillStyle = rgba(red, 0.25); D.ellipse(ctx, px + 1 * s, y + 2 * s, 6.5 * s, 13.5 * s, 0); ctx.fill();
            // white rib and seeds near the stem end
            ctx.fillStyle = '#fbf6e6'; D.ellipse(ctx, px, y - 10 * s, 3.4 * s, 4 * s, 0); ctx.fill();
            ctx.fillStyle = '#efdca6';
            for (let j = 0; j < 5; j++) { D.ellipse(ctx, px + (hash(j + sg * 3 + it.id) - 0.5) * 6 * s, y - 10 * s + (hash(j * 3 + it.id) - 0.5) * 6 * s, 1.1 * s, 0.7 * s, j); ctx.fill(); }
            ctx.fillStyle = '#3f8434'; D.rr(ctx, px - 1.5 * s, y - 22 * s, 3 * s, 5 * s, 1.2 * s); ctx.fill();
            shine(ctx, px - 6 * s, y - 4 * s, 1.4 * s, 7 * s, 0, 0.35);
          }
          R = 26 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.4, 10, 48) * s;
          const strips = form === 'strips';
          pile(ctx, it, x, y, s, {
            n: m / (strips ? 5 : 2.5), R, max: 60, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(red, sh), (i % 2 ? it.brownDown : it.brownUp));
              if (strips) {
                // a gently curved strip: skin outside, paler flesh edge inside
                const cx = px - Math.sin(r) * 24 * s, cy = py + Math.cos(r) * 24 * s, a0 = r - Math.PI / 2;
                ctx.strokeStyle = deepen(col, 0.35); ctx.lineWidth = 4.4 * s;
                ctx.beginPath(); ctx.arc(cx + 0.4 * s, cy + 1.1 * s, 24 * s, a0 - 0.36, a0 + 0.36); ctx.stroke();
                ctx.strokeStyle = col; ctx.lineWidth = 4 * s;
                ctx.beginPath(); ctx.arc(cx, cy, 24 * s, a0 - 0.36, a0 + 0.36); ctx.stroke();
                ctx.strokeStyle = rgba('#f6d8c4', 0.75); ctx.lineWidth = 1 * s;
                ctx.beginPath(); ctx.arc(cx, cy, 22.4 * s, a0 - 0.33, a0 + 0.33); ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.8 * s;
                ctx.beginPath(); ctx.arc(cx, cy, 25.3 * s, a0 - 0.22, a0 + 0.12); ctx.stroke();
              } else {
                chunk(ctx, px, py, 5 * s, 5 * s, r, col, s, 0.25);
                ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(px - 1.6 * s, py - 1.6 * s, 1.2 * s, 1 * s);
              }
            },
          });
        }
        break;
      }
      case 'mushroom': {
        const cap = brownedc(mix('#c9a57c', '#9c7b56', clamp(ck, 0, 1)), tb * 0.8);
        const flesh = brownedc(mix('#efe3cf', '#c9ab84', clamp(ck, 0, 1)), tb);
        const sil = (px, py, k, col, edgeCol) => {
          // cross-section: domed cap with a stem
          ctx.beginPath();
          ctx.moveTo(px - 6 * k, py + 0.5 * k);
          ctx.quadraticCurveTo(px - 6.3 * k, py - 5.5 * k, px, py - 6 * k);
          ctx.quadraticCurveTo(px + 6.3 * k, py - 5.5 * k, px + 6 * k, py + 0.5 * k);
          ctx.lineTo(px + 2.4 * k, py + 1 * k);
          ctx.lineTo(px + 2.2 * k, py + 5.5 * k);
          ctx.quadraticCurveTo(px, py + 6.5 * k, px - 2.2 * k, py + 5.5 * k);
          ctx.lineTo(px - 2.4 * k, py + 1 * k);
          ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
          if (edgeCol) {
            ctx.strokeStyle = edgeCol; ctx.lineWidth = 1.2 * k / 1.8;
            ctx.beginPath(); ctx.moveTo(px - 6 * k, py + 0.5 * k); ctx.quadraticCurveTo(px - 6.3 * k, py - 5.5 * k, px, py - 6 * k); ctx.quadraticCurveTo(px + 6.3 * k, py - 5.5 * k, px + 6 * k, py + 0.5 * k); ctx.stroke();
            ctx.strokeStyle = rgba(deepen(col, 0.2), 0.5); ctx.lineWidth = 0.6 * k / 1.8;
            ctx.beginPath(); ctx.moveTo(px - 5 * k, py + 0.4 * k); ctx.lineTo(px + 5 * k, py + 0.4 * k); ctx.stroke();
          }
        };
        if (form === 'whole') {
          shadow(ctx, x + 1.5 * s, y + 2.5 * s, 12.5 * s, 12 * s, 0.18);
          ctx.fillStyle = shadeHex(cap, 0.85); D.circle(ctx, x + 1 * s, y + 1.5 * s, 13 * s); ctx.fill();
          ctx.fillStyle = dome(ctx, x, y, 12 * s, cap, 0.16, 0.22); D.circle(ctx, x, y, 12 * s); ctx.fill();
          ctx.strokeStyle = rgba(deepen(cap, 0.2), 0.18); ctx.lineWidth = 0.7 * s;
          ctx.beginPath();
          for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + hash(i + it.id) * 0.3; ctx.moveTo(x + Math.cos(a) * 3 * s, y + Math.sin(a) * 3 * s); ctx.lineTo(x + Math.cos(a) * 10.5 * s, y + Math.sin(a) * 10.5 * s); }
          ctx.stroke();
          ctx.fillStyle = rgba(deepen(cap, 0.3), 0.3);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = hash(i * 2 + it.id) * TAU, rr = hash(i * 3 + it.id) * 8 * s; ctx.moveTo(x + Math.cos(a) * rr + 0.8 * s, y + Math.sin(a) * rr); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.8 * s, 0, TAU); }
          ctx.fill();
          ctx.fillStyle = 'rgba(255,250,240,0.28)'; D.ellipse(ctx, x - 4 * s, y - 4.5 * s, 4 * s, 2.6 * s, -0.6); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,215,0.5)'; ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.arc(x, y, 11.3 * s, 1.6, 3.4); ctx.stroke();
          R = 12 * s;
        } else if (form === 'halved') {
          shadow(ctx, x + 1.5 * s, y + 2.5 * s, 12 * s, 11 * s, 0.16);
          sil(x, y, 2 * s, flesh, cap);
          ctx.fillStyle = 'rgba(255,255,250,0.35)'; D.ellipse(ctx, x - 4 * s, y - 5 * s, 3 * s, 1.5 * s, -0.4); ctx.fill();
          R = 12 * s;
        } else {
          R = clamp(8 + Math.sqrt(m) * 2.6, 8, 46) * s;
          const sliced = form === 'sliced';
          pile(ctx, it, x, y, s, {
            n: m / (sliced ? 3 : 1.5), R, max: 55, piece(px, py, r, sh) {
              const col = shadeHex(flesh, sh);
              if (sliced) {
                ctx.save(); ctx.translate(px, py); ctx.rotate(r);
                sil(0.4 * s, 1 * s, 1 * s, 'rgba(74,40,18,0.18)');
                sil(0, 0, 1 * s, col, cap);
                ctx.restore();
              } else chunk(ctx, px, py, 4 * s, 4 * s, r, col, s, 0.3);
            },
          });
        }
        break;
      }
      case 'chives':
      case 'basil': {
        const basil = it.ing === 'basil';
        const green = brownedc(mix(basil ? '#3d8b40' : '#4c9a3c', '#5c7a32', clamp(ck, 0, 1)), tb);
        if (form === 'bunch' || form === 'leaves') {
          if (basil) {
            shadow(ctx, x + 1.5 * s, y + 3 * s, 17 * s, 16 * s, 0.13);
            ctx.strokeStyle = '#5c8f3a'; ctx.lineWidth = 1.6 * s;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(rot + 0.6) * 6 * s, y - Math.sin(rot + 0.6) * 6 * s); ctx.stroke();
            for (let i = 0; i < 5; i++) {
              const a = rot + i * 1.26;
              leaf(ctx, x + Math.cos(a) * 1 * s, y + Math.sin(a) * 1 * s, 18 * s, 11 * s, a, shadeHex(green, 0.9 + i * 0.04), s);
            }
            ctx.fillStyle = shadeHex(green, 1.15); D.circle(ctx, x, y, 2.2 * s); ctx.fill();
          } else {
            const ca = Math.cos(rot), sa = Math.sin(rot);
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(74,40,18,0.1)'; ctx.lineWidth = 8 * 2.4 * s;
            ctx.beginPath(); ctx.moveTo(x - ca * 20 * s + 2 * s, y - sa * 20 * s + 3 * s); ctx.lineTo(x + ca * 20 * s + 2 * s, y + sa * 20 * s + 3 * s); ctx.stroke();
            for (let i = -4; i <= 4; i++) {
              const ox = -sa * i * 2.4 * s, oy = ca * i * 2.4 * s, L1 = (20 + hash(i + it.id) * 5) * s;
              ctx.strokeStyle = shadeHex(green, 0.92 + (i & 1) * 0.1); ctx.lineWidth = 2 * s;
              ctx.beginPath(); ctx.moveTo(x + ox - ca * L1, y + oy - sa * L1); ctx.lineTo(x + ox + ca * L1, y + oy + sa * L1); ctx.stroke();
              ctx.strokeStyle = 'rgba(220,255,190,0.35)'; ctx.lineWidth = 0.6 * s;
              ctx.beginPath(); ctx.moveTo(x + ox - ca * L1 - sa * 0.5 * s, y + oy - sa * L1 + ca * 0.5 * s * -1); ctx.lineTo(x + ox + ca * L1 * 0.8, y + oy + sa * L1 * 0.8); ctx.stroke();
            }
            // twine
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
            ctx.fillStyle = '#c99a5a'; ctx.fillRect(-3 * s, -12 * s, 6 * s, 24 * s);
            ctx.fillStyle = 'rgba(120,80,40,0.35)'; for (let k = -10; k < 12; k += 4) ctx.fillRect(-3 * s, k * s, 6 * s, 1 * s);
            ctx.fillStyle = 'rgba(255,240,210,0.4)'; ctx.fillRect(-2.5 * s, -12 * s, 1.2 * s, 24 * s);
            ctx.restore();
          }
          R = 20 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 4, 6, 30) * s;
          const dk = deepen(green, 0.2);
          pile(ctx, it, x, y, s, {
            n: m * 6, R, max: 60, piece(px, py, r, sh, i) {
              const col = shadeHex(green, sh);
              if (basil) {
                const rx = (form === 'torn' ? 4 : 2) * s, ry = (form === 'torn' ? 2.6 : 1.4) * s;
                ctx.fillStyle = dk; D.ellipse(ctx, px + 0.3 * s, py + 0.6 * s, rx, ry, r); ctx.fill();
                ctx.fillStyle = col;
                if (form === 'torn') { D.blob(ctx, px, py, rx * 0.9, i + it.id, 0.45, 7); ctx.fill(); ctx.strokeStyle = 'rgba(220,250,190,0.35)'; ctx.lineWidth = 0.5 * s; ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * rx * 0.6, py - Math.sin(r) * rx * 0.6); ctx.lineTo(px + Math.cos(r) * rx * 0.6, py + Math.sin(r) * rx * 0.6); ctx.stroke(); }
                else { D.ellipse(ctx, px, py, rx, ry, r); ctx.fill(); }
              } else {
                // little rings of chive
                ctx.fillStyle = col; chamf(ctx, px, py, 3.2 * s, 1.8 * s, r, 0.6 * s); ctx.fill();
                ctx.fillStyle = 'rgba(220,250,190,0.5)'; chamf(ctx, px, py, 1.4 * s, 0.7 * s, r, 0.3 * s); ctx.fill();
              }
            },
          });
        }
        break;
      }
      case 'banana': {
        const flesh = brownedc(mix('#fbf1c8', '#f0d38a', clamp(ck, 0, 1)), tb);
        if (form === 'whole' || form === 'halved') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          const L2 = form === 'whole' ? 1 : 0.55;
          const a0 = -Math.PI / 2 - 0.75 * L2, a1 = -Math.PI / 2 + 0.75 * L2;
          const peel = brownedc('#f2cf4a', tb * 0.6);
          const cy = 26 * s;
          const shape = (dx, dy, ro, ri) => {
            ctx.beginPath();
            ctx.arc(dx, cy + dy, ro, a0, a1);
            ctx.arc(dx, cy + dy, ri, a1, a0, true);
            ctx.closePath();
          };
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(74,40,18,0.16)'; ctx.lineWidth = 14 * s;
          ctx.beginPath(); ctx.arc(2 * s, cy + 4 * s, 34 * s, a0, a1); ctx.stroke();
          ctx.strokeStyle = deepen(peel, 0.18); ctx.lineWidth = 14 * s;
          ctx.beginPath(); ctx.arc(0, cy, 34 * s, a0, a1); ctx.stroke();
          ctx.strokeStyle = peel; ctx.lineWidth = 11 * s;
          ctx.beginPath(); ctx.arc(0, cy - 1 * s, 34.8 * s, a0 + 0.02, a1 - 0.02); ctx.stroke();
          // ridges and a sunny highlight
          ctx.strokeStyle = rgba(deepen(peel, 0.2), 0.35); ctx.lineWidth = 0.8 * s;
          ctx.beginPath(); ctx.arc(0, cy, 31 * s, a0 + 0.05, a1 - 0.05); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3 * s;
          ctx.beginPath(); ctx.arc(0, cy, 37 * s, -Math.PI / 2 - 0.5 * L2, -Math.PI / 2 + 0.4 * L2); ctx.stroke();
          // sugar spots
          ctx.fillStyle = 'rgba(120,80,30,0.35)';
          for (let i = 0; i < 5; i++) { const a = a0 + 0.15 + hash(i * 3 + it.id) * (a1 - a0 - 0.3), rr = (31 + hash(i * 5 + it.id) * 6) * s; D.circle(ctx, Math.cos(a) * rr, cy + Math.sin(a) * rr, (0.6 + hash(i) * 0.6) * s); ctx.fill(); }
          // the stem end and the dark tip
          ctx.fillStyle = '#6b4a2a'; const e = a1; D.circle(ctx, Math.cos(e) * 34 * s, cy + Math.sin(e) * 34 * s, 3 * s); ctx.fill();
          if (form === 'whole') {
            ctx.fillStyle = '#8a6a3a'; const b0 = a0;
            ctx.save(); ctx.translate(Math.cos(b0) * 34 * s, cy + Math.sin(b0) * 34 * s); ctx.rotate(b0 + Math.PI / 2);
            D.rr(ctx, -2.2 * s, -6 * s, 4.4 * s, 7 * s, 1.5 * s); ctx.fill();
            ctx.fillStyle = '#5a3e22'; D.rr(ctx, -2.2 * s, -6.5 * s, 4.4 * s, 2 * s, 1 * s); ctx.fill();
            ctx.restore();
          } else {
            // the cut end
            const b0 = a0, ex = Math.cos(b0) * 34 * s, ey = cy + Math.sin(b0) * 34 * s;
            ctx.fillStyle = flesh; D.ellipse(ctx, ex, ey, 5.2 * s, 6.2 * s, b0); ctx.fill();
            ctx.fillStyle = 'rgba(160,120,60,0.35)'; D.circle(ctx, ex, ey, 1.2 * s); ctx.fill();
          }
          ctx.restore();
          R = 26 * s;
        } else if (form === 'mashed') {
          R = clamp(8 + Math.sqrt(m) * 2.6, 8, 44) * s;
          shadow(ctx, x + 1.5 * s, y + 2.5 * s, R, R * 0.92, 0.13);
          ctx.fillStyle = dome(ctx, x, y, R, flesh, 0.25, 0.12); D.blob(ctx, x, y, R, it.id, 0.3, 12); ctx.fill();
          // lumpy texture
          ctx.fillStyle = rgba(lighten(flesh, 0.4), 0.55);
          for (let i = 0; i < 6; i++) { D.blob(ctx, x + (hash(i * 4 + it.id) - 0.5) * R * 1.1, y + (hash(i * 6 + it.id) - 0.5) * R * 1.1, R * 0.16, i, 0.5, 7); ctx.fill(); }
          ctx.fillStyle = 'rgba(120,90,40,0.3)'; for (let i = 0; i < 10; i++) { D.circle(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 3 + it.id) - 0.5) * R, 1.3 * s); ctx.fill(); }
        } else {
          R = clamp(8 + Math.sqrt(m) * 2.6, 8, 46) * s;
          const sz = form === 'sliced' ? 6 : 3;
          pile(ctx, it, x, y, s, {
            n: m / (form === 'sliced' ? 6 : 2), R, max: 50, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(flesh, sh), i % 2 ? it.brownDown : it.brownUp);
              ctx.fillStyle = 'rgba(110,70,25,0.3)'; D.circle(ctx, px + 0.4 * s, py + 1.1 * s, sz * s); ctx.fill();
              ctx.fillStyle = col; D.circle(ctx, px, py, sz * s); ctx.fill();
              if (form === 'sliced') {
                ctx.fillStyle = rgba(lighten(col, 0.4), 0.6); D.circle(ctx, px - 1.2 * s, py - 1.2 * s, 2 * s); ctx.fill();
                ctx.fillStyle = 'rgba(140,110,60,0.35)'; D.circle(ctx, px, py, 1.4 * s); ctx.fill();
                ctx.fillStyle = 'rgba(120,90,50,0.4)';
                for (let j = 0; j < 4; j++) { const a = r + j * 1.57; ctx.fillRect(px + Math.cos(a) * 2.4 * s, py + Math.sin(a) * 2.4 * s, 0.6 * s, 0.6 * s); }
              }
            },
          });
        }
        break;
      }
      case 'oats': {
        const wet = clamp(it.hyd / Math.max(1, (it.comp.oats || 1) * 2), 0, 1);
        R = clamp(10 + Math.sqrt(m) * 2.6, 10, 60) * s;
        if (wet > 0.3) {
          // a creamy pot of porridge
          const pc = brownedc(mix('#e9dcc0', '#efe4cc', wet), tb * 0.6);
          ctx.fillStyle = dome(ctx, x, y, R, pc, 0.25, 0.1);
          D.blob(ctx, x, y, R, it.id, 0.15, 14); ctx.fill();
          ctx.strokeStyle = 'rgba(255,252,240,0.45)'; ctx.lineWidth = 1.6 * s;
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + (i - 0.5) * R * 0.3, y + (i - 0.5) * R * 0.2, R * (0.45 - i * 0.15), 0.4 + i * 2, 2.2 + i * 2); ctx.stroke(); }
        }
        const fc = wet > 0.3 ? '#d8c597' : '#e3cf9f';
        pile(ctx, it, x, y, s, {
          n: (it.comp.oats || m) * 1.2, R: R * 0.9, max: 80, piece(px, py, r, sh) {
            const col = brownedc(shadeHex(fc, sh), tb);
            ctx.fillStyle = deepen(col, 0.25); D.ellipse(ctx, px + 0.3 * s, py + 0.7 * s, 2.6 * s, 1.8 * s, r); ctx.fill();
            ctx.fillStyle = col; D.ellipse(ctx, px, py, 2.6 * s, 1.8 * s, r); ctx.fill();
            ctx.fillStyle = 'rgba(255,250,230,0.45)'; D.ellipse(ctx, px - 0.6 * s, py - 0.5 * s, 1.1 * s, 0.6 * s, r); ctx.fill();
          },
        });
        if (wet > 0.3) { shine(ctx, x - R * 0.35, y - R * 0.35, R * 0.18, R * 0.08, -0.6, 0.35); }
        specks(ctx, it, x, y, R, s);
        break;
      }

      case 'beetroot': {
        // deep ruby; cooked beet is glossier, a beet that bled into the soup is paler
        const pale = clamp((it.leached || 0) * 2.2, 0, 0.5);
        const flesh = brownedc(mix(mix('#a3173f', '#7e1031', clamp(ck / 1.5, 0, 1)), '#d27a92', pale), tb);
        const ring = rgba(lighten(flesh, 0.25), 0.55);
        if (form === 'whole') {
          shadow(ctx, x + 2.5 * s, y + 4 * s, 22 * s, 21 * s, 0.17);
          // root tail
          ctx.strokeStyle = '#5a1428'; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + Math.cos(rot) * 18 * s, y + Math.sin(rot) * 18 * s); ctx.quadraticCurveTo(x + Math.cos(rot + 0.3) * 26 * s, y + Math.sin(rot + 0.3) * 26 * s, x + Math.cos(rot + 0.15) * 33 * s, y + Math.sin(rot + 0.15) * 33 * s); ctx.stroke();
          const skin = brownedc(mix('#6e1d36', '#5a1530', clamp(ck, 0, 1)), tb * 0.6);
          ctx.fillStyle = dome(ctx, x, y, 21 * s, skin, 0.32, 0.25); D.blob(ctx, x, y, 21 * s, it.id, 0.1, 12); ctx.fill();
          ctx.strokeStyle = 'rgba(40,5,15,0.25)'; ctx.lineWidth = 0.8 * s;
          for (let i = 0; i < 4; i++) { const a = rot + 0.5 + i * 0.5; ctx.beginPath(); ctx.arc(x, y, (8 + i * 3.5) * s, a, a + 0.8); ctx.stroke(); }
          // stem stubs
          const sx = x - Math.cos(rot) * 17 * s, sy = y - Math.sin(rot) * 17 * s;
          for (let i = -1; i <= 1; i++) { ctx.strokeStyle = i ? '#b0305a' : '#5e9a3a'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(rot + i * 0.4) * 8 * s, sy - Math.sin(rot + i * 0.4) * 8 * s); ctx.stroke(); }
          shine(ctx, x - 7 * s, y - 8 * s, 5 * s, 2.6 * s, -0.6, ck > 0.8 ? 0.4 : 0.25);
          R = 22 * s;
        } else if (form === 'halved') {
          for (const sg of [-1, 1]) {
            const px = x + sg * 11 * s;
            shadow(ctx, px + 1.5 * s, y + 3 * s, 19 * s, 18 * s, 0.15);
            ctx.fillStyle = '#5a1530'; D.circle(ctx, px, y, 19 * s); ctx.fill();
            ctx.fillStyle = dome(ctx, px, y, 17.5 * s, flesh, 0.2, 0.1); D.circle(ctx, px, y, 17.5 * s); ctx.fill();
            ctx.strokeStyle = ring; ctx.lineWidth = 1.1 * s;
            for (let r = 4; r < 17; r += 3.5) { D.circle(ctx, px, y, r * s); ctx.stroke(); }
          }
          R = 30 * s;
        } else if (form === 'sliced') {
          R = clamp(10 + Math.sqrt(m) * 2.3, 10, 48) * s;
          pile(ctx, it, x, y, s, {
            n: m / 9, R, max: 30, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(flesh, sh), i % 2 ? it.brownDown : it.brownUp);
              ctx.fillStyle = deepen(col, 0.3); D.circle(ctx, px + 0.5 * s, py + 1.2 * s, 8 * s); ctx.fill();
              ctx.fillStyle = col; D.circle(ctx, px, py, 8 * s); ctx.fill();
              ctx.strokeStyle = ring; ctx.lineWidth = 0.8 * s; D.circle(ctx, px, py, 5 * s); ctx.stroke(); D.circle(ctx, px, py, 2.5 * s); ctx.stroke();
            },
          });
        } else if (form === 'grated') {
          R = clamp(10 + Math.sqrt(m) * 2.1, 10, 50) * s;
          shredMound(ctx, it, x, y, R, s, flesh);
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.3, 10, 50) * s;
          const strips = form === 'strips', grated = false;
          pile(ctx, it, x, y, s, {
            n: m / (grated ? 1.2 : strips ? 2.6 : 3), R, max: grated ? 90 : 70, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(flesh, sh), i % 2 ? it.brownDown : it.brownUp);
              if (grated) {
                ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * 3 * s, py - Math.sin(r) * 3 * s); ctx.quadraticCurveTo(px + 1 * s, py, px + Math.cos(r) * 3 * s, py + Math.sin(r) * 3 * s); ctx.stroke();
              } else if (strips) {
                ctx.fillStyle = deepen(col, 0.3); chamf(ctx, px + 0.3 * s, py + 0.8 * s, 10 * s, 2.2 * s, r, 0.8 * s); ctx.fill();
                ctx.fillStyle = col; chamf(ctx, px, py, 10 * s, 2.2 * s, r, 0.8 * s); ctx.fill();
              } else chunk(ctx, px, py, 6.5 * s, 6.5 * s, r, col, s, 0.25);
            },
          });
        }
        break;
      }
      case 'carrot': {
        const flesh = brownedc(mix('#ef8a34', '#e06a1e', clamp(ck / 1.5, 0, 1)), tb);
        if (form === 'whole') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          const L1 = 30 * s;
          ctx.fillStyle = 'rgba(74,40,18,0.16)'; ctx.beginPath(); ctx.moveTo(-L1 + 2 * s, -6 * s + 3 * s); ctx.quadraticCurveTo(0, -7 * s + 3 * s, L1 + 2 * s, 3 * s); ctx.quadraticCurveTo(0, 7 * s + 3 * s, -L1 + 2 * s, 6 * s + 3 * s); ctx.closePath(); ctx.fill();
          const g = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
          g.addColorStop(0, lighten(flesh, 0.3)); g.addColorStop(0.5, flesh); g.addColorStop(1, deepen(flesh, 0.25));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-L1, -6 * s); ctx.quadraticCurveTo(0, -7 * s, L1, 0); ctx.quadraticCurveTo(0, 7 * s, -L1, 6 * s); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = rgba(deepen(flesh, 0.35), 0.45); ctx.lineWidth = 0.8 * s;
          for (let i = 0; i < 6; i++) { const xx = -L1 + 6 * s + i * 8 * s; ctx.beginPath(); ctx.moveTo(xx, -4 * s + i * 0.5 * s); ctx.lineTo(xx + 2 * s, -2 * s); ctx.stroke(); }
          ctx.strokeStyle = '#5c9a3a'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
          for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-L1, 0); ctx.quadraticCurveTo(-L1 - 6 * s, i * 3 * s, -L1 - 13 * s, i * 6 * s); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,240,220,0.4)'; D.ellipse(ctx, -6 * s, -3.5 * s, 12 * s, 1.4 * s, 0); ctx.fill();
          ctx.restore();
          R = 30 * s;
        } else if (form === 'grated') {
          R = clamp(9 + Math.sqrt(m) * 2.2, 9, 46) * s;
          shredMound(ctx, it, x, y, R, s, flesh);
        } else {
          R = clamp(9 + Math.sqrt(m) * 2.4, 9, 46) * s;
          const core = lighten(flesh, 0.3);
          pile(ctx, it, x, y, s, {
            n: m / (form === 'grated' ? 1 : form === 'sliced' ? 4 : 2.2), R, max: form === 'grated' ? 90 : 60, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(flesh, sh), i % 2 ? it.brownDown : it.brownUp);
              if (form === 'sliced') {
                ctx.fillStyle = deepen(col, 0.3); D.circle(ctx, px + 0.4 * s, py + 1 * s, 4.6 * s); ctx.fill();
                ctx.fillStyle = col; D.circle(ctx, px, py, 4.6 * s); ctx.fill();
                ctx.fillStyle = rgba(core, 0.7); D.circle(ctx, px, py, 2.2 * s); ctx.fill();
              } else if (form === 'strips') {
                ctx.fillStyle = deepen(col, 0.3); chamf(ctx, px + 0.3 * s, py + 0.8 * s, 9 * s, 2 * s, r, 0.7 * s); ctx.fill();
                ctx.fillStyle = col; chamf(ctx, px, py, 9 * s, 2 * s, r, 0.7 * s); ctx.fill();
              } else if (form === 'grated') {
                ctx.strokeStyle = col; ctx.lineWidth = 1.1 * s; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * 2.8 * s, py - Math.sin(r) * 2.8 * s); ctx.quadraticCurveTo(px + 1 * s, py, px + Math.cos(r) * 2.8 * s, py + Math.sin(r) * 2.8 * s); ctx.stroke();
              } else chunk(ctx, px, py, 5.5 * s, 5.5 * s, r, col, s, 0.25);
            },
          });
        }
        break;
      }
      case 'cabbage': {
        const leafC = brownedc(mix('#b9d48a', '#d6d39a', clamp(ck / 2, 0, 1)), tb);
        const inner = brownedc(mix('#eef3d2', '#e9e3b0', clamp(ck / 2, 0, 1)), tb);
        if (form === 'wedge') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          const r = 38 * s, a0 = -0.8, a1 = 0.8;
          const wedge = (rr, dx, dy) => { ctx.beginPath(); ctx.moveTo(-r * 0.55 + dx, dy); ctx.arc(-r * 0.55 + dx, dy, rr, a0, a1); ctx.closePath(); };
          wedge(r + 1, 2 * s, 3 * s); ctx.fillStyle = 'rgba(74,40,18,0.16)'; ctx.fill();
          wedge(r, 0, 0); ctx.fillStyle = shadeHex(leafC, 0.85); ctx.fill();
          wedge(r * 0.9, 0, 0); ctx.fillStyle = inner; ctx.fill();
          ctx.strokeStyle = rgba(leafC, 0.9); ctx.lineWidth = 1.3 * s;
          for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.arc(-r * 0.55, 0, r * (0.18 + i * 0.13), a0 + 0.05, a1 - 0.05); ctx.stroke(); }
          ctx.fillStyle = '#f4f2dc'; ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.2, -4 * s); ctx.lineTo(-r * 0.2, 4 * s); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(-r * 0.55, 0, r * 0.95, a0 + 0.1, a0 + 0.5); ctx.arc(-r * 0.55, 0, r * 0.85, a0 + 0.5, a0 + 0.1, true); ctx.fill();
          ctx.restore();
          R = 26 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.4, 10, 54) * s;
          const fine = form === 'finely shredded';
          pile(ctx, it, x, y, s, {
            n: m / (fine ? 1.5 : 3), R, max: 80, piece(px, py, r, sh, i) {
              const col = brownedc(shadeHex(i % 3 ? inner : leafC, sh), i % 2 ? it.brownDown : it.brownUp);
              const l = (fine ? 4 : 6.5) * s;
              ctx.strokeStyle = deepen(col, 0.15); ctx.lineWidth = (fine ? 1.4 : 2.4) * s; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * l, py - Math.sin(r) * l + 0.6 * s); ctx.quadraticCurveTo(px, py + 2.5 * s, px + Math.cos(r) * l, py + Math.sin(r) * l + 0.6 * s); ctx.stroke();
              ctx.strokeStyle = col; ctx.lineWidth = (fine ? 1 : 1.8) * s;
              ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * l, py - Math.sin(r) * l); ctx.quadraticCurveTo(px, py + 2 * s, px + Math.cos(r) * l, py + Math.sin(r) * l); ctx.stroke();
            },
          });
        }
        break;
      }
      case 'dill': {
        const green = brownedc(mix('#5f9e3f', '#6b7a34', clamp(ck, 0, 1)), tb);
        ctx.lineCap = 'round';
        if (form === 'sprig') {
          shadow(ctx, x + 1.5 * s, y + 3 * s, 14 * s, 12 * s, 0.1);
          ctx.strokeStyle = '#5c8a3a'; ctx.lineWidth = 1.4 * s;
          const ca = Math.cos(rot), sa = Math.sin(rot);
          ctx.beginPath(); ctx.moveTo(x - ca * 16 * s, y - sa * 16 * s); ctx.lineTo(x + ca * 14 * s, y + sa * 14 * s); ctx.stroke();
          ctx.strokeStyle = green; ctx.lineWidth = 0.9 * s;
          for (let i = 0; i < 9; i++) {
            const t = -10 + i * 3, bx = x + ca * t * s, by = y + sa * t * s;
            for (const sd of [-1, 1]) {
              const a = rot + sd * (0.8 + hash(i + it.id) * 0.3), l = (9 - Math.abs(i - 4)) * s;
              ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * l, by + Math.sin(a) * l); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * l * 0.5, by + Math.sin(a) * l * 0.5); ctx.lineTo(bx + Math.cos(a + sd * 0.5) * l * 0.8, by + Math.sin(a + sd * 0.5) * l * 0.8); ctx.stroke();
            }
          }
          R = 18 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 4, 6, 30) * s;
          const fine = form === 'finely chopped';
          pile(ctx, it, x, y, s, {
            n: m * 7, R, max: 70, piece(px, py, r, sh, i) {
              ctx.strokeStyle = i % 4 === 0 ? deepen(green, 0.2) : shadeHex(green, sh); ctx.lineWidth = 0.8 * s;
              const l = (fine ? 1.4 : 2.4) * s;
              ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * l, py - Math.sin(r) * l); ctx.lineTo(px + Math.cos(r) * l, py + Math.sin(r) * l);
              ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(r + 0.8) * l, py + Math.sin(r + 0.8) * l); ctx.stroke();
            },
          });
        }
        break;
      }
      case 'sorrel': {
        // bright green, turning olive almost as soon as it meets heat
        const green = brownedc(mix('#4f9a36', '#7d7a35', clamp(ck * 1.3, 0, 1)), tb);
        if (form === 'bunch') {
          shadow(ctx, x + 1.5 * s, y + 3 * s, 20 * s, 16 * s, 0.12);
          ctx.strokeStyle = '#7a9a3a'; ctx.lineWidth = 1.4 * s;
          for (let i = 0; i < 6; i++) {
            const a = rot + (i - 2.5) * 0.28;
            ctx.beginPath(); ctx.moveTo(x - Math.cos(rot) * 14 * s, y - Math.sin(rot) * 14 * s); ctx.lineTo(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s); ctx.stroke();
          }
          for (let i = 0; i < 6; i++) {
            const a = rot + (i - 2.5) * 0.28;
            ctx.save(); ctx.translate(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s); ctx.rotate(a + Math.PI / 2);
            const col = shadeHex(green, 0.9 + (i % 3) * 0.06);
            ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-3 * s, 2 * s); ctx.quadraticCurveTo(-8 * s, -8 * s, 0, -20 * s); ctx.quadraticCurveTo(8 * s, -8 * s, 3 * s, 2 * s); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(220,255,200,0.4)'; ctx.lineWidth = 0.6 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -17 * s); ctx.stroke();
            ctx.restore();
          }
          R = 20 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 3.2, 6, 34) * s;
          const fine = form === 'finely chopped';
          pile(ctx, it, x, y, s, {
            n: m * (fine ? 3 : 1.8), R, max: 70, piece(px, py, r, sh, i) {
              const col = shadeHex(green, sh);
              ctx.fillStyle = deepen(col, 0.2); chamf(ctx, px + 0.3 * s, py + 0.6 * s, (fine ? 3 : 6) * s, (fine ? 1.6 : 2.4) * s, r, 0.6 * s); ctx.fill();
              ctx.fillStyle = col; chamf(ctx, px, py, (fine ? 3 : 6) * s, (fine ? 1.6 : 2.4) * s, r, 0.6 * s); ctx.fill();
            },
          });
        }
        break;
      }
      case 'salo': {
        // white fat with a pink streak; rendering turns it translucent and golden, then crisp
        const rend = clamp((it.rend || 0) / 0.55, 0, 1);
        const fat = brownedc(mix('#fbf6ee', '#f2dca2', rend), tb * (0.75 + rend * 0.25));
        const meat = brownedc(mix('#e9a29a', '#c98a5a', rend), tb);
        if (form === 'slab') {
          const k = 1 - rend * 0.35;
          const w = 34 * s * k, h = 20 * s * k;
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.3);
          ctx.fillStyle = 'rgba(74,40,18,0.17)'; D.rr(ctx, -w / 2 + 2 * s, -h / 2 + 3 * s, w, h, 3 * s); ctx.fill();
          ctx.fillStyle = brownedc(fat, it.brownDown * 0.3); D.rr(ctx, -w / 2, -h / 2 + 1.5 * s, w, h, 3 * s); ctx.fill();
          const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
          const top = brownedc(mix('#fbf6ee', '#f2dca2', rend), it.brownUp);
          g.addColorStop(0, lighten(top, 0.3)); g.addColorStop(1, deepen(top, 0.06));
          ctx.fillStyle = g; D.rr(ctx, -w / 2, -h / 2, w, h, 3 * s); ctx.fill();
          ctx.fillStyle = rgba(meat, 0.85); D.rr(ctx, -w / 2 + 2 * s, h * 0.08, w - 4 * s, 3 * s * k, 1.5 * s); ctx.fill();
          ctx.fillStyle = brownedc('#c9965e', tb); D.rr(ctx, -w / 2, h / 2 - 3 * s, w, 3 * s, 1.5 * s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; D.rr(ctx, -w / 2 + 3 * s, -h / 2 + 2 * s, w * 0.45, 1.6 * s, 0.8 * s); ctx.fill();
          ctx.restore();
          specks(ctx, it, x, y, 12 * s, s);
          R = 20 * s;
        } else {
          R = clamp(8 + Math.sqrt(m) * 2.6, 8, 36) * s;
          const strips = form === 'strips';
          const crisp = (it.brownDown + it.brownUp) / 2 > 0.8 && rend > 0.35;
          const k = 1 - rend * 0.3;
          pile(ctx, it, x, y, s, {
            n: m / (strips ? 4 : 2), R, max: 40, piece(px, py, r, sh, i) {
              const fc = brownedc(shadeHex(fat, sh), (i % 2 ? it.brownDown : it.brownUp) * 0.9);
              if (crisp) {
                // shkvarky: curled, golden-brown crackling nuggets
                ctx.fillStyle = deepen(fc, 0.3); D.blob(ctx, px + 0.4 * s, py + 0.9 * s, 3.2 * s * k, i + it.id, 0.5, 7); ctx.fill();
                ctx.fillStyle = fc; D.blob(ctx, px, py, 3.2 * s * k, i + it.id, 0.5, 7); ctx.fill();
                ctx.fillStyle = 'rgba(255,240,200,0.55)'; D.circle(ctx, px - 1 * s, py - 1 * s, 0.9 * s); ctx.fill();
              } else if (strips) {
                ctx.fillStyle = deepen(fc, 0.25); chamf(ctx, px + 0.3 * s, py + 0.8 * s, 11 * s * k, 4 * s * k, r, 1 * s); ctx.fill();
                ctx.fillStyle = fc; chamf(ctx, px, py, 11 * s * k, 4 * s * k, r, 1 * s); ctx.fill();
                ctx.strokeStyle = rgba(meat, 0.8); ctx.lineWidth = 1 * s * k; ctx.beginPath(); ctx.moveTo(px - Math.cos(r) * 4 * s, py - Math.sin(r) * 4 * s); ctx.lineTo(px + Math.cos(r) * 4 * s, py + Math.sin(r) * 4 * s); ctx.stroke();
              } else {
                chunk(ctx, px, py, 5 * s * k, 5 * s * k, r, fc, s, 0.25);
                if (i % 3 === 0) { ctx.fillStyle = rgba(meat, 0.8); ctx.fillRect(px - 2.4 * s * k, py + 0.4 * s, 4.8 * s * k, 1 * s); }
              }
            },
          });
          if (rend > 0.1 && !crisp) { ctx.fillStyle = 'rgba(255,245,215,0.35)'; for (let i = 0; i < 5; i++) { D.circle(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 3 + it.id) - 0.5) * R, 1.1 * s); ctx.fill(); } }
        }
        break;
      }
      case 'buckwheat':
      case 'millet': {
        const bw = it.ing === 'buckwheat';
        R = clamp(10 + Math.sqrt(m) * 2.2, 10, 56) * s;
        const wet = clamp(it.hyd / Math.max(1, (it.comp[it.ing] || 1) * 1.2), 0, 1);
        const col = brownedc(bw ? mix('#9b6a3f', '#7d5232', wet) : mix('#efcf62', '#f3e3a4', wet), tb);
        const plump = 1 + wet * 0.35;
        const dk = rgba(deepen(col, 0.3), 0.45);
        if (!bw && wet > 0.5) { ctx.fillStyle = rgba(lighten(col, 0.2), 0.7); D.blob(ctx, x, y, R * 0.92, it.id, 0.15, 12); ctx.fill(); }
        pile(ctx, it, x, y, s, {
          n: m * (bw ? 1.3 : 1.8), R, max: 100, piece(px, py, r, sh) {
            const c2 = shadeHex(col, sh);
            if (bw) {
              // little three-cornered kernels, rounder once cooked
              const k = 2.2 * s * plump;
              ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(px + Math.cos(r) * k + 0.3 * s, py + Math.sin(r) * k + 0.7 * s); ctx.lineTo(px + Math.cos(r + 2.1) * k + 0.3 * s, py + Math.sin(r + 2.1) * k + 0.7 * s); ctx.lineTo(px + Math.cos(r + 4.2) * k + 0.3 * s, py + Math.sin(r + 4.2) * k + 0.7 * s); ctx.closePath(); ctx.fill();
              ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(px + Math.cos(r) * k, py + Math.sin(r) * k); ctx.lineTo(px + Math.cos(r + 2.1) * k, py + Math.sin(r + 2.1) * k); ctx.lineTo(px + Math.cos(r + 4.2) * k, py + Math.sin(r + 4.2) * k); ctx.closePath(); ctx.fill();
            } else {
              const k = 1.3 * s * plump;
              ctx.fillStyle = dk; D.circle(ctx, px + 0.3 * s, py + 0.6 * s, k); ctx.fill();
              ctx.fillStyle = c2; D.circle(ctx, px, py, k); ctx.fill();
            }
          },
        });
        ctx.fillStyle = 'rgba(255,255,240,0.6)';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) { const a = hash(i * 3.3 + it.id) * TAU, rr = Math.sqrt(hash(i * 7.1 + it.id)) * R * 0.9; ctx.rect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.9 * s, 0.6 * s); }
        ctx.fill();
        specks(ctx, it, x, y, R * 0.8, s);
        break;
      }
      default: {
        ctx.fillStyle = dome(ctx, x, y, 14 * s, brownedc(d.color || '#cccccc', tb));
        D.circle(ctx, x, y, 14 * s); ctx.fill();
      }
    }
    return R;
  }

  // ---------------------------------------------------------------- containers (top-down)
  D.containerInnerR = (c) => c.def.r * (c.def.shape === 'plate' ? 0.72 : c.def.shape === 'pan' ? 0.88 : 0.86);
  // where an item sits inside its container (shared by drawing and hit-testing)
  D.itemPos = function (c, it, x, y, s) {
    const inner = D.containerInnerR(c) * s;
    const crepe = it.lump && (it.kind === 'set' ? it.cls : CK.classify(it.comp)) === 'batter' && CK.isCrepe(it.comp);
    const f = it.kind === 'fat' ? 0.3 : it.kind === 'fluid' && !it.lump ? 0 : crepe ? 0.12 : 0.63;
    return { x: x + it.px * inner * f, y: y + it.py * inner * f };
  };

  function rivet(ctx, x, y, r, col) {
    ctx.fillStyle = deepen(col, 0.35); D.circle(ctx, x + r * 0.2, y + r * 0.3, r); ctx.fill();
    ctx.fillStyle = col; D.circle(ctx, x, y, r * 0.9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; D.circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.35); ctx.fill();
  }

  D.container = function (ctx, c, x, y, s, opts) {
    opts = opts || {};
    const r = c.def.r * s;
    const shape = c.def.shape;
    ctx.save();
    // soft contact shadow (skipped while lifted: the hand draws a floating one)
    if (!opts.lifted) {
      ctx.fillStyle = 'rgba(60,34,14,0.10)';
      D.circle(ctx, x + 5 * s, y + 8 * s, r * 1.06);
      ctx.fill();
      ctx.fillStyle = 'rgba(60,34,14,0.16)';
      D.circle(ctx, x + 3.5 * s, y + 5.5 * s, r * 1.0);
      ctx.fill();
    }
    const ha = opts.handleAngle != null ? opts.handleAngle : 0.6;
    if (shape === 'pan') {
      // cast-iron handle with a wooden grip
      ctx.save(); ctx.translate(x, y); ctx.rotate(ha);
      if (!opts.lifted) { ctx.fillStyle = 'rgba(60,34,14,0.14)'; D.rr(ctx, r * 0.9 + 2 * s, -7 * s + 4 * s, r * 1.05, 14 * s, 6 * s); ctx.fill(); }
      const hg = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
      hg.addColorStop(0, '#55504e'); hg.addColorStop(0.45, '#2e2a29'); hg.addColorStop(1, '#1d1a19');
      ctx.fillStyle = hg; D.rr(ctx, r * 0.9, -7 * s, r * 1.05, 14 * s, 6 * s); ctx.fill();
      const wg = ctx.createLinearGradient(0, -5.5 * s, 0, 5.5 * s);
      wg.addColorStop(0, '#b07a4f'); wg.addColorStop(0.5, '#8d5d3a'); wg.addColorStop(1, '#6a432a');
      ctx.fillStyle = wg; D.rr(ctx, r * 1.25, -5.5 * s, r * 0.68, 11 * s, 5.5 * s); ctx.fill();
      ctx.strokeStyle = 'rgba(70,40,20,0.35)'; ctx.lineWidth = 0.8 * s;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * 1.3, (-2.5 + i * 2.2) * s); ctx.bezierCurveTo(r * 1.5, (-3.5 + i * 2.2) * s, r * 1.65, (-1.5 + i * 2.2) * s, r * 1.88, (-2.6 + i * 2.2) * s); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,230,200,0.3)'; D.rr(ctx, r * 1.28, -4.6 * s, r * 0.6, 2.2 * s, 1.1 * s); ctx.fill();
      rivet(ctx, r * 1.2, 0, 2.2 * s, '#c9a46a');
      ctx.fillStyle = '#3a2a1e'; D.circle(ctx, r * 1.82, 0, 2.4 * s); ctx.fill();
      ctx.restore();
      // body
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, '#5d5958'); g.addColorStop(0.7, '#353232'); g.addColorStop(1, '#1f1c1c');
      ctx.fillStyle = g; D.circle(ctx, x, y, r); ctx.fill();
      // rim lip: lit top-left, a cool glint
      ctx.strokeStyle = 'rgba(255,240,220,0.28)'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.97, 3.3, 4.9); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,220,0.12)'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.97, 0.2, 1.4); ctx.stroke();
      // inner wall
      ctx.fillStyle = '#242122'; D.circle(ctx, x, y, r * 0.915); ctx.fill();
      // cooking surface, faintly seasoned
      const g2 = ctx.createRadialGradient(x + r * 0.12, y + r * 0.15, r * 0.05, x, y, r * 0.88);
      g2.addColorStop(0, '#423e3d'); g2.addColorStop(0.75, '#363232'); g2.addColorStop(1, '#2b2828');
      ctx.fillStyle = g2; D.circle(ctx, x, y, r * 0.88); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2 * s; D.circle(ctx, x, y, r * 0.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,220,0.04)'; ctx.lineWidth = 1.5 * s; D.circle(ctx, x, y, r * 0.35); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,220,0.08)'; ctx.lineWidth = 6 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 3.5, 4.3); ctx.stroke();
    } else if (shape === 'pot') {
      const single = c.type === 'saucepan';
      if (single) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ha);
        if (!opts.lifted) { ctx.fillStyle = 'rgba(60,34,14,0.14)'; D.rr(ctx, r * 0.9 + 2 * s, -3 * s, r * 1.0, 14 * s, 6 * s); ctx.fill(); }
        const hg = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
        hg.addColorStop(0, '#d9dee3'); hg.addColorStop(0.5, '#a5adb5'); hg.addColorStop(1, '#7c848c');
        ctx.fillStyle = hg; D.rr(ctx, r * 0.9, -6 * s, r * 0.32, 12 * s, 4 * s); ctx.fill();
        const gg = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
        gg.addColorStop(0, '#5a4a40'); gg.addColorStop(0.5, '#3a3330'); gg.addColorStop(1, '#2a2422');
        ctx.fillStyle = gg; D.rr(ctx, r * 1.15, -7 * s, r * 0.75, 14 * s, 6 * s); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,220,0.18)'; D.rr(ctx, r * 1.2, -5.5 * s, r * 0.62, 2.5 * s, 1.2 * s); ctx.fill();
        ctx.fillStyle = '#1e1a18'; D.circle(ctx, r * 1.78, 0, 2.6 * s); ctx.fill();
        rivet(ctx, r * 1.02, -3 * s, 1.6 * s, '#cfd5da'); rivet(ctx, r * 1.02, 3 * s, 1.6 * s, '#cfd5da');
        ctx.restore();
      } else {
        for (const sg of [-1, 1]) {
          const hx = x + sg * r * 0.92 - (sg < 0 ? 22 * s : 0);
          const hg = ctx.createLinearGradient(0, y - 9 * s, 0, y + 9 * s);
          hg.addColorStop(0, '#c5ccd3'); hg.addColorStop(0.5, '#8a929b'); hg.addColorStop(1, '#5f666e');
          ctx.fillStyle = hg; D.rr(ctx, hx, y - 9 * s, 22 * s, 18 * s, 6 * s); ctx.fill();
          ctx.fillStyle = 'rgba(60,64,70,0.55)'; D.rr(ctx, hx + (sg < 0 ? 5 : 3) * s, y - 4 * s, 14 * s, 8 * s, 4 * s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; D.rr(ctx, hx + 3 * s, y - 8 * s, 16 * s, 2 * s, 1 * s); ctx.fill();
          rivet(ctx, x + sg * r * 0.96, y - 5 * s, 1.7 * s, '#d5dbe0'); rivet(ctx, x + sg * r * 0.96, y + 5 * s, 1.7 * s, '#d5dbe0');
        }
      }
      // brushed steel rim
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.75, '#c2c9d0'); g.addColorStop(1, '#8e969f');
      ctx.fillStyle = g; D.circle(ctx, x, y, r); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.955, 3.2, 5.0); ctx.stroke();
      ctx.strokeStyle = 'rgba(90,98,108,0.45)'; ctx.lineWidth = 1.2 * s; D.circle(ctx, x, y, r * 0.905); ctx.stroke();
      // inner wall and base
      const g2 = ctx.createRadialGradient(x + r * 0.2, y + r * 0.2, r * 0.1, x, y, r * 0.86);
      g2.addColorStop(0, '#d3d9de'); g2.addColorStop(0.7, '#b0b8c0'); g2.addColorStop(1, '#848c95');
      ctx.fillStyle = g2; D.circle(ctx, x, y, r * 0.86); ctx.fill();
      // brushed rings on the base
      ctx.lineWidth = 1 * s;
      for (let i = 1; i <= 5; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(90,98,108,0.12)';
        D.circle(ctx, x + r * 0.05, y + r * 0.06, r * (0.12 * i + 0.04)); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0.35, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,78,88,0.18)'; ctx.lineWidth = 6 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.8, 3.4, 4.8); ctx.stroke();
    } else if (shape === 'bowl' || shape === 'soupbowl') {
      const isBowl = shape === 'bowl';
      const rim = isBowl ? '#efe6d6' : '#fffdf8';
      const band = isBowl ? '#8fb6c9' : '#d9876f';
      ctx.fillStyle = dome(ctx, x, y, r, band, 0.3, 0.25); D.circle(ctx, x, y, r); ctx.fill();
      // little glaze dots on the outside
      ctx.fillStyle = isBowl ? 'rgba(255,255,255,0.45)' : 'rgba(255,240,220,0.5)';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.1; ctx.moveTo(x + Math.cos(a) * r * 0.965 + 1.1 * s, y + Math.sin(a) * r * 0.965); ctx.arc(x + Math.cos(a) * r * 0.965, y + Math.sin(a) * r * 0.965, 1.1 * s, 0, TAU); }
      ctx.fill();
      ctx.fillStyle = rim; D.circle(ctx, x, y, r * 0.93); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.9, 3.3, 4.9); ctx.stroke();
      const g = ctx.createRadialGradient(x + r * 0.15, y + r * 0.2, r * 0.05, x, y, r * 0.86);
      g.addColorStop(0, isBowl ? '#fdfaf3' : '#ffffff'); g.addColorStop(0.75, isBowl ? '#efe6d6' : '#f3f0ea'); g.addColorStop(1, isBowl ? '#d5c8b2' : '#ddd7cd');
      ctx.fillStyle = g; D.circle(ctx, x, y, r * 0.86); ctx.fill();
      if (!isBowl) { ctx.strokeStyle = rgba(band, 0.55); ctx.lineWidth = 1.4 * s; D.circle(ctx, x, y, r * 0.8); ctx.stroke(); }
      // glaze reflection
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.74, 3.6, 4.3); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; D.circle(ctx, x - r * 0.62, y - r * 0.18, 1.6 * s); ctx.fill();
    } else if (shape === 'plate') {
      const g0 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.2, x, y, r);
      g0.addColorStop(0, '#fffdf9'); g0.addColorStop(0.8, '#f6f2ea'); g0.addColorStop(1, '#e4ddd0');
      ctx.fillStyle = g0; D.circle(ctx, x, y, r); ctx.fill();
      ctx.strokeStyle = '#7fa8c4'; ctx.lineWidth = 2.5 * s; D.circle(ctx, x, y, r * 0.92); ctx.stroke();
      ctx.strokeStyle = 'rgba(127,168,196,0.6)'; ctx.lineWidth = 0.9 * s; D.circle(ctx, x, y, r * 0.875); ctx.stroke();
      // a tiny painted sprig pattern between the lines and the well
      ctx.fillStyle = 'rgba(127,168,196,0.55)';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, px = x + Math.cos(a) * r * 0.8, py = y + Math.sin(a) * r * 0.8;
        ctx.moveTo(px + 1.4 * s, py); ctx.arc(px, py, 1.4 * s, 0, TAU);
        const px2 = x + Math.cos(a + 0.12) * r * 0.81, py2 = y + Math.sin(a + 0.12) * r * 0.81;
        ctx.moveTo(px2 + 0.8 * s, py2); ctx.arc(px2, py2, 0.8 * s, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = '#ece6da'; D.circle(ctx, x, y, r * 0.72); ctx.fill();
      const g = ctx.createRadialGradient(x + r * 0.1, y + r * 0.12, r * 0.05, x, y, r * 0.68);
      g.addColorStop(0, '#fffefb'); g.addColorStop(1, '#f5f1e8');
      ctx.fillStyle = g; D.circle(ctx, x, y, r * 0.68); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.965, 3.4, 4.7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0.3, 1.3); ctx.stroke();
    }
    ctx.restore();

    // contents
    D.contents(ctx, c, x, y, s);
  };

  // deep liquid fills the vessel; everything else is placed inside
  D.contents = function (ctx, c, x, y, s) {
    const inner = D.containerInnerR(c) * s;
    const pool = c.pool();
    const deep = pool && pool.mass >= c.def.cover;
    const solids = [];
    ctx.save();
    D.circle(ctx, x, y, inner);
    ctx.clip();
    for (const it of c.items) {
      if (it.kind === 'fat' && !deep) { const q = D.itemPos(c, it, x, y, s); it._sx = q.x; it._sy = q.y; it._sr = D.item(ctx, it, it._sx, it._sy, s); }
    }
    if (deep) drawDeepPool(ctx, c, pool, x, y, inner, s);
    for (const it of c.items) {
      if (it.kind === 'fat' || (it === pool && deep)) continue;
      if (it.kind === 'powder' && deep) continue;
      solids.push(it);
    }
    // fluids/powders first, then solids
    solids.sort((a, b) => order(a) - order(b));
    for (const it of solids) {
      const q = D.itemPos(c, it, x, y, s);
      const px = q.x, py = q.y;
      it._sx = px; it._sy = py;
      ctx.save();
      if (deep) ctx.globalAlpha = 0.85;
      it._sr = D.item(ctx, it, px, py, s);
      ctx.restore();
    }
    if (deep && pool) {
      // translucent water over submerged stuff
      const cls = CK.classify(pool.comp);
      if (cls === 'water') {
        ctx.fillStyle = 'rgba(160,205,235,0.18)'; D.circle(ctx, x, y, inner); ctx.fill();
        // the water line glints over everything
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(x, y, inner * 0.82, 3.5, 4.3); ctx.stroke();
      }
      if (pool.temp > 97 && c._boil) drawBubbles(ctx, x, y, inner, s, cls === 'water' ? 'rgba(255,255,255,0.75)' : 'rgba(255,220,200,0.6)', c._boil, cls);
      const fat = c.fat();
      if (fat) {
        // oil droplets floating on top
        for (let i = 0; i < 8; i++) {
          const fx = x + (hash(i + fat.id) - 0.5) * inner * 1.4, fy = y + (hash(i * 3 + fat.id) - 0.5) * inner * 1.4;
          const fr = (2.6 + hash(i * 5 + fat.id) * 2.4) * s;
          ctx.fillStyle = rgba('#f0dc6a', 0.3); D.ellipse(ctx, fx, fy, fr * 1.5, fr, i); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,180,0.45)'; ctx.lineWidth = 0.7 * s; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,240,0.6)'; D.circle(ctx, fx - fr * 0.45, fy - fr * 0.3, fr * 0.28); ctx.fill();
        }
      }
    }
    ctx.restore();
  };
  function order(it) {
    if (it.kind === 'fluid') return 0;
    if (it.kind === 'powder') return 1;
    if (it.kind === 'set' || (it.ing === 'egg' && it.form === 'cracked')) return 2;
    return CK.isBulk(it) ? 2.5 : 3;
  }

  function drawDeepPool(ctx, c, pool, x, y, inner, s) {
    const cls = CK.classify(pool.comp);
    let col = fluidColor(pool);
    let alpha = 0.95;
    if (cls === 'water') { col = '#a9d3ec'; alpha = 0.6; }
    if (cls === 'beet') { col = deepen(mix(col, '#9a1232', 0.35), 0.08); alpha = 0.97; }
    const fill = clamp(pool.mass / (c.def.cap * 0.75), 0.35, 1);
    const pr = inner * (0.9 + fill * 0.1);
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - inner * 0.3, y - inner * 0.3, inner * 0.1, x, y, inner);
    g.addColorStop(0, mix(col, '#ffffff', cls === 'water' ? 0.35 : 0.25));
    g.addColorStop(0.7, col);
    g.addColorStop(1, browned(deepen(col, cls === 'water' ? 0.05 : 0.12), Math.min(pool.brownDown, 3)));
    ctx.fillStyle = g;
    D.circle(ctx, x, y, pr);
    ctx.fill();
    ctx.globalAlpha = 1;
    // meniscus where the liquid meets the wall
    ctx.strokeStyle = cls === 'water' ? 'rgba(255,255,255,0.4)' : rgba(lighten(col, 0.3), 0.45);
    ctx.lineWidth = 1.5 * s;
    D.circle(ctx, x, y, pr - 1 * s); ctx.stroke();
    const t = now() / 1000;
    if (cls === 'water') {
      // soft caustic ripples
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.4 * s;
      for (let i = 0; i < 3; i++) {
        const a = hash(i * 3.1 + pool.id) * TAU, rr = inner * (0.25 + hash(i * 1.3 + pool.id) * 0.35);
        const cx = x + Math.cos(a) * rr * 0.5, cy = y + Math.sin(a) * rr * 0.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.5 + Math.sin(t * 0.8 + i) * 2 * s, rr * 0.28, a, 0.3, 2.4); ctx.stroke();
      }
    } else if (cls === 'tomato') {
      ctx.fillStyle = 'rgba(120,20,10,0.25)';
      for (let i = 0; i < 20; i++) { D.circle(ctx, x + (hash(i + pool.id) - 0.5) * inner * 1.5, y + (hash(i * 3 + pool.id) - 0.5) * inner * 1.5, 2.5 * s); ctx.fill(); }
      ctx.fillStyle = 'rgba(250,120,80,0.35)';
      for (let i = 0; i < 10; i++) { D.ellipse(ctx, x + (hash(i * 7 + pool.id) - 0.5) * inner * 1.4, y + (hash(i * 9 + pool.id) - 0.5) * inner * 1.4, 2.2 * s, 1.3 * s, i); ctx.fill(); }
      // glossy oil glints on a sauce
      ctx.fillStyle = 'rgba(255,200,120,0.35)';
      for (let i = 0; i < 4; i++) { D.ellipse(ctx, x + (hash(i * 13 + pool.id) - 0.5) * inner, y + (hash(i * 17 + pool.id) - 0.5) * inner, 3.2 * s, 2 * s, i); ctx.fill(); }
    } else if (cls === 'beet') {
      // ruby broth: a few darker swirls and warm glints
      ctx.strokeStyle = rgba(deepen(col, 0.25), 0.35); ctx.lineWidth = 2 * s;
      for (let i = 0; i < 3; i++) { const a = hash(i * 5.3 + pool.id) * TAU, rr = inner * (0.2 + hash(i * 2.1 + pool.id) * 0.4); ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr * 0.4, y + Math.sin(a) * rr * 0.4, rr, a, a + 1.6); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,170,150,0.25)';
      for (let i = 0; i < 6; i++) { D.ellipse(ctx, x + (hash(i * 13 + pool.id) - 0.5) * inner * 1.3, y + (hash(i * 17 + pool.id) - 0.5) * inner * 1.3, 3 * s, 1.8 * s, i); ctx.fill(); }
    } else if (cls === 'cream') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; D.ellipse(ctx, x - inner * 0.25, y - inner * 0.3, inner * 0.3, inner * 0.12, -0.6); ctx.fill();
      ctx.strokeStyle = 'rgba(230,220,200,0.6)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(x, y, inner * 0.4, 0.3, 2.6); ctx.stroke();
    } else if (cls === 'curd' || cls === 'potato') {
      if (cls === 'curd') curdTexture(ctx, pool, x, y, inner * 0.8, s * 1.3);
      else potatoShreds(ctx, pool, x, y, inner * 0.85, s * 1.3, col, 70);
    } else if (cls === 'batter' || cls === 'eggs' || cls === 'dough' || cls === 'mixture') {
      if (pool.smooth < 0.6 && cls !== 'eggs') {
        // lumpy: flour clumps sitting on the surface
        const n = Math.round((1 - pool.smooth) * 26);
        for (let i = 0; i < n; i++) {
          const a = hash(i * 3.3 + pool.id) * TAU, rr = Math.sqrt(hash(i * 1.9 + pool.id)) * inner * 0.8;
          const r = (1.8 + hash(i) * 2.4) * s, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          ctx.fillStyle = 'rgba(150,115,60,0.25)'; D.circle(ctx, px + 0.5 * s, py + 1 * s, r); ctx.fill();
          ctx.fillStyle = '#f8f3e8'; D.circle(ctx, px, py, r); ctx.fill();
          ctx.fillStyle = '#ffffff'; D.circle(ctx, px - r * 0.3, py - r * 0.3, r * 0.4); ctx.fill();
        }
      } else if (pool.smooth < 0.6) {
        // eggs not yet beaten: glossy whites and whole yolks floating
        for (let i = 0; i < 6; i++) {
          const a = hash(i * 4.3 + pool.id) * TAU, rr = hash(i * 2.9 + pool.id) * inner * 0.6;
          ctx.fillStyle = 'rgba(255,255,240,0.6)'; D.blob(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 7 * s, i + pool.id, 0.4, 8); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(240,150,20,0.45)'; ctx.lineWidth = 2.5 * s;
        for (let i = 0; i < 3; i++) { const a = hash(i * 8.1 + pool.id) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * inner * 0.3, y + Math.sin(a) * inner * 0.3, inner * 0.25, a, a + 1.7); ctx.stroke(); }
      } else {
        // smooth: a gentle whisked ribbon
        ctx.strokeStyle = rgba(lighten(col, 0.35), 0.4); ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(x + inner * 0.05, y + inner * 0.05, inner * 0.45, 0.4, 2.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - inner * 0.08, y, inner * 0.25, 3.4, 5.6); ctx.stroke();
        ctx.strokeStyle = rgba(deepen(col, 0.15), 0.25); ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); ctx.arc(x + inner * 0.05, y + inner * 0.08, inner * 0.47, 0.5, 2.7); ctx.stroke();
      }
    } else if (cls === 'milk') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; D.ellipse(ctx, x - inner * 0.25, y - inner * 0.3, inner * 0.3, inner * 0.12, -0.6); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x, y, inner * 0.8, 3.6, 4.4); ctx.stroke();
    shine(ctx, x - inner * 0.42, y - inner * 0.5, 2.2 * s, 1.3 * s, -0.6, 0.6);
  }

  function drawBubbles(ctx, x, y, inner, s, col, intensity, cls) {
    const t = now() / 1000;
    const n = Math.round(6 + intensity * 26);
    // a rolling boil heaves the surface
    if (intensity > 0.5) {
      ctx.fillStyle = cls === 'water' ? 'rgba(255,255,255,0.12)' : 'rgba(255,230,210,0.12)';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        const a = hash(i * 9.1 + Math.floor(t * 0.9 + i / 3)) * TAU, rr = Math.sqrt(hash(i * 4.4 + Math.floor(t * 0.9 + i / 3))) * inner * 0.6;
        D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (6 + ph * 14) * s * intensity); ctx.fill();
      }
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3 * s;
    const hl = cls === 'water' ? 'rgba(255,255,255,0.85)' : 'rgba(255,240,225,0.75)';
    for (let i = 0; i < n; i++) {
      const ph = (t * (0.8 + hash(i) * 1.2) + hash(i * 7)) % 1;
      const a = hash(i * 3.3 + Math.floor(t + hash(i))) * 6.28;
      const rr = Math.sqrt(hash(i * 5.7 + Math.floor(t + hash(i)))) * inner * 0.9;
      const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr, br = (1 + ph * 4) * s;
      ctx.globalAlpha = ph > 0.85 ? (1 - ph) / 0.15 : 1;
      D.circle(ctx, bx, by, br);
      ctx.stroke();
      ctx.fillStyle = hl;
      D.circle(ctx, bx - br * 0.35, by - br * 0.35, Math.max(0.4 * s, br * 0.25)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- front views (wall storage)
  D.hangingPan = function (ctx, c, x, y, s) {
    // hanging on a hook: you see the inside of the pan face-on, handle up
    ctx.save();
    ctx.strokeStyle = '#6b5a4c'; ctx.lineWidth = 3;
    D.container(ctx, c, x, y, s, { handleAngle: -Math.PI / 2 });
    ctx.restore();
  };

  // ---------------------------------------------------------------- the diner
  D.diner = function (ctx, d, mood, x, y, s, t) {
    const L = d.look;
    t = t || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const skin = L.skin, skinDk = deepen(skin, 0.22), skinLt = lighten(skin, 0.25);
    const hairLt = lighten(L.hair, 0.25), hairDk = deepen(L.hair, 0.25);
    const breathe = Math.sin(t * 1.6) * 0.8;
    // body
    const sg = ctx.createLinearGradient(-70, 66, 70, 140);
    sg.addColorStop(0, lighten(L.shirt, 0.18)); sg.addColorStop(1, deepen(L.shirt, 0.18));
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.moveTo(-70, 140); ctx.quadraticCurveTo(-70, 70 - breathe, 0, 66 - breathe); ctx.quadraticCurveTo(70, 70 - breathe, 70, 140); ctx.closePath(); ctx.fill();
    // shoulder folds
    ctx.strokeStyle = rgba(deepen(L.shirt, 0.3), 0.35); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-44, 100); ctx.quadraticCurveTo(-40, 116, -46, 136); ctx.moveTo(44, 100); ctx.quadraticCurveTo(40, 116, 46, 136); ctx.stroke();
    // neck with a soft shadow under the chin
    ctx.fillStyle = shadeHex(skin, 0.92); ctx.fillRect(-12, 38, 24, 32);
    ctx.fillStyle = rgba(skinDk, 0.45); ctx.beginPath(); ctx.ellipse(0, 46, 13, 7, 0, 0, Math.PI); ctx.fill();
    // collar
    ctx.fillStyle = deepen(L.shirt, 0.18);
    ctx.beginPath(); ctx.moveTo(-14, 68); ctx.lineTo(0, 88); ctx.lineTo(14, 68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lighten(L.shirt, 0.3);
    ctx.beginPath(); ctx.moveTo(-18, 66); ctx.lineTo(-2, 86); ctx.lineTo(-10, 88); ctx.lineTo(-24, 70); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, 66); ctx.lineTo(2, 86); ctx.lineTo(10, 88); ctx.lineTo(24, 70); ctx.closePath(); ctx.fill();
    // hair back
    if (L.hairStyle === 'long') {
      const hg = ctx.createLinearGradient(0, -40, 0, 80);
      hg.addColorStop(0, L.hair); hg.addColorStop(1, hairDk);
      ctx.fillStyle = hg; D.rr(ctx, -52, -40, 104, 120, 40); ctx.fill();
    }
    // head
    const bob = Math.sin(t * 2) * 1.5;
    ctx.translate(0, bob);
    // ears
    ctx.fillStyle = skin;
    D.ellipse(ctx, -46, 4, 8, 12); ctx.fill(); D.ellipse(ctx, 46, 4, 8, 12); ctx.fill();
    ctx.fillStyle = rgba(skinDk, 0.5);
    D.ellipse(ctx, -46, 5, 4, 7); ctx.fill(); D.ellipse(ctx, 46, 5, 4, 7); ctx.fill();
    const hgr = ctx.createRadialGradient(-14, -18, 6, 0, 0, 56);
    hgr.addColorStop(0, skinLt); hgr.addColorStop(0.6, skin); hgr.addColorStop(1, shadeHex(skin, 0.9));
    ctx.fillStyle = hgr; D.ellipse(ctx, 0, 0, 46, 52); ctx.fill();
    if (L.earrings) {
      for (const ex of [-47, 47]) {
        ctx.fillStyle = '#d9a93a'; D.circle(ctx, ex, 18, 4.2); ctx.fill();
        ctx.fillStyle = '#f7d878'; D.circle(ctx, ex - 0.8, 17.2, 3); ctx.fill();
        ctx.fillStyle = '#ffffff'; D.circle(ctx, ex - 1.4, 16.4, 1); ctx.fill();
      }
    }
    // hair
    const hairFill = () => { const g = ctx.createLinearGradient(-40, -60, 40, 0); g.addColorStop(0, hairLt); g.addColorStop(0.5, L.hair); g.addColorStop(1, hairDk); return g; };
    ctx.fillStyle = hairFill();
    ctx.strokeStyle = rgba(lighten(L.hair, 0.45), 0.55); ctx.lineWidth = 2;
    if (L.hairStyle === 'bald') {
      ctx.beginPath(); ctx.ellipse(-38, -6, 10, 20, 0.3, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(38, -6, 10, 20, -0.3, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(-38, -6, 7, 3.6, 4.6); ctx.stroke(); ctx.beginPath(); ctx.arc(38, -6, 7, 4.8, 5.8); ctx.stroke();
      // a shiny head
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; D.ellipse(ctx, -14, -38, 12, 6, -0.3); ctx.fill();
    } else if (L.hairStyle === 'bun') {
      D.circle(ctx, 0, -62, 20); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -26, 48, 32, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -62, 14, 3.4, 5.0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-6, -24, 36, 3.6, 4.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -24, 36, 5.0, 5.8); ctx.stroke();
      ctx.fillStyle = rgba(hairDk, 0.8); D.rr(ctx, -12, -46, 24, 6, 3); ctx.fill();
    } else if (L.hairStyle === 'messy') {
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; D.circle(ctx, Math.cos(a) * 38, -18 + Math.sin(a) * 34, 16); ctx.fill(); }
      for (let i = 1; i < 8; i += 2) { const a = Math.PI + (i / 8) * Math.PI; ctx.beginPath(); ctx.arc(Math.cos(a) * 38, -18 + Math.sin(a) * 34, 10, a - 0.8, a + 0.2); ctx.stroke(); }
    } else if (L.hairStyle === 'long') {
      ctx.beginPath(); ctx.ellipse(0, -24, 50, 34, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, -22, 38, 3.5, 4.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(-2, -20, 30, 3.6, 4.2); ctx.stroke();
    }
    // face
    const ey = -2;
    ctx.fillStyle = '#2b2220';
    ctx.strokeStyle = '#2b2220';
    ctx.lineWidth = 3;
    const blink = (t % 4) > 3.85;
    if (mood === 'great') {
      ctx.beginPath(); ctx.arc(-16, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(16, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (blink) {
      ctx.beginPath(); ctx.moveTo(-22, ey); ctx.lineTo(-10, ey); ctx.moveTo(10, ey); ctx.lineTo(22, ey); ctx.stroke();
    } else {
      const er = mood === 'bad' ? 4 : 4.5;
      D.ellipse(ctx, -16, ey, er, er * 1.18); ctx.fill(); D.ellipse(ctx, 16, ey, er, er * 1.18); ctx.fill();
      ctx.fillStyle = '#5a3a2a'; D.ellipse(ctx, -16, ey + 1.5, er * 0.6, er * 0.5); ctx.fill(); D.ellipse(ctx, 16, ey + 1.5, er * 0.6, er * 0.5); ctx.fill();
      ctx.fillStyle = '#fff'; D.circle(ctx, -14.5, ey - 1.8, 1.6); ctx.fill(); D.circle(ctx, 17.5, ey - 1.8, 1.6); ctx.fill();
      D.circle(ctx, -17.5, ey + 2, 0.7); ctx.fill(); D.circle(ctx, 14.5, ey + 2, 0.7); ctx.fill();
    }
    // brows
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = L.hairStyle === 'bald' ? '#bdb6aa' : deepen(L.hair, 0.1);
    const bt = mood === 'bad' ? 4 : mood === 'ok' ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(-24, ey - 12 - bt); ctx.quadraticCurveTo(-17, ey - 15.5, -9, ey - 14 + bt); ctx.moveTo(9, ey - 14 + bt); ctx.quadraticCurveTo(17, ey - 15.5, 24, ey - 12 - bt); ctx.stroke();
    if (L.glasses) {
      ctx.fillStyle = 'rgba(200,225,240,0.18)';
      D.circle(ctx, -16, ey, 11); ctx.fill(); D.circle(ctx, 16, ey, 11); ctx.fill();
      ctx.strokeStyle = '#5b4a3c'; ctx.lineWidth = 2.2;
      D.circle(ctx, -16, ey, 11); ctx.stroke(); D.circle(ctx, 16, ey, 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, ey); ctx.quadraticCurveTo(0, ey - 3, 5, ey); ctx.moveTo(-27, ey - 1); ctx.lineTo(-44, ey - 3); ctx.moveTo(27, ey - 1); ctx.lineTo(44, ey - 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-16, ey, 8, 3.7, 4.4); ctx.stroke(); ctx.beginPath(); ctx.arc(16, ey, 8, 3.7, 4.4); ctx.stroke();
    }
    if (L.freckles) { ctx.fillStyle = 'rgba(170,90,50,0.5)'; for (let i = 0; i < 6; i++) { D.circle(ctx, (i < 3 ? -20 : 14) + (i % 3) * 4, 14 + (i % 2) * 3, 1.3); ctx.fill(); } }
    // cheeks: always a little rosy, glowing when happy
    const blush = mood === 'great' ? 0.38 : mood === 'good' ? 0.3 : mood === 'bad' ? 0.06 : 0.14;
    ctx.fillStyle = `rgba(240,110,100,${blush})`; D.ellipse(ctx, -27, 16, 8.5, 5.2); ctx.fill(); D.ellipse(ctx, 27, 16, 8.5, 5.2); ctx.fill();
    if (blush > 0.2) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; D.circle(ctx, -29, 14, 1.4); ctx.fill(); D.circle(ctx, 25, 14, 1.4); ctx.fill(); }
    // nose
    ctx.fillStyle = rgba(skinDk, 0.35); D.ellipse(ctx, 1, 13, 5, 3); ctx.fill();
    ctx.strokeStyle = shadeHex(skin, 0.75); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(5, 14, -2, 15); ctx.stroke();
    ctx.fillStyle = rgba(skinLt, 0.7); D.circle(ctx, -1, 9, 1.5); ctx.fill();
    // mouth
    ctx.strokeStyle = '#6b2b26'; ctx.lineWidth = 3;
    const my = 28;
    if (mood === 'great') {
      ctx.fillStyle = '#7a2d2a'; ctx.beginPath(); ctx.arc(0, my - 4, 13, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.moveTo(-11, my - 2.6); ctx.lineTo(11, my - 2.6); ctx.lineTo(10, my); ctx.lineTo(-10, my); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e46a6a'; D.ellipse(ctx, 0, my + 5, 6, 3); ctx.fill();
    } else if (mood === 'good') { ctx.beginPath(); ctx.arc(0, my - 6, 11, 0.4, Math.PI - 0.4); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, my - 2); ctx.lineTo(-12.5, my - 4); ctx.moveTo(11, my - 2); ctx.lineTo(12.5, my - 4); ctx.stroke(); }
    else if (mood === 'ok') { ctx.beginPath(); ctx.moveTo(-9, my); ctx.quadraticCurveTo(0, my + 2, 10, my - 2); ctx.stroke(); }
    else if (mood === 'bad') {
      ctx.beginPath(); ctx.arc(0, my + 9, 10, Math.PI + 0.5, -0.5); ctx.stroke();
      const dg = ctx.createLinearGradient(36, -22, 36, -6);
      dg.addColorStop(0, 'rgba(200,230,250,0.9)'); dg.addColorStop(1, 'rgba(110,170,225,0.9)');
      ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(36, -22); ctx.quadraticCurveTo(42, -10, 36, -6); ctx.quadraticCurveTo(30, -10, 36, -22); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; D.circle(ctx, 34.5, -11, 1.2); ctx.fill();
    } else if (mood === 'chew') {
      const o = Math.abs(Math.sin(t * 9)) * 5;
      ctx.fillStyle = '#7a2d2a'; D.ellipse(ctx, 0, my, 7, 2 + o); ctx.fill();
      ctx.fillStyle = rgba(skinDk, 0.25); D.ellipse(ctx, -20, 22 + o * 0.3, 6, 4 + o * 0.3); ctx.fill(); D.ellipse(ctx, 20, 22 + o * 0.3, 6, 4 + o * 0.3); ctx.fill();
    } else { ctx.beginPath(); ctx.arc(0, my - 5, 9, 0.5, Math.PI - 0.5); ctx.stroke(); }
    if (L.mustache) {
      ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.ellipse(-9, my - 8, 11, 5, 0.25, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, my - 8, 11, 5, -0.25, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(170,160,150,0.6)'; ctx.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(i * 3, my - 11); ctx.lineTo(i * 3.6, my - 5); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; D.ellipse(ctx, -11, my - 10, 4, 1.5, 0.25); ctx.fill(); D.ellipse(ctx, 7, my - 10, 4, 1.5, -0.25); ctx.fill();
    }
    ctx.restore();
  };
})();
