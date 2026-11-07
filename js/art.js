// Static kitchen art: walls, shelves, fridge, stove, sink, toaster, utensils, tooltips.
// Everything that never changes is painted once into offscreen layers (see `layer`) and blitted
// each frame; only the moving bits (clouds, clock hands, flames, knobs, water...) are drawn live.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, hash, mix, rgba, browned } = CK;
  const D = CK.D;
  const A = (CK.KitchenArt = {});
  const L = () => CK.LAYOUT;
  const FONT = 'Mali, "Trebuchet MS", system-ui, sans-serif';
  const TAU = Math.PI * 2;
  const lighten = (h, f) => D.lighten(h, f);
  const deepen = (h, f) => D.deepen(h, f);
  const theme = () => CK.THEME || CK.CUISINES[0].theme;

  function text(ctx, s, x, y, size, col, weight, align) {
    ctx.font = `${weight || 700} ${size}px ${FONT}`;
    ctx.fillStyle = col;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  A.text = text;

  // ---------------------------------------------------------------- cached layers
  // A layer is painted once at the current device scale and then copied pixel-for-pixel.
  // Repainted when the scale changes (window resize) or when web fonts finish loading.
  const layers = {};
  let gen = 0;
  A.invalidate = () => { gen++; };
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      document.fonts.ready.then(A.invalidate);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', A.invalidate);
    } catch (e) { /* fonts API unavailable: layers just keep their first paint */ }
  }
  function layer(ctx, key, x, y, w, h, draw) {
    const tr = typeof document !== 'undefined' && ctx.getTransform ? ctx.getTransform() : null;
    if (!tr || tr.b || tr.c || !(tr.a > 0)) { draw(ctx); return; }
    const sc = Math.min(3, tr.a);
    let ly = layers[key];
    if (!ly || Math.abs(ly.sc - sc) > 1e-3 || ly.gen !== gen) {
      const cv = (ly && ly.cv) || document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * sc));
      cv.height = Math.max(1, Math.ceil(h * sc));
      const c2 = cv.getContext('2d');
      c2.setTransform(sc, 0, 0, sc, -x * sc, -y * sc);
      draw(c2);
      ly = layers[key] = { cv, sc, gen };
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(tr.e + x * tr.a), dy = Math.round(tr.f + y * tr.d);
    if (Math.abs(sc - tr.a) < 1e-3) ctx.drawImage(ly.cv, dx, dy);
    else ctx.drawImage(ly.cv, dx, dy, w * tr.a, h * tr.d);
    ctx.restore();
  }
  A.layer = layer;

  // fake items for decorative baskets
  const deco = {};
  function fake(ing, n) {
    const k = ing + n;
    if (!deco[k]) { deco[k] = CK.makeUnit(ing); deco[k].id = 9000 + n * 13 + ing.length; deco[k].rot = hash(n * 3.3) * 6.28; }
    return deco[k];
  }

  // ---------------------------------------------------------------- small painting helpers
  function vgrad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  function hgrad(ctx, x0, x1, stops) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  // soft rounded drop shadow (no blur: two stacked translucent shapes)
  function softShadowRR(ctx, x, y, w, h, r, dx, dy, a) {
    ctx.fillStyle = `rgba(60,34,14,${a * 0.5})`; D.rr(ctx, x + dx - 2, y + dy - 1, w + 4, h + 4, r + 2); ctx.fill();
    ctx.fillStyle = `rgba(60,34,14,${a})`; D.rr(ctx, x + dx, y + dy, w, h, r); ctx.fill();
  }
  function softShadowC(ctx, x, y, r, dx, dy, a) {
    ctx.fillStyle = `rgba(60,34,14,${a * 0.5})`; D.circle(ctx, x + dx, y + dy, r + 3); ctx.fill();
    ctx.fillStyle = `rgba(60,34,14,${a})`; D.circle(ctx, x + dx, y + dy, r); ctx.fill();
  }
  function woodGrain(ctx, x, y, w, h, seed, col, n, amp) {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const yy = y + (i + 0.5) * (h / n) + (hash(seed + i * 3.1) - 0.5) * (h / n) * 0.6;
      const a = (amp || 3) * (0.5 + hash(seed + i));
      ctx.beginPath(); ctx.moveTo(x, yy);
      ctx.bezierCurveTo(x + w * 0.3, yy - a, x + w * 0.6, yy + a, x + w, yy - a * 0.3);
      ctx.stroke();
    }
  }
  function screw(ctx, x, y, r) {
    ctx.fillStyle = '#8f8a84'; D.circle(ctx, x, y, r); ctx.fill();
    ctx.fillStyle = '#c9c4bc'; D.circle(ctx, x - r * 0.2, y - r * 0.2, r * 0.75); ctx.fill();
    ctx.strokeStyle = '#7a756f'; ctx.lineWidth = r * 0.35;
    ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.2); ctx.lineTo(x + r * 0.45, y - r * 0.4); ctx.stroke();
  }

  // ---------------------------------------------------------------- wall
  A.background = function (ctx, k) {
    const l = L();
    drawView(ctx, k, l.window);
    layer(ctx, 'wall', 0, 0, l.W, l.counter.y, drawWall);
    clockHands(ctx, k);
    timerReadout(ctx, k);
  };

  function drawView(ctx, k, w) {
    ctx.save();
    ctx.beginPath(); ctx.rect(w.x, w.y, w.w, w.h); ctx.clip();
    layer(ctx, 'sky', w.x, w.y, w.w, w.h, (c) => {
      c.fillStyle = vgrad(c, w.y, w.y + w.h, ['#93c9e6', '#bfe0ee', '#f6e6c8', '#fbdcb2']);
      c.fillRect(w.x, w.y, w.w, w.h);
      const sx = w.x + w.w * 0.78, sy = w.y + 46;
      const g = c.createRadialGradient(sx, sy, 4, sx, sy, 90);
      g.addColorStop(0, 'rgba(255,248,215,0.95)'); g.addColorStop(0.2, 'rgba(255,236,180,0.6)'); g.addColorStop(1, 'rgba(255,236,180,0)');
      c.fillStyle = g; c.fillRect(w.x, w.y, w.w, w.h);
      c.fillStyle = '#fff6d6'; D.circle(c, sx, sy, 15); c.fill();
    });
    // drifting clouds
    const t = k.time * 4;
    for (let i = 0; i < 3; i++) {
      const cx = w.x + ((i * 97 + t) % (w.w + 80)) - 40, cy = w.y + 40 + i * 30;
      cloud(ctx, cx, cy, 1 - i * 0.12);
    }
    layer(ctx, 'land', w.x, w.y, w.w, w.h, (c) => drawLand(c, w));
    ctx.restore();
  }
  function cloud(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(214,214,232,0.7)';
    D.ellipse(ctx, x + 4 * s, y + 4 * s, 32 * s, 9 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    D.ellipse(ctx, x, y, 30 * s, 10 * s); ctx.fill();
    D.circle(ctx, x - 12 * s, y - 4 * s, 10 * s); ctx.fill();
    D.circle(ctx, x + 6 * s, y - 8 * s, 13 * s); ctx.fill();
    D.circle(ctx, x + 20 * s, y - 2 * s, 8 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,0.9)';
    D.circle(ctx, x + 2 * s, y - 12 * s, 6 * s); ctx.fill();
  }
  function drawLand(c, w) {
    // distant hills
    c.fillStyle = '#b4d4ae'; D.ellipse(c, w.x + 190, w.y + w.h + 6, 150, 62); c.fill();
    c.fillStyle = '#a7cb9d'; D.ellipse(c, w.x + 20, w.y + w.h + 14, 110, 56); c.fill();
    // near hills
    c.fillStyle = '#8fbf7a'; D.ellipse(c, w.x + 60, w.y + w.h + 10, 120, 50); c.fill();
    c.fillStyle = '#76a965'; D.ellipse(c, w.x + 220, w.y + w.h + 20, 110, 60); c.fill();
    c.fillStyle = 'rgba(255,255,220,0.25)'; D.ellipse(c, w.x + 40, w.y + w.h - 30, 70, 10, -0.08); c.fill();
    // little flowers in the meadow
    for (let i = 0; i < 18; i++) {
      const fx = w.x + 10 + hash(i * 3.3) * (w.w - 20), fy = w.y + w.h - 6 - hash(i * 7.7) * 22;
      c.fillStyle = i % 3 === 0 ? '#f6d36b' : i % 3 === 1 ? '#fff4ee' : '#f2a3a0';
      D.circle(c, fx, fy, 1.6); c.fill();
    }
    // a little fence
    c.strokeStyle = '#d8c3a0'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(w.x, w.y + w.h - 18); c.lineTo(w.x + 120, w.y + w.h - 26); c.moveTo(w.x, w.y + w.h - 10); c.lineTo(w.x + 120, w.y + w.h - 18); c.stroke();
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const fx = w.x + 8 + i * 22; c.beginPath(); c.moveTo(fx, w.y + w.h - 5 - i * 1.4); c.lineTo(fx, w.y + w.h - 30 - i * 1.4); c.stroke(); }
    // the tree
    c.fillStyle = vgrad(c, w.y + 90, w.y + w.h, ['#8a6646', '#6e5036']);
    c.beginPath(); c.moveTo(w.x + 199, w.y + w.h); c.lineTo(w.x + 201, w.y + 90); c.lineTo(w.x + 209, w.y + 90); c.lineTo(w.x + 212, w.y + w.h); c.closePath(); c.fill();
    c.strokeStyle = '#6e5036'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(w.x + 205, w.y + 120); c.quadraticCurveTo(w.x + 196, w.y + 110, w.x + 186, w.y + 108); c.stroke();
    const blobs = [[205, 82, 40], [180, 105, 28], [232, 104, 30], [190, 70, 22], [222, 66, 24]];
    c.fillStyle = '#4e8a45';
    for (const [bx, by, br] of blobs) { D.circle(c, w.x + bx + 3, w.y + by + 4, br); c.fill(); }
    c.fillStyle = '#5f9b52';
    for (const [bx, by, br] of blobs) { D.circle(c, w.x + bx, w.y + by, br); c.fill(); }
    c.fillStyle = '#76b062';
    for (const [bx, by, br] of blobs) { D.circle(c, w.x + bx - br * 0.3, w.y + by - br * 0.35, br * 0.5); c.fill(); }
    // apples
    c.fillStyle = '#e0604a';
    for (const [ax, ay] of [[190, 88], [222, 96], [206, 64], [176, 110], [240, 80]]) { D.circle(c, w.x + ax, w.y + ay, 3.2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (const [ax, ay] of [[190, 88], [222, 96], [206, 64], [176, 110], [240, 80]]) { D.circle(c, w.x + ax - 1, w.y + ay - 1, 1); c.fill(); }
    // two birds
    c.strokeStyle = 'rgba(80,80,100,0.6)'; c.lineWidth = 1.5;
    for (const [bx, by] of [[60, 34], [78, 46]]) { c.beginPath(); c.moveTo(w.x + bx - 5, w.y + by); c.quadraticCurveTo(w.x + bx - 2, w.y + by - 4, w.x + bx, w.y + by); c.quadraticCurveTo(w.x + bx + 2, w.y + by - 4, w.x + bx + 5, w.y + by); c.stroke(); }
  }

  function drawWall(c) {
    const l = L();
    const cy = l.counter.y;
    const th = theme();
    c.fillStyle = vgrad(c, 0, cy, th.wall);
    c.fillRect(0, 0, l.W, cy);
    if (th.stripes) {
      // warm plaster with a gentle wallpaper stripe and tiny sprigs
      c.fillStyle = 'rgba(214,184,140,0.16)';
      for (let x = 256; x < l.W; x += 36) c.fillRect(x, 0, 12, cy - 48);
      c.fillStyle = 'rgba(214,184,140,0.08)';
      for (let x = 256; x < l.W; x += 36) { c.fillRect(x - 3, 0, 1.5, cy - 48); c.fillRect(x + 13.5, 0, 1.5, cy - 48); }
      for (let x = 256 + 30; x < l.W; x += 36) {
        for (let y = 20 + ((x / 36) % 2) * 22; y < cy - 60; y += 44) {
          c.fillStyle = 'rgba(200,140,110,0.18)';
          for (let p = 0; p < 4; p++) { const a = p * 1.57 + 0.4; D.circle(c, x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.5); c.fill(); }
          c.fillStyle = 'rgba(150,170,110,0.2)'; D.ellipse(c, x + 3, y + 5, 2.5, 1.1, 0.6); c.fill();
        }
      }
    } else {
      // whitewash: soft brush texture and a few tiny painted dots
      for (let i = 0; i < 260; i++) {
        const x = 256 + hash(i * 3.7) * (l.W - 256), y = hash(i * 5.3) * (cy - 50);
        c.fillStyle = `rgba(${hash(i) < 0.5 ? '200,180,150' : '255,255,250'},${0.05 + hash(i * 1.9) * 0.07})`;
        D.ellipse(c, x, y, 10 + hash(i * 2.3) * 26, 3 + hash(i * 4.1) * 5, (hash(i * 7.7) - 0.5) * 0.5); c.fill();
      }
      // a painted band just under the ceiling
      c.fillStyle = 'rgba(70,110,170,0.16)'; c.fillRect(256, 6, l.W - 256, 3);
      for (let x = 262; x < l.W; x += 22) {
        c.fillStyle = 'rgba(190,60,50,0.22)'; D.circle(c, x, 16, 2.2); c.fill();
        c.fillStyle = 'rgba(80,130,70,0.22)'; D.ellipse(c, x + 8, 16, 3.5, 1.4, 0.5); c.fill();
      }
    }
    // warm light falling from the window
    const w = l.window;
    const lg = c.createRadialGradient(w.x + w.w / 2, w.y + w.h / 2, 60, w.x + w.w / 2, w.y + w.h / 2, 420);
    lg.addColorStop(0, 'rgba(255,246,220,0.45)'); lg.addColorStop(1, 'rgba(255,246,220,0)');
    c.fillStyle = lg; c.fillRect(256, 0, l.W - 256, cy - 48);
    // a soft shade along the top
    c.fillStyle = vgrad(c, 0, 40, ['rgba(120,80,40,0.10)', 'rgba(120,80,40,0)']);
    c.fillRect(0, 0, l.W, 40);
    drawTiles(c, l);
    drawWindow(c, w);
    if (th.motif === 'petrykivka') drawPetrykivka(c, 1050, 236, 1);
    drawPantryShelves(c, l);
    for (const d of th.shelfDeco || []) drawShelfDeco(c, d);
    for (const s of CK.SOURCES) if (!s.fridge && !s.basket && !s.bread && !s.fruit && !s.plant) A.drawSource(c, s, s.x, s.y, 0);
    // dish shelf with a plate rail
    shelf(c, 728, l.dishShelfY, 264, 10, [748, 972]);
    c.strokeStyle = '#9a6a44'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(732, l.dishShelfY - 14); c.lineTo(988, l.dishShelfY - 14); c.stroke();
    c.strokeStyle = 'rgba(255,230,200,0.45)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(732, l.dishShelfY - 15); c.lineTo(988, l.dishShelfY - 15); c.stroke();
    for (const px of [734, 860, 986]) { c.fillStyle = '#8a5b3a'; c.fillRect(px - 2, l.dishShelfY - 16, 4, 16); }
    drawClockFace(c, l.clock);
    drawTimerBody(c, l.timer);
    // rails
    rail(c, 1110, 1590, l.rail);
    rail(c, CK.UTENSIL_RAIL ? CK.UTENSIL_RAIL.x0 : 1110, CK.UTENSIL_RAIL ? CK.UTENSIL_RAIL.x1 : 1440, l.utensilRail);
    const plant = CK.SOURCES.find((s) => s.plant);
    drawHerbPot(c, plant ? plant.pot || plant.ing : null);
  }

  function drawTiles(c, l) {
    const ty = l.counter.y - 48;
    const T = theme().tiles;
    c.fillStyle = T.grout; c.fillRect(256, ty, l.W - 256, 48);
    for (let r = 0; r < 2; r++) {
      for (let x = 256 + (r ? -20 : 0); x < l.W; x += 40) {
        const tx = x + 1.5, tyy = ty + r * 24 + 1.5, tw = 37, th = 21;
        const v = hash(x * 0.37 + r * 11.1);
        const base = v < 0.15 ? T.bases[0] : v < 0.3 ? T.bases[1] : T.bases[2];
        c.fillStyle = vgrad(c, tyy, tyy + th, [lighten(base, 0.35), base, deepen(base, 0.04)]);
        D.rr(c, tx, tyy, tw, th, 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)'; D.rr(c, tx + 3, tyy + 2, tw * 0.5, 2.5, 1.2); c.fill();
        if (v > 0.9 && T.accent === 'stitch') {
          // an occasional tile with a little red-and-black cross-stitch star
          const fx = tx + tw / 2, fy = tyy + th / 2;
          stitchStar(c, fx, fy, 1.6);
        } else if (v > 0.9) {
          // an occasional hand-painted flower tile
          const fx = tx + tw / 2, fy = tyy + th / 2;
          c.fillStyle = 'rgba(110,150,190,0.55)';
          for (let p = 0; p < 5; p++) { const a = p * 1.256; D.ellipse(c, fx + Math.cos(a) * 3.6, fy + Math.sin(a) * 3.6, 2.8, 1.8, a); c.fill(); }
          c.fillStyle = 'rgba(240,190,90,0.8)'; D.circle(c, fx, fy, 1.8); c.fill();
        }
      }
    }
    c.fillStyle = vgrad(c, ty - 6, ty, ['rgba(80,60,40,0)', 'rgba(80,60,40,0.12)']);
    c.fillRect(256, ty - 6, l.W - 256, 6);
    c.fillStyle = T.top; c.fillRect(256, ty - 2, l.W - 256, 3);
  }

  // ---------------------------------------------------------------- Ukrainian decor
  // a cross-stitch "star" (8 arms) made of tiny squares
  function stitchStar(c, x, y, px) {
    const red = '#b8222b', blk = '#2a1d1a';
    const pat = ['..r.r..', '.rr.rr.', 'rrbbbrr', '..bkb..', 'rrbbbrr', '.rr.rr.', '..r.r..'];
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const ch = pat[j][i];
      if (ch === '.') continue;
      c.fillStyle = ch === 'r' ? red : ch === 'k' ? '#c8a24a' : blk;
      c.fillRect(x + (i - 3.5) * px, y + (j - 3.5) * px, px * 0.9, px * 0.9);
    }
  }
  // a band of cross-stitch: zig-zag diamonds in red with black centres
  function stitchBand(c, x, y, w, px, vertical) {
    const n = Math.floor((vertical ? w : w) / px);
    for (let i = 0; i < n; i++) {
      const k = i % 8, h = k < 4 ? k : 8 - k;
      for (let j = -h; j <= h; j++) {
        const edge = Math.abs(j) === h;
        c.fillStyle = edge ? '#b8222b' : (Math.abs(j) < h - 1 ? '#2a1d1a' : '#b8222b');
        if (!edge && Math.abs(j) === h - 1) c.fillStyle = '#d24a3a';
        if (vertical) c.fillRect(x + j * px, y + i * px, px * 0.88, px * 0.88);
        else c.fillRect(x + i * px, y + j * px, px * 0.88, px * 0.88);
      }
    }
  }
  // embroidered rushnyk draped over the window: a white linen towel, ends hanging down both sides
  function drawRushnyk(c, w) {
    const linen = '#fbf7ee', shade = '#e9e1d2';
    const topY = w.y - 26;
    // the rod / peg
    c.fillStyle = '#8a5d3b'; D.rr(c, w.x - 30, topY - 3, w.w + 60, 6, 3); c.fill();
    for (const ex of [w.x - 30, w.x + w.w + 30]) { c.fillStyle = '#7a4f33'; D.circle(c, ex, topY, 5); c.fill(); }
    // the swag across the top
    c.fillStyle = 'rgba(60,34,14,0.12)';
    c.beginPath(); c.moveTo(w.x - 26, topY + 2); c.quadraticCurveTo(w.x + w.w / 2, topY + 44, w.x + w.w + 26, topY + 2); c.lineTo(w.x + w.w + 26, topY + 10); c.quadraticCurveTo(w.x + w.w / 2, topY + 54, w.x - 26, topY + 10); c.closePath(); c.fill();
    c.fillStyle = vgrad(c, topY, topY + 46, [linen, '#f6f0e3', shade]);
    c.beginPath(); c.moveTo(w.x - 26, topY - 2); c.quadraticCurveTo(w.x + w.w / 2, topY + 38, w.x + w.w + 26, topY - 2); c.lineTo(w.x + w.w + 26, topY + 14); c.quadraticCurveTo(w.x + w.w / 2, topY + 52, w.x - 26, topY + 14); c.closePath(); c.fill();
    // a thin embroidered line along the swag
    c.save();
    c.beginPath(); c.moveTo(w.x - 26, topY - 2); c.quadraticCurveTo(w.x + w.w / 2, topY + 38, w.x + w.w + 26, topY - 2); c.lineTo(w.x + w.w + 26, topY + 14); c.quadraticCurveTo(w.x + w.w / 2, topY + 52, w.x - 26, topY + 14); c.closePath(); c.clip();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, x = w.x - 26 + t * (w.w + 52);
      const y = topY + 6 + 76 * t * (1 - t);
      c.fillStyle = i % 4 === 0 ? '#2a1d1a' : '#b8222b';
      c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      if (i % 4 === 2) { c.fillStyle = '#b8222b'; c.fillRect(x - 1.2, y - 4.4, 2.4, 2.4); c.fillRect(x - 1.2, y + 2, 2.4, 2.4); }
    }
    c.restore();
    // the hanging ends
    for (const [sx, dir] of [[w.x - 22, 1], [w.x + w.w - 12, -1]]) {
      const ew = 34, ey0 = topY + 4, ey1 = w.y + 186;
      c.fillStyle = 'rgba(60,34,14,0.12)'; D.rr(c, sx + dir * 3, ey0 + 4, ew, ey1 - ey0, 2); c.fill();
      c.fillStyle = hgrad(c, sx, sx + ew, dir > 0 ? [linen, '#f7f1e5', shade] : [shade, '#f7f1e5', linen]);
      c.fillRect(sx, ey0, ew, ey1 - ey0);
      // soft vertical folds
      c.fillStyle = 'rgba(200,185,160,0.18)'; c.fillRect(sx + ew * 0.35, ey0, 3, ey1 - ey0);
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(sx + ew * 0.2, ey0, 2, ey1 - ey0);
      // embroidered end panel: a band, a big star, a band
      const py = ey1 - 74;
      c.fillStyle = '#b8222b'; c.fillRect(sx + 3, py - 4, ew - 6, 1.6);
      stitchBand(c, sx + 3, py + 4, ew - 6, 2.1, false);
      stitchStar(c, sx + ew / 2, py + 28, 2.6);
      stitchBand(c, sx + 3, py + 52, ew - 6, 2.1, false);
      c.fillStyle = '#b8222b'; c.fillRect(sx + 3, py + 62, ew - 6, 1.6);
      // fringe
      c.strokeStyle = '#efe6d6'; c.lineWidth = 1.2;
      for (let x = sx + 2; x < sx + ew - 1; x += 3) { c.beginPath(); c.moveTo(x, ey1); c.lineTo(x + (hash(x) - 0.5) * 2, ey1 + 9 + hash(x * 3) * 3); c.stroke(); }
      c.strokeStyle = 'rgba(184,34,43,0.6)';
      for (let x = sx + 4; x < sx + ew - 1; x += 9) { c.beginPath(); c.moveTo(x, ey1); c.lineTo(x, ey1 + 10); c.stroke(); }
    }
  }
  // sunflowers in a glass jar on the windowsill
  function drawSunflowers(c, x, base) {
    const heads = [[x - 14, base - 86, 15, -0.25], [x + 12, base - 74, 13, 0.3], [x - 2, base - 104, 12, 0.05]];
    // stems and leaves
    c.lineCap = 'round';
    for (const [hx, hy] of heads) {
      c.strokeStyle = '#5c8a3a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + (hx - x) * 0.15, base - 6); c.quadraticCurveTo(x + (hx - x) * 0.4, (hy + base) / 2, hx, hy + 6); c.stroke();
    }
    for (const [lx, ly, a] of [[x - 12, base - 46, -0.9], [x + 13, base - 40, 0.8], [x + 4, base - 62, -0.4]]) {
      c.fillStyle = '#5f9343'; c.beginPath(); c.ellipse(lx, ly, 11, 4.5, a, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(220,250,190,0.45)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(lx - Math.cos(a) * 9, ly - Math.sin(a) * 9); c.lineTo(lx + Math.cos(a) * 9, ly + Math.sin(a) * 9); c.stroke();
    }
    // jar
    const jw = 30, jh = 36, jx = x - jw / 2, jy = base - jh;
    c.fillStyle = 'rgba(60,34,14,0.15)'; D.ellipse(c, x + 3, base, jw / 2 + 4, 4); c.fill();
    c.fillStyle = 'rgba(200,225,235,0.55)'; D.rr(c, jx, jy, jw, jh, 7); c.fill();
    c.fillStyle = 'rgba(150,200,220,0.35)'; D.rr(c, jx + 2, jy + 12, jw - 4, jh - 14, 6); c.fill();
    c.strokeStyle = 'rgba(110,150,160,0.45)'; c.lineWidth = 1.2; D.rr(c, jx, jy, jw, jh, 7); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.6)'; D.rr(c, jx + 4, jy + 6, 3, jh - 12, 1.5); c.fill();
    // a red ribbon around the neck
    c.fillStyle = '#c0392b'; c.fillRect(jx - 1, jy + 5, jw + 2, 4);
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(jx + jw - 4, jy + 7); c.lineTo(jx + jw + 6, jy + 18); c.lineTo(jx + jw + 1, jy + 18); c.closePath(); c.fill();
    // heads
    for (const [hx, hy, r, tilt] of heads) {
      c.save(); c.translate(hx, hy); c.rotate(tilt);
      c.fillStyle = 'rgba(60,34,14,0.15)'; D.circle(c, 2, 3, r * 1.15); c.fill();
      for (let ring = 0; ring < 2; ring++) {
        const n = 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + ring * (Math.PI / n);
          c.fillStyle = ring ? '#f6c33c' : '#e9a823';
          c.beginPath(); c.ellipse(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.55, r * 0.2, a, 0, TAU); c.fill();
        }
      }
      c.fillStyle = '#5a3a1e'; D.circle(c, 0, 0, r * 0.58); c.fill();
      c.fillStyle = '#3d2614';
      for (let i = 0; i < 18; i++) { const a = i * 2.4, rr = Math.sqrt(i / 18) * r * 0.5; c.fillRect(Math.cos(a) * rr - 0.7, Math.sin(a) * rr - 0.7, 1.4, 1.4); }
      c.fillStyle = 'rgba(255,220,150,0.25)'; D.circle(c, -r * 0.18, -r * 0.18, r * 0.25); c.fill();
      c.restore();
    }
  }
  // a Petrykivka-style painted spray: a curling stem, "grass" brush leaves, a big flower and kalyna berries
  function drawPetrykivka(c, x, y, s) {
    const stroke = (x0, y0, len, a, wid, col) => {
      // a tapered comma stroke: the signature Petrykivka brush mark
      const tx = x0 + Math.cos(a) * len, ty = y0 + Math.sin(a) * len;
      const mx = x0 + Math.cos(a) * len * 0.4, my = y0 + Math.sin(a) * len * 0.4;
      const nx = -Math.sin(a), ny = Math.cos(a);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x0, y0);
      c.quadraticCurveTo(mx + nx * wid * 1.5, my + ny * wid * 1.5, tx, ty);
      c.quadraticCurveTo(mx - nx * wid * 0.35, my - ny * wid * 0.35, x0, y0);
      c.closePath(); c.fill();
    };
    c.save(); c.translate(x, y); c.scale(s, s);
    c.lineCap = 'round';
    // stem (a cubic curve) and two side twigs
    const P = [[0, 150], [-18, 110], [22, 80], [0, 40]];
    const bez = (t) => {
      const u = 1 - t;
      return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]];
    };
    c.strokeStyle = '#3f6b33'; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(0, 150); c.bezierCurveTo(-18, 110, 22, 80, 0, 40); c.stroke();
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-2, 104); c.quadraticCurveTo(-30, 92, -32, 70); c.stroke();
    c.beginPath(); c.moveTo(6, 86); c.quadraticCurveTo(30, 80, 34, 58); c.stroke();
    // leaves: pairs of comma strokes along the stem, big and dark with a light inner stroke
    for (let i = 0; i < 6; i++) {
      const t = 0.08 + i * 0.13;
      const [px, py] = bez(t), [qx, qy] = bez(t + 0.01);
      const ta = Math.atan2(qy - py, qx - px);
      const side = i % 2 ? 1 : -1;
      const a = ta + side * 1.05;
      const len = 21 - i * 1.8;
      stroke(px, py, len, a, 4.2, i % 2 ? '#4f8a3c' : '#5c9a44');
      stroke(px, py, len * 0.62, a + side * 0.18, 2.2, '#8cc063');
    }
    // kalyna berries on the side twigs
    for (const [bx, by] of [[-32, 68], [34, 56]]) {
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9, rr = i ? 6 : 0;
        c.fillStyle = '#b8222b'; D.circle(c, bx + Math.cos(a) * rr, by + Math.sin(a) * rr, 3.4); c.fill();
        c.fillStyle = 'rgba(255,220,200,0.6)'; D.circle(c, bx + Math.cos(a) * rr - 1, by + Math.sin(a) * rr - 1, 1); c.fill();
      }
    }
    // the big flower: layered petals in red, orange and yellow with a dotted heart
    const petals = [['#c0392b', 22, 9], ['#e8742a', 17, 7], ['#f2c14e', 11, 5]];
    for (const [col, len, wid] of petals) {
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        c.fillStyle = col;
        c.beginPath(); c.ellipse(Math.cos(a) * len * 0.55, 40 + Math.sin(a) * len * 0.55, len * 0.5, wid * 0.5, a, 0, TAU); c.fill();
      }
    }
    c.fillStyle = '#7a3b1f'; D.ellipse(c, 0, 42, 8, 5); c.fill();
    c.fillStyle = '#f6e3a0';
    for (let i = 0; i < 6; i++) D.circle(c, -6 + i * 2.4, 40 - Math.abs(i - 2.5) * 0.8, 0.9), c.fill();
    // a little bud and dotted tendrils
    c.fillStyle = '#e8742a'; D.ellipse(c, 20, 118, 5, 7, 0.6); c.fill();
    c.fillStyle = '#c0392b'; D.ellipse(c, 21, 116, 3, 5, 0.6); c.fill();
    c.fillStyle = '#3f6b33';
    for (let i = 0; i < 6; i++) { D.circle(c, -14 - i * 2.2, 124 - i * 3, 1.1 - i * 0.1); c.fill(); }
    c.restore();
  }
  // small non-interactive things on the shelves
  function drawShelfDeco(c, d) {
    const k = d.small ? 0.7 : 1;
    const x = d.x, base = d.y;
    if (d.look === 'jug') {
      // a clay glechyk with a painted flower
      const h = 64 * k, w = 40 * k, y0 = base - h;
      c.fillStyle = 'rgba(60,34,14,0.14)'; D.ellipse(c, x + 2, base - 1, w / 2 + 2, 3); c.fill();
      c.fillStyle = hgrad(c, x - w / 2, x + w / 2, ['#d38a5a', '#b9683c', '#94502c']);
      c.beginPath();
      c.moveTo(x - w * 0.18, y0 + 4 * k); c.lineTo(x + w * 0.18, y0 + 4 * k);
      c.quadraticCurveTo(x + w * 0.16, y0 + h * 0.25, x + w * 0.5, y0 + h * 0.6);
      c.quadraticCurveTo(x + w * 0.52, base - 2, x + w * 0.25, base);
      c.lineTo(x - w * 0.25, base);
      c.quadraticCurveTo(x - w * 0.52, base - 2, x - w * 0.5, y0 + h * 0.6);
      c.quadraticCurveTo(x - w * 0.16, y0 + h * 0.25, x - w * 0.18, y0 + 4 * k);
      c.closePath(); c.fill();
      // handle
      c.strokeStyle = '#a65a32'; c.lineWidth = 4 * k;
      c.beginPath(); c.moveTo(x + w * 0.16, y0 + h * 0.2); c.quadraticCurveTo(x + w * 0.62, y0 + h * 0.18, x + w * 0.42, y0 + h * 0.52); c.stroke();
      c.fillStyle = '#e3a274'; D.ellipse(c, x, y0 + 4 * k, w * 0.2, 2.6 * k); c.fill();
      c.fillStyle = '#5a2e18'; D.ellipse(c, x, y0 + 4 * k, w * 0.14, 1.6 * k); c.fill();
      // painted band: cream glaze with red/green brush strokes
      c.fillStyle = 'rgba(250,236,210,0.85)'; D.ellipse(c, x, y0 + h * 0.66, w * 0.36, h * 0.15); c.fill();
      c.fillStyle = '#c0392b'; D.circle(c, x, y0 + h * 0.66, 3.4 * k); c.fill();
      c.fillStyle = '#4f8a3c';
      for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(x + sx * 7 * k, y0 + h * 0.66, 4 * k, 1.6 * k, sx * 0.4, 0, TAU); c.fill(); }
      c.fillStyle = '#e8a33a'; D.circle(c, x - 11 * k, y0 + h * 0.62, 1.3 * k); c.fill(); D.circle(c, x + 11 * k, y0 + h * 0.62, 1.3 * k); c.fill();
      c.fillStyle = 'rgba(255,230,200,0.35)'; D.rr(c, x - w * 0.36, y0 + h * 0.42, 3, h * 0.4, 1.5); c.fill();
    } else if (d.look === 'bowlstack') {
      // two painted bowls, one on top of the other
      for (let i = 0; i < 2; i++) {
        const by = base - i * 16, bw = 46 - i * 6;
        c.fillStyle = 'rgba(60,34,14,0.12)'; D.ellipse(c, x + 2, by - 1, bw / 2, 3); c.fill();
        c.fillStyle = hgrad(c, x - bw / 2, x + bw / 2, ['#f7f0e2', '#ece2cf', '#d9ccb4']);
        c.beginPath(); c.moveTo(x - bw / 2, by - 16); c.quadraticCurveTo(x - bw / 2 + 2, by, x - bw * 0.25, by); c.lineTo(x + bw * 0.25, by); c.quadraticCurveTo(x + bw / 2 - 2, by, x + bw / 2, by - 16); c.closePath(); c.fill();
        c.fillStyle = '#3f74b5'; c.fillRect(x - bw / 2 + 2, by - 14, bw - 4, 2);
        for (let j = -2; j <= 2; j++) { c.fillStyle = j % 2 ? '#c0392b' : '#3f74b5'; D.circle(c, x + j * bw * 0.16, by - 8, 1.6); c.fill(); }
        c.fillStyle = '#e9dfcb'; D.ellipse(c, x, by - 16, bw / 2, 3); c.fill();
      }
    }
  }

  function drawWindow(c, w) {
    // frame, recess, then cut the glass so the live view shows through
    softShadowRR(c, w.x - 10, w.y - 10, w.w + 20, w.h + 22, 10, 3, 5, 0.12);
    c.fillStyle = hgrad(c, w.x - 10, w.x + w.w + 10, ['#c08a5c', '#b07c52', '#9c6a44']);
    D.rr(c, w.x - 10, w.y - 10, w.w + 20, w.h + 22, 10); c.fill();
    c.strokeStyle = 'rgba(255,225,190,0.45)'; c.lineWidth = 1.5;
    D.rr(c, w.x - 9, w.y - 9, w.w + 18, w.h + 20, 9); c.stroke();
    c.fillStyle = '#8a5d3b'; c.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.fillRect(w.x, w.y, w.w, w.h);
    c.restore();
    // inner shadow at the top of the glass, glass glints
    c.fillStyle = vgrad(c, w.y, w.y + 14, ['rgba(60,40,20,0.22)', 'rgba(60,40,20,0)']);
    c.fillRect(w.x, w.y, w.w, 14);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (const [gx, gw] of [[w.x + 26, 22], [w.x + 58, 8], [w.x + w.w / 2 + 30, 18]]) {
      c.beginPath(); c.moveTo(gx, w.y + w.h); c.lineTo(gx + gw, w.y + w.h); c.lineTo(gx + gw + 70, w.y); c.lineTo(gx + 70, w.y); c.closePath(); c.fill();
    }
    // mullions
    c.fillStyle = '#b07c52';
    c.fillRect(w.x + w.w / 2 - 4, w.y, 8, w.h);
    c.fillRect(w.x, w.y + w.h / 2 - 4, w.w, 8);
    c.fillStyle = 'rgba(255,225,190,0.5)';
    c.fillRect(w.x + w.w / 2 - 4, w.y, 2, w.h);
    c.fillRect(w.x, w.y + w.h / 2 - 4, w.w, 2);
    c.fillStyle = 'rgba(80,50,30,0.25)';
    c.fillRect(w.x + w.w / 2 + 2, w.y, 2, w.h);
    c.fillRect(w.x, w.y + w.h / 2 + 2, w.w, 2);
    // sill
    c.fillStyle = 'rgba(60,34,14,0.15)'; c.fillRect(w.x - 16, w.y + w.h + 18, w.w + 32, 6);
    c.fillStyle = vgrad(c, w.y + w.h + 6, w.y + w.h + 20, ['#cf9a6b', '#a8724a']);
    D.rr(c, w.x - 18, w.y + w.h + 6, w.w + 36, 14, 4); c.fill();
    c.fillStyle = 'rgba(255,235,205,0.5)'; c.fillRect(w.x - 16, w.y + w.h + 7, w.w + 32, 2);
    if (theme().sill === 'sunflowers') drawSunflowers(c, w.x + w.w - 48, w.y + w.h + 7);
    if (theme().window === 'rushnyk') { drawRushnyk(c, w); return; }
    // curtains
    for (const [sx, dir] of [[w.x - 16, 1], [w.x + w.w - 30, -1]]) {
      const path = () => { c.beginPath(); c.moveTo(sx, w.y - 18); c.lineTo(sx + 46, w.y - 18); c.quadraticCurveTo(sx + 26, w.y + 90, sx + 40, w.y + 150); c.lineTo(sx, w.y + 150); c.closePath(); };
      path(); c.fillStyle = 'rgba(60,34,14,0.12)'; c.save(); c.translate(dir * 3, 4); c.fill(); c.restore();
      path(); c.fillStyle = hgrad(c, sx, sx + 46, ['#eaa894', '#e7a28f', '#dc927e']); c.fill();
      c.save(); path(); c.clip();
      // soft folds
      for (let i = 0; i < 4; i++) {
        const fx = sx + 6 + i * 10;
        c.fillStyle = i % 2 ? 'rgba(170,90,70,0.16)' : 'rgba(255,230,215,0.22)';
        c.beginPath(); c.moveTo(fx, w.y - 18); c.quadraticCurveTo(fx - 4 + i * 2, w.y + 70, fx - 2, w.y + 150); c.lineTo(fx + 4, w.y + 150); c.quadraticCurveTo(fx + 2 + i * 2, w.y + 70, fx + 5, w.y - 18); c.closePath(); c.fill();
      }
      // gingham dots
      c.fillStyle = 'rgba(255,245,235,0.55)';
      for (let yy = w.y - 10; yy < w.y + 150; yy += 12) for (let xx = sx + 4 + ((yy / 12) % 2) * 6; xx < sx + 46; xx += 12) { D.circle(c, xx, yy, 1.4); c.fill(); }
      c.restore();
      // tie-back
      const tx = sx + (dir > 0 ? 6 : 8), ty = w.y + 104;
      c.fillStyle = '#c96f5c'; D.rr(c, tx, ty, 28, 7, 3.5); c.fill();
      c.fillStyle = '#f2c94c'; D.circle(c, tx + 14, ty + 3.5, 3.4); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; D.circle(c, tx + 13, ty + 2.5, 1.1); c.fill();
    }
    // valance with a scalloped edge and the rod
    c.fillStyle = '#d98a77'; c.fillRect(w.x - 24, w.y - 22, w.w + 48, 10);
    c.beginPath();
    for (let x = w.x - 24; x < w.x + w.w + 24; x += 12) { c.moveTo(x, w.y - 12); c.arc(x + 6, w.y - 12, 6, Math.PI, 0, true); }
    c.fill();
    c.fillStyle = 'rgba(255,230,215,0.35)'; c.fillRect(w.x - 24, w.y - 22, w.w + 48, 2);
    c.fillStyle = '#9c6a44'; D.rr(c, w.x - 34, w.y - 25, w.w + 68, 5, 2.5); c.fill();
    for (const ex of [w.x - 34, w.x + w.w + 34]) { c.fillStyle = '#8a5d3b'; D.circle(c, ex, w.y - 22.5, 5); c.fill(); c.fillStyle = 'rgba(255,220,180,0.6)'; D.circle(c, ex - 1.5, w.y - 24, 1.6); c.fill(); }
  }

  function shelf(c, x, y, w, th, bx) {
    // the wall shadow under the shelf
    c.fillStyle = vgrad(c, y + th, y + th + 16, ['rgba(80,50,25,0.18)', 'rgba(80,50,25,0)']);
    c.fillRect(x + 4, y + th, w - 8, 16);
    for (const b of bx) {
      c.fillStyle = '#7a4f33';
      c.beginPath(); c.moveTo(b, y + th + 4); c.lineTo(b + 10, y + th + 4); c.quadraticCurveTo(b + 9, y + th + 20, b, y + th + 26); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,220,180,0.25)'; c.fillRect(b, y + th + 4, 2, 18);
    }
    c.fillStyle = vgrad(c, y, y + th, ['#bb8558', '#a8724a', '#9a6640']);
    c.fillRect(x, y, w, th);
    c.save(); c.beginPath(); c.rect(x, y, w, th); c.clip();
    woodGrain(c, x, y, w, th, x + y, 'rgba(110,65,35,0.25)', 3, 1.5);
    c.restore();
    c.fillStyle = 'rgba(255,225,190,0.45)'; c.fillRect(x, y, w, 1.5);
    c.fillStyle = '#8a5b3a'; c.fillRect(x, y + th, w, 4);
    c.fillStyle = 'rgba(60,34,14,0.25)'; c.fillRect(x, y + th + 3, w, 1);
  }
  function drawPantryShelves(c, l) {
    for (const sy of [l.shelfA, l.shelfB, l.shelfC]) shelf(c, l.shelfX0, sy, l.shelfX1 - l.shelfX0, 12, [l.shelfX0 + 30, l.shelfX1 - 40]);
  }

  function rail(c, x0, x1, y) {
    c.fillStyle = 'rgba(60,34,14,0.15)'; D.rr(c, x0, y + 1, x1 - x0, 8, 4); c.fill();
    c.fillStyle = vgrad(c, y - 4, y + 4, ['#b8a48e', '#8a7866', '#6a5a4c']);
    D.rr(c, x0, y - 4, x1 - x0, 8, 4); c.fill();
    c.fillStyle = 'rgba(255,245,230,0.6)'; c.fillRect(x0 + 4, y - 3, x1 - x0 - 8, 1.5);
    for (const x of [x0, x1]) {
      c.fillStyle = '#6e5e50'; D.circle(c, x, y, 7.5); c.fill();
      c.fillStyle = '#9a8876'; D.circle(c, x - 1, y - 1, 5.5); c.fill();
      c.fillStyle = 'rgba(255,245,230,0.7)'; D.circle(c, x - 2.5, y - 2.5, 1.8); c.fill();
    }
  }

  function drawClockFace(c, k) {
    softShadowC(c, k.x, k.y, k.r + 6, 2, 4, 0.14);
    const rg = c.createRadialGradient(k.x - 10, k.y - 12, 4, k.x, k.y, k.r + 7);
    rg.addColorStop(0, '#dca474'); rg.addColorStop(0.8, '#c78f5c'); rg.addColorStop(1, '#a8723f');
    c.fillStyle = rg; D.circle(c, k.x, k.y, k.r + 6); c.fill();
    c.strokeStyle = 'rgba(255,230,200,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(k.x, k.y, k.r + 4.5, 3.4, 4.9); c.stroke();
    const fg = c.createRadialGradient(k.x - 8, k.y - 10, 2, k.x, k.y, k.r);
    fg.addColorStop(0, '#fffdf6'); fg.addColorStop(1, '#f3e8d4');
    c.fillStyle = fg; D.circle(c, k.x, k.y, k.r); c.fill();
    c.strokeStyle = 'rgba(120,80,40,0.25)'; c.lineWidth = 2; D.circle(c, k.x, k.y, k.r - 1); c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.fillStyle = i % 3 ? '#b79a80' : '#8a6a4f';
      D.circle(c, k.x + Math.cos(a) * (k.r - 7), k.y + Math.sin(a) * (k.r - 7), i % 3 ? 1.5 : 2.6); c.fill();
    }
    text(c, '12', k.x, k.y - k.r + 16, 9, '#9b7b5f', 800);
    text(c, '6', k.x, k.y + k.r - 15, 9, '#9b7b5f', 800);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(k.x - 10, k.y - 16, 18, 8, -0.5, 0, TAU); c.fill();
  }
  function clockHands(ctx, k) {
    const c = L().clock;
    const mins = 17 * 60 + 30 + k.world.time / 60;
    const ma = ((mins % 60) / 60) * 6.28 - Math.PI / 2, ha = (((mins / 60) % 12) / 12) * 6.28 - Math.PI / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,34,14,0.18)';
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c.x + 1.5, c.y + 2.5); ctx.lineTo(c.x + 1.5 + Math.cos(ha) * 20, c.y + 2.5 + Math.sin(ha) * 20); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c.x + 1.5, c.y + 2.5); ctx.lineTo(c.x + 1.5 + Math.cos(ma) * 31, c.y + 2.5 + Math.sin(ma) * 31); ctx.stroke();
    ctx.strokeStyle = '#3b2d24';
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(ha) * 20, c.y + Math.sin(ha) * 20); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(ma) * 31, c.y + Math.sin(ma) * 31); ctx.stroke();
    ctx.fillStyle = '#e06c4f'; D.circle(ctx, c.x, c.y, 3.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; D.circle(ctx, c.x - 1, c.y - 1, 1.2); ctx.fill();
  }

  function drawTimerBody(c, tm) {
    softShadowRR(c, tm.x - 40, tm.y - 24, 80, 48, 14, 2, 4, 0.14);
    c.fillStyle = vgrad(c, tm.y - 24, tm.y + 24, ['#f7c46a', '#f0b04a', '#d9933a']);
    D.rr(c, tm.x - 40, tm.y - 24, 80, 48, 14); c.fill();
    c.fillStyle = 'rgba(255,245,220,0.5)'; D.rr(c, tm.x - 34, tm.y - 22, 68, 3, 1.5); c.fill();
    c.fillStyle = '#c98535'; D.rr(c, tm.x - 8, tm.y - 30, 16, 7, 3); c.fill();
    c.fillStyle = '#3a3029'; D.rr(c, tm.x - 32, tm.y - 15, 64, 30, 7); c.fill();
    c.fillStyle = vgrad(c, tm.y - 13, tm.y + 13, ['#2c2420', '#3e342d']);
    D.rr(c, tm.x - 30, tm.y - 13, 60, 26, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; D.rr(c, tm.x - 29, tm.y - 12, 58, 9, 5); c.fill();
  }
  function timerReadout(ctx, k) {
    const T = k.world.timer;
    const tm = L().timer;
    const el = T.running ? k.world.time - T.start : T.acc;
    const mm = Math.floor(el / 60), ss = Math.floor(el % 60);
    if (T.running) { ctx.fillStyle = 'rgba(156,242,163,0.12)'; D.rr(ctx, tm.x - 30, tm.y - 13, 60, 26, 6); ctx.fill(); }
    text(ctx, `${mm}:${String(ss).padStart(2, '0')}`, tm.x, tm.y + 1, 20, T.running ? '#9cf2a3' : '#f7e7c9', 800);
    text(ctx, T.running ? 'tap to stop' : 'timer', tm.x, tm.y + 34, 12, '#8a6a4d', 700);
  }

  function drawHerbPot(c, kind) {
    // little shelf, terracotta pot, and whatever grows in it (basil or dill)
    shelf(c, 1460, 404, 120, 10, []);
    if (!kind) return;
    softShadowRR(c, 1490, 362, 56, 42, 6, 3, 3, 0.12);
    c.fillStyle = hgrad(c, 1488, 1548, ['#d98560', '#c9714e', '#a95a3c']);
    c.beginPath(); c.moveTo(1490, 368); c.lineTo(1546, 368); c.lineTo(1540, 404); c.lineTo(1496, 404); c.closePath(); c.fill();
    c.fillStyle = hgrad(c, 1486, 1550, ['#e2906a', '#cf7752', '#ad5e3f']);
    D.rr(c, 1486, 358, 64, 12, 3); c.fill();
    c.fillStyle = 'rgba(255,225,200,0.45)'; c.fillRect(1489, 359, 58, 2);
    c.fillStyle = '#4a3324'; D.ellipse(c, 1518, 359, 28, 3.5); c.fill();
    if (kind === 'dill') {
      // feathery fronds on thin stems, one yellow umbel
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.3;
        const tx = 1518 + Math.cos(a) * 44, ty = 358 + Math.sin(a) * 50;
        c.strokeStyle = '#5c8f3a'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(1518 + (i - 3) * 2, 358); c.quadraticCurveTo(1518 + (i - 3) * 5, 336, tx, ty); c.stroke();
        // threadlike leaves branching off
        c.strokeStyle = i % 2 ? '#6aa84a' : '#7cb85a'; c.lineWidth = 0.9;
        for (let j = 0; j < 7; j++) {
          const t = 0.35 + j * 0.09;
          const px = 1518 + (i - 3) * 2 + (tx - 1518 - (i - 3) * 2) * t, py = 358 + (ty - 358) * t;
          for (const sd of [-1, 1]) {
            const b = a + sd * 0.9;
            c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(b) * (9 - j * 0.6), py + Math.sin(b) * (9 - j * 0.6)); c.stroke();
          }
        }
      }
      // an umbel of tiny yellow flowers
      const ux = 1540, uy = 306;
      c.strokeStyle = '#7a9a3a'; c.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; c.beginPath(); c.moveTo(ux, uy + 8); c.lineTo(ux + Math.cos(a) * 10, uy + 8 + Math.sin(a) * 7); c.stroke(); c.fillStyle = '#e8c63a'; D.circle(c, ux + Math.cos(a) * 10, uy + 8 + Math.sin(a) * 7, 1.6); c.fill(); }
    } else {
      // basil: stems and glossy leaves
      c.strokeStyle = '#4f8a3a'; c.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.35; c.beginPath(); c.moveTo(1518, 358); c.quadraticCurveTo(1518 + Math.cos(a) * 10, 348, 1518 + Math.cos(a) * 24, 352 + Math.sin(a) * 24); c.stroke(); }
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28;
        const lx = 1518 + Math.cos(a) * 30, ly = 352 + Math.sin(a) * 30;
        c.fillStyle = 'rgba(40,70,30,0.25)'; D.ellipse(c, lx + 1.5, ly + 2, 13, 8, a); c.fill();
        c.fillStyle = i % 2 ? '#3d8b40' : '#4fa04a'; D.ellipse(c, lx, ly, 13, 8, a); c.fill();
        c.fillStyle = 'rgba(220,255,200,0.22)'; D.ellipse(c, lx - Math.sin(a) * 2.5, ly + Math.cos(a) * -2.5, 9, 3.5, a); c.fill();
        c.strokeStyle = 'rgba(220,255,200,0.4)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(lx - Math.cos(a) * 10, ly - Math.sin(a) * 10); c.lineTo(lx + Math.cos(a) * 10, ly + Math.sin(a) * 10); c.stroke();
      }
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 0.4; c.fillStyle = '#5cad52'; D.ellipse(c, 1518 + Math.cos(a) * 14, 346 + Math.sin(a) * 14, 7, 4.5, a); c.fill(); }
    }
    c.fillStyle = '#fbe9d6'; D.rr(c, 1500, 384, 36, 15, 4); c.fill();
    text(c, kind, 1518, 392, 11, '#a95a3c', 800);
  }

  // ---------------------------------------------------------------- utensils hanging
  function drawTool(ctx, id, x, y, ang, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.scale(s || 1, s || 1);
    ctx.lineCap = 'round';
    // drawn hanging: handle at top (0,0) going down
    if (id === 'spoon') {
      ctx.fillStyle = hgrad(ctx, -4, 4, ['#dcab76', '#c8955f', '#a8763f']); D.rr(ctx, -4, 0, 8, 82, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(120,75,35,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-1, 6); ctx.quadraticCurveTo(1, 40, -1, 78); ctx.moveTo(1.8, 12); ctx.quadraticCurveTo(2.6, 44, 1.5, 76); ctx.stroke();
      ctx.fillStyle = '#7a5530'; D.circle(ctx, 0, 6, 2); ctx.fill();
      const g = ctx.createRadialGradient(-5, 88, 2, 0, 96, 21);
      g.addColorStop(0, '#d9a56c'); g.addColorStop(1, '#a8763f');
      ctx.fillStyle = g; D.ellipse(ctx, 0, 96, 14, 20); ctx.fill();
      const g2 = ctx.createRadialGradient(4, 104, 2, 0, 97, 15);
      g2.addColorStop(0, '#b98550'); g2.addColorStop(1, '#8f6234');
      ctx.fillStyle = g2; D.ellipse(ctx, 0, 97, 9.5, 14.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,235,200,0.35)'; D.ellipse(ctx, -4, 90, 2.5, 6, 0.2); ctx.fill();
    } else if (id === 'spatula') {
      ctx.fillStyle = hgrad(ctx, -4, 4, ['#4a4442', '#2f2b2a', '#1e1b1a']); D.rr(ctx, -4, 0, 8, 70, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; D.rr(ctx, -2.5, 4, 1.6, 60, 0.8); ctx.fill();
      ctx.fillStyle = '#1a1716'; D.circle(ctx, 0, 6, 2); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -5, 5, ['#d4d9de', '#9aa2ab']); D.rr(ctx, -5, 62, 10, 9, 2); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -15, 15, ['#ec7059', '#d8573f', '#b9442f']); D.rr(ctx, -15, 68, 30, 42, 6); ctx.fill();
      ctx.fillStyle = 'rgba(110,30,20,0.35)'; for (let i = -1; i <= 1; i++) D.rr(ctx, i * 8 - 1.8, 76, 3.6, 26, 1.8), ctx.fill();
      ctx.fillStyle = 'rgba(255,220,200,0.35)'; D.rr(ctx, -13, 70, 3, 36, 1.5); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,230,0.5)'; ctx.fillRect(-12, 108, 24, 1.2);
    } else if (id === 'whisk') {
      ctx.strokeStyle = 'rgba(120,128,138,0.6)'; ctx.lineWidth = 2.4;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 48); ctx.bezierCurveTo(i * 9, 70, i * 7, 104, 0, 110); ctx.stroke(); }
      ctx.strokeStyle = '#d8dde2'; ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, 48); ctx.bezierCurveTo(i * 9, 70, i * 7, 104, 0, 110); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.7;
      for (let i = -3; i <= 0; i++) { ctx.beginPath(); ctx.moveTo(-0.5, 52); ctx.bezierCurveTo(i * 9 - 0.5, 70, i * 7 - 0.5, 96, -0.5, 104); ctx.stroke(); }
      ctx.fillStyle = hgrad(ctx, -5, 5, ['#6b9cc2', '#4a7fa8', '#38668a']); D.rr(ctx, -5, 0, 10, 50, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; D.rr(ctx, -3, 4, 2, 40, 1); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -5.5, 5.5, ['#e2e6ea', '#9aa2ab']); D.rr(ctx, -5.5, 44, 11, 7, 2); ctx.fill();
      ctx.fillStyle = '#2b4d68'; D.circle(ctx, 0, 6, 2); ctx.fill();
    } else if (id === 'taster') {
      ctx.fillStyle = hgrad(ctx, -2.5, 2.5, ['#d6dce1', '#a2aab2']); D.rr(ctx, -2.5, 10, 5, 62, 2.5); ctx.fill();
      const g = ctx.createRadialGradient(-3, 76, 1, 0, 80, 11);
      g.addColorStop(0, '#f4f7f9'); g.addColorStop(1, '#a9b1b9');
      ctx.fillStyle = g; D.ellipse(ctx, 0, 80, 8, 11); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; D.ellipse(ctx, -2.5, 77, 1.6, 3.5, 0.2); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -4, 4, ['#f08468', '#e06c4f', '#c4553b']); D.rr(ctx, -4, 0, 8, 24, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,220,0.4)'; D.rr(ctx, -2.5, 3, 1.5, 17, 0.8); ctx.fill();
      ctx.fillStyle = '#8a3a28'; D.circle(ctx, 0, 5, 1.6); ctx.fill();
    } else if (id === 'ladle') {
      // steel ladle: long handle with a hook end, a deep round bowl
      ctx.fillStyle = hgrad(ctx, -3, 3, ['#e3e8ec', '#b9c1c8', '#8d969e']); D.rr(ctx, -3, 6, 6, 82, 3); ctx.fill();
      ctx.strokeStyle = '#a9b1b9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 6, 5, Math.PI, Math.PI * 2.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; D.rr(ctx, -1.6, 12, 1.2, 70, 0.6); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -4, 4, ['#7a4f33', '#5e3a24', '#4a2c1a']); D.rr(ctx, -4, 14, 8, 30, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,225,190,0.3)'; D.rr(ctx, -2.5, 17, 1.4, 24, 0.7); ctx.fill();
      const g = ctx.createRadialGradient(-6, 94, 2, 0, 100, 20);
      g.addColorStop(0, '#f2f5f7'); g.addColorStop(0.7, '#bcc4cb'); g.addColorStop(1, '#8a939b');
      ctx.fillStyle = g; D.circle(ctx, 0, 100, 17); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -13, 13, ['#9aa3ab', '#c9d0d6', '#a3acb4']); D.ellipse(ctx, 0, 98, 13, 11); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 100, 15.5, 3.5, 4.6); ctx.stroke();
    } else if (id === 'knife') {
      ctx.fillStyle = hgrad(ctx, -6, 6, ['#5a4032', '#3a2a22', '#2a1e18']); D.rr(ctx, -6, 0, 12, 52, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(140,100,70,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-2, 4); ctx.quadraticCurveTo(0, 26, -2, 48); ctx.stroke();
      ctx.fillStyle = 'rgba(255,230,200,0.18)'; D.rr(ctx, -4.5, 3, 2, 44, 1); ctx.fill();
      ctx.fillStyle = hgrad(ctx, -6, 7, ['#e6eaee', '#b7bec5']); D.rr(ctx, -6.5, 48, 13.5, 7, 2); ctx.fill();
      const bg = ctx.createLinearGradient(-6, 0, 7, 0);
      bg.addColorStop(0, '#c3c9cf'); bg.addColorStop(0.55, '#e4e8ec'); bg.addColorStop(1, '#f6f8fa');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-6, 54); ctx.lineTo(7, 54); ctx.lineTo(7, 150); ctx.quadraticCurveTo(-4, 140, -6, 120); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,130,140,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-1, 56); ctx.lineTo(-1, 128); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(4, 58, 2, 86);
      ctx.fillStyle = '#d7b98a'; for (const ry of [14, 36]) { D.circle(ctx, 0, ry, 2.2); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,250,235,0.7)'; for (const ry of [14, 36]) { D.circle(ctx, -0.6, ry - 0.6, 0.8); ctx.fill(); }
    }
    ctx.restore();
  }
  A.drawTool = drawTool;

  A.utensils = function (ctx, k, tools) {
    const l = L();
    for (const t of tools) {
      // little S-hook on the rail
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4e4138'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, l.utensilRail + 8, 6, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,220,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(t.x, l.utensilRail + 8, 6, Math.PI + 0.3, Math.PI * 1.6); ctx.stroke();
      if (k.tool === t.id) { ctx.fillStyle = 'rgba(80,50,25,0.07)'; D.rr(ctx, t.x - 16, l.utensilRail + 12, 32, 100, 10); ctx.fill(); continue; }
      // a soft shadow on the wall behind it
      ctx.save(); ctx.globalAlpha = 0.14; ctx.translate(3, 4);
      ctx.fillStyle = '#3c2410'; D.rr(ctx, t.x - 7, l.utensilRail + 12, 14, 96, 7); ctx.fill();
      ctx.restore();
      drawTool(ctx, t.id, t.x, l.utensilRail + 10, 0, 1);
    }
  };

  A.knife = function (ctx, k) {
    if (k.tool === 'knife') return;
    const b = L().board;
    ctx.fillStyle = 'rgba(60,34,14,0.16)'; D.rr(ctx, b.x + b.w - 25, b.y + 34, 16, 170, 6); ctx.fill();
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
    ctx.shadowColor = 'rgba(40,20,8,0.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
    // tool's working end at the cursor: rotate so the head points at (px,py)
    const len = id === 'knife' ? 150 : id === 'taster' ? 80 : 100;
    const bob = id === 'knife' ? (k.knifeBob || 0) * 12 : 0;
    ctx.translate(px, py - bob);
    ctx.rotate(Math.PI + ang);
    drawTool(ctx, id, 0, -len, 0, 1);
    ctx.restore();
    // a full ladle shows what's in it
    const h = k.held;
    if (id === 'ladle' && h && h.type === 'ladle') {
      ctx.save();
      D.circle(ctx, px, py, 12.5); ctx.clip();
      if (h.dollop) D.item(ctx, h.items[0], px, py, 0.5);
      else {
        const pool = h.items.find((i) => i.kind === 'fluid' && !i.lump) || h.items[0];
        const col = pool.kind === 'fluid' ? D.fluidColor(pool) : '#d9c9a6';
        ctx.fillStyle = D.dome(ctx, px, py, 12, col, 0.3, 0.12); D.circle(ctx, px, py, 12.5); ctx.fill();
        for (const it of h.items) if (it !== pool && it.kind !== 'fat') D.item(ctx, it, px + (it.px || 0) * 5, py + (it.py || 0) * 5, 0.35);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; D.ellipse(ctx, px - 4, py - 5, 4, 2, -0.5); ctx.fill();
      }
      ctx.restore();
    }
  };

  // ---------------------------------------------------------------- counter & fixtures
  A.counter = function (ctx, k) {
    const l = L();
    layer(ctx, 'counter', 0, l.counter.y, l.W, l.H - l.counter.y, drawCounterStatic);
    // live parts of the fixtures
    const st = l.stove;
    l.burners.forEach((p, i) => {
      const occupied = k.world.containers.some((c) => c.loc.t === 'burner' && c.loc.i === i);
      if (!occupied) A.flame(ctx, p.x, p.y, k.world.burners[i], false, k.time);
    });
    layer(ctx, 'grates', st.x, st.y, st.w, st.h - 70, drawGrates);
    drawKnobs(ctx, k);
    drawTap(ctx, k);
    drawToasterLive(ctx, k);
    if (!k.world.containers.some((c) => c.loc.t === 'pass')) {
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,240,220,0.45)'; ctx.lineWidth = 3;
      D.circle(ctx, l.passSpot.x, l.passSpot.y, 80); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'put the dish here', l.passSpot.x, l.passSpot.y, 15, 'rgba(255,240,220,0.6)', 800);
    }
  };

  function drawCounterStatic(c) {
    const l = L();
    const ct = l.counter;
    // butcher-block planks
    c.fillStyle = vgrad(c, ct.y, ct.y + ct.h, ['#dab38b', '#d3aa7f', '#cca176']);
    c.fillRect(ct.x, ct.y, l.W - ct.x, ct.h);
    for (let y = ct.y, row = 0; y < ct.y + ct.h; y += 54, row++) {
      // planks are staggered: each row is split at a different place
      const split = ct.x + 180 + hash(row * 5.1) * 900;
      for (const [x0, x1, n] of [[ct.x, split, 0], [split, l.W, 1]]) {
        const v = hash(row * 3.3 + n * 7.7);
        c.fillStyle = v < 0.5 ? `rgba(255,235,205,${0.05 + v * 0.1})` : `rgba(140,90,50,${(v - 0.5) * 0.12})`;
        c.fillRect(x0, y, x1 - x0, 54);
        c.save(); c.beginPath(); c.rect(x0, y, x1 - x0, 54); c.clip();
        woodGrain(c, x0, y, x1 - x0, 54, row * 13 + n * 5, 'rgba(140,95,55,0.13)', 7, 4);
        // a knot or two
        if (hash(row * 9.1 + n) > 0.45) {
          const kx = x0 + 40 + hash(row * 2.7 + n) * Math.max(10, x1 - x0 - 80), ky = y + 14 + hash(row * 4.4 + n) * 26;
          c.fillStyle = 'rgba(140,90,50,0.18)'; D.ellipse(c, kx, ky, 9, 4.5); c.fill();
          c.strokeStyle = 'rgba(140,90,50,0.16)'; c.lineWidth = 1;
          D.ellipse(c, kx, ky, 15, 7.5); c.stroke(); D.ellipse(c, kx, ky, 22, 10); c.stroke();
          c.fillStyle = 'rgba(90,55,30,0.25)'; D.ellipse(c, kx, ky, 3.5, 2); c.fill();
        }
        c.restore();
      }
      c.fillStyle = 'rgba(120,75,40,0.28)'; c.fillRect(split - 1, y, 1.5, 54);
      if (y > ct.y) {
        c.fillStyle = 'rgba(120,75,40,0.25)'; c.fillRect(ct.x, y - 1, l.W - ct.x, 1.5);
        c.fillStyle = 'rgba(255,240,215,0.25)'; c.fillRect(ct.x, y + 0.5, l.W - ct.x, 1);
      }
    }
    // shade under the backsplash and the front edge
    c.fillStyle = vgrad(c, ct.y, ct.y + 16, ['rgba(80,50,30,0.3)', 'rgba(80,50,30,0)']);
    c.fillRect(ct.x, ct.y, l.W - ct.x, 16);
    c.fillStyle = vgrad(c, l.H - 14, l.H, ['#9a7050', '#8a6242', '#6e4c34']);
    c.fillRect(0, l.H - 14, l.W, 14);
    c.fillStyle = 'rgba(255,230,200,0.3)'; c.fillRect(0, l.H - 14, l.W, 1.5);
    c.fillStyle = vgrad(c, l.H - 30, l.H - 14, ['rgba(80,50,30,0)', 'rgba(80,50,30,0.12)']);
    c.fillRect(ct.x, l.H - 30, l.W - ct.x, 16);

    drawBaskets(c);
    drawFruitBowl(c);
    drawBreadBoard(c, l.bread);
    drawCuttingBoard(c, l.board);
    drawStoveBase(c, l);
    drawSink(c, l);
    drawToasterBody(c, l.toaster);
    drawCompost(c, l.trash);
    drawPass(c, l.pass);
    drawBell(c, l.bell);
  }

  function drawBaskets(c) {
    for (const s of CK.SOURCES) {
      if (!s.basket) continue;
      softShadowC(c, s.x, s.y, s.r + 4, 3, 5, 0.16);
      c.fillStyle = '#a97a46'; D.circle(c, s.x, s.y, s.r + 5); c.fill();
      // two rows of weave
      for (const [rr, off] of [[s.r + 2.8, 0], [s.r - 0.2, 0.2]]) {
        for (let a = off; a < TAU + off - 0.1; a += 0.4) {
          c.strokeStyle = '#c99a5e'; c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.arc(s.x, s.y, rr, a, a + 0.22); c.stroke();
          c.strokeStyle = 'rgba(255,235,200,0.45)'; c.lineWidth = 1;
          c.beginPath(); c.arc(s.x, s.y, rr - 0.6, a + 0.03, a + 0.16); c.stroke();
        }
      }
      const ig = c.createRadialGradient(s.x + 4, s.y + 6, 2, s.x, s.y, s.r - 2);
      ig.addColorStop(0, '#8a6038'); ig.addColorStop(1, '#5e3f22');
      c.fillStyle = ig; D.circle(c, s.x, s.y, s.r - 2); c.fill();
      c.strokeStyle = 'rgba(40,25,10,0.35)'; c.lineWidth = 1;
      for (let a = 0; a < TAU; a += 0.5) { c.beginPath(); c.moveTo(s.x + Math.cos(a) * 6, s.y + Math.sin(a) * 6); c.lineTo(s.x + Math.cos(a) * (s.r - 3), s.y + Math.sin(a) * (s.r - 3)); c.stroke(); }
      const n = s.ing === 'garlic' ? 4 : 3;
      c.save(); D.circle(c, s.x, s.y, s.r - 2); c.clip();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + 0.4, rr = s.ing === 'garlic' ? 9 : 12;
        D.item(c, fake(s.ing, i), s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, s.ing === 'garlic' ? 0.9 : 0.62);
      }
      c.restore();
      c.strokeStyle = 'rgba(60,35,15,0.35)'; c.lineWidth = 2; D.circle(c, s.x, s.y, s.r - 2); c.stroke();
    }
  }
  function drawFruitBowl(c) {
    for (const s of CK.SOURCES) {
      if (!s.fruit) continue;
      softShadowC(c, s.x, s.y, s.r + 4, 3, 5, 0.16);
      c.fillStyle = D.dome(c, s.x, s.y, s.r + 4, s.bowl || '#7fa8c4', 0.3, 0.2); D.circle(c, s.x, s.y, s.r + 4); c.fill();
      if (s.bowl) {
        // a painted rim on the earthenware bowl
        for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; c.fillStyle = i % 2 ? '#f2d27a' : '#fff4dc'; D.circle(c, s.x + Math.cos(a) * (s.r + 2), s.y + Math.sin(a) * (s.r + 2), 1.4); c.fill(); }
      }
      c.fillStyle = '#f7f3ea'; D.circle(c, s.x, s.y, s.r); c.fill();
      const g = c.createRadialGradient(s.x + 6, s.y + 8, 2, s.x, s.y, s.r - 2);
      g.addColorStop(0, '#fffdf8'); g.addColorStop(1, '#e2dbcd');
      c.fillStyle = g; D.circle(c, s.x, s.y, s.r - 3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(s.x, s.y, s.r - 1.5, 3.4, 4.8); c.stroke();
      for (let i = 0; i < 3; i++) D.item(c, fake(s.ing, i), s.x - 6 + i * 6, s.y - 6 + i * 6, s.ing === 'beetroot' ? 0.72 : 0.62);
    }
  }
  function drawBreadBoard(c, b) {
    const src = CK.SOURCES.find((s) => s.bread);
    if (!src) return;
    const rye = src.loaf === 'rye';
    softShadowRR(c, b.x, b.y, b.w, b.h, 14, 3, 5, 0.16);
    c.fillStyle = '#93633a'; D.rr(c, b.x, b.y, b.w, b.h, 14); c.fill();
    c.fillStyle = vgrad(c, b.y, b.y + b.h, ['#c48d56', '#b8824c', '#a87443']); D.rr(c, b.x + 3, b.y + 3, b.w - 6, b.h - 7, 12); c.fill();
    c.save(); D.rr(c, b.x + 3, b.y + 3, b.w - 6, b.h - 7, 12); c.clip();
    woodGrain(c, b.x, b.y, b.w, b.h, 77, 'rgba(110,65,30,0.22)', 6, 3);
    c.restore();
    c.fillStyle = 'rgba(255,230,195,0.35)'; D.rr(c, b.x + 8, b.y + 4, b.w - 16, 2, 1); c.fill();
    const lx = b.x + 52, ly = b.y + b.h / 2;
    if (rye) {
      // a dark rye brick loaf, dusted with coriander seeds
      c.fillStyle = 'rgba(60,34,14,0.25)'; D.rr(c, lx - 40, ly - 22, 84, 50, 12); c.fill();
      c.fillStyle = vgrad(c, ly - 26, ly + 24, ['#6e4228', '#56321d', '#3e2314']); D.rr(c, lx - 42, ly - 26, 82, 48, 12); c.fill();
      c.fillStyle = vgrad(c, ly - 26, ly - 6, ['#7d4d2e', '#633a22']); D.rr(c, lx - 40, ly - 25, 78, 20, 10); c.fill();
      c.fillStyle = 'rgba(255,220,180,0.18)'; D.rr(c, lx - 34, ly - 23, 60, 4, 2); c.fill();
      c.fillStyle = '#c9a26a';
      for (let i = 0; i < 26; i++) { D.circle(c, lx - 36 + hash(i * 3.1) * 70, ly - 22 + hash(i * 4.7) * 14, 1.2); c.fill(); }
      c.fillStyle = 'rgba(30,15,8,0.3)'; c.fillRect(lx - 42, ly - 4, 82, 1.5);
      D.item(c, fake('ryebread', 1), b.x + 112, b.y + b.h / 2, 0.85);
      return;
    }
    // a rustic loaf with scoring
    c.fillStyle = 'rgba(60,34,14,0.22)'; D.ellipse(c, lx + 3, ly + 5, 42, 27); c.fill();
    const lg = c.createRadialGradient(lx - 14, ly - 12, 4, lx, ly, 46);
    lg.addColorStop(0, '#e6a868'); lg.addColorStop(0.6, '#c9884b'); lg.addColorStop(1, '#9a6030');
    c.fillStyle = lg; D.ellipse(c, lx, ly, 42, 28); c.fill();
    for (let i = -1; i <= 1; i++) {
      const x0 = lx - 12 + i * 18, y0 = b.y + 22, x1 = lx + i * 18, y1 = b.y + b.h - 22;
      c.strokeStyle = '#9a5f2c'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1); c.stroke();
      c.strokeStyle = '#f2d9a8'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(x0 + 0.8, y0 + 1); c.quadraticCurveTo((x0 + x1) / 2 + 3.5, (y0 + y1) / 2, x1 + 0.6, y1 - 1); c.stroke();
    }
    c.fillStyle = 'rgba(255,245,225,0.5)';
    for (let i = 0; i < 14; i++) { D.circle(c, lx - 30 + hash(i * 3.1) * 60, ly - 18 + hash(i * 4.7) * 36, 0.9); c.fill(); }
    c.fillStyle = 'rgba(255,240,215,0.3)'; D.ellipse(c, lx - 14, ly - 13, 16, 6, -0.3); c.fill();
    D.item(c, fake(src.ing, 1), b.x + 112, b.y + b.h / 2, 0.85);
    c.fillStyle = 'rgba(170,110,60,0.6)';
    for (let i = 0; i < 6; i++) { D.circle(c, b.x + 92 + hash(i * 2.2) * 40, b.y + 10 + hash(i * 5.5) * (b.h - 20), 1.1); c.fill(); }
  }
  function drawCuttingBoard(c, bd) {
    softShadowRR(c, bd.x, bd.y, bd.w, bd.h, 18, 4, 6, 0.16);
    c.fillStyle = '#d4b385'; D.rr(c, bd.x, bd.y + 3, bd.w, bd.h, 18); c.fill();
    c.fillStyle = vgrad(c, bd.y, bd.y + bd.h, ['#efd8b2', '#e8cfa6', '#e0c497']); D.rr(c, bd.x, bd.y, bd.w, bd.h, 18); c.fill();
    c.save(); D.rr(c, bd.x, bd.y, bd.w, bd.h, 18); c.clip();
    // glued strips of wood
    for (let i = 1; i < 5; i++) { const x = bd.x + i * bd.w / 5; c.fillStyle = i % 2 ? 'rgba(200,160,110,0.12)' : 'rgba(255,245,225,0.12)'; c.fillRect(x - bd.w / 5, bd.y, bd.w / 5, bd.h); c.fillStyle = 'rgba(170,125,75,0.18)'; c.fillRect(x, bd.y, 1, bd.h); }
    c.strokeStyle = 'rgba(160,120,70,0.2)'; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(bd.x + 10, bd.y + 14 + i * 19); c.bezierCurveTo(bd.x + 80, bd.y + 10 + i * 19, bd.x + 160, bd.y + 22 + i * 19, bd.x + bd.w - 10, bd.y + 18 + i * 19); c.stroke(); }
    // little knife marks
    c.strokeStyle = 'rgba(150,110,65,0.2)';
    for (let i = 0; i < 16; i++) { const kx = bd.x + 30 + hash(i * 3.7) * (bd.w - 90), ky = bd.y + 30 + hash(i * 6.1) * (bd.h - 70), a = hash(i) * 0.8 - 0.4; c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(a) * 14, ky + Math.sin(a) * 14); c.stroke(); }
    c.restore();
    // juice groove
    c.strokeStyle = 'rgba(170,125,75,0.4)'; c.lineWidth = 2.5; D.rr(c, bd.x + 9, bd.y + 9, bd.w - 18, bd.h - 18, 12); c.stroke();
    c.strokeStyle = 'rgba(255,248,230,0.5)'; c.lineWidth = 1; D.rr(c, bd.x + 10.5, bd.y + 10.5, bd.w - 18, bd.h - 18, 12); c.stroke();
    c.strokeStyle = 'rgba(255,250,235,0.55)'; c.lineWidth = 1.5; D.rr(c, bd.x + 1, bd.y + 1, bd.w - 2, bd.h - 2, 17); c.stroke();
    // handle slot
    c.fillStyle = '#b8966a'; D.rr(c, bd.x + 14, bd.y + bd.h - 30, 40, 12, 6); c.fill();
    c.fillStyle = '#d7b98d'; D.rr(c, bd.x + 14, bd.y + bd.h - 28, 40, 10, 5); c.fill();
  }

  function drawStoveBase(c, l) {
    const st = l.stove;
    softShadowRR(c, st.x, st.y, st.w, st.h - 8, 16, 4, 6, 0.2);
    c.fillStyle = vgrad(c, st.y, st.y + st.h - 8, ['#3a383f', '#2b2a2f', '#232227']);
    D.rr(c, st.x, st.y, st.w, st.h - 8, 16); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1.5; D.rr(c, st.x + 1, st.y + 1, st.w - 2, st.h - 10, 15); c.stroke();
    // cooktop
    const cg = c.createLinearGradient(st.x, st.y, st.x + st.w, st.y + st.h - 92);
    cg.addColorStop(0, '#403f47'); cg.addColorStop(0.5, '#34333a'); cg.addColorStop(1, '#2c2b31');
    c.fillStyle = cg; D.rr(c, st.x + 8, st.y + 8, st.w - 16, st.h - 92, 12); c.fill();
    c.save(); D.rr(c, st.x + 8, st.y + 8, st.w - 16, st.h - 92, 12); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.035)';
    c.beginPath(); c.moveTo(st.x + 40, st.y + 8); c.lineTo(st.x + 140, st.y + 8); c.lineTo(st.x + 40, st.y + 200); c.lineTo(st.x - 60, st.y + 200); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; D.rr(c, st.x + 8, st.y + 8, st.w - 16, st.h - 92, 12); c.stroke();
    // control strip
    const ky = st.y + st.h - 80;
    c.fillStyle = vgrad(c, ky, ky + 70, ['#2f2e34', '#26252a']); D.rr(c, st.x + 8, ky, st.w - 16, 66, 10); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(st.x + 14, ky + 1, st.w - 28, 1.5);
    l.burners.forEach((p) => {
      // drip ring, burner crown with gas ports, cap
      c.fillStyle = 'rgba(0,0,0,0.25)'; D.circle(c, p.x, p.y, 64); c.fill();
      const dg = c.createRadialGradient(p.x - 20, p.y - 20, 10, p.x, p.y, 62);
      dg.addColorStop(0, '#45444c'); dg.addColorStop(1, '#2a292e');
      c.fillStyle = dg; D.circle(c, p.x, p.y, 60); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, 58, 3.4, 4.9); c.stroke();
      c.fillStyle = '#1e1d21'; D.circle(c, p.x, p.y, 38); c.fill();
      c.strokeStyle = '#3c3b42'; c.lineWidth = 4; D.circle(c, p.x, p.y, 36); c.stroke();
      c.fillStyle = '#141316';
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; D.circle(c, p.x + Math.cos(a) * 36, p.y + Math.sin(a) * 36, 1.2); c.fill(); }
      c.fillStyle = '#1e1d21'; D.circle(c, p.x, p.y, 26); c.fill();
      const hg = c.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, 17);
      hg.addColorStop(0, '#77757e'); hg.addColorStop(1, '#46454c');
      c.fillStyle = hg; D.circle(c, p.x, p.y, 16); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; D.ellipse(c, p.x - 5, p.y - 6, 5, 2.5, -0.6); c.fill();
    });
  }
  function drawGrates(c) {
    const l = L();
    l.burners.forEach((p) => {
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 7;
      c.save(); c.translate(2, 3);
      D.circle(c, p.x, p.y, 62); c.stroke();
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(p.x + Math.cos(an) * 30, p.y + Math.sin(an) * 30); c.lineTo(p.x + Math.cos(an) * 70, p.y + Math.sin(an) * 70); c.stroke(); }
      c.restore();
      c.strokeStyle = '#4b4a52'; c.lineWidth = 6;
      D.circle(c, p.x, p.y, 62); c.stroke();
      c.strokeStyle = '#47464e'; c.lineWidth = 7;
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.PI / 4; c.beginPath(); c.moveTo(p.x + Math.cos(an) * 30, p.y + Math.sin(an) * 30); c.lineTo(p.x + Math.cos(an) * 70, p.y + Math.sin(an) * 70); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(p.x, p.y, 61, 3.3, 5.0); c.stroke();
      for (let a = 0; a < 4; a++) { const an = a * Math.PI / 2 + Math.PI / 4, ox = -1.5, oy = -1.5; c.beginPath(); c.moveTo(p.x + Math.cos(an) * 31 + ox, p.y + Math.sin(an) * 31 + oy); c.lineTo(p.x + Math.cos(an) * 69 + ox, p.y + Math.sin(an) * 69 + oy); c.stroke(); }
    });
  }

  function drawKnobs(ctx, k) {
    const l = L();
    for (let i = 0; i < l.knobs.length; i++) {
      const kn = l.knobs[i];
      const lvl = k.world.burners[kn.b];
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; D.circle(ctx, kn.x + 1, kn.y + 3, 21); ctx.fill();
      ctx.fillStyle = '#1b1a1e'; D.circle(ctx, kn.x, kn.y, 21); ctx.fill();
      if (lvl) { ctx.strokeStyle = 'rgba(255,138,77,0.45)'; ctx.lineWidth = 2; D.circle(ctx, kn.x, kn.y, 20); ctx.stroke(); }
      const g2 = ctx.createRadialGradient(kn.x - 5, kn.y - 5, 2, kn.x, kn.y, 18);
      g2.addColorStop(0, '#fbf8f2'); g2.addColorStop(0.7, '#e2ddd4'); g2.addColorStop(1, '#b8b1a7');
      ctx.fillStyle = g2; D.circle(ctx, kn.x, kn.y, 17); ctx.fill();
      // grip ridges
      ctx.strokeStyle = 'rgba(140,130,118,0.45)'; ctx.lineWidth = 1.2;
      for (let j = 0; j < 12; j++) { const a = (j / 12) * TAU; ctx.beginPath(); ctx.moveTo(kn.x + Math.cos(a) * 14, kn.y + Math.sin(a) * 14); ctx.lineTo(kn.x + Math.cos(a) * 16.5, kn.y + Math.sin(a) * 16.5); ctx.stroke(); }
      const a = -Math.PI / 2 + (lvl / 5) * Math.PI * 1.4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = lvl ? '#e0583e' : '#5a524a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(kn.x, kn.y); ctx.lineTo(kn.x + Math.cos(a) * 13, kn.y + Math.sin(a) * 13); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; D.ellipse(ctx, kn.x - 6, kn.y - 7, 4, 2, -0.6); ctx.fill();
      // which burner
      const mx = kn.x - 7, my = kn.y - 37;
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = j === kn.b ? (lvl ? '#ff8a4d' : '#d8d2c8') : '#55535a';
        D.circle(ctx, mx + (j % 2) * 14, my + Math.floor(j / 2) * 9, 3.5); ctx.fill();
      }
      const lab = ['off', 'low', 'med-low', 'medium', 'med-high', 'high'][lvl];
      text(ctx, lab, kn.x, kn.y + 25, 11, lvl ? '#ffb08a' : '#9a958d', 800);
    }
  }

  function drawSink(c, l) {
    const sk = l.sink, bs = l.basin;
    softShadowRR(c, sk.x, sk.y, sk.w, sk.h, 16, 3, 5, 0.16);
    c.fillStyle = hgrad(c, sk.x, sk.x + sk.w, ['#d5dade', '#c7ccd2', '#b9bfc6']);
    D.rr(c, sk.x, sk.y, sk.w, sk.h, 16); c.fill();
    c.save(); D.rr(c, sk.x, sk.y, sk.w, sk.h, 16); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
    for (let x = sk.x + 3; x < sk.x + sk.w; x += 3.5) { c.beginPath(); c.moveTo(x, sk.y); c.lineTo(x + 2, sk.y + sk.h); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; D.rr(c, sk.x + 1, sk.y + 1, sk.w - 2, sk.h - 2, 15); c.stroke();
    // basin: deep, darker at the walls
    c.fillStyle = 'rgba(70,78,88,0.35)'; D.rr(c, bs.x - 2, bs.y - 2, bs.w + 4, bs.h + 4, 24); c.fill();
    const bg = c.createLinearGradient(bs.x, bs.y, bs.x + bs.w, bs.y + bs.h);
    bg.addColorStop(0, '#99a2ac'); bg.addColorStop(0.5, '#c3c9cf'); bg.addColorStop(1, '#dde1e5');
    c.fillStyle = bg; D.rr(c, bs.x, bs.y, bs.w, bs.h, 22); c.fill();
    const ig = c.createRadialGradient(bs.x + bs.w / 2, bs.y + bs.h / 2 + 30, 20, bs.x + bs.w / 2, bs.y + bs.h / 2, bs.h * 0.62);
    ig.addColorStop(0, 'rgba(230,234,238,0.5)'); ig.addColorStop(1, 'rgba(230,234,238,0)');
    c.fillStyle = ig; D.rr(c, bs.x + 8, bs.y + 8, bs.w - 16, bs.h - 16, 16); c.fill();
    c.strokeStyle = 'rgba(80,88,98,0.35)'; c.lineWidth = 3; D.rr(c, bs.x + 1.5, bs.y + 1.5, bs.w - 3, bs.h - 3, 21); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bs.x + 30, bs.y + bs.h - 3); c.lineTo(bs.x + bs.w - 24, bs.y + bs.h - 3); c.stroke();
    // drain
    const dx = bs.x + bs.w / 2, dy = bs.y + bs.h / 2 + 50;
    c.fillStyle = '#b6bdc4'; D.circle(c, dx, dy, 15); c.fill();
    c.fillStyle = '#7d858e'; D.circle(c, dx, dy, 12); c.fill();
    c.strokeStyle = '#5f666e'; c.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(dx - 8, dy + i * 4); c.lineTo(dx + 8, dy + i * 4); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(dx, dy, 14, 3.5, 4.8); c.stroke();
    // faucet (base & spout; the handle is live)
    const f = l.faucet;
    c.fillStyle = 'rgba(60,64,70,0.25)'; D.rr(c, f.x - 4, f.y - 2, 12, 50, 6); c.fill();
    c.fillStyle = D.dome(c, f.x, f.y - 6, 13, '#a9b1ba', 0.5, 0.25); D.circle(c, f.x, f.y - 6, 13); c.fill();
    c.fillStyle = hgrad(c, f.x - 6, f.x + 6, ['#e4e8ec', '#b8c0c8', '#8e969f']); D.rr(c, f.x - 6, f.y - 8, 12, 48, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)'; D.rr(c, f.x - 3.5, f.y - 4, 2, 38, 1); c.fill();
    c.fillStyle = D.dome(c, f.x, f.y + 40, 7.5, '#d7dde2', 0.5, 0.2); D.circle(c, f.x, f.y + 40, 7.5); c.fill();
    c.fillStyle = '#7d858e'; D.circle(c, f.x, f.y + 41, 3.5); c.fill();
    const th = l.tapHandle;
    c.fillStyle = D.dome(c, th.x, th.y, 15, '#b3bbc3', 0.4, 0.25); D.circle(c, th.x, th.y, 15.5); c.fill();
  }
  function drawTap(ctx, k) {
    const l = L();
    const f = l.faucet, th = l.tapHandle, bs = l.basin;
    ctx.fillStyle = k.world.tap ? '#5aa0d8' : '#9aa2ab'; D.circle(ctx, th.x, th.y, 13); ctx.fill();
    ctx.fillStyle = k.world.tap ? 'rgba(220,240,255,0.45)' : 'rgba(255,255,255,0.4)'; D.ellipse(ctx, th.x - 4, th.y - 5, 5, 2.5, -0.6); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,60,0.25)'; D.rr(ctx, th.x - 2, th.y - 13, 6, 22, 3); ctx.fill();
    ctx.fillStyle = '#e8ecef'; D.rr(ctx, th.x - 3, th.y - 15, 6, 22, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; D.rr(ctx, th.x - 2, th.y - 13, 1.5, 17, 0.8); ctx.fill();
    if (k.world.tap) {
      const sinkC = k.world.at('sink');
      const endY = sinkC ? k.posOf(sinkC).y : bs.y + bs.h / 2 + 30;
      ctx.lineCap = 'round';
      const wave = (y) => f.x + Math.sin(y * 0.3 + k.time * 20) * 1.5;
      const path = (dx) => { ctx.beginPath(); ctx.moveTo(f.x + dx, f.y + 44); for (let y = f.y + 44; y < endY; y += 8) ctx.lineTo(wave(y) + dx, y); ctx.lineTo(wave(endY) + dx, endY); };
      ctx.strokeStyle = 'rgba(140,195,235,0.75)'; ctx.lineWidth = 7; path(0); ctx.stroke();
      ctx.strokeStyle = 'rgba(225,242,255,0.8)'; ctx.lineWidth = 2; path(-1.5); ctx.stroke();
      // splash ring and droplets
      const ph = (k.time * 3) % 1;
      ctx.strokeStyle = `rgba(220,240,255,${0.6 * (1 - ph)})`; ctx.lineWidth = 1.5;
      D.ellipse(ctx, f.x, endY, 8 + ph * 12, 4 + ph * 5); ctx.stroke();
      ctx.fillStyle = 'rgba(210,235,252,0.8)';
      for (let i = 0; i < 6; i++) { const a = hash(i + Math.floor(k.time * 20)) * 6.28; D.circle(ctx, f.x + Math.cos(a) * 14, endY + Math.sin(a) * 8, 2.2); ctx.fill(); }
    }
  }

  function drawToasterBody(c, T) {
    softShadowRR(c, T.x, T.y, T.w, T.h, 20, 4, 6, 0.18);
    const tg = c.createLinearGradient(T.x, T.y, T.x + T.w, T.y + T.h);
    tg.addColorStop(0, '#f6b07c'); tg.addColorStop(0.5, '#ec955f'); tg.addColorStop(1, '#d4703f');
    c.fillStyle = tg; D.rr(c, T.x, T.y, T.w - 26, T.h, 20); c.fill();
    c.strokeStyle = 'rgba(255,240,225,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(T.x + 22, T.y + 22, 18, 3.3, 4.6); c.stroke();
    c.fillStyle = 'rgba(255,240,225,0.3)'; D.rr(c, T.x + 24, T.y + 4, T.w - 70, 4, 2); c.fill();
    // chrome band
    c.fillStyle = hgrad(c, T.x, T.x + T.w - 26, ['#e6eaee', '#c2c8ce', '#9ca4ac']); D.rr(c, T.x + 6, T.y + T.h - 16, T.w - 38, 6, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(T.x + 9, T.y + T.h - 15.5, T.w - 44, 1.2);
    // slot rims
    for (let i = 0; i < 2; i++) { c.fillStyle = '#b55a30'; D.rr(c, T.x + 14, T.y + 16 + i * 42, T.w - 56, 24, 10); c.fill(); }
    // lever housing and dial face
    c.fillStyle = hgrad(c, T.x + T.w - 30, T.x + T.w - 4, ['#d7dce1', '#b9bec4', '#8f979f']); D.rr(c, T.x + T.w - 30, T.y + 10, 26, 54, 8); c.fill();
    c.fillStyle = '#4a4542'; D.rr(c, T.x + T.w - 19, T.y + 16, 4, 42, 2); c.fill();
    c.fillStyle = D.dome(c, T.x + T.w - 17, T.y + 88, 15, '#ece7de', 0.4, 0.2); D.circle(c, T.x + T.w - 17, T.y + 88, 15); c.fill();
    c.fillStyle = '#7a3b1f';
    for (let j = 0; j < 5; j++) { const a = -Math.PI * 0.75 + j * Math.PI * 0.375; D.circle(c, T.x + T.w - 17 + Math.cos(a) * 11.5, T.y + 88 + Math.sin(a) * 11.5, 0.9 + j * 0.15); c.fill(); }
    // feet
    c.fillStyle = '#5a3a2a'; D.rr(c, T.x + 10, T.y + T.h - 3, 16, 4, 2); c.fill(); D.rr(c, T.x + T.w - 52, T.y + T.h - 3, 16, 4, 2); c.fill();
  }
  function drawToasterLive(ctx, k) {
    const T = L().toaster;
    const tw = k.world.toaster;
    for (let i = 0; i < 2; i++) {
      const sx = T.x + 16, sy = T.y + 18 + i * 42, sw = T.w - 60, sh = 20;
      if (tw.down) {
        const g = ctx.createLinearGradient(0, sy, 0, sy + sh);
        g.addColorStop(0, '#ffb057'); g.addColorStop(1, '#ff7a2e');
        ctx.fillStyle = g; D.rr(ctx, sx, sy, sw, sh, 8); ctx.fill();
        const fl = 0.5 + Math.sin(k.time * 6 + i) * 0.1;
        ctx.fillStyle = `rgba(255,230,160,${fl})`; D.rr(ctx, sx + 4, sy + 4, sw - 8, 12, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); for (let j = 0; j < 5; j++) { const xx = sx + 10 + j * (sw - 20) / 4; ctx.moveTo(xx, sy + 5); ctx.lineTo(xx + 3, sy + sh - 5); } ctx.stroke();
      } else {
        ctx.fillStyle = vgrad(ctx, sy, sy + sh, ['#1a1411', '#3a2c24']); D.rr(ctx, sx, sy, sw, sh, 8); ctx.fill();
      }
    }
    // lever
    const ly = T.y + (tw.down ? 44 : 16);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; D.rr(ctx, T.x + T.w - 25, ly + 2, 18, 14, 5); ctx.fill();
    ctx.fillStyle = vgrad(ctx, ly, ly + 14, ['#5a524c', '#3b3633', '#2a2522']); D.rr(ctx, T.x + T.w - 26, ly, 18, 14, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; D.rr(ctx, T.x + T.w - 24, ly + 1.5, 14, 2, 1); ctx.fill();
    text(ctx, String(tw.level), T.x + T.w - 17, T.y + 89, 15, '#7a3b1f', 900);
    if (tw.down) {
      const p = clamp(tw.timer / k.world.toasterTime(), 0, 1);
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(T.x + T.w - 17, T.y + 88, 17, -Math.PI / 2, -Math.PI / 2 + p * 6.28); ctx.stroke();
    }
  }

  function drawCompost(c, tr) {
    softShadowC(c, tr.x, tr.y, tr.r, 3, 5, 0.18);
    c.fillStyle = D.dome(c, tr.x, tr.y, tr.r, '#6f9b6a', 0.25, 0.25); D.circle(c, tr.x, tr.y, tr.r); c.fill();
    c.strokeStyle = 'rgba(255,255,240,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(tr.x, tr.y, tr.r - 3, 3.4, 4.8); c.stroke();
    const ig = c.createRadialGradient(tr.x - 6, tr.y - 8, 4, tr.x, tr.y, tr.r - 8);
    ig.addColorStop(0, '#6a9465'); ig.addColorStop(1, '#4f7a4b');
    c.fillStyle = ig; D.circle(c, tr.x, tr.y, tr.r - 8); c.fill();
    c.strokeStyle = 'rgba(40,70,40,0.4)'; c.lineWidth = 1.5; D.circle(c, tr.x, tr.y, tr.r - 8); c.stroke();
    // leaf badge
    c.fillStyle = '#a9d08e';
    c.beginPath(); c.moveTo(tr.x - 7, tr.y - 10); c.quadraticCurveTo(tr.x - 6, tr.y - 24, tr.x + 8, tr.y - 22); c.quadraticCurveTo(tr.x + 6, tr.y - 9, tr.x - 7, tr.y - 10); c.fill();
    c.strokeStyle = '#5c8a52'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(tr.x - 8, tr.y - 8); c.quadraticCurveTo(tr.x, tr.y - 14, tr.x + 6, tr.y - 20); c.stroke();
    c.fillStyle = '#e6f0de';
    c.font = `800 13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('COMPOST', tr.x, tr.y + 8);
  }
  function drawPass(c, ps) {
    softShadowRR(c, ps.x, ps.y, ps.w, ps.h, 22, 4, 6, 0.18);
    c.fillStyle = vgrad(c, ps.y, ps.y + ps.h, ['#9c6a42', '#8f5f3a', '#7e5132']);
    D.rr(c, ps.x, ps.y, ps.w, ps.h, 22); c.fill();
    c.strokeStyle = 'rgba(255,225,190,0.35)'; c.lineWidth = 1.5; D.rr(c, ps.x + 1, ps.y + 1, ps.w - 2, ps.h - 2, 21); c.stroke();
    c.fillStyle = 'rgba(40,20,8,0.3)'; D.rr(c, ps.x + 9, ps.y + 11, ps.w - 18, ps.h - 20, 16); c.fill();
    c.fillStyle = vgrad(c, ps.y + 10, ps.y + ps.h - 10, ['#b07a50', '#a8724a', '#9c6840']);
    D.rr(c, ps.x + 10, ps.y + 10, ps.w - 20, ps.h - 20, 16); c.fill();
    c.save(); D.rr(c, ps.x + 10, ps.y + 10, ps.w - 20, ps.h - 20, 16); c.clip();
    woodGrain(c, ps.x + 10, ps.y + 10, ps.w - 20, ps.h - 20, 31, 'rgba(110,65,35,0.18)', 14, 4);
    c.restore();
    // handle cut-outs
    for (const hx of [ps.x + ps.w / 2 - 30]) { c.fillStyle = '#6a4228'; D.rr(c, hx, ps.y + 2, 60, 6, 3); c.fill(); }
    text(c, 'SERVE', ps.x + ps.w / 2, ps.y + ps.h - 27, 18, 'rgba(80,45,25,0.25)', 900);
    text(c, 'SERVE', ps.x + ps.w / 2, ps.y + ps.h - 28, 18, 'rgba(255,240,220,0.45)', 900);
  }
  function drawBell(c, be) {
    c.fillStyle = 'rgba(40,20,8,0.25)'; D.circle(c, be.x + 2, be.y + 8, 27); c.fill();
    c.fillStyle = D.dome(c, be.x, be.y + 4, 26, '#6b5240', 0.25, 0.3); D.circle(c, be.x, be.y + 4, 26); c.fill();
    c.fillStyle = 'rgba(40,20,8,0.3)'; D.circle(c, be.x + 1.5, be.y + 3, 21.5); c.fill();
    const bgr = c.createRadialGradient(be.x - 7, be.y - 7, 2, be.x, be.y, 22);
    bgr.addColorStop(0, '#fff6d0'); bgr.addColorStop(0.5, '#ecc35a'); bgr.addColorStop(1, '#b8892a');
    c.fillStyle = bgr; D.circle(c, be.x, be.y, 21); c.fill();
    c.strokeStyle = 'rgba(255,250,220,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.arc(be.x, be.y, 15, 3.6, 4.5); c.stroke();
    c.fillStyle = '#8a6a2a'; D.circle(c, be.x, be.y, 6.5); c.fill();
    c.fillStyle = '#c9a24a'; D.circle(c, be.x - 0.8, be.y - 0.8, 4.6); c.fill();
    c.fillStyle = 'rgba(255,255,240,0.8)'; D.circle(c, be.x - 2, be.y - 2, 1.4); c.fill();
  }

  A.flame = function (ctx, x, y, level, under, t) {
    if (!level) return;
    const r = 34 + level * 6;
    const n = 18;
    if (under) {
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r + 26);
      g.addColorStop(0, `rgba(255,140,70,${0.1 + level * 0.035})`); g.addColorStop(1, 'rgba(255,140,70,0)');
      ctx.fillStyle = g; D.circle(ctx, x, y, r + 26); ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(90,140,255,${0.08 + level * 0.025})`; ctx.lineWidth = 12;
      D.circle(ctx, x, y, r + 4); ctx.stroke();
    }
    // three batched layers of flame tongues: blue body, pale inner cone, warm tips
    const layerPath = (lenF, widF, offF) => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const fl = (7 + level * 2.6) * (0.8 + 0.3 * Math.sin(t * 18 + i * 1.7)) * lenF;
        const ca = Math.cos(a), sa = Math.sin(a);
        const bx = x + ca * (r + offF), by = y + sa * (r + offF);
        const tx = bx + ca * fl, ty = by + sa * fl;
        const hw = 3.2 * widF;
        const mx = bx + ca * fl * 0.45, my = by + sa * fl * 0.45;
        ctx.moveTo(bx - sa * hw, by + ca * hw);
        ctx.quadraticCurveTo(mx - sa * hw * 1.1, my + ca * hw * 1.1, tx, ty);
        ctx.quadraticCurveTo(mx + sa * hw * 1.1, my - ca * hw * 1.1, bx + sa * hw, by - ca * hw);
        ctx.closePath();
      }
    };
    layerPath(1.05, 1, -2); ctx.fillStyle = 'rgba(80,125,255,0.55)'; ctx.fill();
    layerPath(0.85, 0.8, -1); ctx.fillStyle = 'rgba(70,115,250,0.75)'; ctx.fill();
    layerPath(0.45, 0.5, 0); ctx.fillStyle = 'rgba(200,225,255,0.85)'; ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * TAU;
      const fl = (7 + level * 2.6) * (0.8 + 0.3 * Math.sin(t * 18 + i * 1.7));
      const tx = x + Math.cos(a) * (r + fl * 0.95), ty = y + Math.sin(a) * (r + fl * 0.95);
      ctx.moveTo(tx + 1.4, ty); ctx.arc(tx, ty, 1.4, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,180,110,0.35)'; ctx.fill();
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
      const b = (it.brownDown + it.brownUp) / 2;
      ctx.fillStyle = 'rgba(40,20,8,0.25)';
      D.rr(ctx, sx + 2, sy + 4, sw, sh, 8); ctx.fill();
      const rye = it.ing === 'ryebread';
      const crust = browned(rye ? '#5a3520' : '#c98b4c', b * 0.7 + 0.2), crumb = browned(rye ? '#8a6248' : '#f5e3b8', b * (rye ? 0.7 : 1));
      ctx.fillStyle = vgrad(ctx, sy, sy + sh, [D.lighten(crust, 0.15), crust, D.deepen(crust, 0.2)]);
      D.rr(ctx, sx, sy, sw, sh, 8); ctx.fill();
      ctx.fillStyle = vgrad(ctx, sy + 6, sy + sh - 6, [D.lighten(crumb, 0.15), crumb, browned(crumb, Math.min(b, 2) * 0.4 + 0.15)]);
      D.rr(ctx, sx + 4, sy + 6, sw - 8, sh - 12, 5); ctx.fill();
      ctx.fillStyle = rgba(D.deepen(crumb, 0.25), 0.3);
      for (let j = 0; j < 7; j++) { D.ellipse(ctx, sx + 10 + hash(j * 3 + it.id) * (sw - 20), sy + 9 + hash(j * 5 + it.id) * (sh - 18), 1.4, 0.9); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,250,235,0.35)'; D.rr(ctx, sx + 6, sy + 2, sw - 12, 2, 1); ctx.fill();
      it._sx = sx + sw / 2; it._sy = sy + sh / 2; it._sr = 26;
    });
  };

  // ---------------------------------------------------------------- fridge
  A.fridge = function (ctx, k, sources) {
    const f = L().fridge;
    if (!k.fridgeOpen) layer(ctx, 'fridgeClosed', f.x, f.y, f.w + 10, f.h + 12, (c) => drawFridgeClosed(c, f));
    else layer(ctx, 'fridgeOpen', f.x, f.y, f.w + 10, f.h + 12, (c) => drawFridgeOpen(c, f, sources));
  };
  function drawFridgeClosed(c, f) {
    c.fillStyle = 'rgba(40,30,20,0.12)'; D.rr(c, f.x + 4, f.y + 6, f.w + 4, f.h + 4, 28); c.fill();
    c.fillStyle = 'rgba(40,30,20,0.18)'; D.rr(c, f.x + 6, f.y + 8, f.w, f.h, 26); c.fill();
    const g = c.createLinearGradient(f.x, 0, f.x + f.w, 0);
    g.addColorStop(0, '#cdeadf'); g.addColorStop(0.35, '#bfe4d7'); g.addColorStop(1, '#9dcbbb');
    c.fillStyle = g; D.rr(c, f.x, f.y, f.w, f.h, 26); c.fill();
    // soft enamel sheen
    c.fillStyle = 'rgba(255,255,255,0.28)'; D.rr(c, f.x + 12, f.y + 14, 12, f.h - 60, 6); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.12)'; D.rr(c, f.x + 30, f.y + 14, 5, f.h - 60, 2.5); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2; D.rr(c, f.x + 1.5, f.y + 1.5, f.w - 3, f.h - 3, 25); c.stroke();
    // door split
    c.strokeStyle = 'rgba(80,130,115,0.5)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(f.x + 6, f.y + 250); c.lineTo(f.x + f.w - 6, f.y + 250); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(f.x + 6, f.y + 252); c.lineTo(f.x + f.w - 6, f.y + 252); c.stroke();
    // chrome handles
    for (const [hy, hh] of [[f.y + 120, 100], [f.y + 290, 190]]) {
      c.fillStyle = 'rgba(60,100,90,0.25)'; D.rr(c, f.x + f.w - 28, hy + 3, 12, hh, 6); c.fill();
      c.fillStyle = hgrad(c, f.x + f.w - 30, f.x + f.w - 18, ['#ffffff', '#e2e9e6', '#b9c6c1']); D.rr(c, f.x + f.w - 30, hy, 12, hh, 6); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.9)'; D.rr(c, f.x + f.w - 28, hy + 6, 2.5, hh - 12, 1.2); c.fill();
    }
    // badge
    c.fillStyle = '#e9efe9'; D.rr(c, f.x + f.w / 2 - 34, f.y + 24, 68, 18, 9); c.fill();
    text(c, 'chill', f.x + f.w / 2, f.y + 33.5, 12, '#6aa392', 900);
    // note & magnets
    c.save(); c.translate(f.x + 90, f.y + 400); c.rotate(-0.06);
    c.fillStyle = 'rgba(40,60,50,0.15)'; c.fillRect(-48, -37, 100, 120);
    c.fillStyle = '#fffbe9'; c.fillRect(-50, -40, 100, 120);
    c.fillStyle = 'rgba(240,200,120,0.18)'; c.fillRect(-50, 70, 100, 10);
    c.strokeStyle = 'rgba(120,150,190,0.5)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-42, -12 + i * 16); c.lineTo(42, -12 + i * 16); c.stroke(); }
    c.strokeStyle = 'rgba(230,120,110,0.5)'; c.beginPath(); c.moveTo(-34, -40); c.lineTo(-34, 80); c.stroke();
    text(c, 'groceries', 0, -24, 14, '#6a5a8a', 800);
    c.strokeStyle = 'rgba(90,80,120,0.55)'; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const yy = -2 + i * 16, ww = 30 + hash(i * 3) * 34; c.beginPath(); c.moveTo(-26, yy); for (let x = 0; x < ww; x += 4) c.lineTo(-26 + x, yy + Math.sin(x * 0.7 + i) * 1.4); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.15)'; D.circle(c, 1, -38, 7); c.fill();
    c.fillStyle = '#e06c4f'; D.circle(c, 0, -40, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; D.circle(c, -2, -42, 2); c.fill();
    c.restore();
    // fruit magnets
    c.fillStyle = 'rgba(0,0,0,0.12)'; D.circle(c, f.x + 62, f.y + 603, 12); c.fill();
    c.fillStyle = D.dome(c, f.x + 60, f.y + 600, 12, '#f2c94c', 0.4, 0.2); D.circle(c, f.x + 60, f.y + 600, 12); c.fill();
    c.fillStyle = '#5c9a48'; D.ellipse(c, f.x + 64, f.y + 588, 5, 2.5, -0.5); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)'; D.rr(c, f.x + 122, f.y + 583, 30, 22, 6); c.fill();
    c.fillStyle = D.dome(c, f.x + 135, f.y + 591, 16, '#7fb3e0', 0.35, 0.2); D.rr(c, f.x + 120, f.y + 580, 30, 22, 6); c.fill();
    c.fillStyle = '#fff'; D.circle(c, f.x + 130, f.y + 589, 2); c.fill(); D.circle(c, f.x + 140, f.y + 589, 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(f.x + 135, f.y + 593, 4, 0.3, Math.PI - 0.3); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.12)'; D.circle(c, f.x + 172, f.y + 652, 10); c.fill();
    c.fillStyle = D.dome(c, f.x + 170, f.y + 650, 10, '#e0604a', 0.4, 0.2); D.circle(c, f.x + 170, f.y + 650, 10); c.fill();
    c.fillStyle = '#5c9a48'; D.ellipse(c, f.x + 172, f.y + 640, 4, 2, 0.4); c.fill();
    // kick plate & feet
    c.fillStyle = 'rgba(80,130,115,0.25)'; D.rr(c, f.x + 30, f.y + f.h - 46, f.w - 60, 22, 8); c.fill();
    c.strokeStyle = 'rgba(80,130,115,0.35)'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const xx = f.x + 44 + i * ((f.w - 88) / 5); c.beginPath(); c.moveTo(xx, f.y + f.h - 41); c.lineTo(xx, f.y + f.h - 29); c.stroke(); }
    text(c, 'click to open', f.x + f.w / 2, f.y + 800, 14, 'rgba(60,100,90,0.6)', 800);
  }
  function drawFridgeOpen(c, f, sources) {
    c.fillStyle = 'rgba(40,30,20,0.12)'; D.rr(c, f.x + 4, f.y + 6, f.w + 4, f.h + 4, 28); c.fill();
    c.fillStyle = 'rgba(40,30,20,0.18)'; D.rr(c, f.x + 6, f.y + 8, f.w, f.h, 26); c.fill();
    c.fillStyle = hgrad(c, f.x, f.x + f.w, ['#a9d6c6', '#9fcfbf', '#8cc0ae']); D.rr(c, f.x, f.y, f.w, f.h, 26); c.fill();
    // interior: cool white, lit from the top
    const ix = f.x + 26, iy = f.y + 24, iw = f.w - 40, ih = f.h - 110;
    c.fillStyle = '#d9ebe4'; D.rr(c, ix - 2, iy - 2, iw + 4, ih + 4, 13); c.fill();
    c.fillStyle = vgrad(c, iy, iy + ih, ['#fdfffe', '#f1f8f5', '#e3f1ec']); D.rr(c, ix, iy, iw, ih, 12); c.fill();
    const lg = c.createRadialGradient(f.x + f.w / 2 + 6, f.y + 34, 4, f.x + f.w / 2 + 6, f.y + 34, 170);
    lg.addColorStop(0, 'rgba(255,253,225,0.75)'); lg.addColorStop(1, 'rgba(255,253,225,0)');
    c.fillStyle = lg; D.rr(c, ix, iy, iw, ih, 12); c.fill();
    c.fillStyle = 'rgba(255,255,235,0.9)'; D.rr(c, f.x + f.w / 2 - 16, f.y + 28, 44, 7, 3.5); c.fill();
    // side wall shading
    c.fillStyle = hgrad(c, ix, ix + 18, ['rgba(120,170,155,0.25)', 'rgba(120,170,155,0)']); c.fillRect(ix, iy, 18, ih);
    c.fillStyle = hgrad(c, ix + iw - 18, ix + iw, ['rgba(120,170,155,0)', 'rgba(120,170,155,0.25)']); c.fillRect(ix + iw - 18, iy, 18, ih);
    // glass shelves with a bright front edge and a soft shadow underneath
    for (const sy of [172, 344, 512]) {
      c.fillStyle = 'rgba(90,140,130,0.12)'; c.fillRect(ix, sy + 7, iw, 10);
      c.fillStyle = 'rgba(190,225,240,0.75)'; c.fillRect(ix, sy, iw, 7);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(ix, sy, iw, 1.5);
      c.fillStyle = 'rgba(120,175,200,0.6)'; c.fillRect(ix, sy + 6, iw, 1);
    }
    // crisper drawer
    c.fillStyle = 'rgba(200,230,220,0.9)'; D.rr(c, f.x + 34, f.y + 580, f.w - 56, 170, 10); c.fill();
    c.fillStyle = vgrad(c, f.y + 580, f.y + 750, ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']); D.rr(c, f.x + 34, f.y + 580, f.w - 56, 60, 10); c.fill();
    c.strokeStyle = 'rgba(120,170,155,0.6)'; c.lineWidth = 2; D.rr(c, f.x + 34, f.y + 580, f.w - 56, 170, 10); c.stroke();
    c.fillStyle = 'rgba(120,170,155,0.35)'; D.rr(c, f.x + f.w / 2 - 20, f.y + 590, 40, 8, 4); c.fill();
    // door edge (open towards us, on the left) with its gasket
    c.fillStyle = hgrad(c, f.x, f.x + 26, ['#7fb6a4', '#8cc2b1', '#9fcfbf']); D.rr(c, f.x, f.y, 26, f.h, 12); c.fill();
    c.fillStyle = '#c9ddd6'; c.fillRect(f.x + 20, f.y + 14, 4, f.h - 28);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(f.x + 4, f.y + 14, 3, f.h - 28);
    c.fillStyle = vgrad(c, f.y + f.h - 90, f.y + f.h, ['#a5d3c3', '#9fcfbf', '#8fc2b1']); c.fillRect(f.x, f.y + f.h - 90, f.w, 90);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(f.x + 4, f.y + f.h - 90, f.w - 8, 1.5);
    text(c, 'click edge to close', f.x + f.w / 2 + 6, f.y + f.h - 46, 13, 'rgba(40,80,70,0.7)', 800);
    for (const s of sources) if (s.fridge) A.drawSource(c, s, s.x, s.y, 0);
  }

  // ---------------------------------------------------------------- pantry & fridge item icons
  function glass(ctx, x, y, w, h, r) {
    // a glass body: pale tint, darker edges, a bright vertical glint
    ctx.fillStyle = 'rgba(225,238,242,0.7)'; D.rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(110,150,160,0.35)'; ctx.lineWidth = 1.2; D.rr(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); ctx.stroke();
  }
  function glint(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; D.rr(ctx, x, y, w, h, w / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; D.rr(ctx, x + w + 2.5, y + 4, w * 0.5, h * 0.6, w / 4); ctx.fill();
  }
  function label(ctx, x, y, w, h, col, border) {
    ctx.fillStyle = 'rgba(60,34,14,0.12)'; D.rr(ctx, x + 0.8, y + 1, w, h, 3); ctx.fill();
    ctx.fillStyle = col; D.rr(ctx, x, y, w, h, 3); ctx.fill();
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 0.8; D.rr(ctx, x + 2, y + 2, w - 4, h - 4, 2); ctx.stroke(); }
  }
  function lid(ctx, x, y, w, h, col) {
    ctx.fillStyle = hgrad(ctx, x, x + w, [D.lighten(col, 0.3), col, D.deepen(col, 0.25)]); D.rr(ctx, x, y, w, h, 5); ctx.fill();
    ctx.strokeStyle = rgba(D.deepen(col, 0.3), 0.45); ctx.lineWidth = 1;
    for (let xx = x + 4; xx < x + w - 2; xx += 3.5) { ctx.beginPath(); ctx.moveTo(xx, y + 3); ctx.lineTo(xx, y + h - 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; D.rr(ctx, x + 2, y + 1, w - 4, 2, 1); ctx.fill();
  }

  A.drawSource = function (ctx, s, x, base, tilt) {
    const w = s.w, h = s.h;
    ctx.save();
    ctx.translate(x, base - h / 2);
    ctx.rotate(tilt);
    ctx.lineCap = 'round';
    const y0 = -h / 2;
    if (!tilt) { ctx.fillStyle = 'rgba(60,34,14,0.14)'; D.ellipse(ctx, 2, h / 2 - 1, w / 2 + 2, 3); ctx.fill(); }
    switch (s.look) {
      case 'shaker':
        glass(ctx, -w / 2, y0 + 16, w, h - 16, 8);
        ctx.fillStyle = vgrad(ctx, y0 + 30, y0 + h, ['#ffffff', '#f1f4f6']); D.rr(ctx, -w / 2 + 4, y0 + 30, w - 8, h - 34, 6); ctx.fill();
        ctx.fillStyle = 'rgba(180,190,200,0.35)';
        for (let i = 0; i < 10; i++) { D.circle(ctx, (hash(i * 2.1) - 0.5) * (w - 14), y0 + 34 + hash(i * 3.3) * (h - 42), 0.8); ctx.fill(); }
        glint(ctx, -w / 2 + 5, y0 + 20, 3, h - 30);
        ctx.fillStyle = hgrad(ctx, -w / 2 - 2, w / 2 + 2, ['#dfe4e8', '#b8bfc6', '#8e969e']); D.rr(ctx, -w / 2 - 2, y0, w + 4, 18, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; D.rr(ctx, -w / 2 + 1, y0 + 2, w - 2, 2, 1); ctx.fill();
        ctx.fillStyle = '#6d747b'; for (let i = -1; i <= 1; i++) { D.circle(ctx, i * 8, y0 + 8, 1.8); ctx.fill(); }
        ctx.fillStyle = '#6d747b'; for (let i = -1; i <= 0; i++) { D.circle(ctx, i * 8 + 4, y0 + 12, 1.4); ctx.fill(); }
        text(ctx, 'S', 0, y0 + 46, 18, '#7c8a96', 900);
        break;
      case 'grinder': {
        // a turned-wood pepper mill
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#8a6247', '#6b4a33', '#4a3324']);
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 2, y0 + h); ctx.lineTo(-w / 2, y0 + h - 8);
        ctx.quadraticCurveTo(-w / 2 + 6, y0 + h * 0.6, -w / 2 + 3, y0 + 34);
        ctx.lineTo(w / 2 - 3, y0 + 34);
        ctx.quadraticCurveTo(w / 2 - 6, y0 + h * 0.6, w / 2, y0 + h - 8); ctx.lineTo(w / 2 - 2, y0 + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#6a4a35', '#4a3324', '#33231a']); D.rr(ctx, -w / 2 + 3, y0 + 2, w - 6, 34, 12); ctx.fill();
        ctx.fillStyle = '#2a1c14'; ctx.fillRect(-w / 2 + 3, y0 + 33, w - 6, 3);
        ctx.fillStyle = 'rgba(255,225,190,0.3)'; D.rr(ctx, -w / 2 + 6, y0 + 6, 3, 24, 1.5); ctx.fill(); D.rr(ctx, -w / 2 + 6, y0 + 40, 3, h - 52, 1.5); ctx.fill();
        ctx.fillStyle = '#8a6a50'; D.circle(ctx, 0, y0 + 2, 5); ctx.fill();
        ctx.fillStyle = '#c9a888'; D.circle(ctx, -1, y0 + 1, 2); ctx.fill();
        text(ctx, 'P', 0, y0 + 58, 16, '#e8d2b4', 900);
        break;
      }
      case 'jar': {
        glass(ctx, -w / 2, y0 + 12, w, h - 12, 10);
        const top = y0 + h * 0.35;
        ctx.fillStyle = vgrad(ctx, top, y0 + h, [D.lighten(s.color, 0.12), s.color, D.deepen(s.color, 0.12)]);
        D.rr(ctx, -w / 2 + 4, top, w - 8, h * 0.62, 7); ctx.fill();
        ctx.fillStyle = rgba(D.lighten(s.color, 0.4), 0.7); D.ellipse(ctx, 0, top + 2, w / 2 - 6, 2.4); ctx.fill();
        if (s.ing === 'chili') { ctx.fillStyle = '#f0b04a'; for (let i = 0; i < 12; i++) { D.circle(ctx, (hash(i) - 0.5) * (w - 12), y0 + h * 0.45 + hash(i * 3) * h * 0.45, 1.5); ctx.fill(); } }
        if (s.ing === 'rice') { ctx.fillStyle = '#e2dccb'; for (let i = 0; i < 16; i++) { D.ellipse(ctx, (hash(i) - 0.5) * (w - 12), y0 + h * 0.42 + hash(i * 3) * h * 0.5, 2.5, 1.2, i); ctx.fill(); } }
        if (s.ing === 'millet') { ctx.fillStyle = '#d9b444'; for (let i = 0; i < 22; i++) { D.circle(ctx, (hash(i * 1.7) - 0.5) * (w - 12), y0 + h * 0.4 + hash(i * 3.3) * h * 0.52, 1.3); ctx.fill(); } }
        if (s.ing === 'cherryjam') {
          for (let i = 0; i < 6; i++) { const cx = (hash(i * 2.9) - 0.5) * (w - 14), cy = y0 + h * 0.45 + hash(i * 5.1) * h * 0.45; ctx.fillStyle = '#a3192c'; D.circle(ctx, cx, cy, 3.2); ctx.fill(); ctx.fillStyle = 'rgba(255,180,190,0.6)'; D.circle(ctx, cx - 1, cy - 1, 1); ctx.fill(); }
        }
        if (s.ing === 'sugar') { ctx.fillStyle = 'rgba(200,205,215,0.6)'; for (let i = 0; i < 14; i++) { ctx.fillRect((hash(i * 1.3) - 0.5) * (w - 12), y0 + h * 0.42 + hash(i * 3.7) * h * 0.5, 1.2, 1.2); } }
        if (s.ing === 'cinnamon') { ctx.fillStyle = 'rgba(200,140,90,0.5)'; for (let i = 0; i < 10; i++) { D.circle(ctx, (hash(i * 4.1) - 0.5) * (w - 12), y0 + h * 0.42 + hash(i * 2.3) * h * 0.5, 0.9); ctx.fill(); } }
        if (s.ing === 'honey') {
          ctx.fillStyle = 'rgba(255,220,130,0.45)'; D.rr(ctx, -w / 2 + 7, top + 6, 5, h * 0.48, 2.5); ctx.fill();
          ctx.strokeStyle = 'rgba(180,110,20,0.5)'; ctx.lineWidth = 1.2;
          for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 6, top + 12 + i * 12); ctx.quadraticCurveTo(0, top + 16 + i * 12, w / 2 - 6, top + 12 + i * 12); ctx.stroke(); }
        }
        glint(ctx, -w / 2 + 5, y0 + 18, 3, h - 30);
        if (s.cloth) {
          // homemade varennya: a checked cloth over the lid, tied with string
          ctx.fillStyle = s.cloth;
          ctx.beginPath(); ctx.moveTo(-w / 2 - 5, y0 + 14); ctx.quadraticCurveTo(-w / 2 - 2, y0 - 4, 0, y0 - 5); ctx.quadraticCurveTo(w / 2 + 2, y0 - 4, w / 2 + 5, y0 + 14);
          for (let x = w / 2 + 5; x > -w / 2 - 5; x -= 6) ctx.lineTo(x - 3, y0 + 18 + (x % 12 ? 2 : 0));
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          for (let yy = y0 - 2; yy < y0 + 16; yy += 5) for (let xx = -w / 2 - 2; xx < w / 2 + 2; xx += 5) if (((xx + yy) / 5 | 0) % 2) ctx.fillRect(xx, yy, 2.5, 2.5);
          ctx.strokeStyle = '#d9c39a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-w / 2 - 2, y0 + 11); ctx.lineTo(w / 2 + 2, y0 + 11); ctx.stroke();
        } else lid(ctx, -w / 2 - 2, y0, w + 4, 15, s.ing === 'honey' ? '#d9a33a' : '#c27b4c');
        if (s.ing === 'honey') { ctx.fillStyle = '#f3e3c4'; ctx.save(); ctx.translate(w / 2 - 4, y0 + 6); ctx.rotate(0.5); ctx.fillRect(-1.5, -4, 3, 14); ctx.restore(); }
        label(ctx, -w / 2 + 6, y0 + h * 0.5, w - 12, 18, '#fff7e8', 'rgba(190,140,100,0.5)');
        { const lab = s.label.split(' ')[0].toUpperCase(); text(ctx, lab, 0, y0 + h * 0.5 + 9, Math.min(9, (w - 14) / (lab.length * 0.62)), '#7a5a40', 900); }
        break;
      }
      case 'bag': {
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, [D.lighten(s.color, 0.15), s.color, D.deepen(s.color, 0.15)]);
        ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 14); ctx.lineTo(w / 2, y0 + 14); ctx.lineTo(w / 2 + 3, y0 + h); ctx.lineTo(-w / 2 - 3, y0 + h); ctx.closePath(); ctx.fill();
        // crinkles
        ctx.strokeStyle = rgba(D.deepen(s.color, 0.25), 0.35); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-w / 2 + 6, y0 + 20); ctx.lineTo(-w / 2 + 3, y0 + h - 4); ctx.moveTo(w / 2 - 8, y0 + 18); ctx.lineTo(w / 2 - 4, y0 + h - 6); ctx.moveTo(-6, y0 + h - 4); ctx.lineTo(-2, y0 + h - 18); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 6, y0 + 16); ctx.lineTo(-w / 2 + 12, y0 + 16); ctx.lineTo(-w / 2 + 9, y0 + h - 2); ctx.lineTo(-w / 2 + 2, y0 + h - 2); ctx.closePath(); ctx.fill();
        // folded top
        ctx.fillStyle = vgrad(ctx, y0, y0 + 18, ['#e4d6b6', '#d6c6a4', '#c4b38e']); ctx.fillRect(-w / 2, y0, w, 18);
        ctx.strokeStyle = 'rgba(150,130,90,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 6); ctx.lineTo(w / 2, y0 + 6); ctx.stroke();
        ctx.fillStyle = 'rgba(120,100,60,0.25)'; ctx.fillRect(-w / 2, y0 + 16, w, 2);
        label(ctx, -w / 2 + 8, y0 + 40, w - 16, 30, s.tagColor || '#5b86b8', 'rgba(255,255,255,0.45)');
        { const tg = s.tag || 'FLOUR'; text(ctx, tg, 0, y0 + 55, Math.min(13, (w - 20) / (tg.length * 0.66)), '#ffffff', 900); }
        if (s.ing === 'flour') { ctx.fillStyle = '#f3c24a'; for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(i * 6, y0 + 32); ctx.rotate(i * 0.4); D.ellipse(ctx, 0, 0, 2, 4.5); ctx.fill(); ctx.restore(); } }
        else if (s.ing === 'buckwheat') { ctx.fillStyle = '#7a4f2c'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8, y0 + 28); ctx.lineTo(i * 8 + 3.5, y0 + 35); ctx.lineTo(i * 8 - 3.5, y0 + 35); ctx.closePath(); ctx.fill(); } }
        else { ctx.fillStyle = '#c99a4a'; for (let i = -1; i <= 1; i++) { D.ellipse(ctx, i * 7, y0 + 32, 3, 2, i); ctx.fill(); } }
        break;
      }
      case 'tin':
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, [D.lighten(s.color, 0.2), s.color, D.deepen(s.color, 0.2)]); D.rr(ctx, -w / 2, y0 + 8, w, h - 8, 6); ctx.fill();
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#e2e6ea', '#c0c4c8', '#949aa0']); D.rr(ctx, -w / 2 - 1, y0, w + 2, 12, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-w / 2 + 1, y0 + 2, w - 2, 1.2);
        label(ctx, -w / 2 + 5, y0 + 22, w - 10, 26, '#fff2d8', 'rgba(193,61,50,0.4)');
        text(ctx, 'BAKING', 0, y0 + 30, 8, '#c13d32', 900); text(ctx, 'POWDER', 0, y0 + 40, 8, '#c13d32', 900);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; D.rr(ctx, -w / 2 + 3, y0 + 12, 3, h - 18, 1.5); ctx.fill();
        break;
      case 'bottle': {
        const shape = () => { ctx.beginPath(); ctx.moveTo(-6, y0); ctx.lineTo(6, y0); ctx.lineTo(6, y0 + 30); ctx.quadraticCurveTo(w / 2, y0 + 40, w / 2, y0 + 56); ctx.lineTo(w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + 56); ctx.quadraticCurveTo(-w / 2, y0 + 40, -6, y0 + 30); ctx.closePath(); };
        shape(); ctx.fillStyle = s.fill || 'rgba(170,190,90,0.9)'; ctx.fill();
        shape(); ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)']); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; D.rr(ctx, -w / 2 + 4, y0 + 50, 3, h - 58, 1.5); ctx.fill();
        D.rr(ctx, -4, y0 + 4, 2, 24, 1); ctx.fill();
        const cap = s.cap || '#3a3a3a';
        ctx.fillStyle = hgrad(ctx, -7, 7, [D.lighten(cap, 0.3), cap, D.deepen(cap, 0.3)]); D.rr(ctx, -7, y0 - 6, 14, 12, 3); ctx.fill();
        label(ctx, -w / 2 + 4, y0 + h * 0.55, w - 8, 26, '#fff5e0', rgba(s.tagInk || '#5a6a2a', 0.35));
        text(ctx, (s.tag || ['', ''])[0], 0, y0 + h * 0.55 + 9, 8, s.tagInk || '#5a6a2a', 900);
        text(ctx, (s.tag || ['', ''])[1], 0, y0 + h * 0.55 + 19, (s.tag && s.tag[1] && s.tag[1].length > 6) ? 6 : 8, s.tagInk || '#5a6a2a', 900);
        if (s.ing === 'sunoil') {
          // a little sunflower on the shoulder
          const fx = 0, fy = y0 + 46;
          for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; ctx.fillStyle = '#f6c33c'; D.ellipse(ctx, fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 3, 1.3, a); ctx.fill(); }
          ctx.fillStyle = '#5a3a1e'; D.circle(ctx, fx, fy, 3); ctx.fill();
        }
        break;
      }
      case 'can':
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#e2e6ea', '#c0c4c8', '#949aa0']); D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(110,116,122,0.5)'; ctx.lineWidth = 1;
        for (const yy of [y0 + 4, y0 + h - 4]) { ctx.beginPath(); ctx.moveTo(-w / 2 + 2, yy); ctx.lineTo(w / 2 - 2, yy); ctx.stroke(); }
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, [D.lighten(s.color, 0.2), s.color, D.deepen(s.color, 0.25)]); ctx.fillRect(-w / 2, y0 + 10, w, h - 20);
        ctx.fillStyle = s.band || 'rgba(255,240,200,0.8)'; ctx.fillRect(-w / 2, y0 + 12, w, 2); ctx.fillRect(-w / 2, y0 + h - 14, w, 2);
        if (s.ing === 'tomatopaste') { text(ctx, 'TOMATO PASTE', 0, y0 + h - 19, 6.5, '#fff3d6', 900); }
        ctx.fillStyle = '#ffe9c9'; D.circle(ctx, 0, y0 + h / 2, 15); ctx.fill();
        ctx.fillStyle = D.dome(ctx, 0, y0 + h / 2, 10, '#d8392c', 0.4, 0.2); D.circle(ctx, 0, y0 + h / 2, 10); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; D.circle(ctx, -3, y0 + h / 2 - 3.5, 2); ctx.fill();
        ctx.fillStyle = '#3f8a35'; D.ellipse(ctx, 0, y0 + h / 2 - 9, 5, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; D.rr(ctx, -w / 2 + 4, y0 + 2, 4, h - 4, 2); ctx.fill();
        break;
      case 'tall':
        glass(ctx, -w / 2, y0 + 10, w, h - 10, 8);
        for (let i = 0; i < 14; i++) {
          const xx = -w / 2 + 7 + i * ((w - 14) / 13);
          ctx.strokeStyle = i % 3 ? s.color : D.deepen(s.color, 0.15); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(xx, y0 - 6 + hash(i) * 8); ctx.lineTo(xx + 2, y0 + h - 4); ctx.stroke();
          if (i % 2) { ctx.strokeStyle = 'rgba(255,250,225,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(xx - 0.5, y0 - 4 + hash(i) * 8); ctx.lineTo(xx + 1.3, y0 + h - 6); ctx.stroke(); }
        }
        glint(ctx, -w / 2 + 4, y0 + 14, 3, h - 26);
        label(ctx, -w / 2 + 6, y0 + h * 0.6, w - 12, 18, '#fff7e8', 'rgba(190,140,100,0.5)');
        text(ctx, 'SPAGHETTI', 0, y0 + h * 0.6 + 9, 8, '#7a5a40', 900);
        break;
      case 'eggs':
        ctx.fillStyle = '#c9b999'; D.rr(ctx, -w / 2, y0 + 14, w, h - 14, 6); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const ex = -w / 2 + 16 + i * 24;
          ctx.fillStyle = 'rgba(80,60,30,0.2)'; D.ellipse(ctx, ex + 1.5, y0 + 18, 10, 12); ctx.fill();
          const g = ctx.createRadialGradient(ex - 3, y0 + 10, 1, ex, y0 + 16, 13); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#f1dcbf'); g.addColorStop(1, '#d9bd98');
          ctx.fillStyle = g; D.ellipse(ctx, ex, y0 + 16, 10, 13); ctx.fill();
          ctx.fillStyle = 'rgba(160,110,70,0.25)'; D.circle(ctx, ex + 3, y0 + 14, 0.8); ctx.fill(); D.circle(ctx, ex - 2, y0 + 20, 0.7); ctx.fill();
        }
        ctx.fillStyle = vgrad(ctx, y0 + 24, y0 + h, ['#d6c6a6', '#c4b393', '#b09e7e']); ctx.fillRect(-w / 2, y0 + 24, w, h - 24);
        ctx.strokeStyle = 'rgba(140,120,85,0.5)'; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { const xx = -w / 2 + 4 + i * 24; ctx.beginPath(); ctx.moveTo(xx, y0 + 26); ctx.quadraticCurveTo(xx + 2, y0 + h / 2 + 10, xx, y0 + h - 2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,250,235,0.35)'; ctx.fillRect(-w / 2, y0 + 24, w, 2);
        break;
      case 'butter':
        ctx.fillStyle = vgrad(ctx, y0 + h - 12, y0 + h, ['#f6f8f9', '#d8dee2']); D.rr(ctx, -w / 2, y0 + h - 12, w, 12, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-w / 2 + 6, y0 + h - 11, w - 12, 1.2);
        ctx.fillStyle = '#e3bf55'; D.rr(ctx, -w / 2 + 8, y0 + 8, w - 16, h - 18, 4); ctx.fill();
        ctx.fillStyle = vgrad(ctx, y0 + 4, y0 + h - 10, ['#fbe895', '#f6dc7a', '#ecd06a']); D.rr(ctx, -w / 2 + 8, y0 + 4, w - 16, h - 16, 4); ctx.fill();
        ctx.fillStyle = '#fbeaa8'; ctx.fillRect(-w / 2 + 10, y0 + 6, w - 22, 5);
        ctx.strokeStyle = 'rgba(220,180,80,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w / 2 - 22, y0 + 6); ctx.lineTo(w / 2 - 20, y0 + h - 14); ctx.stroke();
        break;
      case 'carton':
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#ffffff', '#fbfbf8', '#e2e6e8']); ctx.fillRect(-w / 2, y0 + 20, w, h - 20);
        ctx.fillStyle = '#e8ecef'; ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 20); ctx.lineTo(0, y0); ctx.lineTo(w / 2, y0 + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d5dade'; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w / 2, y0 + 20); ctx.lineTo(w / 2 - 6, y0 + 20); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2f4f5'; ctx.fillRect(-3, y0 - 4, 6, 6);
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#6aa8de', '#5b9bd5', '#4a86bd']); ctx.fillRect(-w / 2, y0 + 44, w, 26);
        text(ctx, 'MILK', 0, y0 + 57, 12, '#ffffff', 900);
        // little cow spots
        ctx.fillStyle = 'rgba(60,60,70,0.55)'; D.blob(ctx, -8, y0 + 84, 4, 3, 0.4, 7); ctx.fill(); D.blob(ctx, 9, y0 + 92, 3, 4, 0.4, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-w / 2 + 3, y0 + 22, 2.5, h - 26);
        break;
      case 'tub':
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#fffcf2', '#f7f1df', '#e3dcc6']); D.rr(ctx, -w / 2, y0 + 10, w, h - 10, 6); ctx.fill();
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, [D.lighten(s.color || '#2f6b45', 0.2), s.color || '#2f6b45', D.deepen(s.color || '#2f6b45', 0.2)]); D.rr(ctx, -w / 2 - 2, y0, w + 4, 12, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-w / 2, y0 + 2, w, 1.2);
        { const tg = s.tag || 'PARM'; text(ctx, tg, 0, y0 + 34, Math.min(10, (w - 4) / (tg.length * 0.66)), s.color || '#2f6b45', 900); }
        ctx.fillStyle = rgba(s.color || '#2f6b45', 0.25); for (let i = 0; i < 3; i++) { D.ellipse(ctx, -10 + i * 10, y0 + 46, 3, 1.5, i); ctx.fill(); }
        break;
      case 'tomato':
        for (const dx of [-11, 11]) {
          ctx.fillStyle = 'rgba(80,20,10,0.2)'; D.circle(ctx, dx + 1.5, y0 + h / 2 + 6, 14); ctx.fill();
          ctx.fillStyle = D.dome(ctx, dx, y0 + h / 2 + 4, 14, '#d8392c', 0.4, 0.25); D.circle(ctx, dx, y0 + h / 2 + 4, 14); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; D.ellipse(ctx, dx - 5, y0 + h / 2 - 1, 3, 1.8, -0.6); ctx.fill();
          ctx.fillStyle = '#3f8a35'; D.ellipse(ctx, dx, y0 + h / 2 - 9, 5, 2); ctx.fill();
          ctx.fillStyle = '#5aa043'; D.rr(ctx, dx - 1, y0 + h / 2 - 13, 2, 5, 1); ctx.fill();
        }
        break;
      case 'chicken':
        ctx.fillStyle = vgrad(ctx, y0 + h - 17, y0 + h, ['#f4f6f8', '#d8dee2']); D.ellipse(ctx, 0, y0 + h - 8, w / 2, 9); ctx.fill();
        ctx.fillStyle = D.dome(ctx, -8, y0 + h / 2, 34, '#f2b5ab', 0.3, 0.15); D.ellipse(ctx, -8, y0 + h / 2, 34, 15); ctx.fill();
        ctx.fillStyle = D.dome(ctx, 18, y0 + h / 2 + 2, 22, '#efa597', 0.3, 0.15); D.ellipse(ctx, 18, y0 + h / 2 + 2, 22, 12); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; D.ellipse(ctx, -16, y0 + h / 2 - 6, 12, 3, -0.1); ctx.fill();
        // cling film sheen
        ctx.fillStyle = 'rgba(230,240,248,0.25)'; D.rr(ctx, -w / 2 + 2, y0 + 4, w - 4, h - 14, 10); ctx.fill();
        break;
      case 'bacon':
        ctx.fillStyle = 'rgba(230,240,245,0.7)'; D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = '#fbe6dc'; ctx.fillRect(-w / 2 + 6, y0 + 6 + i * 11, w - 12, 9);
          ctx.fillStyle = '#e07b74'; ctx.fillRect(-w / 2 + 6, y0 + 8 + i * 11, w - 12, 3);
          ctx.fillStyle = 'rgba(200,90,80,0.6)'; ctx.fillRect(-w / 2 + 6, y0 + 12.5 + i * 11, w - 12, 1.2);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; D.rr(ctx, -w / 2 + 2, y0 + 2, 3, h - 4, 1.5); ctx.fill();
        ctx.strokeStyle = 'rgba(150,170,180,0.5)'; ctx.lineWidth = 1; D.rr(ctx, -w / 2 + 0.5, y0 + 0.5, w - 1, h - 1, 6); ctx.stroke();
        break;
      case 'mushrooms':
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#6a8fb8', '#5b7fa8', '#4a6c92']); D.rr(ctx, -w / 2, y0 + h * 0.45, w, h * 0.55, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + i * w / 4, y0 + h * 0.5); ctx.lineTo(-w / 2 + i * w / 4, y0 + h); ctx.stroke(); }
        for (let i = 0; i < 3; i++) {
          const mx = -w / 2 + 8 + i * 12, my = y0 + h * 0.42;
          ctx.fillStyle = D.dome(ctx, mx, my, 9, '#c9a882', 0.35, 0.2); D.ellipse(ctx, mx, my, 9, 7); ctx.fill();
          ctx.fillStyle = '#e6d3b8'; D.ellipse(ctx, mx, y0 + h * 0.46 + 1, 7, 3); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; D.ellipse(ctx, mx - 3, my - 2.5, 2.5, 1.4, -0.5); ctx.fill();
        }
        break;
      case 'pepperveg':
        ctx.fillStyle = 'rgba(80,20,10,0.2)'; D.blob(ctx, 2, y0 + h * 0.58 + 2, w * 0.45, 7, 0.18, 10); ctx.fill();
        ctx.fillStyle = D.dome(ctx, 0, y0 + h * 0.58, w * 0.45, '#d8342a', 0.4, 0.25); D.blob(ctx, 0, y0 + h * 0.58, w * 0.45, 7, 0.18, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(110,15,10,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, y0 + h * 0.4); ctx.quadraticCurveTo(2, y0 + h * 0.65, 0, y0 + h * 0.85); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; D.ellipse(ctx, -6, y0 + h * 0.5, 3.5, 8, 0.2); ctx.fill();
        ctx.fillStyle = '#3f8a35'; D.ellipse(ctx, 0, y0 + 13, 7, 2.5); ctx.fill();
        ctx.fillStyle = '#4f9a3c'; D.rr(ctx, -3, y0, 6, 12, 2); ctx.fill();
        ctx.fillStyle = 'rgba(220,255,200,0.5)'; ctx.fillRect(-2, y0 + 2, 1.2, 8);
        break;
      case 'chives':
        ctx.lineWidth = 2.2;
        for (let i = -5; i <= 5; i++) { ctx.strokeStyle = i % 2 ? '#4c9a3c' : '#5aa848'; ctx.beginPath(); ctx.moveTo(i * 1.5, y0 + h); ctx.lineTo(i * 4.5, y0 + 2); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(220,255,200,0.4)'; ctx.lineWidth = 0.7;
        for (let i = -5; i <= 5; i += 2) { ctx.beginPath(); ctx.moveTo(i * 1.5 - 0.5, y0 + h - 4); ctx.lineTo(i * 4.5 - 0.5, y0 + 6); ctx.stroke(); }
        ctx.fillStyle = '#c99a5a'; ctx.fillRect(-8, y0 + h * 0.62, 16, 5);
        ctx.fillStyle = 'rgba(255,240,210,0.5)'; ctx.fillRect(-8, y0 + h * 0.62, 16, 1.2);
        break;
      case 'parsley':
        ctx.strokeStyle = '#6aa04e'; ctx.lineWidth = 2;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, y0 + h); ctx.lineTo(i * 8, y0 + 18); ctx.stroke(); }
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = 'rgba(30,60,25,0.2)'; D.blob(ctx, i * 8 + 1, y0 + 18, 10, i + 5, 0.4, 8); ctx.fill();
          ctx.fillStyle = i % 2 ? '#3f8f3a' : '#4fa047'; D.blob(ctx, i * 8, y0 + 16, 10, i + 5, 0.4, 8); ctx.fill();
          ctx.fillStyle = 'rgba(220,255,200,0.2)'; D.circle(ctx, i * 8 - 3, y0 + 13, 3.5); ctx.fill();
        }
        break;
      case 'curd': {
        // farmer's cheese in a paper wrapper, crumbly top showing
        ctx.fillStyle = hgrad(ctx, -w / 2, w / 2, ['#f4ead2', '#e9dcc0', '#d5c4a2']);
        ctx.beginPath(); ctx.moveTo(-w / 2, y0 + 18); ctx.lineTo(w / 2, y0 + 18); ctx.lineTo(w / 2 - 2, y0 + h); ctx.lineTo(-w / 2 + 2, y0 + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fbf8f0';
        D.blob(ctx, 0, y0 + 16, w / 2 - 2, 4, 0.35, 12); ctx.fill();
        ctx.fillStyle = 'rgba(220,210,190,0.7)';
        for (let i = 0; i < 12; i++) { D.circle(ctx, (hash(i * 3.1) - 0.5) * (w - 10), y0 + 9 + hash(i * 1.7) * 12, 1.4); ctx.fill(); }
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 8; i++) { D.circle(ctx, (hash(i * 5.3) - 0.5) * (w - 12), y0 + 8 + hash(i * 2.9) * 10, 2); ctx.fill(); }
        label(ctx, -w / 2 + 4, y0 + 26, w - 8, 14, s.color || '#c94a3a');
        text(ctx, s.tag || 'CURD', 0, y0 + 33.5, 9, '#ffffff', 900);
        ctx.strokeStyle = 'rgba(150,120,80,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-w / 2 + 4, y0 + 44); ctx.lineTo(w / 2 - 4, y0 + 48); ctx.stroke();
        break;
      }
      case 'salo': {
        // a slab of salo on butcher paper: white fat, a pink streak, rind and a salt-and-pepper crust
        ctx.fillStyle = vgrad(ctx, y0 + h - 14, y0 + h, ['#efe6d4', '#d9ccb2']);
        ctx.beginPath(); ctx.moveTo(-w / 2, y0 + h - 12); ctx.lineTo(w / 2 - 6, y0 + h - 14); ctx.lineTo(w / 2, y0 + h); ctx.lineTo(-w / 2 + 4, y0 + h); ctx.closePath(); ctx.fill();
        const sx = -w / 2 + 10, sw = w - 22, sy = y0 + 6, sh = h - 18;
        ctx.fillStyle = 'rgba(60,34,14,0.18)'; D.rr(ctx, sx + 2, sy + 3, sw, sh, 5); ctx.fill();
        ctx.fillStyle = vgrad(ctx, sy, sy + sh, ['#fffaf2', '#f6eee0', '#eadfcc']); D.rr(ctx, sx, sy, sw, sh, 5); ctx.fill();
        ctx.fillStyle = '#e9a29a'; D.rr(ctx, sx + 2, sy + sh * 0.55, sw - 4, 4, 2); ctx.fill();
        ctx.fillStyle = 'rgba(210,120,110,0.5)'; D.rr(ctx, sx + 6, sy + sh * 0.3, sw - 18, 2, 1); ctx.fill();
        ctx.fillStyle = '#c9965e'; D.rr(ctx, sx, sy + sh - 5, sw, 5, 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) ctx.fillRect(sx + hash(i * 2.3) * sw, sy + hash(i * 3.7) * 6, 1.4, 1.4);
        ctx.fillStyle = '#3a312c'; for (let i = 0; i < 8; i++) ctx.fillRect(sx + hash(i * 4.1) * sw, sy + 1 + hash(i * 1.9) * 5, 1.2, 1.2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; D.rr(ctx, sx + 3, sy + 3, sw * 0.4, 2, 1); ctx.fill();
        break;
      }
      case 'carrots':
        for (let i = 0; i < 3; i++) {
          const cx = -12 + i * 12, a = (i - 1) * 0.18;
          ctx.save(); ctx.translate(cx, y0 + h); ctx.rotate(a);
          ctx.fillStyle = 'rgba(80,30,5,0.2)'; ctx.beginPath(); ctx.moveTo(-5 + 1.5, -h + 14); ctx.lineTo(5 + 1.5, -h + 14); ctx.lineTo(1.5, 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = hgrad(ctx, -5, 5, ['#f59a4a', '#e8792b', '#c75d1a']);
          ctx.beginPath(); ctx.moveTo(-5, -h + 12); ctx.quadraticCurveTo(-5.5, -h * 0.5, 0, 0); ctx.quadraticCurveTo(5.5, -h * 0.5, 5, -h + 12); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(150,60,10,0.4)'; ctx.lineWidth = 0.7;
          for (let j = 0; j < 4; j++) { const yy = -h + 18 + j * 6; ctx.beginPath(); ctx.moveTo(-3.5, yy); ctx.lineTo(-1, yy + 1); ctx.stroke(); }
          ctx.strokeStyle = '#5c9a3a'; ctx.lineWidth = 1.4;
          for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(0, -h + 12); ctx.quadraticCurveTo(j * 3, -h + 4, j * 6, -h - 2); ctx.stroke(); }
          ctx.restore();
        }
        break;
      case 'cabbage': {
        // half a cabbage, cut face out: pale swirling leaves
        const cy = y0 + h * 0.56, r = Math.min(w / 2, h * 0.55);
        ctx.fillStyle = 'rgba(60,80,20,0.2)'; D.circle(ctx, 2, cy + 3, r); ctx.fill();
        ctx.fillStyle = D.dome(ctx, 0, cy, r, '#a9c97a', 0.3, 0.2); D.circle(ctx, 0, cy, r); ctx.fill();
        ctx.fillStyle = '#eef3d6'; D.circle(ctx, 0, cy, r * 0.86); ctx.fill();
        ctx.strokeStyle = '#c3d69a'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-2 + i * 0.6, cy + 1, r * (0.18 + i * 0.12), 0.4 + i, 4.2 + i); ctx.stroke(); }
        ctx.fillStyle = '#d9e6b0'; D.ellipse(ctx, 0, cy + r * 0.45, 5, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; D.ellipse(ctx, -r * 0.4, cy - r * 0.45, r * 0.3, r * 0.12, -0.5); ctx.fill();
        break;
      }
      case 'sorrel':
        ctx.strokeStyle = '#7a9a3a'; ctx.lineWidth = 1.5;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, y0 + h); ctx.lineTo(i * 6, y0 + 22); ctx.stroke(); }
        for (let i = -3; i <= 3; i++) {
          // arrow-shaped leaves
          const lx = i * 6, ly = y0 + 18;
          ctx.save(); ctx.translate(lx, ly); ctx.rotate(i * 0.18);
          ctx.fillStyle = 'rgba(30,60,25,0.2)'; ctx.beginPath(); ctx.moveTo(1, -16); ctx.quadraticCurveTo(9, -4, 4, 8); ctx.lineTo(1, 4); ctx.lineTo(-2, 8); ctx.quadraticCurveTo(-7, -4, 1, -16); ctx.fill();
          ctx.fillStyle = i % 2 ? '#4f9a36' : '#5eab42'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(8, -6, 3, 6); ctx.lineTo(0, 2); ctx.lineTo(-3, 6); ctx.quadraticCurveTo(-8, -6, 0, -18); ctx.fill();
          ctx.strokeStyle = 'rgba(220,255,200,0.45)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 3); ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = '#c99a5a'; ctx.fillRect(-7, y0 + h * 0.7, 14, 4);
        break;
      default:
        ctx.fillStyle = '#ccc'; D.rr(ctx, -w / 2, y0, w, h, 6); ctx.fill();
    }
    ctx.restore();
  };

  A.sourceIcon = function (ctx, s, x, y, pouring, t) {
    if (s.unit) return;
    ctx.save();
    ctx.shadowColor = 'rgba(40,20,8,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
    const tilt = pouring ? 2.2 + Math.sin(t * 10) * 0.05 : 0.2;
    A.drawSource(ctx, s, x, y + s.h / 2, tilt);
    ctx.restore();
  };

  A.stream = function (ctx, x0, y0, p1, col, t, kind) {
    ctx.save();
    ctx.lineCap = 'round';
    if (kind === 'grains') {
      const base = col === '#ffffff' || col === '#fffdf6' || col === '#f3eee2' || col === '#f7f7f4' ? '#f4f4f4' : col;
      for (let i = 0; i < 18; i++) {
        const f = (t * 3 + i / 18) % 1;
        const x = x0 + (p1.x - x0) * f + Math.sin(i * 7) * 4 * (0.4 + f), y = y0 + (p1.y - y0) * f;
        const r = 1.4 + hash(i * 3.3) * 1.2;
        ctx.fillStyle = 'rgba(60,34,14,0.18)'; D.circle(ctx, x + 0.6, y + 0.8, r); ctx.fill();
        ctx.fillStyle = i % 3 ? base : D.lighten(base, 0.3); D.circle(ctx, x, y, r); ctx.fill();
      }
      // a little puff where it lands
      ctx.fillStyle = rgba(base, 0.35);
      for (let i = 0; i < 4; i++) { const a = hash(i + Math.floor(t * 12)) * TAU; D.circle(ctx, p1.x + Math.cos(a) * 6, p1.y + Math.sin(a) * 3, 1.4); ctx.fill(); }
    } else {
      const path = (dx, wob) => {
        ctx.beginPath();
        ctx.moveTo(x0 + dx, y0);
        const n = 10;
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          ctx.lineTo(x0 + dx + (p1.x - x0) * f + Math.sin(f * 9 + t * 25) * 1.5 * wob, y0 + (p1.y - y0) * f);
        }
      };
      ctx.strokeStyle = rgba(col, 0.88); ctx.lineWidth = 6; path(0, 1); ctx.stroke();
      ctx.strokeStyle = rgba(D.deepen(col, 0.2), 0.35); ctx.lineWidth = 2; path(1.8, 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4; path(-1.4, 1); ctx.stroke();
      // ripples and droplets where it lands
      const ph = (t * 3) % 1;
      ctx.strokeStyle = rgba(D.lighten(col, 0.4), 0.55 * (1 - ph)); ctx.lineWidth = 1.5;
      D.ellipse(ctx, p1.x, p1.y, 6 + ph * 12, 3 + ph * 5); ctx.stroke();
      ctx.fillStyle = rgba(col, 0.8);
      for (let i = 0; i < 4; i++) { const a = hash(i * 1.7 + Math.floor(t * 18)) * TAU; D.circle(ctx, p1.x + Math.cos(a) * 9, p1.y + Math.sin(a) * 5 - 2, 1.6); ctx.fill(); }
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
    ctx.fillStyle = 'rgba(30,18,10,0.18)'; D.rr(ctx, x + 2, y + 5, w, h, 12); ctx.fill();
    ctx.fillStyle = vgrad(ctx, y, y + h, ['rgba(58,43,34,0.95)', 'rgba(44,32,26,0.94)']);
    D.rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,190,0.16)'; ctx.lineWidth = 1.5; D.rr(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke();
    if (bl.length) { ctx.fillStyle = 'rgba(255,231,194,0.12)'; ctx.fillRect(x + 14, y + 10 + tl.length * 22, w - 28, 1); }
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
    const below = by < 10;
    if (below) by = y + 40;
    // one outline: rounded box with the tail joined in
    const r = 16, tx = clamp(x, bx + r + 10, bx + w - r - 10);
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      if (below) { ctx.lineTo(tx - 9, by); ctx.lineTo(x, by - 18); ctx.lineTo(tx + 9, by); }
      ctx.arcTo(bx + w, by, bx + w, by + h, r);
      ctx.arcTo(bx + w, by + h, bx, by + h, r);
      if (!below) { ctx.lineTo(tx + 8, by + h); ctx.lineTo(x, by + h + 18); ctx.lineTo(tx - 10, by + h); }
      ctx.arcTo(bx, by + h, bx, by, r);
      ctx.arcTo(bx, by, bx + w, by, r);
      ctx.closePath();
    };
    ctx.save(); ctx.translate(2, 5); shape(); ctx.fillStyle = 'rgba(40,20,8,0.18)'; ctx.fill(); ctx.restore();
    shape();
    ctx.fillStyle = vgrad(ctx, by, by + h, ['#fffdf6', '#fff6e6']); ctx.fill();
    ctx.strokeStyle = '#6b4d3a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; D.rr(ctx, bx + 10, by + 5, w - 20, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#4a3428'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach((s, i) => ctx.fillText(s, bx + 15, by + 21 + i * 24));
    ctx.restore();
  };
})();
