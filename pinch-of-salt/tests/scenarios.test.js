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

// ---------------------------------------------------------------- shared helpers for 9–16
// chop one fresh unit on the board `chops` times and return it (still on the board)
function chopUnit(k, ing, chops) {
  const it = CK.makeUnit(ing);
  k.w.board.add(it);
  for (let j = 0; j < chops; j++) CK.chop(it);
  return it;
}
function boardMove(k, it, to) { k.w.board.remove(it); to.add(it); }
function toastSlices(k, n, level) {
  for (let j = 0; j < n; j++) k.w.toasterC.add(CK.makeUnit('bread'));
  k.toast(level || 3);
}
// something completely different (a raw onion with a peeled boiled egg, or with a banana)
function wrongDish(recipeId, vessel, withBanana) {
  const k = makeKitchen(CK); const c = k.C[vessel || 'plate'];
  k.unit(c, 'onion');
  if (withBanana) k.unit(c, 'banana');
  else { const egg = CK.makeUnit('egg'); egg.cook = 1.3; egg.method = 'boiled'; egg.form = 'peeled'; c.add(egg); }
  const res = CK.judge(R[recipeId], c);
  if (verbose) console.log('   ' + res.lines.map((l) => l.text).join(' / '));
  return res;
}

// ---------------------------------------------------------------- 9. fry-up
function fryUp(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, plate } = k.C;
  const tom = chopUnit(k, 'tomato', opts.tomChops == null ? 1 : opts.tomChops);
  k.burner(pan, 0, opts.level || 3).add(pan, 'oil', 5).wait(1);
  k.unit(pan, 'bacon', 2).wait(opts.bacon1 || 3);
  if (!opts.noFlip) k.flipAll(pan);
  if (!opts.noTomato) boardMove(k, tom, pan);
  k.wait(1);
  k.heat(0, opts.eggLevel || 2).add(pan, 'butter', 5);
  if (!opts.noEgg) k.unit(pan, 'egg').crackAll(pan);
  // the toast goes on while the egg fries (the toaster runs ~1.0 min at setting 3)
  k.wait(1.5);
  if (!opts.noToast) toastSlices(k, 1, opts.toast || 3);
  k.wait(Math.max(0, (opts.eggMin || 3) - 1.5 - 1.0));
  k.heat(0, 0);
  k.move(pan, plate, (it) => it.kind === 'solid' || it.kind === 'set');
  k.move(k.w.toasterC, plate);
  k.add(plate, 'salt', opts.salt == null ? 0.4 : opts.salt).add(plate, 'pepper', 0.15);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper']));
  return CK.judge(R['fry-up'], plate);
}
report('fry-up as written', fryUp({ ratios: true }), (r) => r.score >= 85);
report('fry-up, bacon 1 min', fryUp({ bacon1: 0.5 }), (r) => r.score < 90 && has(r, /bacon.*(chewy|raw|pale)/));
report('fry-up, everything on high', fryUp({ level: 5, eggLevel: 5, eggMin: 5 }), (r) => r.score < 70 && has(r, /burnt|dark|crisp|hard/));
report('fry-up, forgot the egg', fryUp({ noEgg: true }), (r) => r.score < 75 && has(r, /egg/));
report('fry-up, bacon never turned', fryUp({ noFlip: true }), (r) => has(r, /one side/));
report('fry-up, something else entirely', wrongDish('fry-up'), (r) => r.score <= 15 && has(r, /expecting full breakfast/));

// ---------------------------------------------------------------- 10. omelette
function omelette(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, bowl, plate } = k.C;
  k.unit(bowl, 'egg', 3).crackAll(bowl).add(bowl, 'salt', opts.salt == null ? 0.4 : opts.salt);
  k.stir(bowl, 2.5, 'whisk');
  if (opts.cheeseInBowl) k.add(bowl, 'cheddar', 25).stir(bowl, 1, 'whisk');
  k.burner(pan, 0, opts.level || 2).add(pan, 'butter', 10).wait(1).pourAll(bowl, pan);
  const set1 = opts.min1 || 2;
  if (opts.stir) { const n = Math.round(set1 * 60 / CK.TIME_SCALE / 1.5); for (let i = 0; i < n; i++) k.stir(pan, 1.5, 'spatula'); }
  else k.wait(set1);
  if (!opts.cheeseInBowl && !opts.noCheese) k.add(pan, 'cheddar', 25);
  k.wait(opts.min2 || 1.5);
  k.heat(0, 0);
  k.pourAll(pan, plate);
  if (!opts.noChives) { const ch = chopUnit(k, 'chives', 2); boardMove(k, ch, plate); }
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'cheddar']));
  return CK.judge(R['omelette'], plate);
}
report('omelette as written', omelette({ ratios: true }), (r) => r.score >= 85);
report('omelette, stirred', omelette({ stir: true }), (r) => r.score < 75 && has(r, /scrambled/));
report('omelette, pulled after 1 min', omelette({ min1: 0.5, min2: 0.5 }), (r) => has(r, /raw|runny|wet/));
report('omelette, high heat 6 min', omelette({ level: 5, min1: 3, min2: 3 }), (r) => has(r, /burnt|brown|rubbery|dry/));
report('omelette, no cheese', omelette({ noCheese: true }), (r) => has(r, /cheese/));
report('omelette, something else entirely', wrongDish('omelette', 'plate', true), (r) => r.score <= 15 && has(r, /expecting cheese/));

