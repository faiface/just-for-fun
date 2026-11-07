// Dev helpers for driving the game from the browser console (used while playtesting).
// Load with: await import('/tests/browser-helpers.js')  — or paste it in.
(function () {
  const W = window;
  W.__ev = function (type, x, y, button) {
    const k = CK.kitchen, cv = k.canvas, r = cv.getBoundingClientRect();
    const px = x * k.scale + k.offX, py = y * k.scale + k.offY;
    const cx = r.left + (px * r.width) / cv.width, cy = r.top + (py * r.height) / cv.height;
    cv.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button: button || 0, bubbles: true, pointerId: 1 }));
  };
  W.__run = (sec) => { for (let t = 0; t < sec; t += 0.05) CK.kitchen.update(0.05); CK.kitchen.render(); };
  W.__click = (x, y) => { W.__ev('pointerdown', x, y); W.__run(0.05); W.__ev('pointerup', x, y); W.__run(0.02); };
  W.__drag = (x0, y0, x1, y1, hold) => {
    W.__ev('pointerdown', x0, y0); W.__run(0.02);
    for (let i = 1; i <= 6; i++) { W.__ev('pointermove', x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6); W.__run(0.02); }
    if (hold) W.__run(hold);
    W.__ev('pointerup', x1, y1); W.__run(0.02);
  };
  W.__hold = (x, y, sec) => { W.__ev('pointerdown', x, y); W.__run(sec); W.__ev('pointerup', x, y); W.__run(0.02); };
  W.__shot = (x, y, w, h) => {
    const k = CK.kitchen; k.render(); const s = k.scale;
    const c = document.createElement('canvas'); c.width = w * s; c.height = h * s;
    c.getContext('2d').drawImage(k.canvas, k.offX + x * s, k.offY + y * s, w * s, h * s, 0, 0, w * s, h * s);
    let img = document.getElementById('__dbg');
    if (!img) { img = document.createElement('img'); img.id = '__dbg'; img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;z-index:99;background:#000;pointer-events:none'; document.body.appendChild(img); }
    img.src = c.toDataURL(); img.style.display = 'block';
    return 'shot';
  };
  W.__unshot = () => { const i = document.getElementById('__dbg'); if (i) i.style.display = 'none'; CK.kitchen && CK.kitchen.render(); };
  W.__desc = (c) => c.items.map((i) => { const d = CK.describeItem(i); return `${d.name} ${d.mass.toFixed(1)}g [${d.bits.join(', ')}] cook=${i.cook.toFixed(2)}`; });
})();
