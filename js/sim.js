// The kitchen simulation: items, containers, heat, cooking, and the universal actions
// (pour, crack, chop, stir, whisk, flip, drain). Purely logical — no drawing here.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { clamp, sum } = CK;
  const ROOM = CK.ROOM;

  CK.BURNER_W = [0, 1030, 1380, 1780, 2180, 2630];
  CK.BURNER_NAMES = ['Off', 'Low', 'Medium-low', 'Medium', 'Medium-high', 'High'];
  CK.TOASTER_TEMP = 245;

  CK.CONTAINERS = {
    pan: { name: 'frying pan', shape: 'pan', r: 88, heatCap: 650, loss: 10, cover: 220, stove: true, cap: 1500 },
    saucepan: { name: 'saucepan', shape: 'pot', r: 74, heatCap: 520, loss: 9, cover: 110, stove: true, cap: 1800 },
    pot: { name: 'stock pot', shape: 'pot', r: 98, heatCap: 900, loss: 12, cover: 280, stove: true, cap: 5000 },
    bowl: { name: 'mixing bowl', shape: 'bowl', r: 66, heatCap: 500, loss: 8, cover: 90, stove: false, cap: 1500 },
    plate: { name: 'plate', shape: 'plate', r: 80, heatCap: 400, loss: 8, cover: 99999, stove: false, cap: 1000, serve: true },
    soupbowl: { name: 'soup bowl', shape: 'soupbowl', r: 64, heatCap: 350, loss: 6, cover: 80, stove: false, cap: 900, serve: true },
    board: { name: 'cutting board', shape: 'board', heatCap: 400, loss: 8, cover: 99999, cap: 3000, solidsOnly: true },
    counter: { name: 'counter', shape: 'counter', heatCap: 1000, loss: 10, cover: 99999, cap: 99999, solidsOnly: true },
    toaster: { name: 'toaster', shape: 'toaster', heatCap: 400, loss: 6, cover: 99999, cap: 120, solidsOnly: true },
  };

  // ------------------------------------------------------------------ Item
  class Item {
    constructor(o) {
      this.id = CK.uid();
      this.kind = 'solid'; // solid | fluid | powder | fat | set
      this.ing = null; // main ingredient (solids)
      this.comp = {}; // grams per ingredient key (includes coatings, absorbed water...)
      this.form = 'whole';
      this.pieces = 1;
      this.chops = 0;
      this.temp = ROOM;
      this.cook = 0;
      this.brownDown = 0;
      this.brownUp = 0;
      this.smooth = 1; // fluids: 1 = smooth, 0 = lumpy/streaky
      this.stirSet = 0; // real seconds stirred while setting
      this.stirAcc = 0;
      this.flips = 0;
      this.method = null; // fried | boiled | poached | toasted | deep-fried | simmered
      this.cls = null; // mixture class once set
      this.hyd = 0; // absorbed liquid (pasta, rice)
      this.px = (Math.random() - 0.5) * 0.7;
      this.py = (Math.random() - 0.5) * 0.7;
      this.rot = Math.random() * Math.PI * 2;
      this.seed = Math.random();
      if (o) Object.assign(this, o);
    }
    get mass() {
      let m = 0;
      for (const k in this.comp) m += this.comp[k];
      return m;
    }
    get main() {
      // dominant ingredient key
      let best = null, bm = -1;
      for (const k in this.comp) if (this.comp[k] > bm) { bm = this.comp[k]; best = k; }
      return this.ing || best;
    }
  }
  CK.Item = Item;

  function addComp(a, b, f) {
    f = f == null ? 1 : f;
    for (const k in b) a[k] = (a[k] || 0) + b[k] * f;
  }
  function scaleComp(a, f) {
    for (const k in a) a[k] *= f;
  }
  CK.addComp = addComp;

  function mergeInto(a, b) {
    const ma = a.mass, mb = b.mass, m = ma + mb;
    if (m <= 0) return;
    const w = (x, y) => (x * ma + y * mb) / m;
    a.temp = w(a.temp, b.temp);
    a.cook = w(a.cook, b.cook);
    a.brownDown = w(a.brownDown, b.brownDown);
    a.brownUp = w(a.brownUp, b.brownUp);
    a.smooth = w(a.smooth, b.smooth);
    a.hyd += b.hyd;
    a.pieces += b.pieces;
    a.chops = Math.max(a.chops, b.chops);
    addComp(a.comp, b.comp);
    if (!a.method) a.method = b.method;
  }

  function splitItem(it, frac) {
    const n = new Item();
    const id = n.id;
    Object.assign(n, it);
    n.id = id;
    n.comp = {};
    addComp(n.comp, it.comp, frac);
    scaleComp(it.comp, 1 - frac);
    n.pieces = it.pieces * frac;
    it.pieces *= 1 - frac;
    n.hyd = it.hyd * frac;
    it.hyd *= 1 - frac;
    n.px = (Math.random() - 0.5) * 0.6;
    n.py = (Math.random() - 0.5) * 0.6;
    return n;
  }
  CK.splitItem = splitItem;

  // physical parameters for an item
  function params(it) {
    if (it.kind === 'fluid' || it.kind === 'set') {
      const cls = it.kind === 'set' ? it.cls : CK.classify(it.comp);
      const m = CK.MIX[cls] || CK.MIX.mixture;
      const scr = it.form === 'scrambled';
      return {
        onset: m.onset, time: m.time * (scr ? 0.75 : 1), tau: m.tau * (scr ? 0.6 : 1), brownTime: m.brownTime, moist: m.moist,
        spec: m.spec, f: 0.8, bulk: scr, settable: !!m.settable && it.kind === 'fluid', setAt: m.setAt, cls,
      };
    }
    if (it.kind === 'fat') return { spec: 2.1, brownTime: 45 };
    if (it.kind === 'powder') {
      const d = CK.ING[it.main] || {};
      return { spec: 1.2, brownTime: d.brownTime || null };
    }
    const d = CK.ING[it.ing];
    const form = CK.formOf(it.ing, it.form) || { size: 1, f: 0.6, bulk: false };
    return {
      onset: d.cook ? d.cook.onset : 999,
      time: d.cook ? d.cook.time * form.size : null,
      tau: d.cook ? d.cook.tau * form.size : 40 * form.size,
      brownTime: d.brownTime,
      moist: d.moist || it.hyd > 2,
      spec: d.spec,
      soaks: d.soaks,
      f: form.f,
      bulk: form.bulk,
      size: form.size,
      absorb: d.absorb,
    };
  }
  CK.params = params;

  CK.isBulk = function (it) {
    if (it.kind === 'fluid' || it.kind === 'fat' || it.kind === 'powder') return true;
    return !!params(it).bulk;
  };
  CK.isFlippable = function (it) {
    if (it.kind === 'set') return it.form !== 'scrambled';
    if (it.kind !== 'solid') return false;
    const d = CK.ING[it.ing];
    return !!d.flippable && !CK.isBulk(it);
  };

  function aqueous(it) {
    let a = 0;
    for (const k in it.comp) a += (CK.AQUEOUS[k] || 0) * it.comp[k];
    return a;
  }
  CK.aqueous = aqueous;

  // Browning speed at a surface temperature. brownTime = seconds to reach "golden" (1.0) at 200°C.
  function brownRate(T, bt) {
    if (!bt || T <= 115) return 0;
    return Math.pow((T - 115) / 85, 1.3) / bt;
  }
  CK.brownRate = brownRate;

  const COATS = { salt: 1, pepper: 1, chili: 1, sugar: 1, parmesan: 1, cheddar: 1, cinnamon: 1 };

  // ------------------------------------------------------------------ Container
  class Container {
    constructor(type, o) {
      this.id = CK.uid();
      this.type = type;
      this.def = CK.CONTAINERS[type];
      this.items = [];
      this.temp = ROOM;
      this.loc = { t: 'rack' };
      this.x = 0;
      this.y = 0;
      if (o) Object.assign(this, o);
    }
    get name() { return this.def.name; }
    pool() { return this.items.find((i) => i.kind === 'fluid'); }
    fat() { return this.items.find((i) => i.kind === 'fat'); }
    powder() { return this.items.find((i) => i.kind === 'powder'); }
    solids() { return this.items.filter((i) => i.kind === 'solid' || i.kind === 'set'); }
    get mass() { return sum(this.items, (i) => i.mass); }
    get empty() { return this.items.length === 0; }
    remove(it) {
      const i = this.items.indexOf(it);
      if (i >= 0) this.items.splice(i, 1);
    }
    clear() { this.items = []; }

    // Add an item, merging with what's already there where that's physically sensible.
    // Returns false if this container can't hold it.
    add(it) {
      if (it.mass <= 1e-4) return true;
      const k = it.kind;
      if (this.def.solidsOnly && (k === 'fluid' || k === 'fat')) return false;
      if (k === 'fat' || k === 'powder') {
        // well mixed with the vessel: blend temperatures
        const ms = it.mass * (params(it).spec || 2);
        this.temp = (this.def.heatCap * this.temp + ms * it.temp) / (this.def.heatCap + ms);
      }
      if (k === 'fluid') {
        const p = this.pool();
        if (p) mergeInto(p, it);
        else this.items.push(it);
        const pool = this.pool();
        const pw = this.powder();
        if (pw) this._dissolve(pool, pw);
        if (pool.mass >= this.def.cover && aqueous(pool) > 0.5) {
          const ms = pool.mass * (params(pool).spec || 3.8);
          const prevDeep = p && p !== it && p.mass - it.mass >= this.def.cover;
          // if the pool was already deep it shared the vessel temperature
          const Tp = prevDeep ? (this.temp * (p.mass - it.mass) + it.temp * it.mass) / p.mass : pool.temp;
          this.temp = (this.def.heatCap * this.temp + ms * Tp) / (this.def.heatCap + ms);
          pool.temp = this.temp;
        }
        return true;
      }
      if (k === 'powder') {
        const p = this.pool();
        if (p) { this._dissolve(p, it, true); return true; }
        const solids = this.solids();
        const main = it.main;
        if (solids.length && COATS[main] && !this.powder()) {
          // sprinkle onto the food
          const tm = sum(solids, (s) => s.mass) || 1;
          for (const s of solids) addComp(s.comp, it.comp, s.mass / tm);
          return true;
        }
        const pw = this.powder();
        if (pw) mergeInto(pw, it);
        else this.items.push(it);
        return true;
      }
      if (k === 'fat') {
        const f = this.fat();
        if (f) mergeInto(f, it);
        else this.items.push(it);
        return true;
      }
      // solids
      if (CK.isBulk(it)) {
        const same = this.items.find(
          (o) => o !== it && o.kind === it.kind && o.ing === it.ing && o.form === it.form && o.cls === it.cls &&
            Math.abs(o.cook - it.cook) < 0.35 && Math.abs(o.brownDown + o.brownUp - it.brownDown - it.brownUp) < 0.8
        );
        if (same) { mergeInto(same, it); return true; }
      }
      this.items.push(it);
      return true;
    }
    _dissolve(pool, pw, isNew) {
      // a powder joins a liquid; flour makes lumps
      const lumpy = (pw.comp.flour || 0) + (pw.comp.parmesan || 0) * 0.5;
      const m = pool.mass + pw.mass;
      mergeInto(pool, pw);
      if (lumpy > 0) pool.smooth = clamp(pool.smooth - (2.6 * lumpy) / m, 0, 1);
      if (!isNew) this.remove(pw);
    }
  }
  CK.Container = Container;

  // ------------------------------------------------------------------ factories
  CK.makeUnit = function (ingId) {
    const d = CK.ING[ingId];
    const form = d.forms ? d.forms[0].id : 'whole';
    return new Item({
      kind: 'solid', ing: ingId, comp: { [ingId]: d.unitMass }, form,
      temp: d.storage === 'fridge' ? 5 : ROOM,
    });
  };
  CK.makePoured = function (ingId, g) {
    const d = CK.ING[ingId];
    const temp = ingId === 'water' ? 15 : d.storage === 'fridge' ? 5 : ROOM;
    const comp = {};
    if (d.comp) for (const k in d.comp) comp[k] = d.comp[k] * g;
    else comp[ingId] = g;
    if (d.phase === 'liquid') return new Item({ kind: 'fluid', comp, temp, form: 'fluid' });
    if (d.phase === 'fat') return new Item({ kind: 'fat', comp, temp, form: 'fat' });
    if (d.phase === 'powder') return new Item({ kind: 'powder', comp, temp, form: 'powder' });
    // poured solids (spaghetti, rice)
    return new Item({ kind: 'solid', ing: ingId, comp, temp, form: d.forms[0].id, pieces: 1 });
  };
  CK.addIngredient = function (c, ingId, g) {
    return c.add(CK.makePoured(ingId, g));
  };
  CK.addWater = function (c, g) {
    return c.add(new Item({ kind: 'fluid', comp: { water: g }, temp: 15, form: 'fluid' }));
  };

  // ------------------------------------------------------------------ physics
  function evaporate(c, pool, g) {
    if (g <= 0) return;
    let w = pool.comp.water || 0;
    const t = Math.min(w, g);
    pool.comp.water = w - t;
    g -= t;
    if (g > 0 && pool.comp.milk) pool.comp.milk = Math.max(0, pool.comp.milk - g * 1.1);
    if (pool.comp.water <= 1e-6) delete pool.comp.water;
    if (pool.comp.milk !== undefined && pool.comp.milk <= 1e-6) delete pool.comp.milk;
    if (aqueous(pool) < 0.5) {
      // dried out: only seasonings left? -> crust of powder
      const real = pool.mass - (pool.comp.salt || 0) - (pool.comp.sugar || 0) - (pool.comp.pepper || 0) -
        (pool.comp.bakingpowder || 0) - (pool.comp.chili || 0);
      if (real < 1) {
        pool.kind = 'powder';
        pool.form = 'powder';
        delete pool.comp.water;
        delete pool.comp.milk;
        const pw = c.items.find((i) => i.kind === 'powder' && i !== pool);
        if (pw) { mergeInto(pw, pool); c.remove(pool); }
      }
    }
  }

  // advance one container by dt kitchen-seconds with heatW watts from below
  CK.stepContainer = function (c, dt, heatW, toasting) {
    const items = c.items;
    if (toasting) {
      for (const it of items) {
        const P = params(it);
        it.temp = CK.approach(it.temp, 100, dt, 25);
        const r = brownRate(CK.TOASTER_TEMP, P.brownTime) * dt;
        it.brownDown += r;
        it.brownUp += r;
        it.method = 'toasted';
      }
      c.temp = CK.approach(c.temp, CK.TOASTER_TEMP, dt, 20);
      return;
    }
    if (!items.length && heatW === 0 && Math.abs(c.temp - ROOM) < 0.5) return;
    const pool = c.pool();
    const fat = c.fat();
    const solids = items.filter((i) => i.kind === 'solid' || i.kind === 'set');
    const solidMass = sum(solids, (s) => s.mass);
    const aq = pool ? aqueous(pool) : 0;
    const deep = !!pool && aq > 0.5 && pool.mass >= c.def.cover;
    const subm = deep && pool.mass >= solidMass * 0.7;
    const fatDeep = !!fat && fat.mass >= c.def.cover * 0.6 && fat.mass >= solidMass * 0.6;
    const hasFat = !!fat && fat.mass >= 1.5;

    // heat balance: vessel + whatever is well mixed with it (deep liquid, fat, powders)
    let H = c.def.heatCap;
    for (const it of items) {
      if (it.kind === 'fat' || it.kind === 'powder' || (it.kind === 'fluid' && deep)) H += it.mass * (params(it).spec || 3);
    }
    let W = heatW - (c.temp - ROOM) * c.def.loss;
    let thinEvapW = 0;
    if (c.temp > 100) {
      for (const s of solids) {
        if (subm || fatDeep) break;
        const P = params(s);
        if (P.moist) W -= (c.temp - 100) * 0.022 * s.mass * (1 + (1 - (P.size || 0.6)));
      }
      if (pool && !deep && aq > 0.5) {
        const P = params(pool);
        if (P.settable) W -= (c.temp - 100) * 0.03 * pool.mass;
        else { thinEvapW = (c.temp - 100) * 0.6 * aq; W -= thinEvapW; }
      }
    }
    c.temp += (W / H) * dt;
    if (deep && c.temp > 100) {
      const ex = (c.temp - 100) * H;
      c.temp = 100;
      evaporate(c, pool, ex / 2260);
    }
    if (thinEvapW > 0 && pool) evaporate(c, pool, Math.min((thinEvapW * dt) / 2260, aqueous(pool)));
    if (c.temp < -20) c.temp = -20;

    const hot = c.temp > 115;
    for (const it of items.slice()) {
      if (!items.includes(it)) continue;
      const P = params(it);
      if (it.kind === 'fat') {
        it.temp = c.temp;
        const b = it.comp.butter || 0, o = it.comp.oil || 0, m = b + o || 1;
        let r = 0;
        if (it.temp > 135) r += (b / m) * Math.pow((it.temp - 135) / 60, 1.3) / 45;
        if (it.temp > 205) r += (o / m) * Math.pow((it.temp - 205) / 40, 1.3) / 40;
        if (deep) r = 0;
        it.brownDown += r * dt;
        it.brownUp = it.brownDown;
        continue;
      }
      if (it.kind === 'powder') {
        it.temp = c.temp;
        if (!deep) { it.brownDown += brownRate(c.temp, P.brownTime) * dt; it.brownUp = it.brownDown * 0.5; }
        continue;
      }
      if (it.kind === 'fluid') {
        if (deep) it.temp = c.temp;
        else {
          const cap = aqueous(it) > 0.5 ? 100 : 999;
          const old = it.temp;
          it.temp = CK.approach(it.temp, Math.min(cap, ROOM + (c.temp - ROOM) * 0.85), dt, P.tau);
          c.temp -= (it.mass * P.spec * (it.temp - old)) / H;
        }
        if (!deep || aq <= 0.5) it.brownDown += brownRate(c.temp, P.brownTime) * dt * (hasFat ? 1 : 1.3);
        cookStep(it, P, dt, 1);
        if (deep && heatW > 0 && P.cls === 'tomato' && it.temp > 95) it.method = 'simmered';
        if (P.settable && it.cook >= P.setAt) {
          it.kind = 'set';
          it.cls = P.cls;
          it.form = it.stirSet >= 0.8 ? 'scrambled' : 'set';
          it.smooth = Math.max(it.smooth, 0.3);
          if (!deep) it.method = 'fried';
          it.px = 0; it.py = 0;
        }
        continue;
      }
      // solids
      let target, tau;
      if (subm) {
        target = Math.min(c.temp, 100);
        tau = P.tau;
        if (c.temp > 85) it.method = it.ing === 'egg' && it.form === 'cracked' ? 'poached' : 'boiled';
      } else if (fatDeep) {
        target = P.moist ? Math.min(c.temp, 100) : c.temp;
        tau = P.tau * 0.8;
        const r = brownRate(c.temp, P.brownTime) * dt;
        it.brownDown += r;
        it.brownUp += r;
        if (c.temp > 140) it.method = 'deep-fried';
      } else {
        target = ROOM + (c.temp - ROOM) * (P.f || 0.6);
        if (P.moist) target = Math.min(target, 100);
        tau = target > it.temp ? P.tau * 1.4 : Math.max(P.tau * 1.4, 350);
        if (hot) {
          const r = brownRate(c.temp, P.brownTime) * dt * (hasFat ? 1 : 1.3);
          it.brownDown += r;
          it.brownUp += r * 0.04;
          if (c.temp > 130 && it.method !== 'toasted') it.method = 'fried';
        }
      }
      const oldT = it.temp;
      const cooling = target < it.temp - 0.5;
      it.temp = CK.approach(it.temp, target, dt, tau);
      c.temp -= (it.mass * (P.spec || 3) * (it.temp - oldT)) / H;
      // absorbers (pasta, rice)
      let factor = 1;
      if (P.absorb) {
        const dry = it.comp[it.ing] || 0;
        const maxH = dry * P.absorb;
        if (pool && aq > 0.5 && it.temp > 55) {
          const want = maxH * clamp(it.cook / 1.15, 0, 1.35) - it.hyd;
          if (want > 0) {
            const take = Math.min(want, pool.mass * 0.5);
            const fr = take / pool.mass;
            for (const k in pool.comp) {
              const g = pool.comp[k] * fr;
              pool.comp[k] -= g;
              it.comp[k] = (it.comp[k] || 0) + g;
            }
            it.hyd += take;
          }
        } else {
          factor = it.hyd / Math.max(1, maxH) > 0.55 ? 1 : 0.03;
        }
      }
      // bread & co. soak up whatever liquid they sit in, hot or cold
      if (P.soaks && pool && pool !== it && pool.mass > 0.5) {
        const base = it.comp[it.ing] || 0;
        const want = base * P.soaks - it.hyd;
        if (want > 0) {
          const take = Math.min(want, 3 * dt, pool.mass);
          const fr = take / pool.mass;
          for (const k in pool.comp) {
            const g = pool.comp[k] * fr;
            pool.comp[k] -= g;
            it.comp[k] = (it.comp[k] || 0) + g;
          }
          it.hyd += take;
          if (pool.mass < 0.05) c.remove(pool);
        }
      }
      // food that is cooling down (e.g. resting on a plate) only carries over a little
      cookStep(it, P, dt, factor * (cooling && !subm ? 0.3 : 1));
    }
    // anything soaked/absorbed/evaporated down to nothing disappears
    for (let i = items.length - 1; i >= 0; i--) if (items[i].mass < 0.01) items.splice(i, 1);
  };

  function cookStep(it, P, dt, factor) {
    if (!P.time) return;
    const r = Math.max(0, it.temp - P.onset) / (100 - P.onset) / P.time;
    it.cook += r * dt * factor;
  }

  // ------------------------------------------------------------------ World
  class World {
    constructor() {
      this.time = 0; // kitchen seconds
      this.speed = 1;
      this.burners = [0, 0, 0, 0];
      this.tap = false;
      this.toaster = { down: false, level: 3, timer: 0 };
      this.containers = [];
      this.board = new Container('board', { loc: { t: 'board' } });
      this.counter = new Container('counter', { loc: { t: 'counter' } });
      this.toasterC = new Container('toaster', { loc: { t: 'toaster' } });
      this.events = [];
      this.timer = { running: false, start: 0, acc: 0 };
    }
    all() { return [...this.containers, this.board, this.counter, this.toasterC]; }
    heatFor(c) {
      if (c.loc.t === 'burner') return CK.BURNER_W[this.burners[c.loc.i]] || 0;
      return 0;
    }
    at(t, i) { return this.containers.find((c) => c.loc.t === t && (i == null || c.loc.i === i)); }
    toasterTime() { return 18 + this.toaster.level * 14; }
    step(rdt) {
      if (this.tap) {
        const c = this.at('sink');
        if (c && c.def.stove !== undefined) {
          const room = c.def.cap - c.mass;
          if (room > 0) { const g = Math.min(room, 230 * rdt); CK.addWater(c, g); this.tapAdded = (this.tapAdded || 0) + g; }
          else this.emit('overflow');
        }
      }
      let left = rdt * CK.TIME_SCALE * this.speed;
      this.time += left;
      while (left > 1e-6) {
        const d = Math.min(0.5, left);
        left -= d;
        for (const c of this.containers) CK.stepContainer(c, d, this.heatFor(c), false);
        CK.stepContainer(this.board, d, 0, false);
        CK.stepContainer(this.counter, d, 0, false);
        const T = this.toaster;
        CK.stepContainer(this.toasterC, d, 0, T.down);
        if (T.down) {
          T.timer += d;
          if (T.timer >= this.toasterTime()) { T.down = false; T.timer = 0; this.emit('pop'); }
        }
      }
    }
    emit(e) { this.events.push(e); }
  }
  CK.World = World;

  // ------------------------------------------------------------------ actions
  CK.crack = function (c, it) {
    if (it.ing !== 'egg') return null;
    if (it.form !== 'whole') return null;
    if (it.cook >= 0.45) {
      it.form = 'peeled';
      return 'You peel the egg.';
    }
    if (!c || c.def.solidsOnly) return 'Crack it into a bowl or a pan, not onto the ' + (c ? c.def.name : 'counter') + '.';
    c.remove(it);
    const n = new Item({
      kind: 'solid', ing: 'egg', comp: { ...it.comp }, form: 'cracked', temp: it.temp, cook: it.cook,
      px: it.px, py: it.py,
    });
    c.add(n);
    return null;
  };

  CK.chop = function (it) {
    if (it.kind === 'set') {
      it.chops++;
      if (it.chops >= 2 && it.form !== 'scrambled') it.form = 'scrambled';
      return null;
    }
    if (it.kind !== 'solid') return "You can't chop that.";
    const d = CK.ING[it.ing];
    if (it.ing === 'egg' && it.form === 'whole') return it.cook > 0.45 ? 'Peel the egg first (click it).' : 'Crack raw eggs into a bowl or pan instead.';
    if (it.ing === 'egg' && it.form === 'cracked') return "It's a raw egg — it just runs everywhere.";
    if (!d.forms) return "You can't chop that.";
    const chain = d.forms.filter((f) => f.at != null);
    const last = chain[chain.length - 1];
    if (it.chops >= last.at) return `The ${d.short} is already ${last.label}.`;
    it.chops++;
    let next = null;
    for (const f of chain) if (f.at <= it.chops && (f.at > 0 || it.form === f.id)) next = f;
    if (next && next.id !== it.form) {
      it.form = next.id;
      it.px *= 0.5; it.py *= 0.5;
    }
    return null;
  };

  CK.flip = function (c, it) {
    if (it.kind === 'fluid') return "It's still runny — wait until it sets.";
    if (it.ing === 'egg' && it.form === 'cracked' && it.cook < 0.3) {
      if (c.def.solidsOnly) return "It's a raw egg — it's too runny to flip.";
      breakEgg(c, it);
      return 'Oops — the egg was too runny to flip and the yolk broke.';
    }
    if (!CK.isFlippable(it)) {
      // turning small things = stirring them
      CK.stir(c, 0.4, 'spatula');
      return null;
    }
    const t = it.brownDown;
    it.brownDown = it.brownUp;
    it.brownUp = t;
    it.flips++;
    return null;
  };

  function breakEgg(c, it) {
    c.remove(it);
    const f = new Item({ kind: 'fluid', comp: { ...it.comp }, temp: it.temp, cook: it.cook, form: 'fluid', smooth: 0.35, brownDown: it.brownDown });
    c.add(f);
  }

  function gatherMixables(c) {
    const out = c.items.filter((i) => i.kind === 'fluid' || i.kind === 'powder' || (i.kind === 'solid' && i.ing === 'egg' && i.form === 'cracked' && i.cook < 0.45));
    return out;
  }

  // Stir / whisk for rdt real seconds
  CK.stir = function (c, rdt, tool) {
    const whisk = tool === 'whisk';
    const strength = whisk ? 1.6 : 1;
    const heated = c.temp > 45 || c.items.some((i) => i.temp > 50);
    // powders into the liquid
    const pool0 = c.pool(), pw = c.powder();
    if (pool0 && pw) c._dissolve(pool0, pw);
    for (const it of c.items.slice()) {
      if (it.kind === 'solid' && it.ing === 'egg' && it.form === 'cracked' && it.cook < 0.45) {
        it.stirAcc += rdt * strength;
        if (it.stirAcc > 0.6) breakEgg(c, it);
      }
    }
    if (whisk) {
      const mix = gatherMixables(c);
      if (mix.length > 1 || (mix.length === 1 && mix[0].kind !== 'fluid' && mix[0].kind !== 'powder')) {
        const eggs = mix.filter((m) => m.kind === 'solid');
        for (const e of eggs) breakEgg(c, e);
        const pool = c.pool();
        const pw2 = c.powder();
        if (pool && pw2) c._dissolve(pool, pw2);
      }
    }
    for (const it of c.items) {
      if (it.kind === 'fluid') {
        if (heated && it.cook > 0.02) it.stirSet += rdt;
        it.smooth = clamp(it.smooth + rdt * (whisk ? 0.6 : 0.16), 0, 1);
      } else if (it.kind === 'set' && it.form !== 'scrambled') {
        it.stirAcc += rdt * strength;
        if (it.stirAcc > 1.5) { it.form = 'scrambled'; it.stirAcc = 0; }
      } else if (it.kind === 'solid' && it.form !== 'mashed' && CK.formOf(it.ing, 'mashed')) {
        // soft potatoes (or a banana) get mashed when you keep stirring them
        const d = CK.ING[it.ing];
        if (it.cook >= 0.9 || d.mash === 'raw') {
          it.mashAcc = (it.mashAcc || 0) + rdt * strength;
          if (it.mashAcc > 1.6) { it.form = 'mashed'; it.chops = Math.max(it.chops, CK.formOf(it.ing, 'mashed').at); }
        }
      }
      if (CK.isBulk(it) && (it.kind === 'solid' || it.kind === 'set')) {
        const k = 1 - Math.exp(-rdt * 2.5);
        const avg = (it.brownDown + it.brownUp) / 2;
        it.brownDown += (avg - it.brownDown) * k;
        it.brownUp += (avg - it.brownUp) * k;
      }
    }
    // a mash takes up the butter and milk it's stirred with
    const mash = c.items.find((i) => i.kind === 'solid' && i.form === 'mashed');
    if (mash) {
      for (const o of c.items.slice()) {
        if (o === mash || !(o.kind === 'fat' || o.kind === 'fluid' || o.kind === 'powder')) continue;
        const g = Math.min(o.mass, rdt * (whisk ? 120 : 70));
        const fr = g / o.mass;
        for (const k in o.comp) { const x = o.comp[k] * fr; o.comp[k] -= x; mash.comp[k] = (mash.comp[k] || 0) + x; }
        mash.hyd += g;
        if (o.mass < 0.05) c.remove(o);
      }
    }
    // merge bulk duplicates that have converged
    for (const it of c.items.slice()) {
      if (!c.items.includes(it) || !CK.isBulk(it) || it.kind !== 'solid') continue;
      const same = c.items.find((o) => o !== it && o.kind === 'solid' && o.ing === it.ing && o.form === it.form && Math.abs(o.cook - it.cook) < 0.35);
      if (same) { mergeInto(same, it); c.remove(it); }
    }
  };

  // Move contents from one container to another for rdt real seconds of pouring.
  // to === null means pouring down the sink (only liquids leave; solids stay behind).
  // Returns grams moved; result.full if target is full.
  CK.pourStep = function (from, to, rdt, opts) {
    opts = opts || {};
    const drainOnly = !to || opts.drainOnly;
    const total = from.mass;
    if (total <= 0.01) return { moved: 0, done: true };
    const rate = Math.max(90, total * 0.55);
    let budget = rate * rdt;
    if (to && !drainOnly) {
      const room = to.def.cap - to.mass;
      if (room <= 0.5) return { moved: 0, full: true };
      budget = Math.min(budget, room);
    }
    const accepts = (it) => !to || !to.def.solidsOnly ||
      (it.kind !== 'fluid' && it.kind !== 'fat' && !(it.ing === 'egg' && it.form === 'cracked' && it.cook < 0.45));
    const flowing = from.items.filter((it) =>
      drainOnly ? it.kind === 'fluid' || (it.kind === 'fat' && from.pool()) : CK.isBulk(it) && accepts(it));
    const flowMass = sum(flowing, (i) => i.mass);
    let moved = 0;
    if (flowMass > 0.01) {
      const frac = Math.min(1, budget / flowMass);
      for (const it of flowing) {
        let part;
        if (frac >= 0.999 || it.mass * frac < 0.05 || it.mass < 0.3) { part = it; from.remove(it); }
        else part = splitItem(it, frac);
        moved += part.mass;
        if (to && !drainOnly) to.add(part);
      }
      return { moved, done: false };
    }
    if (drainOnly) return { moved: 0, done: true };
    // discrete pieces slide out one at a time
    from._slide = (from._slide || 0) + rdt;
    const pieces = from.items.filter((it) => accepts(it));
    if (!pieces.length) return { moved: 0, done: true, blocked: from.items.length > 0 };
    if (from._slide > 0.22) {
      from._slide = 0;
      const it = pieces[0];
      if (to.mass + it.mass > to.def.cap) return { moved: 0, full: true };
      from.remove(it);
      it.px = (Math.random() - 0.5) * 0.5;
      it.py = (Math.random() - 0.5) * 0.5;
      to.add(it);
      moved = it.mass;
    }
    return { moved, done: false };
  };

  // ------------------------------------------------------------------ naming & description
  function f2(comp, k, m) { return (comp[k] || 0) / (m || 1); }

  CK.saltiness = function (comp, excludeFat) {
    let m = 0;
    for (const k in comp) if (!(excludeFat && (k === 'oil' || k === 'butter'))) m += comp[k];
    return (comp.salt || 0) / (m || 1);
  };

  CK.itemName = function (it) {
    const m = it.mass;
    const c = it.comp;
    if (it.kind === 'fat') {
      const b = c.butter || 0, o = c.oil || 0;
      const base = b > 0 && o > 0 ? 'butter and oil' : b > 0 ? 'butter' : 'olive oil';
      if (it.brownDown > 2.2) return 'burnt ' + base;
      if (b > o && it.brownDown > 0.7) return 'brown butter';
      if (b > 0 && o === 0 && it.temp > 32) return 'melted butter';
      if (o > 0 && it.temp > 200) return 'smoking hot ' + base;
      return base;
    }
    if (it.kind === 'powder') {
      const keys = Object.keys(c).filter((k) => c[k] > 0.05).sort((a, b) => c[b] - c[a]);
      if (keys.length === 1) {
        const n = (CK.ING[keys[0]] || {}).name || keys[0];
        return it.brownDown > 2 ? 'scorched ' + n : n;
      }
      if (keys.includes('flour')) return 'dry mix (' + keys.map((k) => CK.ING[k] ? CK.ING[k].short : k).join(', ') + ')';
      return keys.map((k) => CK.ING[k] ? CK.ING[k].short : k).join(' and ');
    }
    if (it.kind === 'fluid') {
      const cls = CK.classify(c);
      if (cls === 'water') {
        const s = CK.saltiness(c);
        if (s > 0.004) return 'salted water';
        if (f2(c, 'sugar', m) > 0.03) return 'sugar water';
        return 'water';
      }
      if (cls === 'eggs') return f2(c, 'milk', m) > 0.05 ? 'eggs whisked with milk' : (it.smooth < 0.5 ? 'broken eggs' : 'beaten eggs');
      if (cls === 'batter') return it.smooth < 0.55 ? 'lumpy pancake batter' : 'pancake batter';
      if (cls === 'tomato') {
        const t = (c.tomato || 0) / ((c.tomato || 0) + (c.water || 0) + 1e-6);
        if (t < 0.12) return 'thin tomato broth';
        if (t < 0.36) return 'tomato soup';
        if (t < 0.6) return 'tomato sauce';
        return 'tomato paste';
      }
      if (cls === 'milk') return it.temp > 60 ? 'hot milk' : 'milk';
      if (cls === 'syrup') return (c.honey || 0) > (c.syrup || 0) ? 'honey' : 'maple syrup';
      if (cls === 'soy') return 'soy sauce';
      if (cls === 'dough') return 'floury paste';
      const keys = Object.keys(c).filter((k) => c[k] > 0.5).sort((a, b) => c[b] - c[a]).slice(0, 2);
      return 'mixture of ' + keys.map((k) => CK.ING[k] ? CK.ING[k].short : k).join(' and ');
    }
    if (it.kind === 'set') {
      const scr = it.form === 'scrambled';
      if (it.cls === 'batter') return scr ? 'broken-up pancake' : 'pancake';
      if (it.cls === 'eggs') return scr ? 'scrambled eggs' : 'omelette';
      if (it.cls === 'dough') return 'dumpling';
      return scr ? 'crumbly cooked mixture' : 'set mixture';
    }
    // solids
    const d = CK.ING[it.ing];
    if (it.ing === 'egg') {
      if (it.form === 'whole') {
        if (it.cook < 0.15) return 'egg';
        if (it.method === 'boiled') return it.cook < 0.6 ? 'soft-boiled egg' : it.cook < 1.2 ? 'jammy boiled egg' : 'hard-boiled egg';
        return 'egg cooked in its shell';
      }
      if (it.form === 'cracked') {
        if (it.cook < 0.25) return 'raw egg';
        if (it.method === 'poached' || it.method === 'boiled') return 'poached egg';
        return it.flips % 2 === 1 || it.flips > 0 ? 'fried egg (flipped)' : 'fried egg';
      }
      if (it.form === 'peeled') return 'peeled boiled egg';
      return it.form + ' boiled egg';
    }
    if (it.ing === 'bread') {
      const b = (it.brownDown + it.brownUp) / 2;
      if (it.hyd > 8 && it.form !== 'cubes') {
        const eggy = (c.egg || 0) / m > 0.12;
        if (!eggy) return 'soggy bread';
        return it.cook < 0.35 && b < 0.4 ? 'egg-soaked bread' : 'French toast';
      }
      const base = b >= 0.5 ? 'toast' : 'bread';
      if (it.form === 'slice') return b >= 0.5 ? 'slice of toast' : 'slice of bread';
      if (it.form === 'cubes') return b >= 0.5 ? 'croutons' : 'bread cubes';
      return 'half slice of ' + base;
    }
    if (it.ing === 'spaghetti' || it.ing === 'rice') {
      const n = d.name;
      if (it.cook < 0.25 && it.hyd < 1) return 'dry ' + n;
      return (it.form === 'broken' ? 'broken ' : '') + 'cooked ' + n;
    }
    const form = CK.formOf(it.ing, it.form);
    const isFirst = d.forms && d.forms[0].id === it.form;
    if (isFirst) {
      if (it.form === 'bunch') return 'bunch of ' + d.name;
      return d.name;
    }
    return (form ? form.label : it.form) + ' ' + d.short;
  };

  // doneness words (main), and browning words
  CK.donenessWord = function (it) {
    if (it.kind === 'fat' || it.kind === 'powder') return '';
    if (it.kind === 'fluid') {
      const cls = CK.classify(it.comp);
      if (cls === 'tomato') return it.cook < 0.4 ? 'tastes raw' : it.cook < 0.9 ? 'lightly simmered' : 'well simmered';
      return '';
    }
    if (it.kind === 'set') {
      if (it.cls === 'eggs') {
        if (it.cook < 0.55) return 'wet and runny';
        if (it.cook < 1.35) return 'soft and creamy';
        if (it.cook < 1.9) return 'firm';
        return 'dry and rubbery';
      }
      if (it.cls === 'batter') {
        if (it.cook < 0.75) return 'raw in the middle';
        if (it.cook < 2.4) return 'cooked through';
        return 'dry';
      }
      return it.cook < 0.7 ? 'underdone' : 'cooked';
    }
    const d = CK.ING[it.ing];
    if (it.ing === 'bread') {
      if (it.hyd <= 8 || (it.comp.egg || 0) / it.mass < 0.12) return '';
      if (it.cook < 0.5) return 'raw egg inside';
      if (it.cook < 1.8) return 'set and custardy';
      return 'dried out';
    }
    if (it.ing === 'egg') {
      if (it.form === 'cracked') {
        if (it.cook < 0.25) return 'raw';
        if (it.cook < 0.55) return 'white still runny';
        if (it.cook < 0.75) return 'white almost set';
        if (it.cook < 1.45) return 'yolk runny';
        if (it.cook < 1.9) return 'yolk jammy';
        return 'yolk hard';
      }
      if (it.cook < 0.15) return 'raw';
      if (it.cook < 0.6) return 'runny inside';
      if (it.cook < 1.2) return 'jammy yolk';
      if (it.cook < 1.7) return 'hard yolk';
      return 'overcooked, rubbery';
    }
    if (!d.stages) return '';
    for (const [t, w] of d.stages) if (it.cook < t) return w;
    return '';
  };

  CK.brownDesc = function (it) {
    if (it.kind === 'fat' || it.kind === 'fluid' && it.brownDown < 0.3) return '';
    const toast = it.ing === 'bread';
    const avg = (it.brownDown + it.brownUp) / 2;
    if (CK.isFlippable(it) && Math.abs(it.brownDown - it.brownUp) > 0.4) {
      const dn = CK.brownWord(it.brownDown) || 'pale';
      const up = CK.brownWord(it.brownUp) || 'pale';
      return `${dn} underneath, ${up} on top`;
    }
    const mx = Math.max(it.brownDown, it.brownUp);
    if (mx > 2.4 && avg < 1.6) return 'burnt on one side';
    return CK.brownWord(avg, toast);
  };

  // Text lines for the inspector
  CK.describeItem = function (it) {
    const name = CK.itemName(it);
    const bits = [];
    const dn = CK.donenessWord(it);
    if (dn) bits.push(dn);
    const bd = CK.brownDesc(it);
    if (bd && bd !== 'untoasted') bits.push(bd);
    if (it.kind === 'fluid' && it.smooth < 0.55 && CK.classify(it.comp) === 'batter') bits.push('needs whisking');
    return { name, mass: it.mass, bits };
  };

  // Short natural phrase, e.g. "a burnt fried egg", "raw diced onion"
  CK.phrase = function (it) {
    const name = CK.itemName(it);
    let adj = '';
    const mx = Math.max(it.brownDown, it.brownUp);
    if (mx > 2.6 && !/burnt/.test(name)) adj = 'burnt ';
    else if (it.kind === 'solid' && it.cook < 0.2 && CK.ING[it.ing].cook && !/raw|dry/.test(name) && it.ing !== 'parsley') adj = 'raw ';
    const countable = it.kind === 'solid' && !CK.isBulk(it);
    const full = adj + name;
    if (countable) return /s$/.test(name) && !/ss$/.test(name) ? full : CK.aOrAn(full);
    if (it.kind === 'set' && !/scrambled|broken|crumbly/.test(name)) return CK.aOrAn(full);
    return (it.kind === 'powder' || it.kind === 'fat' || it.mass < 15 ? 'some ' : '') + full;
  };

  // "a slice of bread" x2 -> "2 slices of bread", "a raw tomato" x2 -> "2 raw tomatoes"
  function pluralize(p) {
    p = p.replace(/^an? /, '');
    const plw = (w) => (/(o)$/.test(w) && !/oo$/.test(w) ? w + 'es' : /(s|sh|ch|x)$/.test(w) ? w + 'es' : w + 's');
    let m = p.match(/^(.*?)(\w+)( of .*)$/);
    if (m) return m[1] + plw(m[2]) + m[3];
    m = p.match(/^(.*?)(\w+)( \(.*\))$/);
    if (m) return m[1] + plw(m[2]) + m[3];
    m = p.match(/^(.*?)(\w+)$/);
    return m ? m[1] + plw(m[2]) : p;
  }
  CK.describeContents = function (items) {
    const parts = [];
    const sorted = items.slice().sort((a, b) => b.mass - a.mass);
    const counts = {};
    for (const it of sorted) {
      if (it.mass < 0.3) continue;
      const p = CK.phrase(it);
      counts[p] = (counts[p] || 0) + 1;
    }
    for (const p in counts) {
      if (counts[p] > 1) parts.push(counts[p] + ' ' + pluralize(p));
      else parts.push(p);
    }
    return parts.length ? CK.listJoin(parts.slice(0, 5)) : 'almost nothing';
  };

  // Tasting spoon feedback
  CK.taste = function (c) {
    const items = c.items.filter((i) => i.mass > 0.3);
    if (!items.length) return ['Nothing to taste here.'];
    const comp = {};
    for (const it of items) addComp(comp, it.comp);
    const out = [];
    const T = Math.max(...items.map((i) => i.temp));
    if (T > 75) out.push('Hot! *blows on the spoon*');
    const salinity = CK.saltiness(comp, true);
    const raw = items.filter((i) => i.kind === 'solid' && CK.ING[i.ing].cook && i.cook < 0.2);
    const onlyWater = items.length === 1 && items[0].kind === 'fluid' && CK.classify(items[0].comp) === 'water';
    if (onlyWater) {
      if (salinity < 0.002) out.push('Just plain water.');
      else if (salinity < 0.006) out.push('Lightly salted water.');
      else if (salinity < 0.016) out.push('Salty like the sea — good for pasta.');
      else out.push('Extremely salty water!');
    } else {
      if (salinity < 0.0025) out.push('Bland — no salt to speak of.');
      else if (salinity < 0.0055) out.push('Lightly seasoned.');
      else if (salinity < 0.013) out.push('Nicely seasoned.');
      else if (salinity < 0.022) out.push('Quite salty.');
      else out.push('Way too salty!');
    }
    const tot = sum(Object.values(comp));
    const sweet = ((comp.sugar || 0) + ((comp.syrup || 0) + (comp.honey || 0)) * 0.7 + (comp.banana || 0) * 0.12) / tot;
    if (sweet > 0.06) out.push('Very sweet.');
    else if (sweet > 0.02) out.push('Sweet.');
    if ((comp.chili || 0) / tot > 0.002) out.push('A spicy kick.');
    if ((comp.pepper || 0) / tot > 0.004) out.push('Very peppery.');
    for (const it of items) {
      if (it.kind === 'solid' && (it.ing === 'spaghetti' || it.ing === 'rice' || it.ing === 'potato' || it.ing === 'chicken')) {
        out.push(CK.cap(CK.itemName(it)) + ': ' + CK.donenessWord(it) + '.');
      }
      if (it.kind === 'fat' && it.brownDown > 2.2) out.push('Acrid, burnt fat.');
      if (Math.max(it.brownDown, it.brownUp) > 2.6 && it.kind !== 'fat') out.push('Bitter burnt bits!');
    }
    if (raw.length && !onlyWater && raw.some((r) => r.ing !== 'parsley' && r.ing !== 'tomato')) out.push('Some of it is still raw.');
    return out.slice(0, 4);
  };
})();