// ---------------------------------------------------------------- 11. French toast
function frenchToast(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, bowl, plate } = k.C;
  if (!opts.noSoak) {
    k.unit(bowl, 'egg').crackAll(bowl).add(bowl, 'milk', 50).add(bowl, 'cinnamon', opts.cinnamon == null ? 0.6 : opts.cinnamon).add(bowl, 'sugar', 4);
    k.stir(bowl, 2.5, 'whisk');
  }
  k.unit(bowl, 'bread', 2).wait(opts.soak || 0.5);
  k.burner(pan, 0, opts.level || 3).add(pan, 'butter', 10).wait(1);
  k.move(bowl, pan, (it) => it.kind === 'solid');
  k.wait(opts.side1 || 3);
  if (!opts.noFlip) k.flipAll(pan);
  k.wait(opts.side2 || 3);
  k.heat(0, 0);
  k.move(pan, plate, (it) => it.kind === 'solid');
  if (!opts.noSyrup) k.add(plate, opts.topping || 'syrup', 20);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['cinnamon', 'sugar', 'egg']));
  return CK.judge(R['french-toast'], plate);
}
report('French toast as written', frenchToast({ ratios: true }), (r) => r.score >= 85);
report('French toast with honey', frenchToast({ topping: 'honey' }), (r) => r.score >= 85);
report('French toast, 1 min per side', frenchToast({ side1: 1, side2: 1 }), (r) => r.score < 70 && has(r, /raw egg|soggy|eggy|pale/));
report('French toast, never flipped', frenchToast({ noFlip: true, side1: 6, side2: 0.01 }), (r) => has(r, /one side|flipping|pale/));
report('French toast, high heat', frenchToast({ level: 5, side1: 4, side2: 4 }), (r) => has(r, /burnt|dark/));
report('French toast, not soaked', frenchToast({ noSoak: true }), (r) => r.score < 75 && has(r, /fried bread|soak/));
report('French toast, 3 tsp cinnamon', frenchToast({ cinnamon: 8 }), (r) => r.score < 80 && has(r, /cinnamon/));
report('French toast, something else entirely', wrongDish('french-toast'), (r) => r.score <= 15 && has(r, /expecting cinnamon/));

// ---------------------------------------------------------------- 12. porridge
function porridge(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, soupbowl } = k.C;
  k.add(saucepan, 'oats', 40).add(saucepan, opts.liquid || 'milk', opts.milk || 250).add(saucepan, 'salt', 0.4);
  k.burner(saucepan, 0, opts.level || 3);
  let n = 0;
  while (saucepan.temp < 99.5 && n++ < 80) cookStirring(k, saucepan, 0.25, 30);
  k.heat(0, opts.simmerLevel || 1);
  cookStirring(k, saucepan, opts.min == null ? 4 : opts.min, opts.stirEvery || 20);
  k.heat(0, 0);
  const out = opts.into === 'plate' ? k.C.plate : soupbowl;
  k.pourAll(saucepan, out);
  const ban = chopUnit(k, 'banana', opts.banChops == null ? 3 : opts.banChops);
  boardMove(k, ban, out);
  if (!opts.noHoney) k.add(out, 'honey', 15);
  if (verbose) k.show(out);
  if (opts.ratios) console.log('   ratios', ratios(out, ['salt', 'honey', 'milk', 'oats']));
  return CK.judge(R['porridge'], out);
}
report('porridge as written', porridge({ ratios: true }), (r) => r.score >= 85);
report('porridge, pulled at a simmer', porridge({ min: 0.5 }), (r) => has(r, /runny|soupy|chewy|raw/));
report('porridge, 15 min on medium', porridge({ simmerLevel: 3, min: 15, stirEvery: 60 }), (r) => r.score < 70 && has(r, /thick|stodgy|gluey|burnt|scorch/));
report('porridge, with water', porridge({ liquid: 'water' }), (r) => has(r, /water|creamy/));
report('porridge, whole banana', porridge({ banChops: 0 }), (r) => has(r, /whole banana/));
report('porridge, on a plate', porridge({ into: 'plate' }), (r) => has(r, /plate/));
report('porridge, something else entirely', wrongDish('porridge', 'soupbowl'), (r) => r.score <= 15 && has(r, /expecting banana/));

// ---------------------------------------------------------------- 13. bruschetta
function bruschetta(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pan, bowl, plate } = k.C;
  const tom = chopUnit(k, 'tomato', opts.tomChops == null ? 6 : opts.tomChops); boardMove(k, tom, bowl);
  const gar = chopUnit(k, 'garlic', 10); boardMove(k, gar, bowl);
  const bas = chopUnit(k, 'basil', 1); boardMove(k, bas, bowl);
  k.add(bowl, 'oil', 14).add(bowl, 'salt', opts.salt == null ? 1 : opts.salt).stir(bowl, 1);
  if (opts.cookTomatoes) {
    k.burner(pan, 0, 4).wait(1).pourAll(bowl, pan);
    cookStirring(k, pan, opts.cookTomatoes, 20);
    k.heat(0, 0).pourAll(pan, bowl);
  }
  if (opts.untoasted) k.unit(plate, 'bread', 2);
  else { toastSlices(k, 2, opts.toast || 3); k.move(k.w.toasterC, plate); }
  k.pourAll(bowl, plate);
  if (opts.waitMin) k.wait(opts.waitMin);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'oil']));
  return CK.judge(R['bruschetta'], plate);
}
report('bruschetta as written', bruschetta({ ratios: true }), (r) => r.score >= 85);
report('bruschetta, served after 10 min', bruschetta({ waitMin: 10 }), (r) => r.score >= 80);
report('bruschetta, tomatoes fried 5 min', bruschetta({ cookTomatoes: 5 }), (r) => r.score < 75 && has(r, /tomatoes.*(cooked|warm|soft|brown)/));
report('bruschetta, bread not toasted', bruschetta({ untoasted: true }), (r) => r.score < 80 && has(r, /untoasted|toasted/));
report('bruschetta, halved tomato', bruschetta({ tomChops: 1 }), (r) => has(r, /halves/));
report('bruschetta, 2 tsp salt', bruschetta({ salt: 12 }), (r) => r.score < 60 && has(r, /salty/));
report('bruschetta, something else entirely', wrongDish('bruschetta'), (r) => r.score <= 15 && has(r, /expecting tomato bruschetta/));

