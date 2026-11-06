// The diner tastes the dish. Only the served result matters, never the steps taken.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { sum, addComp } = CK;

  const EXTRA_MSG = {
    sugar: 'Why is this sweet? There’s sugar in it!',
    syrup: 'Maple syrup? On this? Weird.',
    flour: 'It’s got a raw floury taste — was there flour in here?',
    bakingpowder: 'There’s a strange bitter, soapy taste. Baking powder?',
    chili: 'Whoa, this is spicy! I didn’t expect chili.',
    pepper: 'There’s black pepper on this. Not what I expected, but okay.',
    milk: 'There’s milk in here?',
    egg: 'Is that… egg? In this?',
    onion: 'Onion? That wasn’t in the recipe.',
    garlic: 'There’s garlic in this. Unexpected.',
    tomato: 'Tomato? In this?',
    parsley: 'There’s parsley on it — fine, I suppose.',
    spaghetti: 'Why is there spaghetti on my plate?',
    rice: 'There’s rice in this?',
    bacon: 'Bacon! Not in the recipe, but… bacon.',
    chicken: 'Wait, there’s chicken in this?',
    potato: 'There are potatoes in here?',
    bread: 'Why is there bread on this?',
    butter: 'It’s quite buttery.',
    oil: 'It’s a bit oily.',
    parmesan: 'There’s cheese on this! Unexpected.',
    cheddar: 'Cheddar? That wasn’t in the recipe.',
    cinnamon: 'Cinnamon?! In this? That’s… a choice.',
    honey: 'Why is this sweet? Is that honey?',
    soy: 'There’s a soy sauce taste in here. Odd.',
    banana: 'Is that… banana?!',
    oats: 'Why are there oats in this?',
    mushroom: 'Mushrooms? Not in the recipe, but okay.',
    bellpepper: 'There’s bell pepper in this — unexpected.',
    chives: 'A few chives on top — fine, I suppose.',
    basil: 'Some basil on it — nice, actually.',
  };
  const STRONG = { salt: 0.15, pepper: 0.1, chili: 0.08, sugar: 0.8, bakingpowder: 0.4, syrup: 2, honey: 2, cinnamon: 0.15, soy: 1.5 };
  const MILD_EXTRA = { pepper: 4, parsley: 3, butter: 4, oil: 4, parmesan: 5, chives: 3, basil: 3, cheddar: 6 };

  function evalRange(v, range, soft) {
    if (v < range[0]) return v < soft[0] ? 'veryLow' : 'low';
    if (v > range[1]) return v > soft[1] ? 'veryHigh' : 'high';
    return null;
  }
  function wavg(items, f) {
    const m = sum(items, (i) => i.mass) || 1;
    return sum(items, (i) => f(i) * i.mass) / m;
  }

  function evalComponent(c, items, ctx) {
    const issues = [];
    const add = (pen, text, extra) => { if (text && pen > 0.01) issues.push(Object.assign({ pen, text, comp: c.id }, extra || {})); };
    if (!items.length) {
      const text = c.missing || `Where is the ${c.label}?`;
      add(c.pts * (c.core ? 1 : c.missingPen || 0.6), text, { missing: true });
      return { issues, ok: false };
    }
    // amount
    if (c.count) {
      const n = items.filter((i) => i.kind !== 'fluid' && !CK.isBulk(i)).length || (items.length ? 1 : 0);
      if (n < c.count.n) add(c.pts * (c.count.fewPen != null ? c.count.fewPen : 0.25), c.count.few);
      else if (n > c.count.n) add(c.pts * (c.count.manyPen != null ? c.count.manyPen : 0.1), c.count.many);
    }
    if (c.grams) {
      const g = sum(items, (i) => i.comp[c.grams.ing] || 0);
      const r = g / c.grams.g;
      if (r < 0.6) add(c.pts * (r < 0.35 ? (c.grams.fewPen != null ? c.grams.fewPen : 0.3) : 0.12), c.grams.few);
      else if (r > 1.6) add(c.pts * (c.grams.manyPen != null ? c.grams.manyPen * (r > 2.5 ? 2 : 1) : r > 2.5 ? 0.3 : 0.12), c.grams.many);
    }
    // form (judge the biggest piece)
    const main = items.slice().sort((a, b) => b.mass - a.mass)[0];
    if (c.forms) {
      const key = CK.formKey(main);
      if (!c.forms.ok.includes(key)) {
        const bad = c.forms.bad && c.forms.bad[key];
        if (bad) add(c.pts * bad[0], bad[1]);
        else add(c.pts * 0.15, `The ${c.label} isn't prepared the way I expected.`);
      }
    }
    // doneness
    if (c.cook) {
      const v = wavg(items, (i) => i.cook);
      const r = evalRange(v, c.cook.range, c.cook.soft);
      const pens = { low: 0.3, veryLow: c.cook.veryLowPen || 0.75, high: 0.3, veryHigh: 0.65 };
      if (r) add(c.pts * pens[r], c.cook[r]);
    }
    // browning
    if (c.brown) {
      const B = c.brown;
      const pens = { low: 0.2, veryLow: 0.45, high: 0.3, veryHigh: 0.7 };
      if (B.side === 'both') {
        const d = wavg(items, (i) => i.brownDown), u = wavg(items, (i) => i.brownUp);
        const rd = evalRange(d, B.range, B.soft), ru = evalRange(u, B.range, B.soft);
        const isLow = (x) => x === 'low' || x === 'veryLow';
        if (B.oneSide && ((rd === null && isLow(ru)) || (ru === null && isLow(rd)))) add(c.pts * 0.3, B.oneSide);
        else {
          // report the worse side
          const order = { veryHigh: 4, veryLow: 3, high: 2, low: 1 };
          const worst = (order[rd] || 0) >= (order[ru] || 0) ? rd : ru;
          if (worst) add(c.pts * pens[worst], B[worst]);
        }
      } else {
        const f = B.side === 'down' ? (i) => i.brownDown : B.side === 'max' ? (i) => Math.max(i.brownDown, i.brownUp) : (i) => (i.brownDown + i.brownUp) / 2;
        const v = B.side === 'max' ? Math.max(...items.map(f)) : wavg(items, f);
        const r = evalRange(v, B.range, B.soft);
        if (r) add(c.pts * pens[r], B[r]);
      }
    }
    if (c.custom) for (const x of c.custom(items, ctx)) add(x.pen, x.text);
    return { issues, ok: issues.length === 0 };
  }

  CK.judge = function (recipe, cont) {
    const diner = CK.DINERS[recipe.diner];
    const items = cont ? cont.items.filter((i) => i.mass > 0.3) : [];
    const issues = [];
    const praise = [];
    const res = { recipe, diner, issues, praise };

    if (!items.length) {
      res.score = 0;
      res.lines = [{ text: 'Um… the ' + (cont ? cont.def.name : 'plate') + ' is empty?', tone: 'bad' }];
      return finish(res, true);
    }

    const comp = {};
    for (const it of items) addComp(comp, it.comp);
    const total = sum(Object.values(comp));
    res.description = CK.describeContents(items);

    // assign items to components
    const groups = {};
    for (const c of recipe.components) groups[c.id] = [];
    const unmatched = [];
    for (const it of items) {
      const c = recipe.components.find((c) => c.match(it));
      if (c) groups[c.id].push(it);
      else unmatched.push(it);
    }

    // recognition: does this resemble the dish at all?
    const core = recipe.components.filter((c) => c.core);
    const corePts = sum(core, (c) => c.pts);
    const present = sum(core, (c) => (groups[c.id].length ? c.pts : 0));
    const recog = corePts ? present / corePts : 1;

    for (const c of recipe.components) {
      const r = evalComponent(c, groups[c.id], { comp, total, items });
      issues.push(...r.issues);
      if (r.ok && c.praise) praise.push(c.praise);
    }

    // amounts of supporting ingredients
    for (const a of recipe.amounts || []) {
      // `ings` lets either of several ingredients fill the role (maple syrup or honey)
      const g = a.ings ? sum(a.ings, (k) => comp[k] || 0) : comp[a.ing] || 0;
      const r = g / a.g;
      if (r < 0.35 && !a.lowOk && !a.optionalLow && a.low) issues.push({ pen: a.pts * (r < 0.1 ? 1 : 0.6) * (a.lowSoft ? 0.5 : 1), text: a.low });
      else if (r > 2.4 && a.high) issues.push({ pen: a.pts * (r > 4.5 ? 1.4 : 0.6), text: a.high });
    }

    // seasoning (relative to how the recipe tastes when made as written)
    const S = recipe.seasoning || {};
    for (const k in S) {
      const s = S[k];
      const r = (comp[k] || 0) / total / s.target;
      const P = s.pts;
      let pen = 0, text = null, low = false;
      if (k === 'salt') {
        if (r < 0.3) { pen = P; text = "It's bland — it really needs salt."; low = true; }
        else if (r < 0.6) { pen = P * 0.4; text = 'It could use a little more salt.'; low = true; }
        else if (r > 4.5) { pen = Math.max(45, P * 2.2); text = 'Blegh! This is unbelievably salty!'; }
        else if (r > 2.6) { pen = Math.max(20, P * 1.2); text = 'Way too salty!'; }
        else if (r > 1.7) { pen = P * 0.45; text = "It's a bit too salty."; }
      } else if (k === 'pepper') {
        if (r < 0.25) { pen = P * 0.6; text = 'A little black pepper would be nice.'; low = true; }
        else if (r > 7) { pen = P * 1.8; text = "So much pepper I can't stop sneezing!"; }
        else if (r > 3.5) { pen = P * 0.7; text = 'Very peppery.'; }
      } else if (k === 'chili') {
        if (r < 0.25) { pen = P * 0.6; text = 'It’s missing a little kick of chili.'; low = true; }
        else if (r > 6) { pen = P * 2.5; text = 'My mouth is ON FIRE! Way too much chili!'; }
        else if (r > 3) { pen = P * 0.8; text = 'Quite spicy — a bit much chili.'; }
      } else if (k === 'sugar') {
        if (r < 0.3) { pen = P * 0.6; text = 'It’s not sweet at all.'; low = true; }
        else if (r > 4) { pen = P * 1.6; text = 'Sickly sweet!'; }
        else if (r > 2.2) { pen = P * 0.6; text = 'A bit too sweet.'; }
      } else {
        // any other seasoning (e.g. cinnamon): the recipe supplies its own words
        if (r < 0.3) { pen = P * 0.6; text = s.low || null; low = true; }
        else if (r > 6) { pen = P * 2.5; text = s.veryHigh || s.high || null; }
        else if (r > 3) { pen = P * 0.7; text = s.high || null; }
      }
      if (low && s.lowOk) pen = 0;
      if (low && s.lowSoft) pen *= 0.5;
      if (pen > 0 && text) issues.push({ pen, text, season: k });
    }
    const salt = S.salt ? (comp.salt || 0) / total / S.salt.target : null;
    

    // unexpected ingredients
    const expected = new Set(['water', 'salt']);
    for (const c of recipe.components) { expected.add(c.ing); (c.uses || []).forEach((u) => expected.add(u)); }
    for (const a of recipe.amounts || []) (a.ings || [a.ing]).forEach((k) => expected.add(k));
    for (const k in S) expected.add(k);
    for (const k of recipe.allowed || []) expected.add(k);
    if (recipe.id === 'pancakes') ['flour', 'bakingpowder', 'sugar', 'egg', 'milk', 'syrup'].forEach((k) => expected.add(k));
    if (recipe.id === 'scrambled') expected.add('milk');
    if (recipe.id === 'soup') expected.add('tomato');
    const extras = [];
    for (const k in comp) {
      if (expected.has(k)) continue;
      const g = comp[k];
      const thr = STRONG[k] != null ? STRONG[k] : 2;
      if (g < thr) continue;
      const frac = g / total;
      let pen = MILD_EXTRA[k] != null ? MILD_EXTRA[k] : STRONG[k] != null ? 10 : 8;
      pen += Math.min(22, frac * 60);
      extras.push(k);
      issues.push({ pen, text: EXTRA_MSG[k] || `There's ${(CK.ING[k] && CK.ING[k].name) || k} in here? Odd.`, extra: k });
    }
    // free water
    const puddle = sum(items.filter((i) => i.kind === 'fluid' && CK.classify(i.comp) === 'water'), (i) => i.mass);
    if (puddle > 150) issues.push({ pen: 28, text: "It's swimming in water! Did you forget to drain it?" });
    else if (puddle > 20) issues.push({ pen: 8, text: `There’s a watery puddle ${cont.type === 'plate' ? 'on the plate' : 'in the ' + cont.def.name}.` });
    // praise the seasoning only if nothing about the flavour was off
    if (salt !== null && salt >= 0.6 && salt <= 1.7 && !issues.some((i) => i.season || (i.extra && STRONG[i.extra] != null))) praise.push('Seasoned just right.');

    // temperature
    if (recipe.hot !== false) {
      const food = items.filter((i) => i.kind !== 'powder' && i.kind !== 'fat');
      if (food.length) {
        const T = sum(food, (i) => i.temp * i.mass) / sum(food, (i) => i.mass);
        if (T < 32) issues.push({ pen: 14, text: 'It’s gone completely cold.' });
        else if (T < 45) issues.push({ pen: 6, text: 'It’s only lukewarm.' });
        res.temp = T;
      }
    }
    // vessel
    if (!recipe.serves.includes(cont.type)) {
      const V = {
        plate: [recipe.id === 'soup' ? 18 : 3, recipe.id === 'soup' ? 'Soup on a flat plate? It’s running everywhere!' : 'On a plate? Okay.'],
        soupbowl: [2, 'Served in a soup bowl — sure, why not.'],
        pan: [4, 'Straight from the pan! Rustic.'],
        saucepan: [4, 'You’re serving it in the saucepan?'],
        pot: [5, 'The whole pot? Okay…'],
        bowl: [3, 'In the mixing bowl? Fine, I guess.'],
      };
      const v = (recipe.vessel && recipe.vessel[cont.type]) || V[cont.type];
      if (v) issues.push({ pen: v[0], text: v[1], vessel: true });
    }

    let pen = sum(issues, (i) => i.pen);
    res.score = Math.round(CK.clamp(100 - pen, 0, 100));
    res.recog = recog;
    issues.sort((a, b) => b.pen - a.pen);

    const lines = [];
    if (recog < 0.5) {
      // Not the dish at all.
      res.score = Math.min(res.score, Math.round(4 + 22 * recog));
      lines.push({ text: `Hmm… I was expecting ${recipe.dish || recipe.title.toLowerCase()}.`, tone: 'bad' });
      lines.push({ text: `But this is ${res.description}.`, tone: 'bad' });
      const burnt = items.find((i) => Math.max(i.brownDown, i.brownUp) > 2.6 && i.kind !== 'fat');
      const raw = items.find((i) => i.kind === 'solid' && CK.ING[i.ing].cook && i.cook < 0.2 && !CK.ING[i.ing].herb);
      if (burnt) lines.push({ text: 'And it’s burnt.', tone: 'bad' });
      else if (raw && raw.ing === 'chicken') lines.push({ text: 'And that chicken is raw!', tone: 'bad' });
      const sideIssue = issues.find((i) => i.season || i.extra);
      if (sideIssue && lines.length < 4) lines.push({ text: sideIssue.text, tone: 'bad' });
    } else {
      for (const i of issues.slice(0, 4)) lines.push({ text: i.text, tone: i.pen >= 12 ? 'bad' : 'meh' });
      const np = res.score >= 75 ? 2 : res.score >= 45 ? 1 : 0;
      for (const p of praise.slice(0, np)) lines.push({ text: p, tone: 'good' });
      if (!lines.length) lines.push({ text: praise[0] || 'Mmm!', tone: 'good' });
    }
    res.lines = lines;
    return finish(res, false);
  };


  // Free cooking: no recipe, so the guest reacts to how well things are cooked and seasoned.
  CK.freeJudge = function (cont, dinerId) {
    const diner = CK.DINERS[dinerId];
    const items = cont ? cont.items.filter((i) => i.mass > 0.3) : [];
    const issues = [], praise = [];
    const res = { diner, issues, praise, recipe: null };
    if (!items.length) { res.score = 0; res.lines = [{ text: 'Um… there’s nothing here?', tone: 'bad' }]; return finish(res, true); }
    res.description = CK.describeContents(items);
    const comp = {};
    for (const it of items) addComp(comp, it.comp);
    const total = sum(Object.values(comp));
    for (const it of items) {
      const name = CK.itemName(it);
      const mx = Math.max(it.brownDown, it.brownUp);
      if (it.kind === 'fat') { if (it.brownDown > 2.2) issues.push({ pen: 12, text: 'Something tastes of burnt fat.' }); continue; }
      if (it.kind === 'powder') { if (it.mass > 5 && !(it.comp.parmesan > it.mass * 0.5)) issues.push({ pen: 10, text: `There's a pile of dry ${name} on it.` }); continue; }
      if (mx > 2.6) issues.push({ pen: 22, text: `The ${name} is burnt.` });
      else if (mx > 1.9) issues.push({ pen: 6, text: `The ${name} is quite dark.` });
      if (it.kind === 'solid') {
        const d = CK.ING[it.ing];
        if (it.ing === 'chicken' && it.cook < 0.95) issues.push({ pen: 45, text: 'The chicken is raw inside — that’s not safe!' });
        else if (it.ing === 'bacon' && it.cook < 0.5) issues.push({ pen: 25, text: 'Raw bacon? No thanks.' });
        else if (it.ing === 'egg' && it.form === 'cracked' && it.cook < 0.4) issues.push({ pen: 20, text: 'The egg is still raw and slimy.' });
        else if ((it.ing === 'potato' || it.ing === 'spaghetti' || it.ing === 'rice') && it.cook < 0.8) issues.push({ pen: 18, text: `The ${name} is still hard.` });
        else if (d.overcook && it.cook > d.overcook) issues.push({ pen: 8, text: `The ${name} is overcooked.` });
        else if (d.cook && it.cook > 0.7 && mx < 1.9 && it.mass > 20) praise.push(`The ${name} is nicely done.`);
      }
      if (it.kind === 'set' && it.cook < 0.6) issues.push({ pen: 15, text: `The ${name} is still runny inside.` });
      if (it.kind === 'fluid' && CK.classify(it.comp) === 'batter') issues.push({ pen: 25, text: 'That’s raw batter!' });
      if (it.kind === 'fluid' && CK.classify(it.comp) === 'eggs' && it.cook < 0.3) issues.push({ pen: 25, text: 'Raw eggs… in a puddle.' });
    }
    // only fat, powder or plain water isn't a dish
    const foodMass = sum(items.filter((i) => i.kind === 'solid' || i.kind === 'set' || (i.kind === 'fluid' && CK.classify(i.comp) !== 'water')), (i) => i.mass);
    if (foodMass < 15) issues.push({ pen: 70, text: 'That’s… not really food, is it?' });
    const salinity = CK.saltiness(comp, true);
    const savory = !((comp.sugar || 0) + (comp.syrup || 0) + (comp.honey || 0) + (comp.banana || 0) * 0.15 > total * 0.03);
    if (salinity > 0.025) issues.push({ pen: 35, text: 'Way, way too salty!' });
    else if (salinity > 0.015) issues.push({ pen: 12, text: 'It’s too salty.' });
    else if (savory && salinity < 0.002) issues.push({ pen: 10, text: 'It’s a bit bland — it needs salt.' });
    else if (savory) praise.push('Nicely seasoned.');
    if ((comp.chili || 0) / total > 0.004) issues.push({ pen: 15, text: 'So spicy!' });
    const puddle = sum(items.filter((i) => i.kind === 'fluid' && CK.classify(i.comp) === 'water'), (i) => i.mass);
    if (puddle > 40 && cont.type !== 'soupbowl') issues.push({ pen: 12, text: 'It’s sitting in water.' });
    const food = items.filter((i) => i.kind !== 'powder' && i.kind !== 'fat');
    if (food.length) {
      const T = sum(food, (i) => i.temp * i.mass) / sum(food, (i) => i.mass);
      const anyCooked = food.some((i) => i.cook > 0.3 || i.method);
      if (anyCooked && T < 32) issues.push({ pen: 10, text: 'It’s gone cold.' });
    }
    // the same complaint about two identical items only counts once
    const seen = new Set();
    for (let i = issues.length - 1; i >= 0; i--) { if (seen.has(issues[i].text)) issues.splice(i, 1); else seen.add(issues[i].text); }
    const uniq = [...new Set(praise)];
    praise.length = 0; praise.push(...uniq);
    issues.sort((a, b) => b.pen - a.pen);
    res.score = Math.round(CK.clamp(100 - sum(issues, (i) => i.pen), 0, 100));
    const lines = [{ text: `Ooh, so this is ${res.description}.`, tone: 'plain' }];
    for (const i of issues.slice(0, 3)) lines.push({ text: i.text, tone: i.pen >= 12 ? 'bad' : 'meh' });
    for (const p of praise.slice(0, issues.length ? 1 : 2)) lines.push({ text: p, tone: 'good' });
    res.lines = lines;
    return finish(res, false);
  };

  function finish(res, empty) {
    const s = res.score;
    res.stars = s >= 85 ? 3 : s >= 65 ? 2 : s >= 40 ? 1 : 0;
    res.mood = s >= 85 ? 'great' : s >= 65 ? 'good' : s >= 40 ? 'ok' : 'bad';
    const d = res.diner;
    const r = Math.random();
    res.opening = empty ? CK.pick(d.hello, r) : CK.pick(d.hello, r);
    res.verdict = CK.pick(d[res.mood], Math.random());
    return res;
  }
})();
