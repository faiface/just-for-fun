// Random-action fuzzing of the simulation: thousands of random adds/pours/chops/stirs/heat changes.
// Checks that nothing throws, no NaN/negative masses appear, and the judge always returns a sane result.
const { load } = require('./harness');
const CK = load();

const ings = Object.keys(CK.ING).filter((k) => k !== 'water');
const units = ings.filter((k) => CK.ING[k].source === 'unit');
const pours = ings.filter((k) => CK.ING[k].source === 'pour');
let seed = Number(process.argv[2]) || 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

let problems = 0;
function check(w, where) {
  for (const c of w.all()) {
    if (!Number.isFinite(c.temp)) { problems++; console.log('bad container temp', where, c.type, c.temp); }
    for (const it of c.items) {
      const bad = !Number.isFinite(it.mass) || it.mass < -1e-6 || !Number.isFinite(it.temp) || !Number.isFinite(it.cook) ||
        !Number.isFinite(it.brownDown) || !Number.isFinite(it.brownUp) || Object.values(it.comp).some((v) => !Number.isFinite(v) || v < -1e-6);
      if (bad) { problems++; console.log('bad item', where, c.type, JSON.stringify(it)); }
      CK.itemName(it); CK.describeItem(it); CK.phrase(it);
    }
  }
}

for (let run = 0; run < 40; run++) {
  const w = new CK.World();
  const cs = ['pan', 'saucepan', 'pot', 'bowl', 'plate', 'soupbowl'].map((t) => { const c = new CK.Container(t, { loc: { t: 'counter' } }); w.containers.push(c); return c; });
  const targets = () => [...cs, w.board, w.counter];
  for (let step = 0; step < 400; step++) {
    const r = rnd();
    const c = pick(cs);
    try {
      if (r < 0.15) { const t = pick(targets()); if (t.mass < t.def.cap) t.add(CK.makeUnit(pick(units))); }
      else if (r < 0.32) { const t = pick(targets()); CK.addIngredient(t, pick(pours), rnd() * 60); }
      else if (r < 0.38) { if (c.mass < c.def.cap) CK.addWater(c, rnd() * 800); }
      else if (r < 0.46) { const it = pick(w.board.items.concat(c.items)); if (it) CK.chop(it); }
      else if (r < 0.54) CK.stir(c, rnd() * 2, pick(['spoon', 'whisk', 'spatula']));
      else if (r < 0.58) { const it = pick(c.items); if (it) CK.flip(c, it); }
      else if (r < 0.62) { const it = pick(c.items); if (it) CK.crack(c, it); }
      else if (r < 0.7) { const to = pick(targets()); if (to !== c) for (let i = 0; i < 20; i++) CK.pourStep(c, to, 0.05); }
      else if (r < 0.73) { for (let i = 0; i < 30; i++) CK.pourStep(c, null, 0.05); }
      else if (r < 0.8) { const i = Math.floor(rnd() * 4); c.loc = c.def.stove ? { t: 'burner', i } : { t: 'counter' }; w.burners[i] = Math.floor(rnd() * 6); }
      else if (r < 0.83) { w.toasterC.items.length < 2 && w.toasterC.add(CK.makeUnit('bread')); w.toaster.down = true; }
      else if (r < 0.845) c.clear();
      else if (r < 0.87) {
        // ladle: scoop a dollop / bowlful and drop it somewhere else (or back)
        const res = CK.ladle(c);
        if (res.items) { const to = pick(cs); if (to.mass + res.items.reduce((a, i) => a + i.mass, 0) <= to.def.cap) for (const it of res.items) { it.px = rnd() - 0.5; it.py = rnd() - 0.5; to.add(it); } else CK.unladle(c, res.items); }
        else if (!res.msg) { problems++; console.log('ladle returned nothing', run, step); }
      }
      else if (r < 0.88) {
        // a settable batter to ladle from: curd dough, potato batter or pancake batter
        const kind = pick(['curd', 'potato', 'batter']);
        if (kind === 'curd') { CK.addIngredient(c, 'tvorog', 120); c.add(CK.makeUnit('egg')); }
        else if (kind === 'potato') { const p = CK.makeUnit('potato'); for (let i = 0; i < 18; i++) CK.chop(p); c.add(p); c.add(CK.makeUnit('egg')); CK.addIngredient(c, 'flour', 15); }
        else { CK.addIngredient(c, 'flour', 60); CK.addIngredient(c, 'milk', 120); }
        for (const it of c.items.slice()) if (it.ing === 'egg') CK.crack(c, it);
        CK.stir(c, 2, 'whisk');
      }
      else w.step(rnd() * 3);
      check(w, `run ${run} step ${step}`);
      if (step % 50 === 0) {
        for (const rec of CK.RECIPES) {
          const res = CK.judge(rec, c);
          if (!Number.isFinite(res.score) || !res.lines.length || res.lines.some((l) => !l.text || /undefined|NaN/.test(l.text))) { problems++; console.log('bad judge', rec.id, JSON.stringify(res.lines)); }
        }
        const f = CK.freeJudge(c, 'mila');
        if (!Number.isFinite(f.score) || f.lines.some((l) => /undefined|NaN/.test(l.text))) { problems++; console.log('bad free judge', JSON.stringify(f.lines)); }
        const t = CK.taste(c);
        for (const cu of CK.CUISINES) if (!CK.stockFor(cu.id).every((s) => CK.ING[s.ing])) { problems++; console.log('unknown stock in', cu.id); }
        if (t.some((s) => /undefined|NaN/.test(s))) { problems++; console.log('bad taste', t); }
      }
    } catch (e) {
      problems++;
      console.log(`EXCEPTION run ${run} step ${step}:`, e.stack);
      break;
    }
    if (problems > 10) break;
  }
  if (problems > 10) break;
}
console.log(problems ? `${problems} problem(s)` : 'Fuzz OK');
process.exit(problems ? 1 : 0);