// ---------------------------------------------------------------- 14. mashed potatoes
function mash(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, plate } = k.C;
  const p1 = chopUnit(k, 'potato', 7), p2 = chopUnit(k, 'potato', 7);
  boardMove(k, p1, saucepan); boardMove(k, p2, saucepan);
  k.water(saucepan, 1000).burner(saucepan, 0, 5);
  boil(k, saucepan);
  k.wait(opts.min || 12);
  k.heat(0, 0);
  if (!opts.noDrain) k.drain(saucepan);
  k.add(saucepan, 'butter', opts.butter == null ? 30 : opts.butter).add(saucepan, 'milk', 60).add(saucepan, 'salt', opts.salt == null ? 3 : opts.salt);
  k.stir(saucepan, opts.mashSec == null ? 3 : opts.mashSec);
  k.pourAll(saucepan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'butter', 'milk']));
  return CK.judge(R['mash'], plate);
}
report('mash as written', mash({ ratios: true }), (r) => r.score >= 85);
report('mash, boiled 5 min', mash({ min: 5 }), (r) => r.score < 60 && has(r, /hard|raw|lumpy|chunks/));
report('mash, not mashed', mash({ mashSec: 0.5 }), (r) => r.score < 75 && has(r, /chunks|mashed/));
report('mash, not drained', mash({ noDrain: true }), (r) => r.score < 70 && has(r, /watery|soupy|drained|wet/));
report('mash, no salt', mash({ salt: 0 }), (r) => has(r, /bland|salt/));
report('mash, something else entirely', wrongDish('mash'), (r) => r.score <= 15 && has(r, /expecting creamy mashed/));

// ---------------------------------------------------------------- 16. stir-fry with rice
function stirFry(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, pan, plate } = k.C;
  k.add(saucepan, 'rice', 75).water(saucepan, opts.water || 200).add(saucepan, 'salt', 0.4).burner(saucepan, 1, 5);
  boil(k, saucepan);
  k.heat(1, opts.riceLevel || 1);
  const t0 = k.w.time;
  const ch = chopUnit(k, 'chicken', opts.chickenChops == null ? 3 : opts.chickenChops);
  const bp = chopUnit(k, 'bellpepper', 3);
  const on = chopUnit(k, 'onion', 3);
  const ga = chopUnit(k, 'garlic', 10);
  // start the stir-fry so that it finishes when the rice does
  const chickenMin = opts.chickenMin || 4;
  // rice taken off early is dished up straight away; otherwise the stir-fry finishes with the rice
  const early = opts.riceMin != null && opts.riceMin < 5 + chickenMin;
  if (early) { k.wait(opts.riceMin - (k.w.time - t0) / 60).heat(1, 0).pourAll(saucepan, plate); }
  else k.wait(Math.max(0, (opts.riceMin || 12) - 5 - chickenMin - (k.w.time - t0) / 60));
  k.burner(pan, 0, opts.level || 5).add(pan, 'oil', 14).wait(1);
  boardMove(k, ch, pan);
  cookStirring(k, pan, chickenMin, 20);
  if (!opts.keepChicken) k.move(pan, k.C.bowl, (it) => it.ing === 'chicken');
  boardMove(k, bp, pan); boardMove(k, on, pan);
  cookStirring(k, pan, 3, 20);
  k.move(k.C.bowl, pan);
  boardMove(k, ga, pan);
  if (!opts.noSoy) k.add(pan, 'soy', opts.soy || 30);
  cookStirring(k, pan, 1, 15);
  k.heat(0, 0).heat(1, 0);
  if (!early) k.pourAll(saucepan, plate);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'soy', 'oil']));
  return CK.judge(R['stir-fry'], plate);
}
report('stir-fry as written', stirFry({ ratios: true }), (r) => r.score >= 85);
report('stir-fry, rice 5 min', stirFry({ riceMin: 5 }), (r) => r.score < 80 && has(r, /rice.*(hard|crunchy)/));
report('stir-fry, rice with too little water', stirFry({ water: 100 }), (r) => has(r, /rice.*(hard|crunchy|burnt|caught)/));
report('stir-fry, chicken 1 min', stirFry({ chickenMin: 0.3, level: 3 }), (r) => r.score < 50 && has(r, /pink|raw|safe/));
report('stir-fry, chicken left in the pan', stirFry({ keepChicken: true }), (r) => has(r, /chicken.*dry/));
report('stir-fry, whole chicken breast', stirFry({ chickenChops: 0 }), (r) => has(r, /whole chicken|raw|pink/));
report('stir-fry, half a bottle of soy', stirFry({ soy: 150 }), (r) => r.score < 70 && has(r, /salty|soy/));
report('stir-fry, something else entirely', wrongDish('stir-fry'), (r) => r.score <= 15 && has(r, /expecting chicken/));


// ================================================================ Ukrainian kitchen
// ladle `n` dollops from a bowl of dough/batter into a pan or pot, spread out side by side
function ladleDollops(from, to, n) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    const r = CK.ladle(from);
    if (!r.items) break;
    for (const it of r.items) { const a = i * 2 * Math.PI / Math.max(n, 1); it.px = Math.cos(a) * 0.6; it.py = Math.sin(a) * 0.6; to.add(it); }
    got++;
  }
  return got;
}
// one ladle of soup into a bowl
function ladleSoup(from, to) { const r = CK.ladle(from); if (r.items) for (const it of r.items) to.add(it); return r; }
// hard-boiled egg: boiled, peeled (click) and halved (one chop)
function peelAndHalve(k, egg, from) { from.remove(egg); k.w.board.add(egg); CK.crack(k.w.board, egg); CK.chop(egg); return egg; }

