// Procedural drawing of food, containers and the diner. Everything is drawn from the simulation
// state, so cooking changes are visible: whites setting, browning, liquid reducing, etc.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, hash, mix, browned, rgba } = CK;
  const D = (CK.D = {});

  D.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
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
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = hash(it.id * 7 + i * 3.1 + k.length) * Math.PI * 2;
        const rr = Math.sqrt(hash(it.id * 11 + i * 1.7 + k.length)) * R * 0.85;
        ctx.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.6 * s, 1.6 * s);
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

  function shadeHex(hex, f) {
    const [r, g, b] = CK.hex2rgb(hex);
    return CK.rgb2hex(r * f, g * f, b * f);
  }

  // ---------------------------------------------------------------- items
  // Returns an approximate radius for hit testing.
  D.item = function (ctx, it, x, y, s, inPool) {
    s = s || 1;
    ctx.save();
    let R = 14 * s;
    if (it.kind === 'fat') R = drawFat(ctx, it, x, y, s);
    else if (it.kind === 'powder') R = drawPowder(ctx, it, x, y, s);
    else if (it.kind === 'fluid') R = drawThinFluid(ctx, it, x, y, s);
    else if (it.kind === 'set') R = drawSet(ctx, it, x, y, s);
    else R = drawSolid(ctx, it, x, y, s);
    ctx.restore();
    return R;
  };

  function drawFat(ctx, it, x, y, s) {
    const b = it.comp.butter || 0, o = it.comp.oil || 0, m = b + o;
    const R = clamp(10 + Math.sqrt(m) * 5, 10, 70) * s;
    if (b > o && it.temp < 30) {
      // butter pats
      const n = clamp(Math.round(b / 5), 1, 4);
      for (let i = 0; i < n; i++) {
        const px = x + (i - (n - 1) / 2) * 13 * s, py = y + (i % 2) * 6 * s;
        ctx.fillStyle = '#f6dc7a';
        D.rr(ctx, px - 6 * s, py - 5 * s, 12 * s, 10 * s, 2 * s);
        ctx.fill();
        ctx.fillStyle = '#fbeaa8';
        ctx.fillRect(px - 5 * s, py - 4 * s, 8 * s, 2 * s);
      }
      return 14 * s;
    }
    const col = browned(b > o ? '#f2d36a' : '#d8c24c', it.brownDown * 0.9);
    ctx.globalAlpha = b > o ? 0.75 : 0.42;
    ctx.fillStyle = col;
    D.blob(ctx, x, y, R, it.id, 0.25, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (b > 0 && it.temp > 95 && it.temp < 170) {
      // foaming butter
      ctx.fillStyle = 'rgba(255,250,225,0.8)';
      const t = performance.now() / 300;
      for (let i = 0; i < 10; i++) {
        const a = hash(i * 3 + it.id) * 6.28 + t * 0.1;
        const rr = hash(i * 7 + it.id) * R * 0.8;
        D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1.2 + Math.sin(t + i) * 0.6) * s);
        ctx.fill();
      }
    }
    // shine
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(x - R * 0.2, y - R * 0.2, R * 0.5, 3.6, 4.6);
    ctx.stroke();
    return R;
  }

  function drawPowder(ctx, it, x, y, s) {
    const m = it.mass;
    const pairs = Object.keys(it.comp).map((k) => [(CK.ING[k] || {}).color || '#eeeeee', it.comp[k]]);
    const col = browned(CK.mixMany(pairs), it.brownDown * 0.8);
    const R = clamp(4 + Math.sqrt(m) * 3.2, 4, 46) * s;
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 1, x, y, R);
    g.addColorStop(0, mix(col, '#ffffff', 0.4));
    g.addColorStop(1, shadeHex(col, 0.85));
    ctx.fillStyle = g;
    D.blob(ctx, x, y, R, it.id, 0.3, 10);
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
      let w = c[k];
      if (k === 'water') continue; // water is clear: it only dilutes the other colours
      if (k === 'pepper' || k === 'chili') w *= 0.3;
      pairs.push([col, w]);
    }
    if (!pairs.length) return CK.ING.water.color;
    const tot = CK.sum(Object.values(c)) || 1;
    return mix(CK.mixMany(pairs), '#ffffff', clamp(((c.water || 0) / tot - 0.5) * 0.5, 0, 0.3));
  }
  D.fluidColor = fluidColor;

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
    // browned edge
    if (it.brownDown > 0.2) {
      ctx.fillStyle = browned(col, it.brownDown);
      D.blob(ctx, x, y, R + 2.5 * s, it.id, 0.12, 16);
      ctx.fill();
    }
    ctx.fillStyle = col;
    D.blob(ctx, x, y, R, it.id, 0.12, 16);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (it.smooth < 0.6 && (cls === 'batter' || cls === 'dough')) {
      ctx.fillStyle = '#f7f2e6';
      for (let i = 0; i < (1 - it.smooth) * 20; i++) {
        const a = hash(i * 3.3 + it.id) * 6.28, rr = Math.sqrt(hash(i * 1.9 + it.id)) * R * 0.85;
        D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1.5 + hash(i) * 2) * s);
        ctx.fill();
      }
    }
    if (cls === 'eggs' && it.smooth < 0.6) {
      ctx.fillStyle = 'rgba(255,255,240,0.7)';
      for (let i = 0; i < 6; i++) {
        const a = hash(i * 4.3 + it.id) * 6.28, rr = hash(i * 2.9 + it.id) * R * 0.7;
        D.blob(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 5 * s, i + it.id, 0.4, 8);
        ctx.fill();
      }
    }
    if (cls === 'batter' && it.cook > 0.12) {
      // bubbles appear as the pancake cooks
      const n = Math.round(clamp((it.cook - 0.12) * 80, 0, 25));
      for (let i = 0; i < n; i++) {
        const a = hash(i * 2.7 + it.id) * 6.28, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.85;
        ctx.strokeStyle = 'rgba(160,120,60,0.55)';
        ctx.lineWidth = 1 * s;
        D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1.2 + hash(i * 7) * 1.8) * s);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(x - R * 0.15, y - R * 0.15, R * 0.6, 3.5, 4.5);
    ctx.stroke();
    return R;
  }

  function drawSet(ctx, it, x, y, s) {
    const m = it.mass;
    if (it.form === 'scrambled') {
      const R = clamp(8 + Math.sqrt(m) * 3, 8, 60) * s;
      const base = it.cls === 'eggs'
        ? mix('#f9dc6b', '#f3e4a0', clamp((it.cook - 0.5) / 1.2, 0, 1))
        : it.cls === 'batter' ? '#f0d39a' : '#e7d3a8';
      pile(ctx, it, x, y, s, {
        n: m / 3, R, max: 45,
        piece(px, py, rot, sh) {
          ctx.fillStyle = browned(shadeHex(base, sh), topBrown(it) * (0.6 + sh * 0.4));
          D.blob(ctx, px, py, (5 + sh * 3) * s, px + py, 0.5, 7);
          ctx.fill();
        },
      });
      if (it.cls === 'eggs' && it.cook < 1.1) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 6; i++) { D.circle(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 3 + it.id) - 0.5) * R, 2 * s); ctx.fill(); }
      }
      specks(ctx, it, x, y, R, s);
      return R;
    }
    const R = clamp(10 + Math.sqrt(m) * 3.0, 10, 72) * s;
    let base;
    if (it.cls === 'batter') base = '#f2dfae';
    else if (it.cls === 'eggs') base = '#f8d65a';
    else base = '#e8d6ae';
    // underside edge shows through
    ctx.fillStyle = browned(base, it.brownDown);
    D.blob(ctx, x, y, R + 2 * s, it.id, 0.08, 18);
    ctx.fill();
    ctx.fillStyle = browned(base, it.brownUp);
    D.blob(ctx, x, y, R, it.id, 0.08, 18);
    ctx.fill();
    if (it.cls === 'batter' && it.brownUp < 0.3) {
      for (let i = 0; i < 18; i++) {
        const a = hash(i * 2.7 + it.id) * 6.28, rr = Math.sqrt(hash(i * 5.1 + it.id)) * R * 0.85;
        ctx.strokeStyle = 'rgba(150,110,60,0.5)';
        ctx.lineWidth = 1 * s;
        D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1.2 + hash(i * 7) * 1.8) * s);
        ctx.stroke();
      }
    }
    if (it.cls === 'batter' && it.brownUp >= 0.3) {
      // golden mottling
      ctx.fillStyle = rgba(browned(base, it.brownUp + 0.4), 0.35);
      for (let i = 0; i < 10; i++) {
        D.blob(ctx, x + (hash(i + it.id) - 0.5) * R, y + (hash(i * 2 + it.id) - 0.5) * R, R * 0.25, i, 0.4, 8);
        ctx.fill();
      }
    }
    if (it.cls === 'eggs') {
      ctx.strokeStyle = rgba('#d9a43a', 0.5);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(x, y, R * 0.6, 0.5, 2.6); ctx.stroke();
    }
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
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          D.ellipse(ctx, x + 2 * s, y + 3 * s, 13 * s, 17 * s, rot);
          ctx.fill();
          const col = form === 'peeled' ? '#fbf8f0' : browned('#efd9bd', tb);
          const g = ctx.createRadialGradient(x - 4 * s, y - 6 * s, 1, x, y, 18 * s);
          g.addColorStop(0, mix(col, '#ffffff', 0.5));
          g.addColorStop(1, col);
          ctx.fillStyle = g;
          D.ellipse(ctx, x, y, 13 * s, 17 * s, rot);
          ctx.fill();
          if (form === 'whole' && it.method === 'boiled') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            D.ellipse(ctx, x - 3 * s, y - 6 * s, 4 * s, 6 * s, rot); ctx.fill();
          }
          R = 17 * s;
        } else if (form === 'cracked') {
          const r = 26 * Math.sqrt(m / 50) * s;
          const flipped = it.flips % 2 === 1;
          const setA = clamp(0.35 + ck * 0.9, 0.35, 1);
          // lacy browned edge from the bottom
          if (it.brownDown > 0.15 && !flipped) {
            ctx.fillStyle = browned('#f6eedd', it.brownDown * 1.1);
            D.blob(ctx, x, y, r + 3 * s, it.id, 0.28, 18);
            ctx.fill();
          }
          ctx.fillStyle = flipped ? browned('#fffdf6', it.brownUp) : rgba('#fffdf6', setA);
          if (ck < 0.3 && !flipped) ctx.fillStyle = rgba('#f4f0e2', 0.55);
          D.blob(ctx, x, y, r, it.id, 0.22, 18);
          ctx.fill();
          // yolk
          const yx = x + (hash(it.id) - 0.5) * r * 0.4, yy = y + (hash(it.id * 2) - 0.5) * r * 0.4;
          const yr = 10 * Math.sqrt(m / 50) * s;
          let yc = ck < 1.3 ? '#f7a90d' : mix('#f7a90d', '#f3cf61', clamp((ck - 1.3) / 0.8, 0, 1));
          if (flipped) yc = mix(yc, '#fffdf2', 0.55);
          if (it.method === 'poached') yc = mix(yc, '#fffdf2', 0.5);
          ctx.fillStyle = yc;
          D.circle(ctx, yx, yy, yr);
          ctx.fill();
          if (ck < 1.3 && !flipped) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            D.circle(ctx, yx - yr * 0.35, yy - yr * 0.35, yr * 0.3);
            ctx.fill();
          }
          specks(ctx, it, x, y, r, s);
          R = r;
        } else if (form === 'halved') {
          for (const sgn of [-1, 1]) {
            const px = x + sgn * 9 * s;
            ctx.fillStyle = '#fbf8f0';
            D.ellipse(ctx, px, y, 9 * s, 14 * s, 0); ctx.fill();
            ctx.fillStyle = ck < 1.2 ? '#f6a81a' : '#f2cf5c';
            D.circle(ctx, px, y, 5 * s); ctx.fill();
          }
          R = 18 * s;
        } else {
          R = 14 * s + Math.sqrt(m) * s;
          pile(ctx, it, x, y, s, {
            n: 24, R, piece(px, py, r, sh, i) {
              ctx.fillStyle = i % 3 === 0 ? '#f3cd52' : shadeHex('#fbf8f0', sh);
              ctx.fillRect(px - 2.5 * s, py - 2.5 * s, 5 * s, 5 * s);
            },
          });
        }
        break;
      }
      case 'onion': {
        const flesh = browned(mix('#f5eedf', '#ead9a5', clamp(ck / 1.5, 0, 1)), tb);
        if (form === 'whole') {
          const g = ctx.createRadialGradient(x - 6 * s, y - 6 * s, 2, x, y, 24 * s);
          g.addColorStop(0, '#e8b877'); g.addColorStop(1, browned('#b97a3a', tb * 0.6));
          ctx.fillStyle = g; D.circle(ctx, x, y, 24 * s); ctx.fill();
          ctx.strokeStyle = 'rgba(120,70,30,0.35)'; ctx.lineWidth = 1 * s;
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x, y, 24 * s, i * 1.25, i * 1.25 + 0.6); ctx.stroke(); }
          ctx.fillStyle = '#8a5a2b'; D.circle(ctx, x, y, 2.5 * s); ctx.fill();
          R = 24 * s;
        } else if (form === 'halved') {
          ctx.fillStyle = '#c98a48'; D.circle(ctx, x, y, 23 * s); ctx.fill();
          ctx.fillStyle = flesh; D.circle(ctx, x, y, 21 * s); ctx.fill();
          ctx.strokeStyle = rgba(shadeHex(flesh, 0.85), 0.8); ctx.lineWidth = 1.2 * s;
          for (let r = 4; r < 21; r += 4) { D.circle(ctx, x, y, r * s); ctx.stroke(); }
          R = 23 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.2, 10, 50) * s;
          const sz = form === 'sliced' ? 7 : form === 'chopped' ? 4.5 : form === 'diced' ? 3.5 : 2;
          pile(ctx, it, x, y, s, {
            n: m / (sz * 0.8), R, max: 70, piece(px, py, r, sh) {
              ctx.fillStyle = shadeHex(flesh, sh);
              ctx.save(); ctx.translate(px, py); ctx.rotate(r);
              if (form === 'sliced') { ctx.strokeStyle = shadeHex(flesh, sh * 0.95); ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, 2.2); ctx.stroke(); }
              else ctx.fillRect(-sz * s / 2, -sz * s / 2, sz * s, sz * s);
              ctx.restore();
            },
          });
        }
        break;
      }
      case 'garlic': {
        const flesh = browned(mix('#f7f1df', '#efe0b0', clamp(ck, 0, 1)), tb);
        if (form === 'clove') {
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.quadraticCurveTo(8 * s, 0, 0, 9 * s); ctx.quadraticCurveTo(-5 * s, 0, 0, -10 * s); ctx.fill();
          ctx.strokeStyle = 'rgba(150,120,80,0.4)'; ctx.lineWidth = 0.8 * s; ctx.stroke();
          ctx.restore();
          R = 10 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 3, 6, 34) * s;
          const sz = form === 'sliced' ? 4 : form === 'chopped' ? 2.4 : 1.6;
          pile(ctx, it, x, y, s, {
            n: m * (form === 'sliced' ? 1.6 : 4), R, max: 60, piece(px, py, r, sh) {
              ctx.fillStyle = shadeHex(flesh, sh);
              if (form === 'sliced') { D.ellipse(ctx, px, py, sz * s, sz * 0.7 * s, r); ctx.fill(); }
              else ctx.fillRect(px - sz * s / 2, py - sz * s / 2, sz * s, sz * s);
            },
          });
        }
        break;
      }
      case 'potato': {
        const flesh = browned(mix('#f3e6b8', '#f0d58a', clamp(ck / 1.2, 0, 1)), 0);
        if (form === 'whole') {
          ctx.fillStyle = browned('#c8975a', tb * 0.6);
          D.blob(ctx, x, y, 26 * s, it.id, 0.15, 12); ctx.fill();
          ctx.fillStyle = '#8f6537';
          for (let i = 0; i < 4; i++) { D.circle(ctx, x + (hash(i + it.id) - 0.5) * 30 * s, y + (hash(i * 3 + it.id) - 0.5) * 24 * s, 1.5 * s); ctx.fill(); }
          R = 26 * s;
        } else if (form === 'halved' || form === 'wedges') {
          const n = form === 'halved' ? 2 : 6;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * 6.28 + rot;
            const px = x + Math.cos(a) * (n === 2 ? 10 : 13) * s, py = y + Math.sin(a) * (n === 2 ? 10 : 13) * s;
            ctx.fillStyle = browned(flesh, n === 2 ? it.brownUp : tb);
            D.ellipse(ctx, px, py, (n === 2 ? 20 : 12) * s, (n === 2 ? 12 : 6) * s, a + Math.PI / 2); ctx.fill();
            ctx.strokeStyle = '#b8874c'; ctx.lineWidth = 1.5 * s; ctx.stroke();
          }
          R = 28 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.3, 10, 50) * s;
          const sz = form === 'diced' ? 7 : form === 'small dice' ? 4.5 : 3;
          pile(ctx, it, x, y, s, {
            n: m / (sz * 0.55), R, max: 70, piece(px, py, r, sh, i) {
              // each cube shows a mix of browned faces
              const b = (i % 2 ? it.brownDown : it.brownUp) * (0.7 + sh * 0.3);
              ctx.fillStyle = browned(shadeHex(flesh, sh), b);
              ctx.save(); ctx.translate(px, py); ctx.rotate(r);
              D.rr(ctx, -sz * s / 2, -sz * s / 2, sz * s, sz * s, 1.5 * s); ctx.fill();
              ctx.restore();
            },
          });
        }
        break;
      }
      case 'tomato': {
        const red = mix('#d8392c', '#b8301f', clamp(ck, 0, 1));
        if (form === 'whole') {
          const g = ctx.createRadialGradient(x - 7 * s, y - 7 * s, 2, x, y, 22 * s);
          g.addColorStop(0, '#f2685a'); g.addColorStop(1, browned(red, tb * 0.5));
          ctx.fillStyle = g; D.circle(ctx, x, y, 21 * s); ctx.fill();
          ctx.fillStyle = '#3f8a35';
          for (let i = 0; i < 5; i++) { const a = i * 1.256; D.ellipse(ctx, x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s, 4.5 * s, 1.6 * s, a); ctx.fill(); }
          R = 21 * s;
        } else {
          R = clamp(10 + Math.sqrt(m) * 2.4, 10, 46) * s;
          const sz = form === 'halved' ? 0 : form === 'sliced' ? 9 : 4.5;
          if (form === 'halved') {
            for (const sg of [-1, 1]) {
              ctx.fillStyle = red; D.circle(ctx, x + sg * 11 * s, y, 19 * s); ctx.fill();
              ctx.fillStyle = '#e86c50'; D.circle(ctx, x + sg * 11 * s, y, 14 * s); ctx.fill();
              ctx.fillStyle = '#f5d68a';
              for (let i = 0; i < 6; i++) { D.circle(ctx, x + sg * 11 * s + Math.cos(i) * 7 * s, y + Math.sin(i) * 7 * s, 1.4 * s); ctx.fill(); }
            }
            R = 30 * s;
          } else {
            pile(ctx, it, x, y, s, {
              n: m / (sz * 0.9), R, max: 50, piece(px, py, r, sh) {
                ctx.fillStyle = browned(shadeHex(red, sh), tb);
                if (form === 'sliced') { D.circle(ctx, px, py, sz * s); ctx.fill(); ctx.fillStyle = 'rgba(245,200,120,0.6)'; D.circle(ctx, px, py, sz * 0.5 * s); ctx.fill(); }
                else { ctx.fillRect(px - sz * s / 2, py - sz * s / 2, sz * s, sz * s); }
              },
            });
          }
        }
        break;
      }
      case 'parsley': {
        const green = browned(mix('#3f8f3a', '#5c7a32', clamp(ck, 0, 1)), tb);
        if (form === 'bunch') {
          ctx.strokeStyle = '#6aa04e'; ctx.lineWidth = 1.5 * s;
          for (let i = 0; i < 5; i++) {
            const a = rot + (i - 2) * 0.25;
            ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 18 * s, y - Math.sin(a) * 18 * s); ctx.lineTo(x + Math.cos(a) * 6 * s, y + Math.sin(a) * 6 * s); ctx.stroke();
            ctx.fillStyle = shadeHex(green, 0.9 + i * 0.05);
            D.blob(ctx, x + Math.cos(a) * 12 * s, y + Math.sin(a) * 12 * s, 7 * s, i + it.id, 0.5, 8); ctx.fill();
          }
          R = 20 * s;
        } else {
          R = clamp(6 + Math.sqrt(m) * 4, 6, 30) * s;
          const sz = form === 'chopped' ? 2.6 : 1.6;
          pile(ctx, it, x, y, s, { n: m * 6, R, max: 70, piece(px, py, r, sh) { ctx.fillStyle = shadeHex(green, sh); ctx.fillRect(px, py, sz * s, sz * s); } });
        }
        break;
      }
      case 'bread': {
        const crumb = browned('#f5e3b8', it.brownUp);
        const crust = browned('#c98b4c', it.brownUp * 0.7 + 0.2);
        if (form === 'cubes') {
          R = clamp(10 + Math.sqrt(m) * 2.5, 10, 40) * s;
          pile(ctx, it, x, y, s, { n: m / 2.5, R, max: 30, piece(px, py, r, sh) { ctx.fillStyle = browned(shadeHex('#f2dfb0', sh), (it.brownUp + it.brownDown) / 2); ctx.fillRect(px - 4 * s, py - 4 * s, 8 * s, 8 * s); } });
          break;
        }
        const w = (form === 'halved' ? 15 : 30) * s, h = 30 * s;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.15);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; D.rr(ctx, -w / 2 + 2 * s, -h / 2 + 3 * s, w, h, 7 * s); ctx.fill();
        ctx.fillStyle = crust; D.rr(ctx, -w / 2, -h / 2, w, h, 7 * s); ctx.fill();
        ctx.beginPath(); ctx.arc(-w / 4, -h / 2 + 2 * s, w / 4, Math.PI, 0); ctx.arc(w / 4, -h / 2 + 2 * s, w / 4, Math.PI, 0); ctx.fill();
        ctx.fillStyle = crumb; D.rr(ctx, -w / 2 + 3 * s, -h / 2 + 3 * s, w - 6 * s, h - 6 * s, 5 * s); ctx.fill();
        ctx.restore();
        specks(ctx, it, x, y, 12 * s, s);
        R = 22 * s;
        break;
      }
      case 'chicken': {
        const base = mix('#f2b5ab', '#f0e2cc', clamp((ck - 0.2) / 0.9, 0, 1));
        if (form === 'whole' || form === 'halved') {
          const n = form === 'whole' ? 1 : 2;
          for (let i = 0; i < n; i++) {
            const px = x + (n === 2 ? (i - 0.5) * 30 * s : 0);
            ctx.save(); ctx.translate(px, y); ctx.rotate(rot * 0.3);
            ctx.fillStyle = browned(base, it.brownDown * 0.9); D.ellipse(ctx, 0, 0, (n === 1 ? 44 : 22) * s + 2 * s, 24 * s + 2 * s, 0); ctx.fill();
            ctx.fillStyle = browned(base, it.brownUp);
            ctx.beginPath(); ctx.ellipse(0, 0, (n === 1 ? 44 : 22) * s, 24 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 2 * s;
            ctx.beginPath(); ctx.ellipse(-6 * s, -6 * s, 20 * s, 9 * s, -0.2, 3.5, 5.2); ctx.stroke();
            ctx.restore();
          }
          specks(ctx, it, x, y, 30 * s, s);
          R = 44 * s;
        } else {
          R = clamp(12 + Math.sqrt(m) * 2.4, 10, 50) * s;
          const sz = form === 'strips' ? 12 : 6;
          pile(ctx, it, x, y, s, { n: m / sz, R, max: 40, piece(px, py, r, sh, i) { ctx.fillStyle = browned(shadeHex(base, sh), (i % 2 ? it.brownDown : it.brownUp)); ctx.save(); ctx.translate(px, py); ctx.rotate(r); D.rr(ctx, -sz * s / 2, -3 * s, sz * s, 6 * s, 2 * s); ctx.fill(); ctx.restore(); } });
        }
        break;
      }
      case 'bacon': {
        const meat = mix('#e07b74', '#b5552f', clamp(ck, 0, 1));
        const fat = mix('#fbe6dc', '#f2d29a', clamp(ck, 0, 1));
        if (form === 'strip') {
          const shrink = 1 - clamp(ck * 0.12, 0, 0.25);
          ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
          ctx.beginPath();
          for (let i = 0; i <= 10; i++) { const px = (-36 + i * 7.2) * s * shrink; const py = Math.sin(i * 1.3 + it.id) * 2.5 * s; if (i === 0) ctx.moveTo(px, py - 7 * s); else ctx.lineTo(px, py - 7 * s); }
          for (let i = 10; i >= 0; i--) { const px = (-36 + i * 7.2) * s * shrink; const py = Math.sin(i * 1.3 + it.id) * 2.5 * s; ctx.lineTo(px, py + 7 * s); }
          ctx.closePath();
          ctx.fillStyle = browned(fat, it.brownUp); ctx.fill();
          ctx.fillStyle = browned(meat, it.brownUp);
          ctx.fillRect(-34 * s * shrink, -4 * s, 68 * s * shrink, 3 * s);
          ctx.fillRect(-34 * s * shrink, 2 * s, 68 * s * shrink, 2.5 * s);
          ctx.restore();
          R = 36 * s;
        } else {
          R = clamp(8 + Math.sqrt(m) * 2.5, 8, 36) * s;
          pile(ctx, it, x, y, s, { n: m / 2, R, max: 30, piece(px, py, r, sh, i) { ctx.fillStyle = browned(shadeHex(i % 3 ? meat : fat, sh), tb); ctx.fillRect(px - 3 * s, py - 2 * s, 6 * s, 4 * s); } });
        }
        break;
      }
      case 'spaghetti': {
        const cookedLook = clamp(it.hyd / Math.max(1, (it.comp.spaghetti || 1) * 0.6), 0, 1);
        const col = browned(mix('#e8cf86', '#f4de9c', cookedLook), tb);
        const n = clamp(Math.round(m / 3), 6, 45);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6 * s;
        ctx.lineCap = 'round';
        if (cookedLook < 0.3) {
          const L = (it.form === 'broken' ? 30 : 70) * s;
          for (let i = 0; i < n; i++) {
            const off = (hash(i + it.id) - 0.5) * 14 * s;
            const a = rot + (hash(i * 3 + it.id) - 0.5) * 0.15;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(a) * L + Math.sin(a) * off, y - Math.sin(a) * L - Math.cos(a) * off);
            ctx.lineTo(x + Math.cos(a) * L + Math.sin(a) * off, y + Math.sin(a) * L - Math.cos(a) * off);
            ctx.stroke();
          }
          R = 40 * s;
        } else {
          R = clamp(14 + Math.sqrt(m) * 2.3, 14, 58) * s;
          for (let i = 0; i < n; i++) {
            ctx.strokeStyle = shadeHex(col, 0.88 + hash(i * 2 + it.id) * 0.2);
            ctx.beginPath();
            const pol = (a, b) => { const an = hash(a) * 6.283, rr = Math.sqrt(hash(b)) * R * 0.85; return [x + Math.cos(an) * rr, y + Math.sin(an) * rr]; };
            let [px, py] = pol(i + it.id, i * 7 + it.id);
            ctx.moveTo(px, py);
            for (let j = 0; j < 4; j++) {
              const [nx, ny] = pol(i * 13 + j * 5 + it.id, i * 17 + j * 3 + it.id);
              const [cx, cy] = pol(i * 3 + j * 11 + it.id + 0.5, i * 5 + j * 7 + it.id + 0.5);
              ctx.quadraticCurveTo(cx, cy, nx, ny);
              px = nx; py = ny;
            }
            ctx.stroke();
          }
        }
        specks(ctx, it, x, y, R * 0.8, s);
        break;
      }
      case 'rice': {
        R = clamp(10 + Math.sqrt(m) * 2.2, 10, 56) * s;
        const col = browned(mix('#efe9d6', '#fbf9f2', clamp(ck, 0, 1)), tb);
        pile(ctx, it, x, y, s, { n: m * 1.5, R, max: 90, piece(px, py, r, sh) { ctx.fillStyle = shadeHex(col, sh); D.ellipse(ctx, px, py, 2.4 * s, 1.1 * s, r); ctx.fill(); } });
        break;
      }
      default: {
        ctx.fillStyle = browned(d.color || '#ccc', tb);
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
    const f = it.kind === 'fat' ? 0.3 : it.kind === 'fluid' ? 0 : 0.63;
    return { x: x + it.px * inner * f, y: y + it.py * inner * f };
  };

  D.container = function (ctx, c, x, y, s, opts) {
    opts = opts || {};
    const r = c.def.r * s;
    const shape = c.def.shape;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(40,25,10,0.22)';
    D.circle(ctx, x + 4 * s, y + 6 * s, r * 1.02);
    ctx.fill();
    if (shape === 'pan') {
      // handle
      ctx.save(); ctx.translate(x, y); ctx.rotate(opts.handleAngle != null ? opts.handleAngle : 0.6);
      ctx.fillStyle = '#2b2422'; D.rr(ctx, r * 0.9, -7 * s, r * 1.05, 14 * s, 6 * s); ctx.fill();
      ctx.fillStyle = '#4a3b33'; D.rr(ctx, r * 1.25, -5 * s, r * 0.68, 10 * s, 5 * s); ctx.fill();
      ctx.restore();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
      g.addColorStop(0, '#4a4a50'); g.addColorStop(1, '#232327');
      ctx.fillStyle = g; D.circle(ctx, x, y, r); ctx.fill();
      ctx.fillStyle = '#35353a'; D.circle(ctx, x, y, r * 0.88); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2 * s; D.circle(ctx, x, y, r * 0.6); ctx.stroke();
    } else if (shape === 'pot') {
      const single = c.type === 'saucepan';
      ctx.fillStyle = '#7c838c';
      if (single) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(opts.handleAngle != null ? opts.handleAngle : 0.6);
        ctx.fillStyle = '#3a3330'; D.rr(ctx, r * 0.9, -7 * s, r * 1.0, 14 * s, 6 * s); ctx.fill(); ctx.restore();
      } else {
        for (const sg of [-1, 1]) { ctx.fillStyle = '#6f767f'; D.rr(ctx, x + sg * r * 0.92 - (sg < 0 ? 22 * s : 0), y - 9 * s, 22 * s, 18 * s, 6 * s); ctx.fill(); }
      }
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, '#e9edf1'); g.addColorStop(1, '#9aa2ab');
      ctx.fillStyle = g; D.circle(ctx, x, y, r); ctx.fill();
      const g2 = ctx.createRadialGradient(x + r * 0.2, y + r * 0.2, r * 0.1, x, y, r * 0.86);
      g2.addColorStop(0, '#c9d0d6'); g2.addColorStop(1, '#8e969f');
      ctx.fillStyle = g2; D.circle(ctx, x, y, r * 0.86); ctx.fill();
    } else if (shape === 'bowl' || shape === 'soupbowl') {
      const rim = shape === 'bowl' ? '#e9dfcf' : '#ffffff';
      const band = shape === 'bowl' ? '#8fb6c9' : '#d9876f';
      ctx.fillStyle = band; D.circle(ctx, x, y, r); ctx.fill();
      ctx.fillStyle = rim; D.circle(ctx, x, y, r * 0.93); ctx.fill();
      const g = ctx.createRadialGradient(x + r * 0.15, y + r * 0.2, r * 0.05, x, y, r * 0.86);
      g.addColorStop(0, shape === 'bowl' ? '#fbf7ef' : '#ffffff'); g.addColorStop(1, shape === 'bowl' ? '#ddd2bf' : '#e6e2db');
      ctx.fillStyle = g; D.circle(ctx, x, y, r * 0.86); ctx.fill();
    } else if (shape === 'plate') {
      ctx.fillStyle = '#f9f7f2'; D.circle(ctx, x, y, r); ctx.fill();
      ctx.strokeStyle = '#7fa8c4'; ctx.lineWidth = 2.5 * s; D.circle(ctx, x, y, r * 0.92); ctx.stroke();
      ctx.fillStyle = '#efebe2'; D.circle(ctx, x, y, r * 0.72); ctx.fill();
      ctx.fillStyle = '#fbfaf6'; D.circle(ctx, x, y, r * 0.68); ctx.fill();
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
      if (cls === 'water') { ctx.fillStyle = 'rgba(160,205,235,0.18)'; D.circle(ctx, x, y, inner); ctx.fill(); }
      if (pool.temp > 97 && c._boil) drawBubbles(ctx, x, y, inner, s, cls === 'water' ? 'rgba(255,255,255,0.75)' : 'rgba(255,220,200,0.6)', c._boil);
      const fat = c.fat();
      if (fat) { ctx.fillStyle = rgba('#e8d25a', 0.35); for (let i = 0; i < 8; i++) { D.ellipse(ctx, x + (hash(i + fat.id) - 0.5) * inner * 1.4, y + (hash(i * 3 + fat.id) - 0.5) * inner * 1.4, 6 * s, 4 * s, i); ctx.fill(); } }
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
    const fill = clamp(pool.mass / (c.def.cap * 0.75), 0.35, 1);
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - inner * 0.3, y - inner * 0.3, inner * 0.1, x, y, inner);
    g.addColorStop(0, mix(col, '#ffffff', 0.25));
    g.addColorStop(1, browned(col, Math.min(pool.brownDown, 3)));
    ctx.fillStyle = g;
    D.circle(ctx, x, y, inner * (0.9 + fill * 0.1));
    ctx.fill();
    ctx.globalAlpha = 1;
    if (cls === 'tomato') {
      ctx.fillStyle = 'rgba(120,20,10,0.25)';
      for (let i = 0; i < 20; i++) { D.circle(ctx, x + (hash(i + pool.id) - 0.5) * inner * 1.5, y + (hash(i * 3 + pool.id) - 0.5) * inner * 1.5, 2.5 * s); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x, y, inner * 0.8, 3.6, 4.4); ctx.stroke();
  }

  function drawBubbles(ctx, x, y, inner, s, col, intensity) {
    const t = performance.now() / 1000;
    const n = Math.round(6 + intensity * 26);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3 * s;
    for (let i = 0; i < n; i++) {
      const ph = (t * (0.8 + hash(i) * 1.2) + hash(i * 7)) % 1;
      const a = hash(i * 3.3 + Math.floor(t + hash(i))) * 6.28;
      const rr = Math.sqrt(hash(i * 5.7 + Math.floor(t + hash(i)))) * inner * 0.9;
      D.circle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, (1 + ph * 4) * s);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- front views (wall storage)
  D.hangingPan = function (ctx, c, x, y, s) {
    // hanging on a hook: you see the inside of the pan face-on, handle up
    ctx.save();
    ctx.strokeStyle = '#6b5a4c'; ctx.lineWidth = 3;
    const r = c.def.r * s;
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
    // body
    ctx.fillStyle = L.shirt;
    ctx.beginPath(); ctx.moveTo(-70, 140); ctx.quadraticCurveTo(-70, 70, 0, 66); ctx.quadraticCurveTo(70, 70, 70, 140); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shadeHex(L.shirt, 0.85);
    ctx.beginPath(); ctx.moveTo(-14, 68); ctx.lineTo(0, 88); ctx.lineTo(14, 68); ctx.closePath(); ctx.fill();
    // neck
    ctx.fillStyle = shadeHex(L.skin, 0.92); ctx.fillRect(-12, 40, 24, 30);
    // hair back
    if (L.hairStyle === 'long') { ctx.fillStyle = L.hair; D.rr(ctx, -52, -40, 104, 120, 40); ctx.fill(); }
    // head
    const bob = Math.sin(t * 2) * 1.5;
    ctx.translate(0, bob);
    ctx.fillStyle = L.skin; D.ellipse(ctx, 0, 0, 46, 52); ctx.fill();
    // ears
    D.ellipse(ctx, -46, 4, 8, 12); ctx.fill(); D.ellipse(ctx, 46, 4, 8, 12); ctx.fill();
    if (L.earrings) { ctx.fillStyle = '#f2c94c'; D.circle(ctx, -47, 18, 4); ctx.fill(); D.circle(ctx, 47, 18, 4); ctx.fill(); }
    // hair
    ctx.fillStyle = L.hair;
    if (L.hairStyle === 'bald') {
      ctx.beginPath(); ctx.ellipse(-38, -6, 10, 20, 0.3, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(38, -6, 10, 20, -0.3, 0, 6.28); ctx.fill();
    } else if (L.hairStyle === 'bun') {
      D.circle(ctx, 0, -62, 20); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -26, 48, 32, 0, Math.PI, 0); ctx.fill();
    } else if (L.hairStyle === 'messy') {
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; D.circle(ctx, Math.cos(a) * 38, -18 + Math.sin(a) * 34, 16); ctx.fill(); }
    } else if (L.hairStyle === 'long') {
      ctx.beginPath(); ctx.ellipse(0, -24, 50, 34, 0, Math.PI, 0); ctx.fill();
    }
    // face
    const ey = -2;
    ctx.fillStyle = '#2b2220';
    ctx.strokeStyle = '#2b2220';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const blink = (t % 4) > 3.85;
    if (mood === 'great') {
      ctx.beginPath(); ctx.arc(-16, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(16, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    } else if (blink) {
      ctx.beginPath(); ctx.moveTo(-22, ey); ctx.lineTo(-10, ey); ctx.moveTo(10, ey); ctx.lineTo(22, ey); ctx.stroke();
    } else {
      D.circle(ctx, -16, ey, 4.5); ctx.fill(); D.circle(ctx, 16, ey, 4.5); ctx.fill();
      ctx.fillStyle = '#fff'; D.circle(ctx, -14.5, ey - 1.5, 1.5); ctx.fill(); D.circle(ctx, 17.5, ey - 1.5, 1.5); ctx.fill();
    }
    // brows
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = L.hairStyle === 'bald' ? '#bdb6aa' : L.hair;
    const bt = mood === 'bad' ? 4 : mood === 'ok' ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(-24, ey - 12 - bt); ctx.lineTo(-9, ey - 14 + bt); ctx.moveTo(9, ey - 14 + bt); ctx.lineTo(24, ey - 12 - bt); ctx.stroke();
    if (L.glasses) {
      ctx.strokeStyle = '#5b4a3c'; ctx.lineWidth = 2;
      D.circle(ctx, -16, ey, 11); ctx.stroke(); D.circle(ctx, 16, ey, 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, ey); ctx.lineTo(5, ey); ctx.stroke();
    }
    if (L.freckles) { ctx.fillStyle = 'rgba(170,90,50,0.5)'; for (let i = 0; i < 6; i++) { D.circle(ctx, (i < 3 ? -20 : 14) + (i % 3) * 4, 14 + (i % 2) * 3, 1.3); ctx.fill(); } }
    // cheeks
    if (mood === 'great' || mood === 'good') { ctx.fillStyle = 'rgba(240,110,100,0.3)'; D.ellipse(ctx, -27, 16, 8, 5); ctx.fill(); D.ellipse(ctx, 27, 16, 8, 5); ctx.fill(); }
    // nose
    ctx.strokeStyle = shadeHex(L.skin, 0.75); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(5, 14, -2, 15); ctx.stroke();
    // mouth
    ctx.strokeStyle = '#6b2b26'; ctx.lineWidth = 3;
    const my = 28;
    if (mood === 'great') { ctx.fillStyle = '#7a2d2a'; ctx.beginPath(); ctx.arc(0, my - 4, 13, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e46a6a'; D.ellipse(ctx, 0, my + 5, 6, 3); ctx.fill(); }
    else if (mood === 'good') { ctx.beginPath(); ctx.arc(0, my - 6, 11, 0.4, Math.PI - 0.4); ctx.stroke(); }
    else if (mood === 'ok') { ctx.beginPath(); ctx.moveTo(-9, my); ctx.quadraticCurveTo(0, my + 2, 10, my - 2); ctx.stroke(); }
    else if (mood === 'bad') { ctx.beginPath(); ctx.arc(0, my + 9, 10, Math.PI + 0.5, -0.5); ctx.stroke(); ctx.fillStyle = 'rgba(120,180,230,0.8)'; ctx.beginPath(); ctx.moveTo(36, -22); ctx.quadraticCurveTo(42, -10, 36, -6); ctx.quadraticCurveTo(30, -10, 36, -22); ctx.fill(); }
    else if (mood === 'chew') { const o = Math.abs(Math.sin(t * 9)) * 5; ctx.fillStyle = '#7a2d2a'; D.ellipse(ctx, 0, my, 7, 2 + o); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, my - 5, 9, 0.5, Math.PI - 0.5); ctx.stroke(); }
    if (L.mustache) { ctx.fillStyle = '#e8e4dc'; ctx.beginPath(); ctx.ellipse(-9, my - 8, 11, 5, 0.25, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, my - 8, 11, 5, -0.25, 0, 6.28); ctx.fill(); }
    ctx.restore();
  };
})();
