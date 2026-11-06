// Headless playthroughs: following each recipe as written should score well; classic mistakes
// should be noticed by the diner. Run with:  node tests/scenarios.test.js   (add -v for details)
const { load, makeKitchen } = require('./harness');
const CK = load();
const verbose = process.argv.includes('-v');

let failures = 0;
function report(name, res, expect) {
  const ok = expect(res);
  if (!ok) failures++;
  const comp = {};
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: score ${res.score} (${res.stars}★)`);
  if (verbose || !ok) {
    for (const l of res.lines) console.log(`        [${l.tone}] ${l.text}`);
    if (res.issues.length) console.log('        issues: ' + res.issues.map((i) => `${i.text} (-${i.pen.toFixed(1)})`).join(' | '));
  }
}
function ratios(c, keys) {
  const comp = {};
  for (const it of c.items) CK.addComp(comp, it.comp);
  const tot = Object.values(comp).reduce((a, b) => a + b, 0);
  return keys.map((k) => `${k}=${((comp[k] || 0) / tot).toFixed(4)}`).join(' ') + ` total=${tot.toFixed(0)}g`;
}
const R = CK.RECIPE;
const has = (res, re) => { re = new RegExp(re.source, 'i'); return res.lines.some((l) => re.test(l.text)) || res.issues.some((i) => re.test(i.text)); };

// Helper: wait while stirring periodically (every `every` kitchen-seconds, 0.3s real of stirring)
function cookStirring(k, c, minutes, every, tool) {
  const real = (minutes * 60) / CK.TIME_SCALE;
  const dt = 0.05;
  let since = 0;
  for (let t = 0; t < real - 1e-9; t += dt) {
    since += dt * CK.TIME_SCALE;
    if (since >= every) { since = 0; for (let j = 0; j < 6; j++) CK.stir(c, 0.05, tool || 'spoon'); }
    k.w.step(dt);
  }
}
function boil(k, c, maxMin) {
  let t = 0;
  while (c.temp < 99.5 && t < (maxMin || 30)) { k.wait(0.25); t += 0.25; }
}

// ---------------------------------------------------------------- 1. fried egg
function friedEgg(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, plate } = k.C;
  k.burner(pan, 0, opts.level || 2).add(pan, 'butter', opts.butter == null ? 5 : opts.butter).wait(1);
  k.unit(pan, 'egg').crackAll(pan).wait(opts.min || 3);
  if (opts.flip) k.flipAll(pan);
  k.add(pan, 'salt', opts.salt == null ? 0.4 : opts.salt).add(pan, 'pepper', 0.15);
  k.heat(0, 0);
  k.pourAll(pan, plate);
  if (opts.coolMin) k.wait(opts.coolMin);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper']));
  return CK.judge(R['fried-egg'], plate);
}
report('fried egg as written', friedEgg({ ratios: true }), (r) => r.score >= 88);
report('fried egg, high heat 3min', friedEgg({ level: 5 }), (r) => r.score < 75 && has(r, /burnt|crispy/));
report('fried egg, 1.5 min', friedEgg({ min: 1.5 }), (r) => r.score < 80 && has(r, /runny|raw/));
report('fried egg, 7 min', friedEgg({ min: 7 }), (r) => r.score < 80 && has(r, /yolk|burnt|crispy/));
report('fried egg, no salt', friedEgg({ salt: 0 }), (r) => r.score < 90 && has(r, /salt/));
report('fried egg, 6g salt', friedEgg({ salt: 6 }), (r) => r.score < 60 && has(r, /salty/));
report('fried egg, flipped', friedEgg({ flip: true }), (r) => has(r, /flipped/));
report('fried egg, left to go cold', friedEgg({ coolMin: 12 }), (r) => has(r, /cold|lukewarm/));
{
  const k = makeKitchen(CK); const { plate } = k.C;
  k.unit(plate, 'onion');
  report('raw onion instead of egg', CK.judge(R['fried-egg'], plate), (r) => r.score <= 10 && has(r, /expecting/));
  report('empty plate', CK.judge(R['fried-egg'], k.C.soupbowl), (r) => r.score === 0);
}

// ---------------------------------------------------------------- 2. egg & toast
function eggToast(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, plate } = k.C;
  k.water(saucepan, 1000).burner(saucepan, 1, 5);
  boil(k, saucepan);
  k.unit(saucepan, 'egg');
  const toastAt = 2;
  k.wait(toastAt);
  const bread = CK.makeUnit('bread');
  k.w.toasterC.add(bread);
  k.toast(opts.toast || 3);
  const tToast = k.w.time;
  k.move(k.w.toasterC, plate);
  k.add(plate, 'butter', 5);
  // remaining boil time
  k.wait(Math.max(0, (opts.min || 6) - toastAt - (k.w.time - tToast) / 60 - 0));
  k.move(saucepan, plate, (it) => it.kind === 'solid');
  k.add(plate, 'salt', 0.4);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt']));
  return CK.judge(R['egg-toast'], plate);
}
report('egg & toast as written', eggToast({ ratios: true }), (r) => r.score >= 88);
report('egg & toast, 12 min egg', eggToast({ min: 12 }), (r) => has(r, /hard|firm/));
report('egg & toast, toaster on 5 twice', (() => {
  const k = makeKitchen(CK); const { plate } = k.C;
  const b = CK.makeUnit('bread'); k.w.toasterC.add(b); k.toast(5); k.toast(5);
  k.move(k.w.toasterC, plate);
  return CK.judge(R['egg-toast'], plate);
})(), (r) => has(r, /burnt/));

// ---------------------------------------------------------------- 3. scrambled
function scrambled(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, bowl, plate } = k.C;
  k.unit(bowl, 'egg', 2).crackAll(bowl).add(bowl, 'milk', 15).add(bowl, 'salt', 0.4);
  if (!opts.noWhisk) k.stir(bowl, 2.5, 'whisk');
  k.burner(pan, 0, opts.level || 2).add(pan, 'butter', 10).wait(1).pourAll(bowl, pan);
  const steps = Math.round((opts.min || 2) * 60 / CK.TIME_SCALE / 1.5);
  for (let i = 0; i < steps; i++) { if (opts.noStir) k.wait(1.5 * CK.TIME_SCALE / 60); else k.stir(pan, 1.5, 'spatula'); }
  k.heat(0, 0);
  k.add(pan, 'pepper', 0.15);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper']));
  return CK.judge(R['scrambled'], plate);
}
report('scrambled as written', scrambled({ ratios: true }), (r) => r.score >= 88);
report('scrambled, not stirred', scrambled({ noStir: true }), (r) => has(r, /omelette/));
report('scrambled, 6 min', scrambled({ min: 6 }), (r) => r.score < 75);
report('scrambled, not whisked', scrambled({ noWhisk: true }), (r) => r.score >= 60);

// ---------------------------------------------------------------- 4. pancakes
function pancakes(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, bowl, plate } = k.C;
  k.add(bowl, 'flour', opts.flour || 100).add(bowl, 'bakingpowder', opts.bp == null ? 4 : opts.bp).add(bowl, 'sugar', 12).add(bowl, 'salt', 0.4);
  k.unit(bowl, 'egg').crackAll(bowl).add(bowl, 'milk', opts.milk || 150);
  k.stir(bowl, opts.whisk == null ? 3 : opts.whisk, 'whisk');
  if (verbose) k.show(bowl);
  k.burner(pan, 0, opts.level || 3).add(pan, 'butter', 5).wait(1.5);
  for (let n = 0; n < 2; n++) {
    // pour half
    const half = bowl.mass / (2 - n);
    let poured = 0;
    while (poured < half - 1) { const r = CK.pourStep(bowl, pan, 0.02); poured += r.moved; if (!r.moved) break; }
    k.wait(opts.side1 || 2);
    if (!opts.noFlip) k.flipAll(pan);
    k.wait(opts.side2 || 1.5);
    k.move(pan, plate, (it) => it.kind === 'set');
    if (n === 0) k.add(pan, 'butter', 5);
  }
  k.add(plate, 'syrup', 20);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'sugar']));
  return CK.judge(R['pancakes'], plate);
}
report('pancakes as written', pancakes({ ratios: true }), (r) => r.score >= 85);
report('pancakes, not flipped', pancakes({ noFlip: true }), (r) => has(r, /pale|side/));
report('pancakes, no baking powder', pancakes({ bp: 0 }), (r) => has(r, /baking powder/));
report('pancakes, lumpy', pancakes({ whisk: 0.2 }), (r) => has(r, /lump/));
report('pancakes, 300 ml milk', pancakes({ milk: 320 }), (r) => has(r, /crêpe|thin/));

// ---------------------------------------------------------------- 5. aglio e olio
function aglio(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pot, pan, plate } = k.C;
  k.water(pot, 1500).burner(pot, 0, 5);
  boil(k, pot);
  k.add(pot, 'salt', opts.salt == null ? 18 : opts.salt).add(pot, 'spaghetti', 100);
  // garlic
  k.unit('board', 'garlic', 3).chopBoard(opts.garlicChops || 3).boardTo(pan);
  k.unit('board', 'parsley').chopBoard(2);
  const pastaMin = opts.pastaMin || 8;
  k.wait(pastaMin - 2.5);
  k.burner(pan, 1, opts.garlicLevel || 2).add(pan, 'oil', 40);
  cookStirring(k, pan, opts.garlicMin || 1.5, 10);
  k.add(pan, 'chili', 0.3).heat(1, 0);
  k.wait(1);
  if (!opts.noDrain) k.drain(pot);
  k.pourAll(pot, pan);
  k.heat(1, 1);
  cookStirring(k, pan, 1, 5);
  k.heat(1, 0);
  k.boardTo(pan);
  k.stir(pan, 0.5);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'chili']));
  return CK.judge(R['aglio'], plate);
}
report('aglio e olio as written', aglio({ ratios: true }), (r) => r.score >= 85);
report('aglio, garlic on high 4 min', aglio({ garlicLevel: 5, garlicMin: 4 }), (r) => has(r, /burnt|bitter|brown/));
report('aglio, pasta 4 min', aglio({ pastaMin: 4 }), (r) => has(r, /crunchy|firm/));
report('aglio, pasta 16 min', aglio({ pastaMin: 16 }), (r) => has(r, /mushy|soft/));
report('aglio, unsalted water', aglio({ salt: 0 }), (r) => has(r, /salt|bland/));
report('aglio, not drained', aglio({ noDrain: true }), (r) => has(r, /water|drain/));

// ---------------------------------------------------------------- 6. tomato soup
function soup(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, soupbowl } = k.C;
  k.unit('board', 'onion').chopBoard(opts.onionChops ?? 10);
  k.burner(saucepan, 0, 3).add(saucepan, 'oil', 27).wait(1);
  k.boardTo(saucepan);
  cookStirring(k, saucepan, opts.onionMin || 5, 40);
  k.unit('board', 'garlic', 2).chopBoard(10).boardTo(saucepan);
  cookStirring(k, saucepan, 1, 20);
  k.add(saucepan, 'cannedtom', 400).water(saucepan, opts.water == null ? 250 : opts.water).add(saucepan, 'salt', opts.salt == null ? 6 : opts.salt).add(saucepan, 'sugar', 4);
  boil(k, saucepan);
  k.heat(0, opts.simmerLevel || 2);
  cookStirring(k, saucepan, opts.simmer == null ? 10 : opts.simmer, 90);
  k.heat(0, 0);
  k.add(saucepan, 'pepper', 0.15);
  k.pourAll(saucepan, opts.into === 'plate' ? k.C.plate : soupbowl);
  const out = opts.into === 'plate' ? k.C.plate : soupbowl;
  if (verbose) k.show(out);
  if (opts.ratios) console.log('   ratios', ratios(out, ['salt', 'sugar', 'pepper']));
  return CK.judge(R['soup'], out);
}
report('tomato soup as written', soup({ ratios: true }), (r) => r.score >= 85);
report('soup, onion not chopped', soup({ onionChops: 0 }), (r) => has(r, /whole onion/));
report('soup, no simmer', soup({ simmer: 0 }), (r) => has(r, /raw|tinny|can/));
report('soup, simmered 40 min', soup({ simmer: 40, simmerLevel: 3 }), (r) => has(r, /thick|sauce|burnt|scorch/));
report('soup, on a plate', soup({ into: 'plate' }), (r) => has(r, /plate/));

// ---------------------------------------------------------------- 7. home fries
function fries(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, plate } = k.C;
  k.unit('board', 'potato').chopBoard(opts.chops == null ? 7 : opts.chops);
  k.burner(pan, 0, opts.level || 3).add(pan, 'oil', 27).wait(1.5).boardTo(pan);
  if (opts.noStir) k.wait(opts.min || 13);
  else cookStirring(k, pan, opts.min || 13, 120);
  k.heat(0, 0).add(pan, 'salt', 1.5).add(pan, 'pepper', 0.15);
  k.unit('board', 'parsley').chopBoard(2).boardTo(pan);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper']));
  return CK.judge(R['home-fries'], plate);
}
report('home fries as written', fries({ ratios: true }), (r) => r.score >= 85);
report('home fries, never stirred', fries({ noStir: true }), (r) => has(r, /side|burnt|stirr/));
report('home fries, 5 min', fries({ min: 5 }), (r) => has(r, /hard|raw/));
report('home fries, whole potato', fries({ chops: 0 }), (r) => has(r, /whole potato/));

// ---------------------------------------------------------------- 8. chicken
function chicken(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, plate } = k.C;
  const ch = CK.makeUnit('chicken');
  k.w.board.add(ch);
  CK.addIngredient(k.w.board, 'salt', 1.5); CK.addIngredient(k.w.board, 'pepper', 0.15);
  k.burner(pan, 0, opts.level || 3).add(pan, 'oil', 14).wait(1.5).boardTo(pan);
  k.wait(opts.side1 || 6);
  if (!opts.noFlip) k.flipAll(pan);
  k.add(pan, 'butter', 14).wait(opts.side2 || 5.5).heat(0, 0).wait(1);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper']));
  return CK.judge(R['chicken'], plate);
}
report('chicken as written', chicken({ ratios: true }), (r) => r.score >= 85);
report('chicken, 3+3 min', chicken({ side1: 3, side2: 3 }), (r) => r.score < 40 && has(r, /raw|pink|safe/));
report('chicken, never flipped', chicken({ noFlip: true }), (r) => has(r, /side|pale|burnt|dark/));
report('chicken, high heat', chicken({ level: 5 }), (r) => has(r, /burnt|dark|dry/));

console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nAll scenarios passed.');
process.exit(failures ? 1 : 0);