// ---------------------------------------------------------------- U1. syrnyky
function syrnyky(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { bowl, pan, pot, plate } = k.C;
  k.add(bowl, 'tvorog', 120).unit(bowl, 'egg').crackAll(bowl).add(bowl, 'sugar', 8).add(bowl, 'salt', 0.4).add(bowl, 'flour', opts.flour == null ? 12 : opts.flour);
  k.stir(bowl, 2, 'whisk');
  let fry = pan;
  if (opts.boil) { fry = pot; k.water(pot, 1500).burner(pot, 0, 5); boil(k, pot); }
  else k.burner(pan, 0, opts.level || 3).add(pan, 'sunoil', 15).wait(1);
  if (opts.pourAll) k.pourAll(bowl, fry);
  else ladleDollops(bowl, fry, opts.n || 4);
  k.wait(opts.side1 || 4);
  if (!opts.noFlip) k.flipAll(fry);
  k.wait(opts.side2 || 3);
  k.heat(0, 0);
  k.move(fry, plate, (it) => it.kind === 'set' || it.lump);
  if (!opts.noSmetana) k.add(plate, 'smetana', 30);
  k.add(plate, opts.topping || 'cherryjam', 20);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'sugar', 'smetana', 'cherryjam']));
  return CK.judge(R['syrnyky'], plate);
}
report('syrnyky as written', syrnyky({ ratios: true }), (r) => r.score >= 85);
report('syrnyky with honey', syrnyky({ topping: 'honey' }), (r) => r.score >= 85);
report('syrnyky, burnt on high', syrnyky({ level: 5, side1: 5, side2: 5 }), (r) => r.score < 70 && has(r, /burnt|dark/));
report('syrnyky, raw inside', syrnyky({ level: 5, side1: 1.5, side2: 1 }), (r) => r.score < 80 && has(r, /raw|doughy/));
report('syrnyky, one giant syrnyk', syrnyky({ pourAll: true }), (r) => r.score < 85 && has(r, /giant/));
report('syrnyky, never flipped', syrnyky({ noFlip: true, side1: 7, side2: 0.01 }), (r) => has(r, /one side|flipping|pale/));
report('syrnyky, no smetana', syrnyky({ noSmetana: true }), (r) => r.score < 85 && has(r, /smetana/));
report('syrnyky, boiled instead of fried', syrnyky({ boil: true, side1: 3, side2: 2 }), (r) => r.score < 75 && has(r, /boiled|varenyky/));
report('syrnyky, something else entirely', wrongDish('syrnyky'), (r) => r.score <= 15 && has(r, /expecting syrnyky/));

// ---------------------------------------------------------------- U2. hrechka with mushrooms
function hrechka(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, pan, plate } = k.C;
  k.add(saucepan, 'buckwheat', 100).water(saucepan, opts.water || 200).add(saucepan, 'salt', opts.salt == null ? 3 : opts.salt).burner(saucepan, 1, 5);
  boil(k, saucepan);
  k.heat(1, opts.kashaLevel || 1);
  const t0 = k.w.time;
  const on = chopUnit(k, 'onion', 10);
  const mush = [];
  if (!opts.noMushrooms) for (let i = 0; i < 5; i++) mush.push(chopUnit(k, 'mushroom', 3));
  // the mushrooms finish with the buckwheat
  const kashaMin = opts.kashaMin || 12;
  const early = kashaMin < 10;
  if (early) k.wait(kashaMin - (k.w.time - t0) / 60).heat(1, 0).pourAll(saucepan, plate);
  else k.wait(Math.max(0, kashaMin - 10));
  k.burner(pan, 0, 3).add(pan, 'butter', 15).wait(1);
  boardMove(k, on, pan);
  cookStirring(k, pan, 3, 20);
  for (const m of mush) boardMove(k, m, pan);
  cookStirring(k, pan, 6, 20);
  k.add(pan, 'salt', 0.4).add(pan, 'pepper', 0.15);
  k.wait(Math.max(0, kashaMin - (k.w.time - t0) / 60));
  k.heat(0, 0).heat(1, 0);
  if (!early) k.pourAll(saucepan, pan);
  k.stir(pan, 0.5);
  k.pourAll(pan, plate);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper', 'butter']));
  return CK.judge(R['hrechka'], plate);
}
report('hrechka as written', hrechka({ ratios: true }), (r) => r.score >= 85);
report('hrechka, buckwheat 5 min', hrechka({ kashaMin: 5 }), (r) => r.score < 80 && has(r, /buckwheat.*(hard|crunchy)|watery/));
report('hrechka, on medium-high', hrechka({ kashaLevel: 4, kashaMin: 14 }), (r) => r.score < 80 && has(r, /caught|burnt/));
report('hrechka, too much water', hrechka({ water: 500 }), (r) => r.score < 85 && has(r, /watery/));
report('hrechka, forgot the mushrooms', hrechka({ noMushrooms: true }), (r) => r.score < 80 && has(r, /mushrooms/));
report('hrechka, no salt', hrechka({ salt: 0 }), (r) => has(r, /salt|bland/));
report('hrechka, something else entirely', wrongDish('hrechka'), (r) => r.score <= 15 && has(r, /expecting buckwheat/));

// ---------------------------------------------------------------- U3. mlyntsi
function mlyntsi(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { bowl, pan, plate } = k.C;
  k.unit(bowl, 'egg').crackAll(bowl).add(bowl, 'milk', opts.milk || 150).add(bowl, 'sugar', 4).add(bowl, 'salt', 0.4).add(bowl, 'flour', opts.flour || 50);
  k.stir(bowl, 3, 'whisk');
  k.burner(pan, 0, opts.level || 3).add(pan, 'sunoil', 5).wait(1);
  let n = 0;
  while (bowl.pool() && n++ < 10) {
    if (opts.pourAll) k.pourAll(bowl, pan); else ladleDollops(bowl, pan, 1);
    k.wait(opts.side1 || 1.5);
    if (!opts.noFlip) k.flipAll(pan);
    k.wait(opts.side2 || 1);
    k.move(pan, plate, (it) => it.kind === 'set' || it.lump);
  }
  k.heat(0, 0);
  if (!opts.noSmetana) k.add(plate, 'smetana', 30);
  k.add(plate, 'honey', 15);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'sugar', 'smetana', 'honey']));
  return CK.judge(R['mlyntsi'], plate);
}
report('mlyntsi as written', mlyntsi({ ratios: true }), (r) => r.score >= 85);
report('mlyntsi, thick pancake batter', mlyntsi({ flour: 100, milk: 70 }), (r) => r.score < 80 && has(r, /thick|fluffy/));
report('mlyntsi, whole bowl at once', mlyntsi({ pourAll: true, side1: 2, side2: 1.5 }), (r) => r.score < 80 && has(r, /thick pancake/));
report('mlyntsi, never flipped', mlyntsi({ noFlip: true, side1: 2.5, side2: 0.01 }), (r) => has(r, /pale|flipping/));
report('mlyntsi, high heat', mlyntsi({ level: 5, side1: 2.5, side2: 2 }), (r) => r.score < 80 && has(r, /burnt|dark/));
report('mlyntsi, no smetana', mlyntsi({ noSmetana: true }), (r) => r.score < 85 && has(r, /smetana/));
report('mlyntsi, something else entirely', wrongDish('mlyntsi', 'plate', true), (r) => r.score <= 15 && has(r, /expecting mlyntsi/));

