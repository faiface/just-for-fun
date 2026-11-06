// Static kitchen art: walls, shelves, fridge, stove, sink, toaster, utensils, tooltips.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, hash, mix, rgba, browned } = CK;
  const D = CK.D;
  const A = (CK.KitchenArt = {});
  const L = () => CK.LAYOUT;
  const FONT = 'Nunito, system-ui, sans-serif';

  function text(ctx, s, x, y, size, col, weight, align) {
    ctx.font = `${weight || 700} ${size}px ${FONT}`;
    ctx.fillStyle = col;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  A.text = text;

  // fake items for decorative baskets
  const deco = {};
  function fake(ing, n) {
    const k = ing + n;
    if (!deco[k]) { deco[k] = CK.makeUnit(ing); deco[k].id = 9000 + n * 13 + ing.length; deco[k].rot = hash(n * 3.3) * 6.28; }
    return deco[k];
  }

  // ---------------------------------------------------------------- wall
  A.background = function (ctx, k) {
    const l = L();
    // wall
    const g = ctx.createLinearGradient(0, 0, 0, l.counter.y);
    g.addColorStop(0, '#f7ecd9'); g.addColorStop(1, '#f1e1c6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, l.W, l.counter.y);
    ctx.fillStyle = 'rgba(214,184,140,0.18)';
    for (let x = 256; x < l.W; x += 36) ctx.fillRect(x, 0, 12, l.counter.y - 48);
    // backsplash tiles
    const ty = l.counter.y - 48;
    ctx.fillStyle = '#dfeee8'; ctx.fillRect(256, ty, l.W - 256, 48);
    ctx.strokeStyle = 'rgba(120,160,150,0.35)'; ctx.lineWidth = 1.5;
    for (let r = 0; r < 2; r++) for (let x = 256 + (r ? 20 : 0); x < l.W; x += 40) { ctx.strokeRect(x, ty + r * 24, 40, 24); }
    // window
    const w = l.window;
    ctx.fillStyle = '#b07c52'; D.rr(ctx, w.x - 10, w.y - 10, w.w + 20, w.h + 22, 10); ctx.fill();
    const sky = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
    sky.addColorStop(0, '#9fd0ea'); sky.addColorStop(1, '#fbe2bd');
    ctx.fillStyle = sky; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(w.x, w.y, w.w, w.h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const t = k.time * 4;
    for (let i = 0; i < 3; i++) {
      const cx = w.x + ((i * 97 + t) % (w.w + 80)) - 40, cy = w.y + 40 + i * 30;
      D.ellipse(ctx, cx, cy, 30, 10); ctx.fill(); D.ellipse(ctx, cx + 16, cy - 6, 18, 9); ctx.fill();
    }
    ctx.fillStyle = '#8fbf7a'; D.ellipse(ctx, w.x + 60, w.y + w.h + 10, 120, 50); ctx.fill();
    ctx.fillStyle = '#76a965'; D.ellipse(ctx, w.x + 220, w.y + w.h + 20, 110, 60); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(w.x + 200, w.y + 90, 10, w.h - 90);
    ctx.fillStyle = '#5f9b52'; D.circle(ctx, w.x + 205, w.y + 82, 40); ctx.fill(); D.circle(ctx, w.x + 180, w.y + 105, 28); ctx.fill(); D.circle(ctx, w.x + 232, w.y + 104, 30); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#b07c52'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(w.x + w.w / 2, w.y); ctx.lineTo(w.x + w.w / 2, w.y + w.h); ctx.moveTo(w.x, w.y + w.h / 2); ctx.lineTo(w.x + w.w, w.y + w.h / 2); ctx.stroke();
    // curtains
    ctx.fillStyle = '#e7a28f';
    for (const sx of [w.x - 16, w.x + w.w - 30]) {
      ctx.beginPath(); ctx.moveTo(sx, w.y - 18); ctx.lineTo(sx + 46, w.y - 18); ctx.quadraticCurveTo(sx + 26, w.y + 90, sx + 40, w.y + 150); ctx.lineTo(sx, w.y + 150); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#d98a77'; ctx.fillRect(w.x - 24, w.y - 22, w.w + 48, 10);
    // pantry shelves
    for (const sy of [l.shelfA, l.shelfB]) {
      ctx.fillStyle = '#a8724a'; ctx.fillRect(l.shelfX0, sy, l.shelfX1 - l.shelfX0, 12);
      ctx.fillStyle = '#8a5b3a'; ctx.fillRect(l.shelfX0, sy + 12, l.shelfX1 - l.shelfX0, 4);
      ctx.fillStyle = '#7a4f33';
      for (const bx of [l.shelfX0 + 30, l.shelfX1 - 40]) { ctx.beginPath(); ctx.moveTo(bx, sy + 16); ctx.lineTo(bx + 10, sy + 16); ctx.lineTo(bx, sy + 40); ctx.closePath(); ctx.fill(); }
    }
    for (const s of CK.SOURCES) if (!s.fridge && !s.basket && !s.bread) A.drawSource(ctx, s, s.x, s.y, 0);
    // dish shelf
    ctx.fillStyle = '#a8724a'; ctx.fillRect(728, l.dishShelfY, 264, 10);
    ctx.fillStyle = '#8a5b3a'; ctx.fillRect(728, l.dishShelfY + 10, 264, 4);
    // clock
    const c = l.clock;
    ctx.fillStyle = '#c78f5c'; D.circle(ctx, c.x, c.y, c.r + 6); ctx.fill();
    ctx.fillStyle = '#fffaf0'; D.circle(ctx, c.x, c.y, c.r); ctx.fill();
    ctx.fillStyle = '#9b7b5f';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; D.circle(ctx, c.x + Math.cos(a) * (c.r - 7), c.y + Math.sin(a) * (c.r - 7), i % 3 ? 1.5 : 3); ctx.fill(); }
    const mins = 17 * 60 + 30 + k.world.time / 60;
    const ma = ((mins % 60) / 60) * 6.28 - Math.PI / 2, ha = (((mins / 60) % 12) / 12) * 6.28 - Math.PI / 2;
    ctx.strokeStyle = '#3b2d24'; ctx.lineCap = 'round';
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(ha) * 20, c.y + Math.sin(ha) * 20); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(ma) * 31, c.y + Math.sin(ma) * 31); ctx.stroke();
    ctx.fillStyle = '#e06c4f'; D.circle(ctx, c.x, c.y, 3.5); ctx.fill();
    // timer
    const T = k.world.timer;
    const tm = l.timer;
    ctx.fillStyle = '#f0b04a'; D.rr(ctx, tm.x - 40, tm.y - 24, 80, 48, 14); ctx.fill();
    ctx.fillStyle = '#3a3029'; D.rr(ctx, tm.x - 32, tm.y - 15, 64, 30, 7); ctx.fill();
    const el = T.running ? k.world.time - T.start : T.acc;
    const mm = Math.floor(el / 60), ss = Math.floor(el % 60);
    text(ctx, `${mm}:${String(ss).padStart(2, '0')}`, tm.x, tm.y + 1, 20, T.running ? '#9cf2a3' : '#f7e7c9', 800);
    text(ctx, T.running ? 'tap to stop' : 'timer', tm.x, tm.y + 34, 12, '#8a6a4d', 700);
    // rails
    ctx.fillStyle = '#7a6a5c'; ctx.fillRect(1110, l.rail - 4, 480, 8);
    for (const x of [1110, 1586]) { D.circle(ctx, x, l.rail, 7); ctx.fill(); }
    ctx.fillRect(1110, l.utensilRail - 4, 320, 8);
    for (const x of [1110, 1430]) { D.circle(ctx, x, l.utensilRail, 7); ctx.fill(); }
    // potted herb
    ctx.fillStyle = '#c9714e'; ctx.beginPath(); ctx.moveTo(1488, 360); ctx.lineTo(1548, 360); ctx.lineTo(1540, 404); ctx.lineTo(1496, 404); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4f9a48';
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28; D.ellipse(ctx, 1518 + Math.cos(a) * 30, 352 + Math.sin(a) * 30, 12, 6, a); ctx.fill(); }
    ctx.fillStyle = '#a8724a'; ctx.fillRect(1460, 404, 120, 10);
    // little picture
    ctx.fillStyle = '#b07c52'; D.rr(ctx, 1460, 310, 0, 0, 0);
  };

  // ---------------------------------------------------------------- utensils hanging
  function drawTool(ctx, id, x, y, ang, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.scale(s || 1, s || 1);
    // drawn hanging: handle at top (0,0) going down
    if (id === 'spoon') {
      ctx.fillStyle = '#c8955f'; D.rr(ctx, -4, 0, 8, 80, 4); ctx.fill();
      ctx.fillStyle = '#b98550'; D.ellipse(ctx, 0, 96, 14, 20); ctx.fill();
      ctx.fillStyle = '#a77543'; D.ellipse(ctx, 0, 97, 9, 14); ctx.fill();
    } else if (id === 'spatula') {
      ctx.fillStyle = '#2f2b2a'; D.rr(ctx, -4, 0, 8, 70, 4); ctx.fill();
      ctx.fillStyle = '#d8573f'; D.rr(ctx, -15, 68, 30, 42, 6); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 8 - 1.5, 76, 3, 26);
    } else if (id === 'whisk') {
      ctx.fillStyle = '#4a7fa8'; D.rr(ctx, -5, 0, 10, 50, 5); ctx.fill();
      ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 48); ctx.bezierCurveTo(i * 9, 70, i * 7, 104, 0, 110); ctx.stroke(); }
    } else if (id === 'taster') {
      ctx.fillStyle = '#b8bfc6'; D.rr(ctx, -2.5, 10, 5, 62, 2.5); ctx.fill();
      ctx.fillStyle = '#d4dae0'; D.ellipse(ctx, 0, 80, 8, 11); ctx.fill();
      ctx.fillStyle = '#e06c4f'; D.rr(ctx, -4, 0, 8, 24, 4); ctx.fill();
    } else if (id === 'knife') {
      ctx.fillStyle = '#3a2a22'; D.rr(ctx, -6, 0, 12, 52, 5); ctx.fill();
      ctx.fillStyle = '#d4d9de';
      ctx.beginPath(); ctx.moveTo(-6, 52); ctx.lineTo(7, 52); ctx.lineTo(7, 150); ctx.quadraticCurveTo(-4, 140, -6, 120); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(3, 56, 2, 88);
      ctx.fillStyle = '#c7a37a'; D.circle(ctx, 0, 14, 2); ctx.fill(); D.circle(ctx, 0, 36, 2); ctx.fill();
    }
    ctx.restore();
  }
  A.drawTool = drawTool;

  A.utensils = function (ctx, k, tools) {
    const l = L();
    for (const t of tools) {
      ctx.strokeStyle = '#5c4d42'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, l.utensilRail + 8, 6, Math.PI, 0); ctx.stroke();
      if (k.tool === t.id) { ctx.fillStyle = 'rgba(0,0,0,0.08)'; D.rr(ctx, t.x - 16, l.utensilRail + 12, 32, 100, 10); ctx.fill(); continue; }
      drawTool(ctx, t.id, t.x, l.utensilRail + 10, 0, 1);
    }
  };

  A.knife = function (ctx, k) {
    if (k.tool === 'knife') return;
    const b = L().board;
    drawTool(ctx, 'knife', b.x + b.w - 18, b.y + 30, 0, 1.15);
  };

  A.toolCursor = function (ctx, k, id, x, y) {
    const ta = k.toolAct;
    let ang = 0.5, px = x, py = y;
    if (ta && ta.kind === 'stir') {
      const p = k.posOf(ta.c);
      const r = ta.c.def.r * 0.35;
      px = p.x + Math.cos(ta.a) * r; py = p.y + Math.sin(ta.a) * r;
      ang = 0.3 + Math.sin(ta.a) * 0.2;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
    // tool's working end at the cursor: rotate so the head points at (px,py)
    const len = id === 'knife' ? 150 : id === 'taster' ? 80 : 100;
    const bob = id === 'knife' ? (k.knifeBob || 0) * 12 : 0;
    ctx.translate(px, py - bob);
    ctx.rotate(Math.PI + ang);
    drawTool(ctx, id, 0, -len, 0, 1);
    ctx.restore();
  };

  // ---------------------------------------------------------------- counter & fixtures
  A.counter = function (ctx, k) {
    const l = L();
    const c = l.counter;
    const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    g.addColorStop(0, '#d7b088'); g.addColorStop(1, '#cfa47a');
    ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(140,95,55,0.25)'; ctx.lineWidth = 1.5;
    for (let y = c.y + 54; y < c.y + c.h; y += 54) { ctx.beginPath(); ctx.moveTo(c.x, y); ctx.lineTo(c.x + c.w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(140,95,55,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) { const y = c.y + hash(i) * c.h, x = c.x + hash(i * 3) * c.w; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 40, y - 3, x + 80, y + 3, x + 130, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(80,50,30,0.25)'; ctx.fillRect(c.x, c.y, c.w, 5);
    ctx.fillStyle = '#8a6242'; ctx.fillRect(0, l.H - 14, l.W, 14);

    // baskets
    for (const s of CK.SOURCES) {
      if (!s.basket) continue;
      ctx.fillStyle = '#b98a54'; D.circle(ctx, s.x, s.y, s.r + 4); ctx.fill();
      ctx.strokeStyle = '#94683a'; ctx.lineWidth = 2;
      for (let a = 0; a < 6.28; a += 0.4) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 2, a, a + 0.2); ctx.stroke(); }
      ctx.fillStyle = '#7b5532'; D.circle(ctx, s.x, s.y, s.r - 2); ctx.fill();
      const n = s.ing === 'garlic' ? 4 : 3;
      ctx.save(); D.circle(ctx, s.x, s.y, s.r - 2); ctx.clip();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + 0.4, rr = s.ing === 'garlic' ? 9 : 12;
        D.item(ctx, fake(s.ing, i), s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, s.ing === 'garlic' ? 0.9 : 0.62);
      }
      ctx.restore();
    }
    // bread board
    const b = l.bread;
    ctx.fillStyle = '#a2703f'; D.rr(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
    ctx.fillStyle = '#b8824c'; D.rr(ctx, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 12); ctx.fill();
    ctx.fillStyle = '#c9884b'; D.ellipse(ctx, b.x + 52, b.y + b.h / 2, 42, 28); ctx.fill();
    ctx.strokeStyle = '#a86b33'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(b.x + 40 + i * 18, b.y + 22); ctx.lineTo(b.x + 52 + i * 18, b.y + b.h - 22); ctx.stroke(); }
    D.item(ctx, fake('bread', 1), b.x + 112, b.y + b.h / 2, 0.85);
    // cutting board
    const bd = l.board;
    ctx.fillStyle = 'rgba(60,40,20,0.2)'; D.rr(ctx, bd.x + 4, bd.y + 6, bd.w, bd.h, 18); ctx.fill();
    ctx.fillStyle = '#e8cfa6'; D.rr(ctx, bd.x, bd.y, bd.w, bd.h, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(160,120,70,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(bd.x + 10, bd.y + 14 + i * 19); ctx.lineTo(bd.x + bd.w - 10, bd.y + 18 + i * 19); ctx.stroke(); }
    ctx.fillStyle = '#d7b98d'; D.rr(ctx, bd.x + 14, bd.y + bd.h - 30, 40, 12, 6); ctx.fill();
    // stove
    const st = l.stove;
    ctx.fillStyle = '#2b2a2f'; D.rr(ctx, st.x, st.y, st.w, st.h - 8, 16); ctx.fill();
    ctx.fillStyle = '#34333a'; D.rr(ctx, st.x + 8, st.y + 8, st.w - 16, st.h - 92, 12); ctx.fill();
    l.burners.forEach((p, i) => {
      ctx.strokeStyle = '#4b4a52'; ctx.lineWidth = 6;
      D.circle(ctx, p.x, p.y, 62); ctx.stroke();
      ctx.fillStyle = '#1e1d21'; D.circle(ctx, p.x, p.y, 26); ctx.fill();
      ctx.fillStyle = '#56545c'; D.circle(ctx, p.x, p.y, 16); ctx.fill();
      ctx.strokeStyle = '#47464e'; ctx.lineWidth = 7;
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(an) * 30, p.y + Math.sin(an) * 30); ctx.lineTo(p.x + Math.cos(an) * 70, p.y + Math.sin(an) * 70); ctx.stroke(); }
      const occupied = k.world.containers.some((c) => c.loc.t === 'burner' && c.loc.i === i);
      if (!occupied) A.flame(ctx, p.x, p.y, k.world.burners[i], false, k.time);
    });
    // knobs
    for (let i = 0; i < l.knobs.length; i++) {
      const kn = l.knobs[i];
      const lvl = k.world.burners[kn.b];
      ctx.fillStyle = '#1b1a1e'; D.circle(ctx, kn.x, kn.y, 21); ctx.fill();
      const g2 = ctx.createRadialGradient(kn.x - 5, kn.y - 5, 2, kn.x, kn.y, 18);
      g2.addColorStop(0, '#f2efe9'); g2.addColorStop(1, '#bcb6ad');
      ctx.fillStyle = g2; D.circle(ctx, kn.x, kn.y, 17); ctx.fill();
      const a = -Math.PI / 2 + (lvl / 5) * Math.PI * 1.4 - (lvl ? 0 : 0);
      ctx.strokeStyle = lvl ? '#e0583e' : '#5a524a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(kn.x, kn.y); ctx.lineTo(kn.x + Math.cos(a) * 13, kn.y + Math.sin(a) * 13); ctx.stroke();
      // which burner
      const mx = kn.x - 7, my = kn.y - 37;
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = j === kn.b ? (lvl ? '#ff8a4d' : '#d8d2c8') : '#55535a';
        D.circle(ctx, mx + (j % 2) * 14, my + Math.floor(j / 2) * 9, 3.5); ctx.fill();
      }
      const lab = ['off', 'low', 'med-low', 'medium', 'med-high', 'high'][lvl];
      text(ctx, lab, kn.x, kn.y + 25, 11, lvl ? '#ffb08a' : '#9a958d', 800);
    }
    // sink
    const sk = l.sink, bs = l.basin;
    ctx.fillStyle = '#c7ccd2'; D.rr(ctx, sk.x, sk.y, sk.w, sk.h, 16); ctx.fill();
    const bg = ctx.createLinearGradient(bs.x, bs.y, bs.x + bs.w, bs.y + bs.h);
    bg.addColorStop(0, '#a3abb4'); bg.addColorStop(1, '#d5dade');
    ctx.fillStyle = bg; D.rr(ctx, bs.x, bs.y, bs.w, bs.h, 22); ctx.fill();
    ctx.fillStyle = '#7d858e'; D.circle(ctx, bs.x + bs.w / 2, bs.y + bs.h / 2 + 50, 12); ctx.fill();
    ctx.strokeStyle = '#5f666e'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(bs.x + bs.w / 2 - 8, bs.y + bs.h / 2 + 50 + i * 4); ctx.lineTo(bs.x + bs.w / 2 + 8, bs.y + bs.h / 2 + 50 + i * 4); ctx.stroke(); }
    // faucet
    const f = l.faucet;
    ctx.fillStyle = '#9aa2ab'; D.circle(ctx, f.x, f.y - 6, 12); ctx.fill();
    ctx.fillStyle = '#b8c0c8'; D.rr(ctx, f.x - 6, f.y - 8, 12, 48, 6); ctx.fill();
    ctx.fillStyle = '#d7dde2'; D.circle(ctx, f.x, f.y + 40, 7); ctx.fill();
    const th = l.tapHandle;
    ctx.fillStyle = k.world.tap ? '#5aa0d8' : '#9aa2ab'; D.circle(ctx, th.x, th.y, 13); ctx.fill();
    ctx.fillStyle = '#e8ecef'; D.rr(ctx, th.x - 3, th.y - 15, 6, 22, 3); ctx.fill();
    if (k.world.tap) {
      ctx.strokeStyle = 'rgba(160,210,245,0.85)'; ctx.lineWidth = 7;
      const sinkC = k.world.at('sink');
      const endY = sinkC ? k.posOf(sinkC).y : bs.y + bs.h / 2 + 30;
      ctx.beginPath(); ctx.moveTo(f.x, f.y + 44);
      for (let y = f.y + 44; y < endY; y += 8) ctx.lineTo(f.x + Math.sin(y * 0.3 + k.time * 20) * 1.5, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,230,250,0.7)';
      for (let i = 0; i < 6; i++) { const a = hash(i + Math.floor(k.time * 20)) * 6.28; D.circle(ctx, f.x + Math.cos(a) * 14, endY + Math.sin(a) * 8, 2.5); ctx.fill(); }
    }
    // toaster
    const T = l.toaster;
    const tw = k.world.toaster;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; D.rr(ctx, T.x + 4, T.y + 6, T.w, T.h, 20); ctx.fill();
    const tg = ctx.createLinearGradient(T.x, T.y, T.x + T.w, T.y + T.h);
    tg.addColorStop(0, '#f2a36f'); tg.addColorStop(1, '#d9774b');
    ctx.fillStyle = tg; D.rr(ctx, T.x, T.y, T.w - 26, T.h, 20); ctx.fill();
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = tw.down ? '#ff8a3a' : '#2a201c';
      D.rr(ctx, T.x + 16, T.y + 18 + i * 42, T.w - 60, 20, 8); ctx.fill();
      if (tw.down) { ctx.fillStyle = 'rgba(255,200,120,0.6)'; D.rr(ctx, T.x + 20, T.y + 22 + i * 42, T.w - 68, 12, 6); ctx.fill(); }
    }
    // lever & dial (right side)
    ctx.fillStyle = '#b9bec4'; D.rr(ctx, T.x + T.w - 30, T.y + 10, 26, 54, 8); ctx.fill();
    ctx.fillStyle = '#3b3633'; D.rr(ctx, T.x + T.w - 26, T.y + (tw.down ? 44 : 16), 18, 14, 5); ctx.fill();
    ctx.fillStyle = '#e8e3da'; D.circle(ctx, T.x + T.w - 17, T.y + 88, 14); ctx.fill();
    text(ctx, String(tw.level), T.x + T.w - 17, T.y + 89, 15, '#7a3b1f', 900);
    if (tw.down) {
      const p = clamp(tw.timer / k.world.toasterTime(), 0, 1);
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(T.x + T.w - 17, T.y + 88, 17, -Math.PI / 2, -Math.PI / 2 + p * 6.28); ctx.stroke();
    }
    // trash
    const tr = l.trash;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; D.circle(ctx, tr.x + 3, tr.y + 5, tr.r); ctx.fill();
    ctx.fillStyle = '#6f9b6a'; D.circle(ctx, tr.x, tr.y, tr.r); ctx.fill();
    ctx.fillStyle = '#5c8558'; D.circle(ctx, tr.x, tr.y, tr.r - 8); ctx.fill();
    ctx.fillStyle = '#e6f0de';
    ctx.font = `800 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('COMPOST', tr.x, tr.y + 4);
    // serving pass
    const ps = l.pass;
    ctx.fillStyle = 'rgba(60,40,20,0.2)'; D.rr(ctx, ps.x + 4, ps.y + 6, ps.w, ps.h, 22); ctx.fill();
    ctx.fillStyle = '#8f5f3a'; D.rr(ctx, ps.x, ps.y, ps.w, ps.h, 22); ctx.fill();
    ctx.fillStyle = '#a8724a'; D.rr(ctx, ps.x + 10, ps.y + 10, ps.w - 20, ps.h - 20, 16); ctx.fill();
    text(ctx, 'SERVE', ps.x + ps.w / 2, ps.y + ps.h - 28, 18, 'rgba(255,240,220,0.45)', 900);
    if (!k.world.containers.some((c) => c.loc.t === 'pass')) {
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,240,220,0.45)'; ctx.lineWidth = 3;
      D.circle(ctx, l.passSpot.x, l.passSpot.y, 80); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'put the dish here', l.passSpot.x, l.passSpot.y, 15, 'rgba(255,240,220,0.6)', 800);
    }
    // bell
    const be = l.bell;
    ctx.fillStyle = '#6b5240'; D.circle(ctx, be.x, be.y + 4, 26); ctx.fill();
    const bgr = ctx.createRadialGradient(be.x - 7, be.y - 7, 2, be.x, be.y, 22);
    bgr.addColorStop(0, '#fff4c4'); bgr.addColorStop(1, '#d9a93a');
    ctx.fillStyle = bgr; D.circle(ctx, be.x, be.y, 21); ctx.fill();
    ctx.fillStyle = '#8a6a2a'; D.circle(ctx, be.x, be.y, 6); ctx.fill();
  };

  A.flame = function (ctx, x, y, level, under, t) {
    if (!level) return;
    const r = 34 + level * 6;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28;
      const fl = (7 + level * 2.6) * (0.8 + 0.3 * Math.sin(t * 18 + i * 1.7));
      const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
      const tx = x + Math.cos(a) * (r + fl), ty = y + Math.sin(a) * (r + fl);
      const g = ctx.createLinearGradient(bx, by, tx, ty);
      g.addColorStop(0, 'rgba(70,120,255,0.95)'); g.addColorStop(0.6, 'rgba(120,170,255,0.7)'); g.addColorStop(1, 'rgba(255,170,90,0.1)');
      ctx.strokeStyle = g; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    }
    if (under) {
      ctx.fillStyle = `rgba(255,120,60,${0.08 + level * 0.03})`;
      D.circle(ctx, x, y, r + 18); ctx.fill();
    }
  };

  A.toasterItems = function (ctx, k) {
    const T = L().toaster;
    const tw = k.world.toaster;
    k.world.toasterC.items.forEach((it, i) => {
      const x = T.x + 50, y = T.y + 28 + i * 42;
      it.ax = x; it.ay = y;
      if (tw.down) { it._sx = null; return; }
      // popped up: the top edge of the slice sticks out of its slot
      const sx = T.x + 12, sy = T.y + 14 + i * 42, sw = T.w - 52, sh = 28;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      D.rr(ctx, sx + 2, sy + 4, sw, sh, 8); ctx.fill();
      ctx.fillStyle = browned('#c98b4c', (it.brownDown + it.brownUp) / 2 * 0.7 + 0.2);
      D.rr(ctx, sx, sy, sw, sh, 8); ctx.fill();
      ctx.fillStyle = browned('#f5e3b8', (it.brownDown + it.brownUp) / 2);
      D.rr(ctx, sx + 4, sy + 6, sw - 8, sh - 12, 5); ctx.fill();
      it._sx = sx + sw / 2; it._sy = sy + sh / 2; it._sr = 26;
    });
  };

  // ---------------------------------------------------------------- fridge
  A.fridge = function (ctx, k, sources) {
    const f = L().fridge;
    ctx.fillStyle = 'rgba(40,30,20,0.25)'; D.rr(ctx, f.x + 6, f.y + 8, f.w, f.h, 26); ctx.fill();
    if (!k.fridgeOpen) {
      const g = ctx.createLinearGradient(f.x, 0, f.x + f.w, 0);
      g.addColorStop(0, '#bfe4d7'); g.addColorStop(1, '#a6d3c4');
      ctx.fillStyle = g; D.rr(ctx, f.x, f.y, f.w, f.h, 26); ctx.fill();
      ctx.strokeStyle = 'rgba(80,130,115,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x + 6, f.y + 250); ctx.lineTo(f.x + f.w - 6, f.y + 250); ctx.stroke();
      ctx.fillStyle = '#e9efe9'; D.rr(ctx, f.x + f.w - 30, f.y + 120, 12, 100, 6); ctx.fill(); D.rr(ctx, f.x + f.w - 30, f.y + 290, 12, 190, 6); ctx.fill();
      // note & magnets
      ctx.save(); ctx.translate(f.x + 90, f.y + 400); ctx.rotate(-0.06);
      ctx.fillStyle = '#fffbe9'; ctx.fillRect(-50, -40, 100, 120);
      ctx.strokeStyle = 'rgba(120,150,190,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-42, -12 + i * 16); ctx.lineTo(42, -12 + i * 16); ctx.stroke(); }
      text(ctx, 'groceries', 0, -24, 14, '#6a5a8a', 800);
      ctx.fillStyle = '#e06c4f'; D.circle(ctx, 0, -40, 7); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f2c94c'; D.circle(ctx, f.x + 60, f.y + 600, 12); ctx.fill();
      ctx.fillStyle = '#7fb3e0'; D.rr(ctx, f.x + 120, f.y + 580, 30, 22, 6); ctx.fill();
      text(ctx, 'click to open', f.x + f.w / 2, f.y + 800, 14, 'rgba(60,100,90,0.6)', 800);
      return;
    }
    // open: interior
    ctx.fillStyle = '#9fcfbf'; D.rr(ctx, f.x, f.y, f.w, f.h, 26); ctx.fill();
    const ig = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
    ig.addColorStop(0, '#fbfffd'); ig.addColorStop(1, '#e3f1ec');
    ctx.fillStyle = ig; D.rr(ctx, f.x + 26, f.y + 24, f.w - 40, f.h - 110, 12); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,0.5)'; D.circle(ctx, f.x + f.w / 2 + 6, f.y + 40, 30); ctx.fill();
    for (const sy of [172, 344, 512]) {
      ctx.fillStyle = 'rgba(190,225,240,0.8)'; ctx.fillRect(f.x + 26, sy, f.w - 40, 7);
    }
    ctx.fillStyle = 'rgba(200,230,220,0.9)'; D.rr(ctx, f.x + 34, f.y + 580, f.w - 56, 170, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(120,170,155,0.6)'; ctx.lineWidth = 2; D.rr(ctx, f.x + 34, f.y + 580, f.w - 56, 170, 10); ctx.stroke();
    // door edge (open towards us, on the left)
    ctx.fillStyle = '#8cc2b1'; D.rr(ctx, f.x, f.y, 26, f.h, 12); ctx.fill();
    ctx.fillStyle = '#9fcfbf'; ctx.fillRect(f.x, f.y + f.h - 90, f.w, 90);
    text(ctx, 'click edge to close', f.x + f.w / 2 + 6, f.y + f.h - 46, 13, 'rgba(40,80,70,0.7)', 800);
    for (const s of sources) if (s.fridge) A.drawSource(ctx, s, s.x, s.y, 0);
  };

  // ---------------------------------------------------------------- pantry & fridge item icons
  A.drawSource = function (ctx, s, x, base, tilt) {
    const w = s.w, h = s.h;
    ctx.save();
    ctx.translate(x, base - h / 2);
    ctx.rotate(tilt);
    const y0 = -h / 2;
    switch (s.look) {
      case 'shaker':
        ctx.fillStyle = 'rgba(220,235,240,0.9)'; D.rr(ctx, -w / 2, y0 + 16, w, h - 16, 8); ctx.fill();
        ctx.fillStyle = '#ffffff'; D.rr(ctx, -w / 2 + 4, y0 + 30, w - 8, h - 34, 6); ctx.fill();
        ctx.fillStyle = '#b8bfc6'; D.rr(ctx, -w / 2 - 2, y0, w + 4, 18, 6); ctx.fill();
        ctx.fillStyle = '#6d747b'; for (let i = -1; i <= 1; i++) { D.circle(ctx, i * 8, y0 + 8, 1.8); ctx.fill(); }
        text(ctx, 'S', 0, y0 + 46, 18, '#7c8a96', 900);
        break;
      case 'grinder':
        ctx.fillStyle = '#6b4a33'; D.rr(ctx, -w / 2, y0 + 30, w, h - 30, 10); ctx.fill();
        ctx.fillStyle = '#4a3324'; D.rr(ctx, -w / 2 + 3, y0, w - 6, 34, 12); ctx.fill();
        ctx.fillStyle = '#8a6a50'; D.circle(ctx, 0, y0 + 2, 5); ctx.fill();
        text(ctx, 'P', 0, y0 + 56, 16, '#d9c0a0', 900);
        break;
      case 'jar':
        ctx.fillStyle = 'rgba(225,238,242,0.75)'; D.rr(ctx, -w / 2, y0 + 12, w, h - 12, 10); ctx.fill();
        ctx.fillStyle = s.color; D.rr(ctx, -w / 2 + 4, y0 + h * 0.35, w - 8, h * 0.62, 7); ctx.fill();
        if (s.ing === 'chili') { ctx.fillStyle = '#f0b04a'; for (let i = 0; i < 12; i++) { D.circle(ctx, (hash(i) - 0.5) * (w - 12), y0 + h * 0.45 + hash(i * 3) * h * 0.45, 1.5); ctx.fill(); } }
        if (s.ing === 'rice') { ctx.fillStyle = '#e2dccb'; for (let i = 0; i < 16; i++) { D.ellipse(ctx, (hash(i) - 0.5) * (w - 12), y0 + h * 0.42 + hash(i * 3) * h * 0.5, 2.5, 1.2, i); ctx.fill(); } }
        ctx.fillStyle = '#c27b4c'; D.rr(ctx, -w / 2 - 2, y0, w + 4, 15, 5); ctx.fill();
        ctx.fillStyle = '#fff7e8'; D.rr(ctx, -w / 2 + 6, y0 + h * 0.5, w - 12, 18, 3); ctx.fill();
        text(ctx, s.label.split(' ')[0].toUpperCase(), 0, y0 + h * 0.5 + 9, 9, '#7a5a40', 900);
        break;
      case 'bag':
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 14); ctx.lineTo(w / 2, y0 + 14); ctx.lineTo(w / 2 + 3, y0 + h); ctx.lineTo(-w / 2 - 3, y0 + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d6c6a4'; ctx.fillRect(-w / 2, y0, w, 18);
        ctx.fillStyle = '#5b86b8'; D.rr(ctx, -w / 2 + 8, y0 + 40, w - 16, 30, 4); ctx.fill();
        text(ctx, 'FLOUR', 0, y0 + 55, 13, '#ffffff', 900);
        break;
      case 'tin':
        ctx.fillStyle = s.color; D.rr(ctx, -w / 2, y0 + 8, w, h - 8, 6); ctx.fill();
        ctx.fillStyle = '#c0c4c8'; D.rr(ctx, -w / 2 - 1, y0, w + 2, 12, 4); ctx.fill();
        ctx.fillStyle = '#fff2d8'; D.rr(ctx, -w / 2 + 5, y0 + 22, w - 10, 26, 3); ctx.fill();
        text(ctx, 'BAKING', 0, y0 + 30, 8, '#c13d32', 900); text(ctx, 'POWDER', 0, y0 + 40, 8, '#c13d32', 900);
        break;
      case 'bottle':
        ctx.fillStyle = s.ing === 'oil' ? 'rgba(170,190,90,0.9)' : 'rgba(150,80,30,0.95)';
        ctx.beginPath(); ctx.moveTo(-6, y0); ctx.lineTo(6, y0); ctx.lineTo(6, y0 + 30); ctx.quadraticCurveTo(w / 2, y0 + 40, w / 2, y0 + 56); ctx.lineTo(w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + 56); ctx.quadraticCurveTo(-w / 2, y0 + 40, -6, y0 + 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#3a3a3a'; D.rr(ctx, -7, y0 - 6, 14, 12, 3); ctx.fill();
        ctx.fillStyle = '#fff5e0'; D.rr(ctx, -w / 2 + 4, y0 + h * 0.55, w - 8, 26, 3); ctx.fill();
        text(ctx, s.ing === 'oil' ? 'OLIVE' : 'MAPLE', 0, y0 + h * 0.55 + 9, 8, '#5a6a2a', 900);
        text(ctx, s.ing === 'oil' ? 'OIL' : 'SYRUP', 0, y0 + h * 0.55 + 19, 8, '#5a6a2a', 900);
        break;
      case 'can':
        ctx.fillStyle = '#c0c4c8'; D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
        ctx.fillStyle = s.color; ctx.fillRect(-w / 2, y0 + 10, w, h - 20);
        ctx.fillStyle = '#ffe9c9'; D.circle(ctx, 0, y0 + h / 2, 15); ctx.fill();
        ctx.fillStyle = '#d8392c'; D.circle(ctx, 0, y0 + h / 2, 10); ctx.fill();
        ctx.fillStyle = '#3f8a35'; D.ellipse(ctx, 0, y0 + h / 2 - 9, 5, 2); ctx.fill();
        break;
      case 'tall':
        ctx.fillStyle = 'rgba(225,238,242,0.75)'; D.rr(ctx, -w / 2, y0 + 10, w, h - 10, 8); ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) { const xx = -w / 2 + 7 + i * ((w - 14) / 13); ctx.beginPath(); ctx.moveTo(xx, y0 - 6 + hash(i) * 8); ctx.lineTo(xx + 2, y0 + h - 4); ctx.stroke(); }
        ctx.fillStyle = '#fff7e8'; D.rr(ctx, -w / 2 + 6, y0 + h * 0.6, w - 12, 18, 3); ctx.fill();
        text(ctx, 'SPAGHETTI', 0, y0 + h * 0.6 + 9, 8, '#7a5a40', 900);
        break;
      case 'eggs':
        ctx.fillStyle = '#d8c9ad'; D.rr(ctx, -w / 2, y0 + 14, w, h - 14, 6); ctx.fill();
        for (let i = 0; i < 4; i++) { const g = ctx.createRadialGradient(-w / 2 + 16 + i * 24 - 3, y0 + 10, 1, -w / 2 + 16 + i * 24, y0 + 16, 12); g.addColorStop(0, '#fff7ea'); g.addColorStop(1, '#e8cfae'); ctx.fillStyle = g; D.ellipse(ctx, -w / 2 + 16 + i * 24, y0 + 16, 10, 13); ctx.fill(); }
        ctx.fillStyle = '#c4b393'; ctx.fillRect(-w / 2, y0 + 24, w, h - 24);
        break;
      case 'butter':
        ctx.fillStyle = '#eef2f4'; D.rr(ctx, -w / 2, y0 + h - 12, w, 12, 6); ctx.fill();
        ctx.fillStyle = '#f6dc7a'; D.rr(ctx, -w / 2 + 8, y0 + 4, w - 16, h - 14, 4); ctx.fill();
        ctx.fillStyle = '#fbeaa8'; ctx.fillRect(-w / 2 + 10, y0 + 6, w - 22, 5);
        break;
      case 'carton':
        ctx.fillStyle = '#fbfbf8'; ctx.fillRect(-w / 2, y0 + 20, w, h - 20);
        ctx.fillStyle = '#e8ecef'; ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 20); ctx.lineTo(0, y0); ctx.lineTo(w / 2, y0 + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5b9bd5'; ctx.fillRect(-w / 2, y0 + 44, w, 26);
        text(ctx, 'MILK', 0, y0 + 57, 12, '#ffffff', 900);
        break;
      case 'tub':
        ctx.fillStyle = '#f7f1df'; D.rr(ctx, -w / 2, y0 + 10, w, h - 10, 6); ctx.fill();
        ctx.fillStyle = '#2f6b45'; D.rr(ctx, -w / 2 - 2, y0, w + 4, 12, 4); ctx.fill();
        text(ctx, 'PARM', 0, y0 + 34, 10, '#2f6b45', 900);
        break;
      case 'tomato':
        for (const dx of [-11, 11]) { ctx.fillStyle = '#d8392c'; D.circle(ctx, dx, y0 + h / 2 + 4, 14); ctx.fill(); ctx.fillStyle = '#3f8a35'; D.ellipse(ctx, dx, y0 + h / 2 - 9, 5, 2); ctx.fill(); }
        break;
      case 'chicken':
        ctx.fillStyle = '#e9edf0'; D.ellipse(ctx, 0, y0 + h - 8, w / 2, 9); ctx.fill();
        ctx.fillStyle = '#f2b5ab'; D.ellipse(ctx, -8, y0 + h / 2, 34, 15); ctx.fill();
        ctx.fillStyle = '#efa597'; D.ellipse(ctx, 18, y0 + h / 2 + 2, 22, 12); ctx.fill();
        break;
      case 'bacon':
        ctx.fillStyle = 'rgba(230,240,245,0.7)'; D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fbe6dc'; ctx.fillRect(-w / 2 + 6, y0 + 6 + i * 11, w - 12, 9); ctx.fillStyle = '#e07b74'; ctx.fillRect(-w / 2 + 6, y0 + 8 + i * 11, w - 12, 3); }
        break;
      case 'parsley':
        ctx.strokeStyle = '#6aa04e'; ctx.lineWidth = 2;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, y0 + h); ctx.lineTo(i * 8, y0 + 18); ctx.stroke(); ctx.fillStyle = i % 2 ? '#3f8f3a' : '#4fa047'; D.blob(ctx, i * 8, y0 + 16, 10, i + 5, 0.4, 8); ctx.fill(); }
        break;
      default:
        ctx.fillStyle = '#ccc'; D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
    }
    ctx.restore();
  };

  A.sourceIcon = function (ctx, s, x, y, pouring, t) {
    if (s.unit) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    const tilt = pouring ? 2.2 + Math.sin(t * 10) * 0.05 : 0.2;
    A.drawSource(ctx, s, x, y + s.h / 2, tilt);
    ctx.restore();
  };

  A.stream = function (ctx, x0, y0, p1, col, t, kind) {
    ctx.save();
    if (kind === 'grains') {
      ctx.fillStyle = col === '#ffffff' || col === '#fffdf6' || col === '#f3eee2' || col === '#f7f7f4' ? '#f4f4f4' : col;
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 14; i++) {
        const f = (t * 3 + i / 14) % 1;
        const x = x0 + (p1.x - x0) * f + Math.sin(i * 7) * 4, y = y0 + (p1.y - y0) * f;
        D.circle(ctx, x, y, 2); ctx.fill(); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = rgba(col, 0.85);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const n = 10;
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        ctx.lineTo(x0 + (p1.x - x0) * f + Math.sin(f * 9 + t * 25) * 1.5, y0 + (p1.y - y0) * f);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- overlays
  function wrapLines(ctx, s, maxW) {
    const words = s.split(' ');
    const out = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
    return out;
  }

  A.tooltip = function (ctx, info, mx, my) {
    const l = L();
    const maxW = 330;
    ctx.save();
    ctx.font = `800 17px ${FONT}`;
    const tl = wrapLines(ctx, info.title, maxW);
    ctx.font = `600 15px ${FONT}`;
    const bl = [];
    for (const s of info.lines) bl.push(...wrapLines(ctx, s, maxW));
    ctx.font = `800 17px ${FONT}`;
    let w = Math.max(...tl.map((s) => ctx.measureText(s).width));
    ctx.font = `600 15px ${FONT}`;
    for (const s of bl) w = Math.max(w, ctx.measureText(s).width);
    w += 28;
    const h = tl.length * 22 + bl.length * 20 + 20;
    let x = mx + 22, y = my + 22;
    if (x + w > l.W - 8) x = mx - w - 16;
    if (y + h > l.H - 8) y = my - h - 16;
    ctx.fillStyle = 'rgba(44,32,26,0.92)';
    D.rr(ctx, x, y, w, h, 12); ctx.fill();
    let yy = y + 20;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `800 17px ${FONT}`; ctx.fillStyle = '#ffe7c2';
    for (const s of tl) { ctx.fillText(s, x + 14, yy); yy += 22; }
    ctx.font = `600 15px ${FONT}`; ctx.fillStyle = '#f3e6d6';
    for (const s of bl) { ctx.fillText(s, x + 14, yy); yy += 20; }
    ctx.restore();
  };

  A.bubble = function (ctx, lines, x, y, t) {
    ctx.save();
    ctx.globalAlpha = clamp(t / 0.4, 0, 1);
    ctx.font = `700 17px ${FONT}`;
    const w = Math.max(...lines.map((s) => ctx.measureText(s).width)) + 30;
    const h = lines.length * 24 + 18;
    let bx = clamp(x - w / 2, 10, L().W - w - 10), by = y - h - 50;
    if (by < 10) by = y + 40;
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#6b4d3a'; ctx.lineWidth = 2.5;
    D.rr(ctx, bx, by, w, h, 16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, by + h); ctx.lineTo(x, by + h + 18); ctx.lineTo(x + 8, by + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3428'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((s, i) => ctx.fillText(s, bx + 15, by + 21 + i * 24));
    ctx.restore();
  };
})();
