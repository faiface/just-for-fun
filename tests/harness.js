// Loads the game's classic scripts into a Node VM context so the simulation and judge can be
// exercised headlessly.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load() {
  const ctx = { console, Math, JSON, Object, Array, Number, String, Set, Map };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['util.js', 'ingredients.js', 'sim.js', 'recipes.js', 'judge.js']) {
    const p = path.join(__dirname, '..', 'js', f);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  return ctx.CK;
}

// A tiny scripted "player" that drives the world the same way the UI does.
function makeKitchen(CK) {
  const w = new CK.World();
  const C = {};
  for (const t of ['pan', 'saucepan', 'pot', 'bowl', 'bowl2', 'plate', 'soupbowl']) {
    C[t] = new CK.Container(t === 'bowl2' ? 'bowl' : t, { loc: { t: 'counter' } });
    w.containers.push(C[t]);
  }
  const k = {
    w, C, CK,
    log: [],
    place(c, t, i) { c.loc = { t, i }; return k; },
    burner(c, i, level) { c.loc = { t: 'burner', i }; w.burners[i] = level; return k; },
    heat(i, level) { w.burners[i] = level; return k; },
    add(c, ing, g) { CK.addIngredient(c, ing, g); return k; },
    unit(c, ing, n) {
      for (let j = 0; j < (n || 1); j++) {
        const it = CK.makeUnit(ing);
        (c === 'board' ? w.board : c).add(it);
      }
      return k;
    },
    water(c, g) { CK.addWater(c, g); return k; },
    crackAll(c) { for (const it of c.items.slice()) if (it.ing === 'egg' && it.form === 'whole') CK.crack(c, it); return k; },
    chopBoard(times) { for (const it of w.board.items) for (let j = 0; j < times; j++) CK.chop(it); return k; },
    boardTo(c) { for (const it of w.board.items.slice()) { w.board.remove(it); c.add(it); } return k; },
    move(from, to, filter) {
      for (const it of from.items.slice()) if (!filter || filter(it)) { from.remove(it); to.add(it); }
      return k;
    },
    pourAll(from, to) { let n = 0; while (from.items.length && n++ < 5000) { const r = CK.pourStep(from, to, 0.05); if (r.full || r.blocked) break; } return k; },
    drain(c) { let n = 0; while (c.pool() && n++ < 5000) CK.pourStep(c, null, 0.05); return k; },
    stir(c, realSec, tool) { const n = Math.ceil(realSec / 0.05); for (let j = 0; j < n; j++) { CK.stir(c, 0.05, tool || 'spoon'); w.step(0.05); } return k; },
    // wait kitchen minutes; optionally stir every `stirEvery` kitchen seconds for 0.3s real
    wait(min, stirEvery, tool) {
      const total = (min * 60) / CK.TIME_SCALE; // real seconds
      const dt = 0.05;
      let t = 0, since = 0;
      while (t < total - 1e-9) {
        if (stirEvery) {
          since += dt * CK.TIME_SCALE;
          if (since >= stirEvery) { since = 0; for (let j = 0; j < 6; j++) CK.stir(c0(), 0.05, tool || 'spoon'); }
        }
        w.step(dt);
        t += dt;
      }
      return k;
      function c0() { return k._stirTarget; }
    },
    stirTarget(c) { k._stirTarget = c; return k; },
    flipAll(c) { for (const it of c.items) if (CK.isFlippable(it)) CK.flip(c, it); return k; },
    toast(level) { w.toaster.level = level; w.toaster.down = true; let n = 0; while (w.toaster.down && n++ < 100000) w.step(0.05); return k; },
    show(c, label) {
      const lines = c.items.map((it) => {
        const d = CK.describeItem(it);
        return `   ${d.name} ${it.mass.toFixed(1)}g cook=${it.cook.toFixed(2)} bD=${it.brownDown.toFixed(2)} bU=${it.brownUp.toFixed(2)} T=${it.temp.toFixed(0)} [${d.bits.join(', ')}]`;
      });
      console.log(`${label || c.def.name} @${c.temp.toFixed(0)}°C t=${(w.time / 60).toFixed(1)}min\n${lines.join('\n')}`);
      return k;
    },
  };
  return k;
}

module.exports = { load, makeKitchen };