// ---------------------------------------------------------------- U4. lazy varenyky
function lazyVarenyky(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { bowl, pot, pan, soupbowl } = k.C;
  k.add(bowl, 'tvorog', 200).unit(bowl, 'egg').crackAll(bowl).add(bowl, 'sugar', 12).add(bowl, 'salt', 0.4).add(bowl, 'flour', opts.flour || 40);
  k.stir(bowl, 2, 'whisk');
  if (opts.fry) {
    k.burner(pan, 0, 3).add(pan, 'sunoil', 15).wait(1);
    ladleDollops(bowl, pan, 8);
    k.wait(4).flipAll(pan).wait(3).heat(0, 0);
    k.move(pan, soupbowl, (it) => it.kind === 'set' || it.lump);
  } else {
    k.water(pot, 1500).add(pot, 'salt', 6).burner(pot, 1, 5);
    boil(k, pot);
    ladleDollops(bowl, pot, 10);
    k.wait(opts.min || 5);
    k.heat(1, 0);
    if (opts.noDrain) k.pourAll(pot, soupbowl);
    else { k.drain(pot); k.move(pot, soupbowl); }
  }
  k.add(soupbowl, 'butter', 10);
  if (!opts.noSmetana) k.add(soupbowl, 'smetana', 30);
  if (verbose) k.show(soupbowl);
  if (opts.ratios) console.log('   ratios', ratios(soupbowl, ['salt', 'sugar', 'smetana', 'butter']));
  return CK.judge(R['lazy-varenyky'], soupbowl);
}
report('lazy varenyky as written', lazyVarenyky({ ratios: true }), (r) => r.score >= 85);
report('lazy varenyky, fried instead of boiled', lazyVarenyky({ fry: true }), (r) => r.score < 70 && has(r, /fried|syrnyky/));
report('lazy varenyky, pulled at 2 min', lazyVarenyky({ min: 2 }), (r) => r.score < 70 && has(r, /raw/));
report('lazy varenyky, not drained', lazyVarenyky({ noDrain: true }), (r) => r.score < 75 && has(r, /water|drain/));
report('lazy varenyky, too much flour', lazyVarenyky({ flour: 130 }), (r) => r.score < 85 && has(r, /flour|doughy/));
report('lazy varenyky, no smetana', lazyVarenyky({ noSmetana: true }), (r) => r.score < 85 && has(r, /smetana/));
report('lazy varenyky, something else entirely', wrongDish('lazy-varenyky', 'soupbowl'), (r) => r.score <= 15 && has(r, /expecting lazy varenyky/));

// ---------------------------------------------------------------- U5. deruny
function deruny(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { bowl, pan, plate } = k.C;
  const pc = opts.potatoChops == null ? 18 : opts.potatoChops;
  boardMove(k, chopUnit(k, 'potato', pc), bowl); boardMove(k, chopUnit(k, 'potato', pc), bowl);
  boardMove(k, chopUnit(k, 'onion', 16), bowl);
  k.unit(bowl, 'egg').crackAll(bowl).add(bowl, 'flour', 20).add(bowl, 'salt', opts.salt == null ? 4 : opts.salt).add(bowl, 'pepper', 0.15);
  k.stir(bowl, 2.5, 'whisk');
  k.burner(pan, 0, opts.level || 3).add(pan, 'sunoil', 30).wait(1);
  if (pc >= 18) {
    ladleDollops(bowl, pan, 4);
    k.wait(opts.side1 || 4);
    if (!opts.noFlip) k.flipAll(pan);
    k.wait(opts.side2 || 3);
  } else {
    // diced potato never turns into a batter: the player tips the lot into the pan and fries it
    k.pourAll(bowl, pan);
    cookStirring(k, pan, 7, 30, 'spatula');
  }
  k.heat(0, 0);
  k.move(pan, plate, (it) => it.kind !== 'fat');
  if (!opts.noSmetana) k.add(plate, 'smetana', 30);
  if (verbose) k.show(plate);
  if (opts.ratios) console.log('   ratios', ratios(plate, ['salt', 'pepper', 'smetana']));
  return CK.judge(R['deruny'], plate);
}
report('deruny as written', deruny({ ratios: true }), (r) => r.score >= 85);
report('deruny, potato diced not grated', deruny({ potatoChops: 7 }), (r) => r.score < 40 && has(r, /grated|expecting deruny/));
report('deruny, burnt on high', deruny({ level: 5, side1: 5, side2: 5 }), (r) => r.score < 70 && has(r, /burnt|dark/));
report('deruny, pale and raw on low', deruny({ level: 1, side1: 3, side2: 2 }), (r) => r.score < 75 && has(r, /pale|raw|crisp/));
report('deruny, never flipped', deruny({ noFlip: true, side1: 7, side2: 0.01 }), (r) => has(r, /one side|flipping|pale|crisp/));
report('deruny, no smetana', deruny({ noSmetana: true }), (r) => r.score < 85 && has(r, /smetana/));
report('deruny, something else entirely', wrongDish('deruny'), (r) => r.score <= 15 && has(r, /expecting deruny/));

