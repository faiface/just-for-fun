// Menus, recipe card, verdict screen, saved scores.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const $ = (id) => document.getElementById(id);
  const KEY = 'pinch-of-salt-v1';

  const Store = {
    data: { scores: {} },
    load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.scores) this.data = s; } catch (e) { /* private mode etc. */ } },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
    get(id) { return this.data.scores[id] || null; },
    record(id, score, stars) {
      const prev = this.get(id);
      const better = !prev || score > prev.best;
      if (better) this.data.scores[id] = { best: score, stars };
      this.save();
      return { better, prev };
    },
  };
  CK.Store = Store;
  Store.load();

  let kitchen = null;
  let recipe = null; // null = free cooking
  let cuisineId = CK.CUISINE[Store.data.cuisine] ? Store.data.cuisine : CK.CUISINES[0].id;
  let freeDiner = 'mila';
  let dinerAnim = null;

  function starsText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

  function portrait(canvas, dinerId, mood, t) {
    const ctx = canvas.getContext('2d');
    const d = CK.DINERS[dinerId];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / 260;
    CK.D.diner(ctx, d, mood || 'neutral', canvas.width / 2, canvas.height * 0.44, s * 1.25, t || 0);
  }

  // ------------------------------------------------------------ menu
  function progress(cid) {
    const rs = CK.recipesFor(cid);
    let got = 0;
    for (const r of rs) { const sc = Store.get(r.id); if (sc) got += sc.stars; }
    return { got, max: rs.length * 3, n: rs.length };
  }
  const WORLD_ICON = { classics: '🍳', ukrainian: '🌻' };
  function buildTabs() {
    const el = $('cuisines');
    el.innerHTML = '';
    for (const cu of CK.CUISINES) {
      const b = document.createElement('button');
      b.className = 'world-pill ' + cu.id + (cu.id === cuisineId ? ' on' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', cu.id === cuisineId ? 'true' : 'false');
      const pr = progress(cu.id);
      b.innerHTML = `<span class="wp-icon">${WORLD_ICON[cu.id] || '🍽️'}</span><span class="wp-name"></span><span class="wp-stars">★ ${pr.got}/${pr.max}</span>`;
      b.querySelector('.wp-name').textContent = cu.name;
      b.addEventListener('click', () => {
        if (cuisineId === cu.id) return;
        cuisineId = cu.id;
        Store.data.cuisine = cu.id; Store.save();
        buildMenu(true);
      });
      el.appendChild(b);
    }
    // the banner of the world you're in
    const cu = CK.CUISINE[cuisineId];
    const pr = progress(cuisineId);
    const cooked = CK.recipesFor(cuisineId).filter((r) => Store.get(r.id)).length;
    const world = $('world');
    world.className = 'world ' + cu.id;
    const ban = $('worldBanner');
    ban.innerHTML = `<div class="wb-icon">${WORLD_ICON[cu.id] || '🍽️'}</div>
      <div class="wb-text"><div class="wb-title"><span class="wb-name"></span><span class="wb-sub"></span></div><div class="wb-tag"></div></div>
      <div class="wb-prog"><div class="wb-stars">★ ${pr.got} <small>/ ${pr.max}</small></div>
        <div class="wb-bar"><i style="width:${pr.max ? Math.round((pr.got / pr.max) * 100) : 0}%"></i></div>
        <div class="wb-count">${pr.n ? `${cooked} of ${pr.n} recipes cooked` : 'free cooking only'}</div></div>`;
    ban.querySelector('.wb-name').textContent = cu.name;
    ban.querySelector('.wb-sub').textContent = cu.subtitle || '';
    ban.querySelector('.wb-tag').textContent = cu.tagline;
  }
  function buildMenu(switched) {
    buildTabs();
    if (switched) { const w = $('world'); w.classList.remove('enter'); void w.offsetWidth; w.classList.add('enter'); }
    const el = $('levels');
    el.innerHTML = '';
    const list = CK.recipesFor(cuisineId);
    list.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'level';
      const sc = Store.get(r.id);
      const st = sc ? sc.stars : 0;
      b.innerHTML = `<div class="num">Recipe ${i + 1}</div><div class="title"></div><div class="blurb"></div>
        <div class="foot"><div class="who"><canvas width="80" height="80"></canvas><span></span></div>
        <div><div class="st"><b>${'★'.repeat(st)}</b>${'★'.repeat(3 - st)}</div><div class="sc">${sc ? 'best ' + sc.best : 'not cooked yet'}</div></div></div>`;
      b.querySelector('.title').textContent = r.title;
      b.querySelector('.blurb').textContent = r.blurb;
      b.querySelector('.who span').textContent = 'for ' + CK.DINERS[r.diner].name;
      portrait(b.querySelector('canvas'), r.diner, st >= 2 ? 'good' : 'neutral');
      b.addEventListener('click', () => startLevel(r));
      el.appendChild(b);
    });
    const cu = CK.CUISINE[cuisineId];
    const f = document.createElement('button');
    f.className = 'level free';
    f.innerHTML = `<div class="num">Sandbox</div><div class="title">Free Cooking</div><div class="blurb"></div><div class="foot"><div class="who"><canvas width="80" height="80"></canvas><span>for a friend</span></div></div>`;
    f.querySelector('.blurb').textContent = cuisineId === 'classics'
      ? 'No recipe — cook whatever you like and serve it to a friend for an honest opinion.'
      : `No recipe — the kitchen is stocked with ${cu.name.split(' ')[0]} staples. Cook whatever you like and serve it to a friend.`;
    portrait(f.querySelector('canvas'), 'mila', 'good');
    f.addEventListener('click', () => startLevel(null));
    el.appendChild(f);
    if (!list.length) {
      const n = document.createElement('div');
      n.className = 'level soon';
      n.innerHTML = '<div class="num">Coming soon</div><div class="title">Recipes are on their way</div><div class="blurb">Grandma is still writing them down. Meanwhile the kitchen is open for free cooking.</div>';
      el.appendChild(n);
    }
    updateSoundButtons();
  }

  function show(id) {
    for (const s of ['menu', 'game']) $(s).classList.toggle('hidden', s !== id);
  }

  // ------------------------------------------------------------ game
  function startLevel(r) {
    recipe = r;
    if (r) cuisineId = r.cuisine || 'classics';
    show('game');
    if (!kitchen) {
      kitchen = new CK.Kitchen($('cv'), { onServe: serve });
      CK.kitchen = kitchen;
    }
    kitchen._resize();
    kitchen.setCuisine(cuisineId);
    kitchen.reset();
    kitchen.paused = false;
    setSpeed(1);
    if (!r) freeDiner = CK.pick(Object.keys(CK.DINERS));
    const dinerId = r ? r.diner : freeDiner;
    $('dinerName').textContent = CK.DINERS[dinerId].name;
    const sc = r && Store.get(r.id);
    $('bestLine').textContent = r ? (sc ? `Best: ${sc.best}/100 ${starsText(sc.stars)}` : 'First time cooking this') : 'Free cooking';
    portrait($('dinerMini'), dinerId, 'neutral');
    const cu = CK.CUISINE[cuisineId];
    $('cuisineLine').textContent = cu.name + (cu.subtitle ? ' · ' + cu.subtitle : '');
    $('side').dataset.cuisine = cu.id;
    renderRecipe(r);
    if (!Store.data.seenHelp) { Store.data.seenHelp = true; Store.save(); openHelp(); }
  }

  function renderRecipe(r) {
    const el = $('recipeCard');
    el.innerHTML = '';
    const h = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; el.appendChild(e); return e; };
    if (!r) {
      h('h2', 'Free Cooking');
      h('p', cuisineId === 'classics' ? 'Your friend is hungry and open-minded. Cook anything — eggs, pasta, a soup, something weird — and they’ll tell you what they think.' : 'Your friend is hungry and open-minded. Cook anything — a soup, a kasha, something fried, something weird — and they’ll tell you what they think.', 'blurb');
      h('h3', 'Ideas');
      const ul = h('ul', null, 'free-tips');
      for (const s of CK.CUISINE[cuisineId].theme.ideas || []) { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); }
      h('p', '💡 The tasting spoon tells you how things taste before you serve them.', 'hint');
      return;
    }
    h('h2', r.title);
    h('p', r.blurb, 'blurb');
    h('h3', 'Ingredients');
    const ul = h('ul');
    for (const s of r.ingredients) { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); }
    h('h3', 'Method');
    const ol = h('ol');
    for (const s of r.steps) { const li = document.createElement('li'); li.textContent = s; ol.appendChild(li); }
    if (r.hint) h('p', '💡 ' + r.hint, 'hint');
  }

  function setSpeed(v) {
    if (kitchen) kitchen.world.speed = v;
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === v));
  }

  // ------------------------------------------------------------ serving
  function serve(cont) {
    kitchen.paused = true;
    const res = recipe ? CK.judge(recipe, cont) : CK.freeJudge(cont, freeDiner);
    const dinerId = recipe ? recipe.diner : freeDiner;
    const d = CK.DINERS[dinerId];
    $('verdict').classList.remove('hidden');
    $('result').classList.add('hidden');
    $('verdictName').textContent = d.name;
    $('verdictTitle').textContent = recipe ? recipe.title : 'Free cooking';
    const talk = $('talk');
    talk.innerHTML = '';
    let mood = 'neutral';
    const start = performance.now();
    if (dinerAnim) cancelAnimationFrame(dinerAnim);
    const anim = () => { portrait($('dinerBig'), dinerId, mood, (performance.now() - start) / 1000); dinerAnim = requestAnimationFrame(anim); };
    anim();
    const lines = [];
    lines.push({ text: res.opening, tone: 'plain', mood: 'neutral' });
    if (res.score > 0 || cont.items.length) lines.push({ text: '*takes a bite*', tone: 'action', mood: 'chew' });
    for (const l of res.lines) lines.push({ text: l.text, tone: l.tone, mood: res.mood === 'great' ? 'good' : res.mood === 'bad' ? 'bad' : 'ok' });
    lines.push({ text: res.verdict, tone: res.mood === 'great' || res.mood === 'good' ? 'good' : res.mood === 'ok' ? 'meh' : 'bad', mood: res.mood });
    let i = 0;
    const next = () => {
      if (i >= lines.length) return finish(res);
      const l = lines[i++];
      mood = l.mood;
      const p = document.createElement('div');
      p.className = 'say ' + l.tone;
      p.textContent = l.text;
      talk.appendChild(p);
      p.scrollIntoView({ block: 'nearest' });
      setTimeout(next, l.tone === 'action' ? 1100 : 900 + Math.min(1200, l.text.length * 18));
    };
    setTimeout(next, 300);
  }

  function finish(res) {
    const r = recipe;
    $('result').classList.remove('hidden');
    const starsEl = $('stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i < res.stars) { s.className = 'on'; s.style.animationDelay = i * 0.25 + 's'; setTimeout(() => CK.Audio.play('star'), i * 250); }
      starsEl.appendChild(s);
    }
    const num = $('scoreNum');
    let v = 0;
    const tick = () => { v = Math.min(res.score, v + Math.max(1, Math.round(res.score / 30))); num.textContent = v; if (v < res.score) { CK.Audio.play('score'); setTimeout(tick, 25); } };
    num.textContent = '0';
    tick();
    if (res.stars >= 2) setTimeout(() => CK.Audio.play('yay'), 700); else if (res.stars === 0) setTimeout(() => CK.Audio.play('sad'), 500);
    let note = '';
    if (r) {
      const rec = Store.record(r.id, res.score, res.stars);
      if (rec.better && rec.prev) note = `New best! (was ${rec.prev.best})`;
      else if (rec.better) note = 'Score saved.';
      else note = `Your best is ${rec.prev.best}.`;
    } else note = 'Free cooking — just for fun.';
    $('bestNote').textContent = note;
    const body = $('detailBody');
    body.innerHTML = '';
    const p0 = document.createElement('p');
    p0.textContent = 'You served: ' + (res.description || 'nothing') + '.';
    body.appendChild(p0);
    for (const it of res.issues) {
      const p = document.createElement('p');
      p.textContent = it.text;
      const s = document.createElement('span');
      s.className = 'pen';
      s.textContent = '−' + Math.round(it.pen);
      p.appendChild(s);
      body.appendChild(p);
    }
    if (!res.issues.length) { const p = document.createElement('p'); p.textContent = 'Nothing to complain about!'; body.appendChild(p); }
    const same = r ? CK.recipesFor(r.cuisine || 'classics') : [];
    const idx = r ? same.indexOf(r) : -1;
    $('nextBtn').classList.toggle('hidden', !r || idx >= same.length - 1);
  }

  function closeVerdict() {
    $('verdict').classList.add('hidden');
    if (dinerAnim) cancelAnimationFrame(dinerAnim);
    dinerAnim = null;
  }

  function openHelp() { $('help').classList.remove('hidden'); if (kitchen) kitchen.paused = true; }
  function closeHelp() {
    $('help').classList.add('hidden');
    if (kitchen && !$('game').classList.contains('hidden') && $('verdict').classList.contains('hidden')) kitchen.paused = false;
  }

  function updateSoundButtons() {
    const t = CK.Audio.muted ? 'Sound: off' : 'Sound: on';
    if ($('soundBtn')) $('soundBtn').textContent = CK.Audio.muted ? 'Sound off' : 'Sound on';
    if ($('soundBtnMenu')) $('soundBtnMenu').textContent = t;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-speed]');
    if (!b) return;
    if (b.dataset.speed) { setSpeed(Number(b.dataset.speed)); return; }
    const a = b.dataset.act;
    if (a === 'help') openHelp();
    else if (a === 'closeHelp') closeHelp();
    else if (a === 'sound') { CK.Audio.unlock(); CK.Audio.setMuted(!CK.Audio.muted); updateSoundButtons(); }
    else if (a === 'restart') { kitchen.reset(); setSpeed(1); }
    else if (a === 'menu') { closeVerdict(); if (kitchen) kitchen.paused = true; buildMenu(); show('menu'); }
    else if (a === 'retry') { closeVerdict(); startLevel(recipe); }
    else if (a === 'next') { closeVerdict(); const same = CK.recipesFor(recipe.cuisine || 'classics'); startLevel(same[same.indexOf(recipe) + 1]); }
    else if (a === 'resetScores') { if (confirm('Forget all your scores?')) { Store.data.scores = {}; Store.save(); buildMenu(); } }
  });
  document.addEventListener('pointerdown', () => CK.Audio.unlock(), { once: true });

  buildMenu();
  show('menu');
})();
