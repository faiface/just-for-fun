// The playable kitchen: layout, input, continuous actions, particles and rendering.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, hash, mix, rgba, dist } = CK;
  const D = CK.D;

  const W = 1600, H = 900;
  const L = (CK.LAYOUT = {
    W, H,
    fridge: { x: 16, y: 36, w: 232, h: 850 },
    counter: { x: 256, y: 452, w: 1344, h: 434 },
    shelfA: 134, shelfB: 268, shelfC: 400, shelfX0: 268, shelfX1: 704,
    window: { x: 728, y: 34, w: 264, h: 214 },
    dishShelfY: 396,
    clock: { x: 1052, y: 88, r: 40 },
    timer: { x: 1052, y: 178 },
    rail: 58, utensilRail: 300,
    board: { x: 276, y: 556, w: 250, h: 250 },
    stove: { x: 660, y: 462, w: 352, h: 424 },
    burners: [{ x: 748, y: 556 }, { x: 926, y: 556 }, { x: 748, y: 734 }, { x: 926, y: 734 }],
    knobs: [{ x: 700, y: 852, b: 0 }, { x: 770, y: 852, b: 2 }, { x: 902, y: 852, b: 1 }, { x: 972, y: 852, b: 3 }],
    sink: { x: 1028, y: 470, w: 214, h: 262 },
    basin: { x: 1044, y: 502, w: 182, h: 214 },
    faucet: { x: 1135, y: 486 }, tapHandle: { x: 1186, y: 484 },
    toaster: { x: 1028, y: 754, w: 132, h: 118 },
    trash: { x: 1206, y: 818, r: 46 },
    bread: { x: 1270, y: 466, w: 150, h: 82 },
    pass: { x: 1290, y: 574, w: 298, h: 300 },
    passSpot: { x: 1420, y: 736 },
    bell: { x: 1548, y: 610 },
  });

  const SOURCES = [
    // pantry shelves (front view, poured)
    { ing: 'salt', x: 300, y: L.shelfA, w: 40, h: 70, look: 'shaker', label: 'Salt' },
    { ing: 'pepper', x: 360, y: L.shelfA, w: 34, h: 82, look: 'grinder', label: 'Pepper' },
    { ing: 'chili', x: 420, y: L.shelfA, w: 44, h: 64, look: 'jar', color: '#c4391f', label: 'Chili flakes' },
    { ing: 'cinnamon', x: 482, y: L.shelfA, w: 44, h: 64, look: 'jar', color: '#9a5b2e', label: 'Cinnamon' },
    { ing: 'sugar', x: 552, y: L.shelfA, w: 56, h: 80, look: 'jar', color: '#fffdf6', label: 'Sugar' },
    { ing: 'bakingpowder', x: 634, y: L.shelfA, w: 48, h: 62, look: 'tin', color: '#e2574c', label: 'Baking powder' },
    { ing: 'flour', x: 312, y: L.shelfB, w: 70, h: 100, look: 'bag', color: '#e9dcc0', tag: 'FLOUR', tagColor: '#5b86b8', label: 'Flour' },
    { ing: 'oats', x: 400, y: L.shelfB, w: 66, h: 96, look: 'bag', color: '#d9c08a', tag: 'OATS', tagColor: '#7a9a4a', label: 'Rolled oats' },
    { ing: 'rice', x: 484, y: L.shelfB, w: 60, h: 92, look: 'jar', color: '#f6f1e2', label: 'Rice' },
    { ing: 'spaghetti', x: 566, y: L.shelfB, w: 64, h: 116, look: 'tall', color: '#ead28a', label: 'Spaghetti' },
    { ing: 'soy', x: 648, y: L.shelfB, w: 34, h: 96, look: 'bottle', fill: 'rgba(55,32,20,0.95)', tag: ['SOY', 'SAUCE'], tagInk: '#b8322a', label: 'Soy sauce' },
    { ing: 'oil', x: 300, y: L.shelfC, w: 42, h: 116, look: 'bottle', fill: 'rgba(170,190,90,0.9)', tag: ['OLIVE', 'OIL'], tagInk: '#5a6a2a', label: 'Olive oil' },
    { ing: 'syrup', x: 366, y: L.shelfC, w: 40, h: 96, look: 'bottle', fill: 'rgba(150,80,30,0.95)', tag: ['MAPLE', 'SYRUP'], tagInk: '#7a3b1f', label: 'Maple syrup' },
    { ing: 'honey', x: 436, y: L.shelfC, w: 54, h: 70, look: 'jar', color: '#e0a12a', label: 'Honey' },
    { ing: 'cannedtom', x: 512, y: L.shelfC, w: 60, h: 76, look: 'can', color: '#c6392a', label: 'Crushed tomatoes' },
    // fridge (only when open)
    { ing: 'egg', fridge: true, unit: true, x: 92, y: 168, w: 104, h: 42, look: 'eggs', label: 'Eggs' },
    { ing: 'butter', fridge: true, x: 196, y: 168, w: 70, h: 34, look: 'butter', label: 'Butter' },
    { ing: 'milk', fridge: true, x: 74, y: 340, w: 46, h: 110, look: 'carton', label: 'Milk' },
    { ing: 'parmesan', fridge: true, x: 132, y: 340, w: 44, h: 56, look: 'tub', color: '#2f6b45', tag: 'PARM', label: 'Grated parmesan' },
    { ing: 'cheddar', fridge: true, x: 188, y: 340, w: 44, h: 56, look: 'tub', color: '#d9822b', tag: 'CHED', label: 'Grated cheddar' },
    { ing: 'chicken', fridge: true, unit: true, x: 90, y: 508, w: 86, h: 46, look: 'chicken', label: 'Chicken breast' },
    { ing: 'bacon', fridge: true, unit: true, x: 162, y: 508, w: 52, h: 40, look: 'bacon', label: 'Bacon' },
    { ing: 'mushroom', fridge: true, unit: true, x: 213, y: 508, w: 40, h: 34, look: 'mushrooms', label: 'Mushrooms' },
    { ing: 'tomato', fridge: true, unit: true, x: 84, y: 694, w: 46, h: 40, look: 'tomato', label: 'Tomatoes' },
    { ing: 'bellpepper', fridge: true, unit: true, x: 144, y: 694, w: 44, h: 46, look: 'pepperveg', label: 'Bell peppers' },
    { ing: 'parsley', fridge: true, unit: true, x: 204, y: 694, w: 50, h: 56, look: 'parsley', label: 'Parsley' },
    { ing: 'chives', fridge: true, unit: true, x: 110, y: 772, w: 70, h: 50, look: 'chives', label: 'Chives' },
    // baskets & bread
    { ing: 'onion', unit: true, basket: true, x: 312, y: 502, r: 36, label: 'Onions' },
    { ing: 'garlic', unit: true, basket: true, x: 394, y: 502, r: 30, label: 'Garlic' },
    { ing: 'potato', unit: true, basket: true, x: 476, y: 502, r: 36, label: 'Potatoes' },
    { ing: 'banana', unit: true, fruit: true, x: 1508, y: 512, r: 40, label: 'Bananas' },
    { ing: 'basil', unit: true, plant: true, x: 1518, y: 404, w: 80, h: 96, label: 'Basil plant (pick a sprig)' },
    { ing: 'bread', unit: true, bread: true, x: L.bread.x + L.bread.w / 2, y: L.bread.y + L.bread.h / 2, w: L.bread.w, h: L.bread.h, label: 'Bread' },
  ];

  const TOOLS = [
    { id: 'spoon', x: 1150, label: 'Wooden spoon', hint: 'hold on a pot or pan to stir' },
    { id: 'spatula', x: 1226, label: 'Spatula', hint: 'click food in a pan to flip it · hold to stir' },
    { id: 'whisk', x: 1302, label: 'Whisk', hint: 'hold on a bowl to whisk' },
    { id: 'taster', x: 1378, label: 'Tasting spoon', hint: 'click a dish to taste it' },
  ];

  const HOMES = {
    pan: { t: 'rack', x: 1196, y: 186, s: 0.78 },
    saucepan: { t: 'rack', x: 1352, y: 176, s: 0.78 },
    pot: { t: 'rack', x: 1508, y: 188, s: 0.78 },
    plate: { t: 'shelf', x: 772, y: 350, s: 0.55 },
    soupbowl: { t: 'shelf', x: 842, y: 359, s: 0.55 },
    bowl: { t: 'shelf', x: 906, y: 360, s: 0.55 },
    bowl2: { t: 'shelf', x: 966, y: 360, s: 0.55 },
  };

  const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  class Kitchen {
    constructor(canvas, hooks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hooks = hooks || {};
      this.mouse = { x: 0, y: 0, down: false };
      this.particles = [];
      this.messages = [];
      this.paused = true;
      this.last = performance.now();
      this.time = 0;
      this.reset();
      this._bind();
      this._resize();
      const loop = (t) => {
        // tolerate low frame rates (background tabs, slow devices) without losing time
        let dt = Math.min(0.25, Math.max(0, (t - this.last) / 1000));
        this.last = t;
        while (dt > 1e-4) { const d = Math.min(0.05, dt); this.update(d); dt -= d; }
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    reset() {
      const w = (this.world = new CK.World());
      this.C = {};
      for (const key of Object.keys(HOMES)) {
        const type = key === 'bowl2' ? 'bowl' : key;
        const c = new CK.Container(type, { key, home: HOMES[key], loc: { t: HOMES[key].t } });
        this.C[key] = c;
        w.containers.push(c);
      }
      this.fridgeOpen = false;
      this.held = null;
      this.tool = null;
      this.toolAct = null;
      this.pour = null;
      this.taste = null;
      this.particles = [];
      this.messages = [];
      this.hover = null;
      this.knobFlash = {};
    }

    // ------------------------------------------------------------ geometry
    posOf(c) {
      const l = c.loc;
      if (l.t === 'rack' || l.t === 'shelf') return { x: c.home.x, y: c.home.y, s: c.home.s };
      if (l.t === 'burner') return { x: L.burners[l.i].x, y: L.burners[l.i].y, s: 1 };
      if (l.t === 'sink') return { x: L.basin.x + L.basin.w / 2, y: L.basin.y + L.basin.h / 2 + 4, s: 1 };
      if (l.t === 'pass') return { x: L.passSpot.x, y: L.passSpot.y, s: 1 };
      if (l.t === 'held') return { x: this.mouse.x + (this.held ? this.held.ox : 0), y: this.mouse.y + (this.held ? this.held.oy : 0), s: 1 };
      return { x: c.x, y: c.y, s: 1 };
    }
    placed() { return this.world.containers.filter((c) => c.loc.t !== 'rack' && c.loc.t !== 'shelf' && c.loc.t !== 'held'); }
    containerAt(x, y, exclude) {
      const list = this.placed().filter((c) => c !== exclude).sort((a, b) => this.posOf(b).y - this.posOf(a).y);
      // topmost (drawn last = largest y) first
      for (const c of list) {
        const p = this.posOf(c);
        if (dist(x, y, p.x, p.y) <= c.def.r * p.s) return c;
      }
      return null;
    }
    handleHit(c, x, y) {
      const p = this.posOf(c);
      if (c.def.shape !== 'pan' && c.type !== 'saucepan') return false;
      const a = 0.6, r = c.def.r * p.s;
      const dx = x - p.x, dy = y - p.y;
      const along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a);
      return along > r * 0.9 && along < r * 2.0 && Math.abs(across) < 12;
    }
    storedAt(x, y) {
      for (const c of this.world.containers) {
        if (c.loc.t !== 'rack' && c.loc.t !== 'shelf') continue;
        const p = this.posOf(c);
        if (dist(x, y, p.x, p.y) <= c.def.r * p.s + 4) return c;
      }
      return null;
    }
    burnerAt(x, y, rad) {
      let best = -1, bd = rad || 95;
      L.burners.forEach((b, i) => { const d = dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    sourceAt(x, y) {
      for (const s of SOURCES) {
        if (s.fridge && !this.fridgeOpen) continue;
        if (s.r) { if (dist(x, y, s.x, s.y) < s.r) return s; continue; }
        if (x >= s.x - s.w / 2 && x <= s.x + s.w / 2 && y >= s.y - s.h && y <= s.y + (s.fridge || s.bread ? s.h / 2 : 4)) return s;
      }
      return null;
    }
    looseItemAt(x, y) {
      const lists = [this.world.toasterC.items, this.world.counter.items, this.world.board.items];
      for (const list of lists) {
        for (let i = list.length - 1; i >= 0; i--) {
          const it = list[i];
          if (it._sx != null && dist(x, y, it._sx, it._sy) < Math.max(12, it._sr || 14)) return { it, owner: list === this.world.toasterC.items ? this.world.toasterC : list === this.world.counter.items ? this.world.counter : this.world.board };
        }
      }
      return null;
    }
    itemInContainerAt(c, x, y) {
      // smaller things first, so a whole egg sitting on a cracked one can still be clicked
      const sol = c.items.filter((i) => i.kind === 'solid' || i.kind === 'set').sort((a, b) => (a._sr || 16) - (b._sr || 16));
      const p = this.posOf(c);
      for (const it of sol) {
        const q = D.itemPos(c, it, p.x, p.y, p.s);
        if (dist(x, y, q.x, q.y) < Math.max(12, (it._sr || 16) * 0.9)) return it;
      }
      return null;
    }
    toolAt(x, y) {
      if (y < L.utensilRail - 10 || y > L.utensilRail + 130) return null;
      for (const t of TOOLS) if (Math.abs(x - t.x) < 26 && this.tool !== t.id) return t;
      return null;
    }
    knifeAt(x, y) { return this.tool !== 'knife' && x > L.board.x + L.board.w - 34 && x < L.board.x + L.board.w + 6 && y > L.board.y + 14 && y < L.board.y + L.board.h - 10; }
    knobAt(x, y) { return L.knobs.findIndex((k) => dist(x, y, k.x, k.y) < 24); }

    // ------------------------------------------------------------ messages
    say(text, x, y) {
      this.messages = this.messages.filter((m) => m.text !== text);
      this.messages.push({ text, t: 2.8, x, y });
      if (this.messages.length > 3) this.messages.shift();
    }
    sfx(name, a) { if (CK.Audio) CK.Audio.play(name, a); }

    // ------------------------------------------------------------ input
    _bind() {
      const cv = this.canvas;
      const pos = (e) => {
        const r = cv.getBoundingClientRect();
        const px = (e.clientX - r.left) * (cv.width / r.width);
        const py = (e.clientY - r.top) * (cv.height / r.height);
        return { x: (px - this.offX) / this.scale, y: (py - this.offY) / this.scale };
      };
      cv.addEventListener('pointerdown', (e) => {
        if (this.paused) return;
        cv.setPointerCapture(e.pointerId);
        const p = pos(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        if (CK.Audio) CK.Audio.unlock();
        if (e.button === 2) { this.cancel(); return; }
        this.mouse.down = true;
        this.onDown(p.x, p.y, e);
      });
      const release = (p) => {
        this.mouse.down = false;
        if (!this.paused) this.onUp(p.x, p.y);
        else { this.toolAct = null; if (this.held) this.dropBack(); }
      };
      cv.addEventListener('pointermove', (e) => {
        const p = pos(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        if (this.held && this.held.start && dist(p.x, p.y, this.held.start.x, this.held.start.y) > 6) this.held.moved = true;
        // a second button pressed mid-drag arrives as a move: right button = cancel
        if (this.mouse.down && (e.buttons & 2) && this.held) { this.cancel(); this.mouse.down = false; this.toolAct = null; return; }
        // the left button was released without us seeing a pointerup
        if (this.mouse.down && e.pointerType === 'mouse' && !(e.buttons & 1)) release(p);
      });
      cv.addEventListener('pointerup', (e) => {
        const p = pos(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        if (e.button === 2 && !(this.mouse.down && !(e.buttons & 1))) return;
        if (this.mouse.down) release(p);
      });
      const lost = () => {
        if (!this.mouse.down) return;
        this.mouse.down = false;
        this.toolAct = null;
        if (this.held) this.dropBack();
      };
      cv.addEventListener('pointercancel', lost);
      cv.addEventListener('lostpointercapture', lost);
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('wheel', (e) => {
        const p = pos(e);
        const k = this.knobAt(p.x, p.y);
        if (k >= 0 && !this.paused) { e.preventDefault(); this.knob(L.knobs[k].b, e.deltaY < 0 ? 1 : -1); }
      }, { passive: false });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.cancel();
      });
      window.addEventListener('resize', () => this._resize());
    }
    _resize() {
      const cv = this.canvas;
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      this.scale = Math.min(cv.width / W, cv.height / H);
      this.offX = (cv.width - W * this.scale) / 2;
      this.offY = (cv.height - H * this.scale) / 2;
    }

    cancel() {
      if (this.held) this.dropBack();
      else if (this.tool) { this.tool = null; this.toolAct = null; }
    }

    knob(b, d) {
      const w = this.world;
      w.burners[b] = clamp(w.burners[b] + d, 0, 5);
      this.knobFlash[b] = 1.2;
      this.sfx('click');
      if (d > 0 && w.burners[b] === 1) this.sfx('ignite');
    }

    onDown(x, y, e) {
      const w = this.world;
      // never hold two things at once
      if (this.held) this.dropBack();
      this.toolAct = null;
      // fixtures that work with or without a tool
      const k = this.knobAt(x, y);
      if (k >= 0) { const kn = L.knobs[k]; this.knob(kn.b, x >= kn.x ? 1 : -1); return; }
      if (dist(x, y, L.tapHandle.x, L.tapHandle.y) < 22 || dist(x, y, L.faucet.x, L.faucet.y) < 18) { w.tap = !w.tap; w.tapAdded = 0; this.sfx('click'); return; }
      if (dist(x, y, L.bell.x, L.bell.y) < 26) { this.serve(); return; }
      const T = L.toaster;
      if (inRect(x, y, { x: T.x + T.w - 34, y: T.y + 10, w: 34, h: 50 })) { this.toasterLever(); return; }
      if (dist(x, y, T.x + T.w - 17, T.y + 88) < 16) { w.toaster.level = (w.toaster.level % 5) + 1; this.sfx('click'); return; }
      if (dist(x, y, L.timer.x, L.timer.y) < 30) { this.toggleTimer(); return; }
      if (inRect(x, y, L.fridge) && (!this.fridgeOpen || x < L.fridge.x + 26 || y < L.fridge.y + 40 || y > L.fridge.y + L.fridge.h - 90)) {
        this.fridgeOpen = !this.fridgeOpen;
        this.sfx(this.fridgeOpen ? 'open' : 'close');
        return;
      }
      // pick up / swap utensils
      const t = this.toolAt(x, y);
      if (t) { this.tool = t.id; this.say(t.label + ': ' + t.hint); this.sfx('pick'); return; }
      if (this.knifeAt(x, y)) { this.tool = 'knife'; this.say('Knife: click or hold on food on the cutting board to chop it'); this.sfx('pick'); return; }
      if (this.tool) { this.toolDown(x, y); return; }
      this.handDown(x, y);
    }

    toolDown(x, y) {
      const tool = this.tool;
      // putting the tool back
      const home = TOOLS.find((t) => t.id === tool);
      if ((home && Math.abs(x - home.x) < 30 && y > L.utensilRail - 10 && y < L.utensilRail + 130) ||
        (tool === 'knife' && inRect(x, y, { x: L.board.x + L.board.w - 40, y: L.board.y, w: 50, h: L.board.h }) && !this.boardItemAt(x, y))) {
        this.tool = null; this.sfx('pick'); return;
      }
      if (tool === 'knife') {
        const it = this.boardItemAt(x, y);
        if (!it) {
          const c = this.containerAt(x, y);
          const li = this.looseItemAt(x, y) || (c && this.itemInContainerAt(c, x, y));
          if (li) { this.say('Put it on the cutting board to chop it.'); return; }
          return this.dropToolAndGrab(x, y);
        }
        this.toolAct = { kind: 'chop', it, t: 0 };
        this.doChop(it);
        return;
      }
      const c = this.containerAt(x, y);
      if (tool === 'taster') {
        if (!c) {
          const li = this.looseItemAt(x, y);
          if (li) { this.showTaste({ items: [li.it], temp: li.it.temp, def: {} }, x, y); return; }
          return this.dropToolAndGrab(x, y);
        }
        this.showTaste(c, x, y);
        return;
      }
      if (!c) {
        const li = this.looseItemAt(x, y);
        if (li && tool === 'spatula' && (CK.isFlippable(li.it) || (li.it.ing === 'egg' && li.it.form === 'cracked'))) {
          const msg = CK.flip(li.owner, li.it);
          if (msg) this.say(msg); else this.sfx('flip');
          return;
        }
        return this.dropToolAndGrab(x, y);
      }
      if (tool === 'spatula') {
        const it = this.itemInContainerAt(c, x, y);
        if (it && (CK.isFlippable(it) || it.kind === 'fluid' || (it.ing === 'egg' && it.form === 'cracked'))) {
          const msg = CK.flip(c, it);
          if (msg) this.say(msg); else this.sfx('flip');
          this.toolAct = { kind: 'noop' };
          return;
        }
      }
      this.toolAct = { kind: 'stir', c, a: 0 };
    }

    // clicking something a utensil can't be used on: hang the utensil back up and use your hand
    dropToolAndGrab(x, y) {
      const tool = this.tool;
      this.tool = null;
      this.toolAct = null;
      this.handDown(x, y);
      if (!this.held) this.tool = tool; // nothing to grab there: keep holding the utensil
    }

    boardItemAt(x, y) {
      const list = this.world.board.items;
      for (let i = list.length - 1; i >= 0; i--) {
        const it = list[i];
        if (it._sx != null && dist(x, y, it._sx, it._sy) < Math.max(16, it._sr || 14)) return it;
      }
      return null;
    }
    doChop(it) {
      const msg = CK.chop(it);
      if (msg) { this.say(msg); this.toolAct = null; return; }
      this.sfx('chop');
      this.knifeBob = 1;
    }

    showTaste(c, x, y) {
      const lines = CK.taste(c);
      this.taste = { lines, x, y, t: 4 };
      this.sfx('slurp');
    }

    handDown(x, y) {
      const w = this.world;
      // food lying loose (toaster, counter, board)
      const li = this.looseItemAt(x, y);
      if (li && !(li.owner === w.toasterC && w.toaster.down)) {
        li.owner.remove(li.it);
        this.held = { type: 'item', it: li.it, from: li.owner, fromPos: { ax: li.it.ax, ay: li.it.ay }, ox: 0, oy: 0, start: { x, y }, t0: performance.now() };
        this.sfx('pick');
        return;
      }
      // containers that are out
      const c = this.containerAt(x, y);
      let hc = null;
      for (const cc of this.placed()) if (this.handleHit(cc, x, y)) hc = cc;
      if (hc) return this.pickContainer(hc, x, y);
      if (c) {
        const it = this.itemInContainerAt(c, x, y);
        if (it && !(c.loc.t === 'pass' && false)) {
          c.remove(it);
          this.held = { type: 'item', it, from: c, fromPos: { px: it.px, py: it.py }, ox: 0, oy: 0, start: { x, y }, t0: performance.now() };
          this.sfx('pick');
          return;
        }
        return this.pickContainer(c, x, y);
      }
      const sc = this.storedAt(x, y);
      if (sc) return this.pickContainer(sc, x, y);
      const s = this.sourceAt(x, y);
      if (s) {
        if (s.unit) {
          const it = CK.makeUnit(s.ing);
          this.held = { type: 'item', it, from: null, ox: 0, oy: 0, start: { x, y }, t0: performance.now(), fresh: true };
        } else {
          this.held = { type: 'source', src: s, ox: 0, oy: 0, start: { x, y } };
        }
        this.sfx('pick');
      }
    }

    pickContainer(c, x, y) {
      const p = this.posOf(c);
      this.held = { type: 'container', c, fromLoc: { ...c.loc }, fromXY: { x: c.x, y: c.y }, ox: 0, oy: 0, start: { x, y }, t0: performance.now() };
      // grab offset so the container doesn't jump (but keep handle-picks reasonable)
      const ox = p.x - x, oy = p.y - y;
      const m = Math.hypot(ox, oy), lim = 40;
      this.held.ox = m > lim ? (ox / m) * lim : ox;
      this.held.oy = m > lim ? (oy / m) * lim : oy;
      c.loc = { t: 'held' };
      this.sfx('pick');
    }

    onUp(x, y) {
      if (this.toolAct) { this.toolAct = null; return; }
      const h = this.held;
      if (!h) return;
      const click = !h.moved && performance.now() - (h.t0 || 0) < 350;
      if (h.type === 'source') { this.held = null; this.pour = null; return; }
      if (h.type === 'item') {
        if (click && h.from) {
          this.dropBack();
          this.itemClick(h.it, h.from);
          return;
        }
        this.dropItem(h.it, x, y);
        return;
      }
      if (h.type === 'container') {
        if (click) { this.dropBack(); return; }
        this.dropContainer(h.c, x + h.ox, y + h.oy, x, y);
      }
    }

    itemClick(it, owner) {
      if (it.ing === 'egg' && it.form === 'whole') {
        const msg = CK.crack(owner === this.world.counter || owner === this.world.board ? owner : owner, it);
        if (msg) this.say(msg); else this.sfx('crack');
        return;
      }
      const d = CK.describeItem(it);
      this.say(CK.cap(d.name) + (d.bits.length ? ' — ' + d.bits.join(', ') : ''));
    }

    dropBack() {
      const h = this.held;
      if (!h) return;
      if (h.type === 'item') {
        if (h.from) {
          if (h.fromPos.ax != null) { h.it.ax = h.fromPos.ax; h.it.ay = h.fromPos.ay; }
          if (h.fromPos.px != null) { h.it.px = h.fromPos.px; h.it.py = h.fromPos.py; }
          h.from.items.push(h.it);
        }
      } else if (h.type === 'container') {
        h.c.loc = h.fromLoc;
        h.c.x = h.fromXY.x; h.c.y = h.fromXY.y;
      }
      this.held = null;
      this.pour = null;
    }

    dropItem(it, x, y) {
      const w = this.world;
      const h = this.held;
      const fail = (msg) => { if (msg) this.say(msg); if (h.from) this.dropBack(); else this.held = null; };
      if (dist(x, y, L.trash.x, L.trash.y) < L.trash.r + 6) { this.held = null; this.sfx('trash'); return; }
      const c = this.containerAt(x, y);
      if (c) {
        const p = this.posOf(c);
        const inner = D.containerInnerR(c) * 0.63;
        let px = (x - p.x) / inner, py = (y - p.y) / inner;
        const m = Math.hypot(px, py);
        if (m > 1) { px /= m; py /= m; }
        it.px = px; it.py = py;
        if (c.mass + it.mass > c.def.cap) return fail(`The ${c.def.name} is full.`);
        c.add(it);
        this.held = null;
        this.sfx(c.loc.t === 'burner' && c.temp > 120 ? 'sizzleHit' : 'drop');
        return;
      }
      const T = L.toaster;
      if (inRect(x, y, T)) {
        if (it.ing !== 'bread') return fail("That won't fit in the toaster.");
        if (w.toasterC.items.length >= 2) return fail('The toaster only has two slots.');
        if (w.toaster.down) return fail('Wait for the toaster to pop.');
        it.ax = T.x + 50; it.ay = T.y + 30 + w.toasterC.items.length * 40;
        w.toasterC.add(it);
        this.held = null; this.sfx('drop');
        return;
      }
      if (inRect(x, y, L.board)) {
        if (it.ing === 'egg' && it.form === 'cracked' && it.cook < 0.45) return fail('A raw egg would run all over the board — keep it in a bowl or pan.');
        it.ax = clamp(x, L.board.x + 26, L.board.x + L.board.w - 50);
        it.ay = clamp(y, L.board.y + 24, L.board.y + L.board.h - 24);
        w.board.items.push(it);
        this.held = null; this.sfx('drop');
        return;
      }
      if (inRect(x, y, L.stove)) return fail('Put it in a pan or pot first!');
      if (inRect(x, y, L.sink)) return fail('Not in the sink — use a bowl or the board.');
      if (inRect(x, y, L.counter) && !inRect(x, y, L.pass)) {
        if (it.kind === 'set' || (it.ing === 'egg' && it.form === 'cracked')) return fail('That would make a mess — put it on a plate.');
        it.ax = clamp(x, L.counter.x + 20, W - 20);
        it.ay = clamp(y, L.counter.y + 16, L.counter.y + L.counter.h - 20);
        w.counter.items.push(it);
        this.held = null; this.sfx('drop');
        return;
      }
      if (inRect(x, y, L.pass)) return fail('Put a plate on the serving tray first.');
      if (h.fresh) { this.held = null; return; }
      fail();
    }

    dropContainer(c, x, y, mx, my) {
      const w = this.world;
      const h = this.held;
      const back = (msg) => { if (msg) this.say(msg); this.dropBack(); };
      const occupied = (t, i) => w.containers.some((o) => o !== c && o.loc.t === t && (i == null || o.loc.i === i));
      if (dist(mx, my, L.trash.x, L.trash.y) < L.trash.r + 10) {
        if (c.items.length) { c.clear(); this.sfx('trash'); this.say(`Emptied the ${c.def.name}.`); }
        return back();
      }
      const b = this.burnerAt(mx, my, 100);
      if (b >= 0 || inRect(mx, my, L.stove)) {
        if (!c.def.stove) return back(`The ${c.def.name} can't go on the stove.`);
        const bi = b >= 0 ? b : this.burnerAt(mx, my, 400);
        if (occupied('burner', bi)) return back('That burner is already in use.');
        c.loc = { t: 'burner', i: bi };
        this.held = null; this.sfx('clank');
        return;
      }
      if (inRect(mx, my, L.sink)) {
        if (occupied('sink')) return back('There is already something in the sink.');
        c.loc = { t: 'sink' };
        this.held = null; this.sfx('clank');
        return;
      }
      if (inRect(mx, my, L.pass)) {
        if (occupied('pass')) return back('There is already a dish on the serving tray.');
        c.loc = { t: 'pass' };
        this.held = null; this.sfx('drop');
        return;
      }
      if (inRect(mx, my, L.toaster)) return back();
      if (inRect(mx, my, L.counter)) {
        const r = c.def.r;
        c.x = clamp(x, L.counter.x + r * 0.8, W - r * 0.8);
        c.y = clamp(y, L.counter.y + r * 0.7, L.counter.y + L.counter.h - r * 0.6);
        c.loc = { t: 'counter' };
        this.held = null; this.sfx('drop');
        return;
      }
      if (my < L.counter.y && !inRect(mx, my, L.fridge)) {
        if (c.items.length) return back(`Empty the ${c.def.name} before putting it away.`);
        c.loc = { t: c.home.t };
        this.held = null; this.sfx('clank');
        return;
      }
      back();
    }

    toasterLever() {
      const w = this.world;
      if (w.toaster.down) { w.toaster.down = false; w.toaster.timer = 0; this.sfx('pop'); return; }
      if (!w.toasterC.items.length) { this.say('Put a slice of bread in the toaster first.'); return; }
      w.toaster.down = true; w.toaster.timer = 0;
      this.sfx('lever');
    }

    toggleTimer() {
      const T = this.world.timer;
      if (T.running) { T.running = false; T.acc = this.world.time - T.start; }
      else { T.running = true; T.start = this.world.time; }
      this.sfx('click');
    }

    serve() {
      const c = this.world.containers.find((o) => o.loc.t === 'pass');
      if (!c) { this.say('Put the finished dish on the serving tray, then ring the bell.'); return; }
      this.sfx('bell');
      if (this.hooks.onServe) this.hooks.onServe(c);
    }

    // ------------------------------------------------------------ continuous actions
    pourTarget(x, y) {
      const h = this.held;
      const c = this.containerAt(x, y, h.type === 'container' ? h.c : null);
      if (c) return { c };
      if (h.type === 'container' && inRect(x, y, L.basin) && !this.world.at('sink')) return { sink: true };
      if (inRect(x, y, L.board)) return { c: this.world.board, board: true };
      return null;
    }

    update(dt) {
      this.time += dt;
      for (const m of this.messages) m.t -= dt;
      this.messages = this.messages.filter((m) => m.t > 0);
      if (this.taste) { this.taste.t -= dt; if (this.taste.t <= 0) this.taste = null; }
      if (this.paused) { if (CK.Audio) CK.Audio.setLoops({}); return; }
      const w = this.world;
      w.step(dt);
      for (const k in this.knobFlash) this.knobFlash[k] -= dt;
      if (this.knifeBob) this.knifeBob = Math.max(0, this.knifeBob - dt * 6);
      // events
      for (const e of w.events) {
        if (e === 'pop') { this.sfx('pop'); this.say('Toast is up!'); }
        if (e === 'overflow' && !this._ovf) { this._ovf = 1; this.say('It’s overflowing! Turn off the tap.'); setTimeout(() => (this._ovf = 0), 3000); }
      }
      w.events.length = 0;

      // tool actions
      const ta = this.toolAct;
      if (ta && ta.kind === 'stir' && this.mouse.down) {
        CK.stir(ta.c, dt, this.tool);
        ta.a += dt * (this.tool === 'whisk' ? 14 : 7);
        // swirl the contents a little
        for (const it of ta.c.items) {
          if (it.kind === 'solid' && !CK.isBulk(it)) continue;
          const a = dt * 1.6, cs = Math.cos(a), sn = Math.sin(a);
          const px = it.px * cs - it.py * sn, py = it.px * sn + it.py * cs;
          it.px = px; it.py = py;
        }
        if (Math.random() < dt * 4) this.sfx(this.tool === 'whisk' ? 'whisk' : 'stir');
      }
      if (ta && ta.kind === 'chop' && this.mouse.down) {
        ta.t += dt;
        if (ta.t > 0.13) { ta.t -= 0.13; if (this.world.board.items.includes(ta.it)) this.doChop(ta.it); }
      }

      // pouring
      const h = this.held;
      if (h && (h.type === 'source' || h.type === 'container')) {
        const tgt = this.pourTarget(this.mouse.x, this.mouse.y);
        const key = tgt ? (tgt.sink ? 'sink' : tgt.c.id) : null;
        if (!this.pour || this.pour.key !== key) this.pour = { key, tgt, t: 0, moved: 0, active: false };
        const P = this.pour;
        if (tgt) {
          P.t += dt;
          if (P.t > 0.28) {
            P.active = true;
            if (h.type === 'source') this.pourSource(h.src, tgt, dt, P);
            else this.pourContainer(h.c, tgt, dt, P);
          }
        }
      } else this.pour = null;

      this.updateParticles(dt);
      if (CK.Audio) this.updateAudio();
    }

    pourSource(src, tgt, dt, P) {
      const d = CK.ING[src.ing];
      const c = tgt.c;
      if (!c) return;
      if (c.def.solidsOnly && (d.phase === 'liquid' || d.phase === 'fat')) { if (!P.warned) { P.warned = 1; this.say("That would make a mess — pour it into a container."); } P.active = false; return; }
      // starts gently (a pinch is a quick dip) and speeds up the longer you keep pouring
      const held = P.t - 0.28;
      const maxBoost = clamp(30 / d.pourRate, 1, 6); // only slow pourers (salt, sugar...) speed up
      const ramp = held < 0.6 ? clamp(held / 0.6, 0.25, 1) : Math.min(maxBoost, 1 + Math.max(0, held - 1.2) * 1.6);
      let g = d.pourRate * dt * ramp;
      if (c.mass + g > c.def.cap) { if (!P.warned) { P.warned = 1; this.say(`The ${c.def.name} is full.`); } P.active = false; return; }
      CK.addIngredient(c, src.ing, g);
      if (c.def.solidsOnly) for (const it of c.items) if (it.ax == null) { it.ax = this.mouse.x; it.ay = this.mouse.y + 30; }
      P.moved += g;
      P.ing = src.ing;
      if (Math.random() < dt * 8) this.sfx(d.phase === 'liquid' || d.phase === 'fat' ? 'pourLiquid' : 'pourDry');
    }

    pourContainer(from, tgt, dt, P) {
      if (!from.items.length) { P.active = false; return; }
      let r;
      if (tgt.sink) r = CK.pourStep(from, null, dt);
      else {
        const before = tgt.c.items.length;
        r = CK.pourStep(from, tgt.c, dt);
        if (tgt.board) {
          for (const it of tgt.c.items) if (it.ax == null) { it.ax = clamp(this.mouse.x, L.board.x + 26, L.board.x + L.board.w - 50); it.ay = clamp(this.mouse.y + 20, L.board.y + 24, L.board.y + L.board.h - 24); }
        }
      }
      if (r.full && !P.warned) { P.warned = 1; this.say(`The ${tgt.c.def.name} is full.`); }
      if (r.blocked && !P.warned) { P.warned = 1; this.say('Liquids would spill on the board — only solids slide off.'); }
      if (!r.moved && tgt.sink && P.moved > 0 && from.items.length && !P.warned) { P.warned = 1; this.say('Drained! The solids stay in the pot.'); }
      P.moved += r.moved || 0;
      P.active = (r.moved || 0) > 0;
      if (r.moved && Math.random() < dt * 8) this.sfx('pourLiquid');
    }

    // ------------------------------------------------------------ particles
    updateParticles(dt) {
      const ps = this.particles;
      for (const p of ps) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.98; p.r += p.gr * dt;
      }
      this.particles = ps.filter((p) => p.life > 0);
      if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
      for (const c of this.world.containers) {
        if (c.loc.t === 'rack' || c.loc.t === 'shelf') continue;
        const p = this.posOf(c);
        const pool = c.pool();
        const deep = pool && pool.mass >= c.def.cover;
        const hotItems = c.items.filter((i) => i.temp > 60 && i.kind !== 'powder');
        let steam = 0;
        if (deep && pool.temp > 60) steam = (pool.temp - 55) / 45 * (c._boil ? 2.2 : 1);
        else if (hotItems.length) steam = Math.max(...hotItems.map((i) => (i.temp - 60) / 60)) * 0.8;
        // boiling detector for visuals
        c._boil = deep && pool.temp >= 99.5 && this.world.heatFor(c) > 0 ? clamp(this.world.heatFor(c) / 2600, 0.2, 1) : 0;
        const smoky = c.items.some((i) => (i.kind === 'fat' && i.brownDown > 1.8) || (Math.max(i.brownDown, i.brownUp) > 2.3 && i.kind !== 'fat')) && c.temp > 150;
        const R = c.def.r * 0.6;
        if (Math.random() < Math.min(steam, 2.5) * dt * 7) {
          this.particles.push({ x: p.x + (Math.random() - 0.5) * R * 2, y: p.y + (Math.random() - 0.5) * R, vx: (Math.random() - 0.5) * 8, vy: -26 - Math.random() * 20, r: 6, gr: 14, life: 1.6, max: 1.6, col: '255,255,255', a: 0.16, soft: true });
        }
        if (smoky && Math.random() < dt * 10) {
          this.particles.push({ x: p.x + (Math.random() - 0.5) * R * 1.5, y: p.y + (Math.random() - 0.5) * R, vx: (Math.random() - 0.5) * 10, vy: -30 - Math.random() * 20, r: 8, gr: 18, life: 2.2, max: 2.2, col: '70,62,58', a: 0.3, soft: true });
        }
        // sizzle spatter
        const sizzle = this.sizzleLevel(c);
        if (sizzle > 0.2 && Math.random() < sizzle * dt * 30) {
          const a = Math.random() * 6.28;
          this.particles.push({ x: p.x + Math.cos(a) * R * 0.8, y: p.y + Math.sin(a) * R * 0.8, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30, r: 1.4, gr: 0, life: 0.25, max: 0.25, col: '255,236,170', a: 0.9 });
        }
      }
    }
    sizzleLevel(c) {
      if (c.loc.t !== 'burner' && c.temp < 120) return 0;
      const pool = c.pool();
      if (pool && pool.mass >= c.def.cover) return 0;
      const wet = c.items.some((i) => (i.kind === 'solid' || i.kind === 'set' || i.kind === 'fluid') && (CK.params(i).moist || i.kind === 'fluid'));
      const fat = c.fat();
      if (!wet && !fat) return 0;
      return clamp((c.temp - 110) / 90, 0, 1) * (wet ? 1 : 0.3);
    }
    updateAudio() {
      let sizzle = 0, boil = 0;
      for (const c of this.world.containers) { sizzle = Math.max(sizzle, this.sizzleLevel(c)); boil = Math.max(boil, c._boil || 0); }
      CK.Audio.setLoops({ sizzle, boil, tap: this.world.tap ? 1 : 0, flame: this.world.burners.some((b) => b > 0) ? 1 : 0 });
    }

    // ------------------------------------------------------------ hover info
    hoverInfo(x, y) {
      const w = this.world;
      const h = this.held;
      if (h) {
        if ((h.type === 'source' || h.type === 'container') && this.pour && this.pour.tgt) {
          const P = this.pour;
          const tname = P.tgt.sink ? 'the sink' : P.tgt.c.def.name;
          if (h.type === 'source') {
            const g = P.moved;
            return { title: `${h.src.label} → ${tname}`, lines: [P.active || g > 0 ? '+ ' + CK.measure(h.src.ing, g) : 'hold here to pour…'] };
          }
          return { title: `Pouring into ${tname}`, lines: [P.tgt.sink ? (P.moved > 0 ? `drained ${CK.fmtGrams(P.moved)} of liquid` : 'hold to drain the liquid') : P.moved > 0 ? `→ ${CK.fmtGrams(P.moved)}` : 'hold here to pour…'] };
        }
        if (h.type === 'source') return { title: h.src.label, lines: ['Hold over a pan, pot, bowl or plate to pour.'] };
        return null;
      }
      const k = this.knobAt(x, y);
      if (k >= 0) {
        const b = L.knobs[k].b;
        const names = ['Back-left', 'Back-right', 'Front-left', 'Front-right'];
        return { title: `${names[b]} burner: ${CK.BURNER_NAMES[w.burners[b]]}`, lines: ['Click the right side to turn up, left side to turn down (or scroll).'] };
      }
      if (dist(x, y, L.bell.x, L.bell.y) < 26) return { title: 'Service bell', lines: ['Ring it to serve the dish on the tray.'] };
      if (dist(x, y, L.tapHandle.x, L.tapHandle.y) < 22 || dist(x, y, L.faucet.x, L.faucet.y) < 18) return { title: 'Tap', lines: [w.tap ? 'Running — click to turn off.' : 'Click to turn on. Fills whatever is in the sink.'] };
      if (inRect(x, y, L.toaster)) {
        const items = w.toasterC.items.map((i) => CK.describeItem(i)).map((d) => `${CK.cap(d.name)}${d.bits.length ? ' — ' + d.bits.join(', ') : ''}`);
        return { title: `Toaster · setting ${w.toaster.level}${w.toaster.down ? ' · toasting…' : ''}`, lines: [...items, 'Lever: start / pop up. Dial: darkness (1–5).'] };
      }
      if (dist(x, y, L.timer.x, L.timer.y) < 30) return { title: 'Kitchen timer', lines: ['Click to start or stop.'] };
      if (dist(x, y, L.trash.x, L.trash.y) < L.trash.r) return { title: 'Compost bin', lines: ['Drop food here, or drop a container to empty it.'] };
      if (this.tool) {
        const t = TOOLS.find((t) => t.id === this.tool);
        const hint = t ? t.hint : 'click or hold food on the board to chop';
        const c = this.containerAt(x, y);
        const base = { title: (t ? t.label : 'Knife') + ' in hand', lines: [hint, 'Right-click or Esc to put it down.'] };
        if (c) return this.containerInfo(c, base.title);
        const bi = this.boardItemAt(x, y);
        if (bi) return this.itemInfo(bi, 'On the board');
        return base;
      }
      const li = this.looseItemAt(x, y);
      if (li) return this.itemInfo(li.it);
      const c = this.containerAt(x, y) || this.storedAt(x, y);
      if (c) return this.containerInfo(c);
      const t = this.toolAt(x, y);
      if (t) return { title: t.label, lines: ['Click to pick up: ' + t.hint + '.'] };
      if (this.knifeAt(x, y)) return { title: 'Knife', lines: ['Click to pick up, then click/hold food on the board to chop.'] };
      const s = this.sourceAt(x, y);
      if (s) return { title: s.label, lines: [s.unit ? 'Drag one out.' : 'Drag and hold over a container to pour.'] };
      if (inRect(x, y, L.fridge)) return { title: 'Fridge', lines: [this.fridgeOpen ? 'Click the door edge to close.' : 'Click to open.'] };
      if (inRect(x, y, L.board)) return { title: 'Cutting board', lines: ['Put food here, then use the knife to chop it.'] };
      if (inRect(x, y, L.pass)) return { title: 'Serving tray', lines: ['Put the finished plate here and ring the bell.'] };
      return null;
    }
    itemInfo(it, title) {
      const d = CK.describeItem(it);
      const lines = [`${CK.fmtGrams(d.mass)}${d.bits.length ? ' · ' + d.bits.join(', ') : ''}`];
      if (it.ing === 'egg' && it.form === 'whole') lines.push(it.cook > 0.45 ? 'Click to peel.' : 'Click it in a bowl or pan to crack it.');
      return { title: title ? `${title}: ${d.name}` : CK.cap(d.name), lines };
    }
    containerInfo(c, prefix) {
      const lines = [];
      const items = c.items.filter((i) => i.mass > 0.05).sort((a, b) => b.mass - a.mass);
      for (const it of items.slice(0, 7)) {
        const d = CK.describeItem(it);
        lines.push(`${CK.cap(d.name)} · ${CK.fmtGrams(d.mass)}${d.bits.length ? ' · ' + d.bits.join(', ') : ''}`);
      }
      if (!items.length) lines.push('Empty.');
      if (c.loc.t === 'shelf' || c.loc.t === 'rack') lines.push('Drag it to the counter or stove.');
      else if (c.def.stove || c.items.length) lines.push(Math.round(c.temp) + '°C');
      const where = c.loc.t === 'burner' ? ` (${CK.BURNER_NAMES[this.world.burners[c.loc.i]]})` : '';
      return { title: (prefix ? prefix + ' · ' : '') + CK.cap(c.def.name) + where, lines };
    }

    // ------------------------------------------------------------ rendering
    render() {
      const ctx = this.ctx;
      const cv = this.canvas;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // letterbox: extend the wall above and the floor below
      const split = this.offY + L.counter.y * this.scale;
      ctx.fillStyle = '#f1e1c6';
      ctx.fillRect(0, 0, cv.width, split);
      ctx.fillStyle = '#6e4c34';
      ctx.fillRect(0, split, cv.width, cv.height - split);
      ctx.fillStyle = '#5c3f2b';
      for (let x = (this.offX % 60) - 60; x < cv.width; x += 60 * this.scale + 1) ctx.fillRect(x, this.offY + H * this.scale, 2, cv.height);
      ctx.setTransform(this.scale, 0, 0, this.scale, this.offX, this.offY);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      CK.KitchenArt.background(ctx, this);
      // stored containers
      for (const c of this.world.containers) {
        if (c.loc.t === 'rack' || c.loc.t === 'shelf') {
          const p = this.posOf(c);
          if (c.loc.t === 'rack') { ctx.strokeStyle = '#6b5a4c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, L.rail); ctx.lineTo(p.x, p.y - c.def.r * p.s - (c.type === 'pot' ? 8 : 40)); ctx.stroke(); }
          D.container(ctx, c, p.x, p.y, p.s, { handleAngle: -Math.PI / 2 });
        }
      }
      CK.KitchenArt.utensils(ctx, this, TOOLS);
      CK.KitchenArt.counter(ctx, this);
      // loose items on board/counter/toaster
      const w = this.world;
      for (const it of w.board.items) { it._sx = it.ax; it._sy = it.ay; it._sr = D.item(ctx, it, it.ax, it.ay, 1); }
      CK.KitchenArt.knife(ctx, this);
      CK.KitchenArt.toasterItems(ctx, this);
      for (const it of w.counter.items) { it._sx = it.ax; it._sy = it.ay; it._sr = D.item(ctx, it, it.ax, it.ay, 1); }
      // containers out in the kitchen
      const out = this.placed().sort((a, b) => this.posOf(a).y - this.posOf(b).y);
      for (const c of out) {
        const p = this.posOf(c);
        if (c.loc.t === 'burner') CK.KitchenArt.flame(ctx, p.x, p.y, w.burners[c.loc.i], true, this.time);
        D.container(ctx, c, p.x, p.y, p.s);
      }
      CK.KitchenArt.fridge(ctx, this, SOURCES);
      // particles
      for (const p of this.particles) {
        const lf = clamp(p.life / p.max, 0, 1);
        const a = p.a * (p.soft ? Math.min(1, (1 - lf) * 5) * lf * 1.6 : lf);
        if (p.soft) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(${p.col},${a})`);
          g.addColorStop(1, `rgba(${p.col},0)`);
          ctx.fillStyle = g;
        } else ctx.fillStyle = `rgba(${p.col},${a})`;
        D.circle(ctx, p.x, p.y, p.r);
        ctx.fill();
      }
      this.renderHeld(ctx);
      this.renderOverlay(ctx);
      ctx.restore();
    }

    renderHeld(ctx) {
      const h = this.held;
      const mx = this.mouse.x, my = this.mouse.y;
      if (this.tool) CK.KitchenArt.toolCursor(ctx, this, this.tool, mx, my);
      if (!h) return;
      const P = this.pour;
      if (h.type === 'item') {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 8;
        D.item(ctx, h.it, mx, my - 6, 1);
        ctx.restore();
      } else if (h.type === 'container') {
        const p = this.posOf(h.c);
        const tilt = P && P.active ? 1 : 0;
        if (P && P.tgt && P.active) CK.KitchenArt.stream(ctx, p.x, p.y, P.tgt.sink ? { x: L.basin.x + L.basin.w / 2, y: L.basin.y + L.basin.h / 2 } : this.tgtPos(P.tgt), D.fluidColor(h.c.pool() || { comp: { water: 1 } }), this.time);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(tilt * 0.25);
        ctx.translate(-p.x, -p.y);
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 12;
        D.container(ctx, h.c, p.x, p.y - 8, 1);
        ctx.restore();
      } else if (h.type === 'source') {
        if (P && P.tgt && P.active) {
          const d = CK.ING[h.src.ing];
          const col = d.color;
          CK.KitchenArt.stream(ctx, mx, my + 10, this.tgtPos(P.tgt), col, this.time, d.phase === 'powder' || d.phase === 'solid' ? 'grains' : 'liquid');
        }
        CK.KitchenArt.sourceIcon(ctx, h.src, mx, my, P && P.active ? 1 : 0, this.time);
      }
    }
    tgtPos(t) {
      if (t.board) return { x: this.mouse.x, y: this.mouse.y + 40 };
      const p = this.posOf(t.c);
      return { x: p.x, y: p.y };
    }

    renderOverlay(ctx) {
      // tooltip
      const info = this.hoverInfo(this.mouse.x, this.mouse.y);
      if (info) CK.KitchenArt.tooltip(ctx, info, this.mouse.x, this.mouse.y);
      if (this.taste) CK.KitchenArt.bubble(ctx, this.taste.lines, this.taste.x, this.taste.y, this.taste.t);
      if (this.world.tap && this.world.at('sink')) {
        const t = '+ ' + Math.round(this.world.tapAdded || 0) + ' ml water';
        ctx.save();
        ctx.font = '800 16px Mali, "Trebuchet MS", system-ui, sans-serif';
        const tw = ctx.measureText(t).width + 20;
        ctx.fillStyle = 'rgba(40,90,130,0.85)';
        D.rr(ctx, L.faucet.x - tw / 2, L.basin.y + L.basin.h - 36, tw, 28, 14); ctx.fill();
        ctx.fillStyle = '#eaf6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, L.faucet.x, L.basin.y + L.basin.h - 22);
        ctx.restore();
      }
      // messages
      let y = 26;
      for (const m of this.messages) {
        ctx.save();
        ctx.globalAlpha = clamp(m.t / 0.4, 0, 1);
        ctx.font = '600 20px Mali, "Trebuchet MS", system-ui, sans-serif';
        const tw = ctx.measureText(m.text).width;
        ctx.fillStyle = 'rgba(52,38,30,0.88)';
        D.rr(ctx, W / 2 - tw / 2 - 18, y - 4, tw + 36, 36, 18); ctx.fill();
        ctx.fillStyle = '#fff6e6';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.text, W / 2, y + 14);
        ctx.restore();
        y += 44;
      }
    }
  }

  CK.Kitchen = Kitchen;
  CK.SOURCES = SOURCES;
  CK.TOOLS = TOOLS;
})();