// ---------------------------------------------------------------- U6. kulish
function kulish(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { saucepan, pan, soupbowl } = k.C;
  k.water(saucepan, opts.water || 700).burner(saucepan, 1, 5);
  boil(k, saucepan);
  const pot = chopUnit(k, 'potato', 7);
  const addMillet = () => { k.add(saucepan, 'millet', 60).add(saucepan, 'salt', opts.salt == null ? 5 : opts.salt); boardMove(k, pot, saucepan); };
  if (!opts.lateMillet) addMillet();
  k.heat(1, 2).stirTarget(saucepan);
  const t0 = k.w.time;
  const salo = chopUnit(k, 'salo', opts.saloChops == null ? 5 : opts.saloChops);
  const on = chopUnit(k, 'onion', 10);
  if (opts.rawSalo) {
    boardMove(k, salo, saucepan); boardMove(k, on, saucepan);
    k.wait((opts.simmer || 15) + 3, 60);
  } else {
    k.burner(pan, 0, opts.saloLevel || 3).wait(1);
    boardMove(k, salo, pan);
    cookStirring(k, pan, opts.saloMin || 6, 30, 'spatula');
    boardMove(k, on, pan);
    cookStirring(k, pan, 5, 20, 'spatula');
    k.heat(0, 0);
    // the millet has simmered 15 minutes by now (stirred now and then)
    k.wait(Math.max(0, (opts.simmer || 15) - (k.w.time - t0) / 60), 60);
    if (opts.lateMillet) addMillet();
    k.pourAll(pan, saucepan);
    cookStirring(k, saucepan, opts.lateMillet ? 4 : 3, 30);
  }
  k.heat(1, 0);
  const out = opts.into === 'plate' ? k.C.plate : soupbowl;
  ladleSoup(saucepan, out);
  if (!opts.noDill) boardMove(k, chopUnit(k, 'dill', 2), out);
  if (verbose) k.show(out);
  if (opts.ratios) console.log('   ratios', ratios(out, ['salt', 'millet', 'salo', 'lard', 'water']));
  return CK.judge(R['kulish'], out);
}
report('kulish as written', kulish({ ratios: true }), (r) => r.score >= 85);
report('kulish, salo not fried', kulish({ rawSalo: true }), (r) => r.score < 85 && has(r, /salo.*(pale|flabby|fatty|chewy)/));
report('kulish, millet only 4 min', kulish({ lateMillet: true }), (r) => r.score < 75 && has(r, /millet.*(gritty|hard|raw)|potato.*(hard|raw)/));
report('kulish, watery', kulish({ water: 1600 }), (r) => r.score < 90 && has(r, /watery|thin/));
report('kulish, burnt shkvarky', kulish({ saloLevel: 5, saloMin: 9 }), (r) => r.score < 90 && has(r, /shkvarky.*(burnt|dark)/));
report('kulish, on a plate', kulish({ into: 'plate' }), (r) => has(r, /plate/));
report('kulish, something else entirely', wrongDish('kulish', 'soupbowl'), (r) => r.score <= 15 && has(r, /expecting kulish/));

// ---------------------------------------------------------------- U7. green borscht
function greenBorscht(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pot, pan, saucepan, soupbowl } = k.C;
  k.water(pot, 1000).burner(pot, 1, 5);
  boil(k, pot);
  const pots = [chopUnit(k, 'potato', 7), chopUnit(k, 'potato', 7)];
  if (!opts.latePotato) for (const p of pots) boardMove(k, p, pot);
  k.heat(1, 2);
  const t0 = k.w.time;
  // the egg goes on in its own saucepan
  k.water(saucepan, 600).burner(saucepan, 2, 5);
  k.burner(pan, 0, 3).add(pan, 'butter', 15).wait(1);
  boardMove(k, chopUnit(k, 'onion', 10), pan); boardMove(k, chopUnit(k, 'carrot', 13), pan);
  cookStirring(k, pan, 5, 20);
  k.heat(0, 0).pourAll(pan, pot);
  k.add(pot, 'salt', opts.salt == null ? 12 : opts.salt);
  boil(k, saucepan);
  k.unit(saucepan, 'egg');
  const tEgg = k.w.time;
  k.heat(2, 3);
  let egg = null;
  // taken out early: it sits on the counter until serving
  if (opts.eggMin) { k.wait(opts.eggMin); egg = saucepan.items.find((i) => i.ing === 'egg'); k.move(saucepan, k.w.counter, (i) => i === egg); }
  k.wait(Math.max(0, 12 - (k.w.time - t0) / 60));
  if (opts.latePotato) for (const p of pots) boardMove(k, p, pot);
  if (!opts.noSorrel) for (let i = 0; i < 3; i++) boardMove(k, chopUnit(k, 'sorrel', opts.sorrelChops == null ? 2 : opts.sorrelChops), pot);
  k.wait(3);
  if (!egg) k.wait(Math.max(0, 10 - (k.w.time - tEgg) / 60));
  k.heat(1, 0).heat(2, 0);
  const eggFrom = egg ? k.w.counter : saucepan;
  egg = egg || saucepan.items.find((i) => i.ing === 'egg');
  const out = opts.into === 'plate' ? k.C.plate : soupbowl;
  ladleSoup(pot, out);
  boardMove(k, peelAndHalve(k, egg, eggFrom), out);
  boardMove(k, chopUnit(k, 'dill', 2), out);
  k.add(out, 'smetana', 30);
  if (verbose) k.show(out);
  if (opts.ratios) console.log('   ratios', ratios(out, ['salt', 'sorrel', 'smetana', 'butter', 'water']));
  return CK.judge(R['green-borscht'], out);
}
report('green borscht as written', greenBorscht({ ratios: true }), (r) => r.score >= 85);
report('green borscht, forgot the sorrel', greenBorscht({ noSorrel: true }), (r) => r.score < 75 && has(r, /sorrel/));
report('green borscht, sorrel not chopped', greenBorscht({ sorrelChops: 0 }), (r) => has(r, /bunch of sorrel/));
report('green borscht, potatoes in for 3 min', greenBorscht({ latePotato: true }), (r) => r.score < 85 && has(r, /potato.*(hard|raw)/));
report('green borscht, soft-boiled egg', greenBorscht({ eggMin: 4 }), (r) => has(r, /yolk|egg/));
report('green borscht, 2 tbsp salt', greenBorscht({ salt: 36 }), (r) => r.score < 85 && has(r, /way too salty/));
report('green borscht, a quarter cup of salt', greenBorscht({ salt: 75 }), (r) => r.score < 60 && has(r, /unbelievably salty/));
report('green borscht, on a plate', greenBorscht({ into: 'plate' }), (r) => has(r, /plate/));
report('green borscht, something else entirely', wrongDish('green-borscht', 'soupbowl'), (r) => r.score <= 15 && has(r, /expecting green borscht/));

