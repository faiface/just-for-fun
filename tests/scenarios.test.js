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


// ---------------------------------------------------------------- Ukrainian kitchen mechanics
// (no Ukrainian recipes yet: these only prove the mechanics the recipes will rely on)
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