// ---------------------------------------------------------------- U8. Ukrainian borscht
function borscht(opts) {
  opts = opts || {};
  const k = makeKitchen(CK); const { pot, pan, soupbowl } = k.C;
  k.water(pot, 1200).burner(pot, 1, 5);
  boil(k, pot);
  k.heat(1, opts.simmerLevel ?? 2);
  if (!opts.noBeet) boardMove(k, chopUnit(k, 'beetroot', opts.beetChops == null ? 6 : opts.beetChops), pot);
  k.wait(opts.beetMin == null ? 5 : opts.beetMin);
  boardMove(k, chopUnit(k, 'potato', 7), pot);
  // zazharka
  k.burner(pan, 0, 3).add(pan, 'sunoil', 20).wait(1);
  boardMove(k, chopUnit(k, 'onion', 10), pan); boardMove(k, chopUnit(k, 'carrot', 5), pan);
  cookStirring(k, pan, 5, 20);
  k.add(pan, 'tomatopaste', opts.paste || 30);
  cookStirring(k, pan, 1, 15);
  k.heat(0, 0);
  boardMove(k, chopUnit(k, 'cabbage', 3), pot);
  k.pourAll(pan, pot);
  k.add(pot, 'salt', opts.salt == null ? 12 : opts.salt).add(pot, 'sugar', 4);
  k.stirTarget(pot).wait(opts.min == null ? 8 : opts.min, 120);
  boardMove(k, chopUnit(k, 'garlic', 10), pot);
  k.wait(1);
  k.heat(1, 0);
  const out = opts.into === 'plate' ? k.C.plate : soupbowl;
  ladleSoup(pot, out);
  // a whole beetroot doesn't fit in the ladle: the player fishes it out by hand
  for (const it of pot.items.slice()) if (it.ing === 'beetroot' && !CK.isBulk(it)) k.move(pot, out, (x) => x === it);
  k.add(out, 'smetana', 30);
  boardMove(k, chopUnit(k, 'dill', 2), out);
  if (verbose) k.show(out);
  if (opts.ratios) console.log('   ratios', ratios(out, ['salt', 'sugar', 'tomato', 'beet', 'sunoil', 'water']));
  return CK.judge(R['borscht'], out);
}
report('borscht as written', borscht({ ratios: true }), (r) => r.score >= 85);
report('borscht, barely simmered', borscht({ beetMin: 0, min: 1 }), (r) => r.score < 85 && has(r, /raw|crunchy|pale/));
report('borscht, heat off after boiling', borscht({ simmerLevel: 0 }), (r) => r.score < 70 && has(r, /raw|crunchy|pale|hard/));
report('borscht, whole beetroot', borscht({ beetChops: 0 }), (r) => r.score < 75 && has(r, /whole beetroot|pale/));
report('borscht, 2 tbsp salt', borscht({ salt: 36 }), (r) => r.score < 85 && has(r, /way too salty/));
report('borscht, a quarter cup of salt', borscht({ salt: 75 }), (r) => r.score < 60 && has(r, /unbelievably salty/));
report('borscht, a whole tin of tomato paste', borscht({ paste: 150 }), (r) => has(r, /tomato/));
report('borscht, no beetroot at all', borscht({ noBeet: true }), (r) => r.score < 50 && has(r, /ruby|beetroot/));
report('borscht, on a plate', borscht({ into: 'plate' }), (r) => r.score < 85 && has(r, /plate/));
report('borscht, something else entirely', wrongDish('borscht', 'soupbowl'), (r) => r.score <= 15 && has(r, /expecting ukrainian borscht/));

// ---------------------------------------------------------------- Ukrainian kitchen mechanics
// (the building blocks the Ukrainian recipes rely on)
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && (verbose || !ok) ? '\n        ' + detail : ''}`);
}
const names = (c) => c.items.map((i) => CK.itemName(i)).join(', ');
{
  // every stocked ingredient exists, and each cuisine keeps the shared basics
  const bad = [];
  for (const cu of CK.CUISINES) for (const s of CK.stockFor(cu.id)) if (!CK.ING[s.ing]) bad.push(cu.id + ':' + s.ing);
  check('cuisine stock: all ingredients exist', !bad.length, bad.join(' '));
  const uk = CK.stockedIngredients('ukrainian');
  const need = ['beetroot', 'carrot', 'cabbage', 'dill', 'sorrel', 'smetana', 'tvorog', 'salo', 'buckwheat', 'millet', 'sunoil', 'tomatopaste', 'cherryjam', 'ryebread', 'potato', 'onion', 'egg', 'flour'];
  check('ukrainian kitchen stocks its ingredients', need.every((k) => uk.has(k)), need.filter((k) => !uk.has(k)).join(' '));
  for (const r of CK.RECIPES) {
    const st = CK.stockedIngredients(r.cuisine);
    const miss = r.components.map((c) => c.ing).filter((k) => k && !st.has(k) && k !== 'tomato');
    if (miss.length) check(`recipe ${r.id}: ingredients stocked in its kitchen`, false, miss.join(' '));
  }
}
{
  // syrnyky: farmer's cheese + egg + flour whisked into a curd dough, ladled into a pan as separate dollops
  const k = makeKitchen(CK); const { bowl, pan, plate } = k.C;
  k.add(bowl, 'tvorog', 250).add(bowl, 'sugar', 20).add(bowl, 'flour', 35).unit(bowl, 'egg').crackAll(bowl).stir(bowl, 2, 'whisk');
  const doughOk = CK.classify(bowl.pool().comp) === 'curd';
  k.burner(pan, 0, 3).add(pan, 'sunoil', 15).wait(1.5);
  for (let i = 0; i < 4; i++) { const r = CK.ladle(bowl); r.items[0].px = Math.cos(i * 1.57) * 0.7; r.items[0].py = Math.sin(i * 1.57) * 0.7; pan.add(r.items[0]); }
  const separate = pan.items.filter((i) => i.lump).length === 4 && !pan.pool();
  k.wait(3.5).flipAll(pan).wait(3);
  k.heat(0, 0).pourAll(pan, plate);
  const sy = plate.items.filter((i) => i.kind === 'set' && i.cls === 'curd' && i.lump);
  check('syrnyky: 4 separate golden syrnyky', doughOk && separate && sy.length === 4 && sy.every((i) => i.cook > 0.75 && i.brownDown > 0.6 && i.brownUp > 0.6 && i.method === 'fried'),
    `${names(plate)} | ${sy.map((i) => `c=${i.cook.toFixed(2)} b=${i.brownDown.toFixed(2)}/${i.brownUp.toFixed(2)}`).join(' ')}`);
  check('syrnyky: named and pluralised', /4 syrnyky/.test(CK.describeContents(plate.items)), CK.describeContents(plate.items));
}
{
  // deruny: grated potato + minced onion + egg + flour whisked into a batter
  const k = makeKitchen(CK); const { bowl, pan } = k.C;
  for (const [ing, n] of [['potato', 18], ['potato', 18], ['onion', 16]]) boardMove(k, chopUnit(k, ing, n), bowl);
  k.unit(bowl, 'egg').crackAll(bowl).add(bowl, 'flour', 30).add(bowl, 'salt', 3).stir(bowl, 2.5, 'whisk');
  const merged = bowl.items.length === 1 && CK.classify(bowl.pool().comp) === 'potato';
  k.burner(pan, 0, 3).add(pan, 'sunoil', 30).wait(1.5);
  for (let i = 0; i < 3; i++) { const r = CK.ladle(bowl); r.items[0].px = (i - 1) * 0.7; pan.add(r.items[0]); }
  k.wait(3.5).flipAll(pan).wait(3);
  const de = pan.items.filter((i) => i.kind === 'set' && i.cls === 'potato');
  check('deruny: grated potato batter fries into deruny', merged && de.length === 3 && de.every((i) => i.cook > 0.75 && CK.itemName(i) === 'derun'), names(bowl) + ' → ' + names(pan));
}
{
  // lazy varenyky: curd dough dollops dropped into boiling water set as dumplings
  const k = makeKitchen(CK); const { bowl, pot } = k.C;
  k.add(bowl, 'tvorog', 250).add(bowl, 'flour', 60).unit(bowl, 'egg').crackAll(bowl).stir(bowl, 2, 'whisk');
  k.water(pot, 2000).add(pot, 'salt', 10).burner(pot, 1, 5); boil(k, pot);
  for (let i = 0; i < 5; i++) pot.add(CK.ladle(bowl).items[0]);
  k.wait(4.5);
  const du = pot.items.filter((i) => i.kind === 'set' && i.lump);
  k.heat(1, 0).drain(pot);
  check('lazy varenyky: boiled dumplings that survive draining', du.length === 5 && du.every((i) => i.method === 'boiled' && CK.itemName(i) === 'lazy varenyk' && i.cook > 0.75) && pot.items.length === 5, names(pot));
}
{
  // borscht: beetroot simmered in water turns the broth ruby; with vegetables in it, it's borscht
  const k = makeKitchen(CK); const { pot, soupbowl } = k.C;
  k.water(pot, 1500).burner(pot, 1, 5); boil(k, pot); k.heat(1, 3);
  boardMove(k, chopUnit(k, 'potato', 7), pot); boardMove(k, chopUnit(k, 'beetroot', 6), pot); boardMove(k, chopUnit(k, 'cabbage', 3), pot);
  k.add(pot, 'tomatopaste', 30).add(pot, 'salt', 10).wait(15);
  const pool = pot.pool();
  const r = CK.ladle(pot);
  for (const it of r.items) soupbowl.add(it);
  check('borscht: beet broth named borscht, ladled with its vegetables', CK.classify(pool.comp) === 'beet' && CK.itemName(pool) === 'borscht' &&
    r.items[0].mass > 200 && r.items[0].mass < 300 && soupbowl.items.some((i) => i.ing === 'beetroot') && CK.itemName(soupbowl.pool()) === 'borscht', names(soupbowl));
  const k2 = makeKitchen(CK);
  k2.water(k2.C.saucepan, 800).burner(k2.C.saucepan, 1, 4); boil(k2, k2.C.saucepan);
  boardMove(k2, chopUnit(k2, 'beetroot', 6), k2.C.saucepan); k2.wait(10); k2.move(k2.C.saucepan, k2.C.bowl, (i) => i.kind === 'solid').wait(0.1);
  check('borscht: just beet in water is a beet broth', /beet broth/.test(CK.itemName(k2.C.saucepan.pool())), CK.itemName(k2.C.saucepan.pool()));
}
{
  // salo renders lard into the pan and crisps into shkvarky
  const k = makeKitchen(CK); const { pan } = k.C;
  k.burner(pan, 0, 3).wait(1); boardMove(k, chopUnit(k, 'salo', 5), pan);
  cookStirring(k, pan, 8, 40, 'spatula');
  const fat = pan.fat(), sk = pan.items.find((i) => i.ing === 'salo');
  check('salo: renders lard and turns into shkvarky', fat && fat.comp.lard > 20 && CK.itemName(sk) === 'shkvarky', names(pan));
}

console.log(failures ? `\n${failures} scenario(s) FAILED` : '\nAll scenarios passed.');
process.exit(failures ? 1 : 0);
