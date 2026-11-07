// Levels: a recipe (written like a real one), who you're cooking for, and what the finished dish
// should be like. The judge compares the served dish against `components`, `amounts` and
// `seasoning` — it never looks at which steps you took.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;
  const { sum } = CK;

  const clsOf = (it) => (it.kind === 'set' ? it.cls : it.kind === 'fluid' ? CK.classify(it.comp) : null);
  const M = {
    ing: (...ids) => (it) => it.kind === 'solid' && ids.includes(it.ing),
    egg: (it) => (it.kind === 'solid' && it.ing === 'egg') || ((it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'eggs'),
    batter: (it) => (it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'batter',
    tomato: (it) => it.kind === 'fluid' && clsOf(it) === 'tomato',
    // Ukrainian kitchen
    curd: (it) => (it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'curd',
    potatoBatter: (it) => (it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'potato',
    beetBroth: (it) => it.kind === 'fluid' && !it.lump && clsOf(it) === 'beet',
    broth: (it) => it.kind === 'fluid' && !it.lump && ['water', 'beet', 'cream', 'mixture'].includes(clsOf(it)),
  };
  // Pieces fried (or boiled) from ladled dollops: syrnyky, deruny, lazy varenyky, mlyntsi.
  // One pan-sized slab instead of dollops, or raw dough, gets its own complaint.
  function dollopIssues(items, o) {
    const out = [];
    const raw = items.filter((i) => i.kind === 'fluid');
    if (raw.length) out.push({ pen: 30, text: o.raw });
    const big = items.filter((i) => i.kind === 'set' && i.mass > o.maxG && i.form !== 'scrambled');
    if (big.length && o.giant) out.push({ pen: big.some((i) => i.mass > o.maxG * 2) ? 22 : 12, text: o.giant });
    const set = items.filter((i) => i.kind === 'set');
    if (o.method && set.length && set.filter((i) => i.method && i.method !== o.method).length > set.length / 2) out.push({ pen: o.wrongPen || 25, text: o.wrongMethod });
    return out;
  }
  CK.MATCH = M;

  // form key used by recipes: solids -> form, mixtures -> 'fluid' | 'set' | 'scrambled'
  CK.formKey = (it) => (it.kind === 'solid' ? it.form : it.kind === 'set' ? it.form : it.kind);

  CK.DINERS = {
    otto: {
      name: 'Grandpa Otto', look: { skin: '#f1c9a5', hair: '#e8e4dc', hairStyle: 'bald', mustache: true, glasses: true, shirt: '#7c9a6e' },
      hello: ['Ah, something smells good in here!', 'Let me get my napkin ready…', "I've been looking forward to this all day."],
      great: ['Wonderful. Just the way I like it.', 'Now that is proper cooking. Thank you, dear.'],
      good: ['Very nice indeed. A few little things, but I enjoyed it.', "That hit the spot. You're getting the hang of it."],
      ok: ["It's… fine. I'll eat it.", 'Not bad, not great. Keep practising.'],
      bad: ["Oh dear. I don't think I can finish this.", "Well… it's the thought that counts."],
    },
    mila: {
      name: 'Mila', look: { skin: '#c99a76', hair: '#3b2a24', hairStyle: 'bun', shirt: '#e0876a' },
      hello: ['Ooh, is it ready?! I am starving.', 'Finally! Gimme gimme.', "Okay, I'm sitting, I'm ready."],
      great: ['This is SO good. Can you make it every day?', 'Honestly? Restaurant level. I love it.'],
      good: ["Really tasty! Just a couple of nitpicks.", 'Yum! Nearly perfect.'],
      ok: ["It's okay! Not your best, but I'll eat it.", "Hmm, it's alright."],
      bad: ["Uh… I'll just order something, I think.", "I love you, but no."],
    },
    theo: {
      name: 'Theo', look: { skin: '#f3d2b4', hair: '#c4733a', hairStyle: 'messy', freckles: true, shirt: '#5b8fc7', kid: true },
      hello: ["Is it ready? Is it? Is it?", 'My tummy is making noises.', "Okay I'll try it. But only one bite."],
      great: ['That was AWESOME. Can I have seconds?', 'Best thing ever. Ten out of ten!'],
      good: ["Pretty good! I ate almost all of it.", "Yummy. Mostly."],
      ok: ["It's kinda weird but okay.", "Meh. My mum makes it better."],
      bad: ['Ewww. No thank you.', "I'm not eating that. Nope."],
    },
    ines: {
      name: 'Inès', look: { skin: '#8d5b43', hair: '#1f1a1a', hairStyle: 'long', earrings: true, shirt: '#9a7fc4' },
      hello: ["Let's see what you've made.", 'Presentation first… okay. Now the taste.', "I've been hearing good things."],
      great: ['Beautifully done. I have nothing to add.', 'Chef’s kiss. Truly.'],
      good: ['Lovely. A couple of details to polish.', "Good work — close to excellent."],
      ok: ['Edible, but it needs work.', 'The idea is there. The execution, less so.'],
      bad: ["I'm sorry, this didn't work at all.", "Let's… start again from the top."],
    },
    rosa: {
      name: 'Aunt Rosa', look: { skin: '#e8b996', hair: '#8f8a84', hairStyle: 'bun', glasses: true, earrings: true, shirt: '#c25a74' },
      hello: ['Don’t mind me, sweetheart, I’m only here to eat.', 'It smells like my mother’s kitchen in here.', "Let's see what you've learned."],
      great: ['Perfect. Just how I would have made it.', 'Bravo, sweetheart. That is real cooking.'],
      good: ['Very good! A little tweak here and there and it’s perfect.', 'Lovely. I’d happily have that again.'],
      ok: ["It's alright, sweetheart. Try again?", "It's edible. Let's call it practice."],
      bad: ['Oh, sweetheart… no.', "Let's not tell anyone about this one."],
    },
    kofi: {
      name: 'Kofi', look: { skin: '#7a4a33', hair: '#1c1514', hairStyle: 'messy', shirt: '#e0a43a' },
      hello: ['I skipped lunch for this. No pressure!', 'Smells amazing. What are we having?', 'Big appetite today — I hope there’s plenty.'],
      great: ['Oh, that is the real deal. Clean plate!', 'Best thing I’ve eaten all week.'],
      good: ['Really good! Just a couple of small things.', "Solid. I'd order that again."],
      ok: ['It filled me up, at least.', 'Hmm. Decent, not amazing.'],
      bad: ["Yeah… I think I'll grab a sandwich.", "Sorry, friend, I can't eat this."],
    },
    // ---- Ukrainian kitchen
    halyna: {
      name: 'Babusia Halyna', look: { skin: '#efc7a8', hair: '#dedad3', hairStyle: 'bun', glasses: true, earrings: true, shirt: '#b8322f' },
      hello: ['Well, let’s see what you’ve cooked for your babusia.', 'Sit down, I’m tasting. Ну, давай.', 'I’ve made this a thousand times, so don’t you dare cut corners.'],
      great: ['Ой, смачно! That is exactly how my mother made it.', 'Золоті руки — golden hands! I’ll write you into my recipe book.'],
      good: ['Good, good. A little more care and it will be just like mine.', 'Not bad at all, дитино. Next time, listen to your babusia.'],
      ok: ['Hmm. Edible. We will practise together.', 'It’s food, but it isn’t my recipe.'],
      bad: ['Ой лишенько! Who taught you to cook like this?', 'No, no, no. Give me that spoon.'],
    },
    taras: {
      name: 'Taras', look: { skin: '#e2a982', hair: '#4a2f1d', hairStyle: 'bald', mustache: true, shirt: '#2f5d8a' },
      hello: ['Is it ready? A Cossack never says no to a full plate!', 'I could smell this from the yard. Давай!', 'Bring it on — I brought my big spoon.'],
      great: ['Смачно! I could eat this every day and twice on Sundays.', 'Ох, now that’s the stuff. Clean plate — see?'],
      good: ['Good! Very good. A couple of small things, but I’m not complaining.', 'Tasty! I’ll have seconds anyway.'],
      ok: ['Well, it fills a Cossack’s belly. Mostly.', 'Hmm. I’ve had better, I’ve had worse.'],
      bad: ['Brother… even my dog would think twice.', 'Ой. Let’s agree we never speak of this.'],
    },
    solomiia: {
      name: 'Solomiia', look: { skin: '#f4d6bf', hair: '#8a5530', hairStyle: 'long', freckles: true, earrings: true, shirt: '#e8b923' },
      hello: ['I haven’t had a home-cooked meal since I left for uni…', 'Is it really like Mum’s? Let me see!', 'My dorm kitchen has one hotplate. This smells like home.'],
      great: ['It tastes like home. Дякую — I could cry.', 'Exactly like Mum’s! I’m calling her right now to tell her.'],
      good: ['So good! Almost like Mum’s — almost.', 'Mmm, дякую! Just a tiny thing or two.'],
      ok: ['It’s okay… still better than instant noodles.', 'Not quite Mum’s, but thank you for trying.'],
      bad: ['Um… I think I’ll stick to instant noodles.', 'Ой… Mum would not approve.'],
    },
  };

  CK.RECIPES = [
    // ------------------------------------------------------------------ 1
    {
      id: 'fried-egg',
      cuisine: 'classics',
      title: 'Sunny-Side Up Egg',
      diner: 'otto',
      blurb: 'One perfect fried egg: set white, runny golden yolk.',
      serves: ['plate'],
      ingredients: ['1 egg', '1 tsp butter (5 g)', 'a pinch of salt', 'a pinch of black pepper'],
      steps: [
        'Set a frying pan over medium-low heat and add the butter. Let it melt and foam gently.',
        'Crack the egg into the pan. Cook it without moving it for about 3 minutes, until the white is completely set but the yolk is still runny. Don’t flip it.',
        'Sprinkle with a pinch of salt and pepper, slide it onto a plate and serve straight away.',
      ],
      hint: 'Drag the frying pan from the wall onto a burner. Click the fridge to open it, drag an egg into the pan, then click the egg to crack it.',
      components: [
        {
          id: 'egg', label: 'fried egg', missing: 'Where is the egg?', ing: 'egg', pts: 60, core: true, match: M.egg,
          count: { n: 1, few: 'Where is the egg?', many: 'More than one egg? Generous, but I only wanted one.' },
          forms: {
            ok: ['cracked'],
            bad: {
              whole: [0.85, 'The egg is still in its shell! I wanted it fried.'],
              peeled: [0.6, "That's a boiled egg, not a fried one."],
              fluid: [0.5, 'The yolk is broken — this is more like scrambled egg.'],
              scrambled: [0.5, "This is scrambled, I wanted it sunny-side up."],
              set: [0.45, "That's an omelette, not a fried egg."],
            },
          },
          cook: {
            range: [0.75, 1.5], soft: [0.5, 1.95],
            low: "The white's still a bit runny on top.", veryLow: "It's raw! The white is all slimy.",
            high: "The yolk's gone a bit firm — I like it runny.", veryHigh: 'The yolk is cooked hard all the way through.',
          },
          brown: {
            side: 'down', range: [0, 1.6], soft: [0, 2.4],
            high: 'The bottom is a bit too crispy for me.', veryHigh: 'The bottom of the egg is burnt.',
          },
          custom(items) {
            const out = [];
            const it = items[0];
            if (it && it.form === 'cracked' && it.flips > 0) out.push({ pen: 10, text: 'You flipped it! I asked for sunny-side up.' });
            if (it && it.form === 'cracked' && it.method === 'poached') out.push({ pen: 18, text: "This was poached in water, not fried." });
            return out;
          },
          praise: 'The yolk is perfectly runny and the white is set. Lovely.',
        },
      ],
      amounts: [
        { ing: 'butter', g: 5, pts: 8, low: 'It could use a little butter.', high: 'Quite greasy — that was a lot of butter.', optionalLow: true },
      ],
      seasoning: {
        salt: { target: 0.0072, pts: 16 },
        pepper: { target: 0.0027, pts: 6 },
      },
      allowed: ['oil'],
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'scrambled',
      cuisine: 'classics',
      title: 'Creamy Scrambled Eggs',
      diner: 'theo',
      blurb: 'Soft, glossy scrambled eggs — no brown bits!',
      serves: ['plate'],
      ingredients: ['2 eggs', '1 tbsp milk (15 ml)', '2 tsp butter (10 g)', 'a pinch of salt', 'a pinch of black pepper'],
      steps: [
        'Crack the eggs into a bowl, add the milk and the salt, and whisk until smooth and evenly yellow.',
        'Melt the butter in a frying pan over medium-low heat.',
        'Pour in the eggs. Stir gently and constantly with a spatula as they begin to set.',
        'When they are just set but still soft and glossy — about 2 minutes — take them off the heat, season with pepper and serve.',
      ],
      hint: 'Pick up the whisk from the utensil pot and hold the mouse button on the bowl to whisk.',
      components: [
        {
          id: 'eggs', label: 'scrambled eggs', missing: 'Where are the eggs?', ing: 'egg', pts: 60, core: true, match: M.egg,
          grams: { g: 100, ing: 'egg', few: 'Is that all? I thought there were two eggs.', many: 'Whoa, that is a mountain of eggs.' },
          forms: {
            ok: ['scrambled'],
            bad: {
              set: [0.4, "This is an omelette, not scrambled eggs. You've got to stir them!"],
              cracked: [0.45, "That's a fried egg — I wanted scrambled."],
              whole: [0.85, 'The eggs are still in their shells!'],
              peeled: [0.6, 'Boiled eggs? I wanted scrambled.'],
              fluid: [0.0, ''],
            },
          },
          cook: {
            range: [0.55, 1.35], soft: [0.35, 1.9],
            low: "They're a little too runny.", veryLow: "The eggs are raw! That's just goo.",
            high: "They're a bit dry and firm.", veryHigh: 'Dry and rubbery. Squeaky eggs!',
          },
          brown: { side: 'max', range: [0, 0.8], soft: [0, 1.6], high: 'There are brown bits in my eggs.', veryHigh: 'These are burnt!' },
          custom(items) {
            const out = [];
            const it = items.find((i) => i.kind === 'set' || i.kind === 'fluid');
            if (it && it.smooth < 0.5 && it.form === 'scrambled') out.push({ pen: 6, text: 'Some bits are white and some are yellow — streaky.' });
            return out;
          },
          praise: 'So soft and creamy!',
        },
      ],
      amounts: [
        { ing: 'butter', g: 10, pts: 6, low: 'They could be a bit richer — more butter?', high: 'Very buttery. Like, very.' },
        { ing: 'milk', g: 15, pts: 6, low: null, high: 'They taste a bit watery and milky.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0033, pts: 14 },
        pepper: { target: 0.0012, pts: 4 },
      },
      allowed: ['oil'],
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'pancakes',
      cuisine: 'classics',
      title: 'Fluffy Pancakes',
      diner: 'ines',
      blurb: 'Two golden pancakes with maple syrup.',
      serves: ['plate'],
      ingredients: ['100 g flour', '1 tsp baking powder (4 g)', '1 tbsp sugar (12 g)', 'a pinch of salt', '1 egg', '150 ml milk', '2 tsp butter (10 g), for the pan', '1 tbsp maple syrup (20 g), to serve'],
      steps: [
        'In a mixing bowl, combine the flour, baking powder, sugar and salt. Add the egg and the milk and whisk until smooth.',
        'Heat a frying pan over medium heat and melt half of the butter in it.',
        'Pour in half of the batter. Cook for about 2 minutes, until bubbles appear on top and the underside is golden, then flip and cook for 1–2 minutes more.',
        'Repeat with the rest of the butter and batter. Stack the pancakes on a plate and drizzle with maple syrup.',
      ],
      hint: 'Hold a container over another to pour gradually — let go when you have poured enough.',
      components: [
        {
          id: 'pancake', label: 'pancakes', missing: 'Where are the pancakes?', ing: 'flour', pts: 60, core: true, match: M.batter,
          count: { n: 2, few: 'Only one pancake? The recipe makes two.', many: 'So many little pancakes!', fewPen: 0.12, manyPen: 0.06 },
          forms: {
            ok: ['set'],
            bad: { scrambled: [0.45, 'The pancakes are all torn up into bits.'], fluid: [0.0, ''] },
          },
          cook: {
            range: [0.8, 2.6], soft: [0.6, 3.2],
            low: 'A bit gooey in the middle.', veryLow: 'This is raw batter in the middle!',
            high: 'A little dry.', veryHigh: 'Dry as cardboard.',
          },
          brown: {
            side: 'both', range: [0.55, 1.85], soft: [0.3, 2.5],
            low: 'They are quite pale.', veryLow: 'Pale and floppy, no colour at all.',
            high: 'They are a bit too dark.', veryHigh: 'Burnt pancakes!',
            oneSide: "One side is pale — they weren't flipped properly.",
          },
          custom(items) {
            const out = [];
            const comp = {};
            for (const it of items) CK.addComp(comp, it.comp);
            const flour = comp.flour || 0;
            if (flour < 1) return out;
            const liquid = (comp.milk || 0) + (comp.egg || 0) + (comp.water || 0);
            const r = liquid / flour;
            if (r < 1.3) out.push({ pen: r < 0.9 ? 18 : 9, text: 'Very thick and dense — the batter needed more liquid.' });
            else if (r > 3.0) out.push({ pen: r > 4 ? 16 : 8, text: 'These are thin and floppy, more like crêpes.' });
            const bp = (comp.bakingpowder || 0) / flour;
            if (bp < 0.01) out.push({ pen: 16, text: 'Flat as a coaster — no baking powder?' });
            else if (bp > 0.09) out.push({ pen: bp > 0.15 ? 14 : 7, text: 'There is a bitter, soapy taste — too much baking powder.' });
            if (!comp.egg) out.push({ pen: 6, text: 'They fall apart a bit — was there no egg?' });
            const sug = ((comp.sugar || 0)) / flour;
            if (sug > 0.4) out.push({ pen: sug > 0.7 ? 12 : 6, text: 'The batter itself is very sugary.' });
            const lumpy = items.filter((i) => i.smooth < 0.5).length;
            if (lumpy) out.push({ pen: 10, text: 'There are pockets of dry flour — lumpy batter.' });
            return out;
          },
          praise: 'Fluffy, golden, beautiful.',
        },
      ],
      amounts: [
        { ing: 'butter', g: 10, pts: 6, low: null, high: 'Greasy — they were swimming in butter.', lowOk: true },
        { ing: 'syrup', g: 20, pts: 8, low: 'Where is the maple syrup?', high: 'Drowning in syrup!' },
      ],
      seasoning: {
        salt: { target: 0.0011, pts: 5, lowOk: true },
        sugar: { target: 0.035, pts: 8, lowSoft: true },
      },
      allowed: ['oil'],
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'aglio',
      cuisine: 'classics',
      title: 'Spaghetti Aglio e Olio',
      diner: 'otto',
      blurb: 'Spaghetti with golden garlic, chili, olive oil and parsley.',
      serves: ['plate'],
      ingredients: ['100 g spaghetti', '1 tbsp salt (about 18 g), for the pasta water', '3 tbsp olive oil (40 ml)', '3 garlic cloves, thinly sliced', 'a pinch of chili flakes', 'a small bunch of parsley, chopped', 'about 1.5 litres of water'],
      steps: [
        'Bring a large pot with about 1.5 litres of water to a boil. Add the salt, then the spaghetti, and cook for about 8 minutes.',
        'Meanwhile, put the olive oil and the garlic in a frying pan over medium-low heat. Cook gently, stirring, until the garlic is pale golden — 1 to 2 minutes. Don’t let it go brown. Add the chili flakes and turn off the heat.',
        'Drain the spaghetti and add it to the pan. Toss over low heat for a minute so the pasta soaks up the garlicky oil.',
        'Toss in the chopped parsley and serve.',
      ],
      hint: 'To drain, hold the pot over the sink — the water pours out, the pasta stays in.',
      components: [
        {
          id: 'pasta', label: 'spaghetti', missing: 'Where is the spaghetti?', ing: 'spaghetti', pts: 45, core: true, match: M.ing('spaghetti'),
          grams: { g: 100, ing: 'spaghetti', few: 'That is a tiny portion of pasta.', many: 'That is a LOT of pasta.' },
          forms: { ok: ['strands', 'broken'] },
          cook: {
            range: [0.88, 1.38], soft: [0.7, 1.75],
            low: 'The pasta is a bit too firm in the middle.', veryLow: 'The spaghetti is crunchy — undercooked!',
            high: 'The pasta is a bit soft.', veryHigh: 'Mushy, overcooked pasta.',
          },
          brown: { side: 'max', range: [0, 0.9], soft: [0, 1.8], high: 'Some of the pasta got crispy and brown.', veryHigh: 'Burnt pasta stuck to it.' },
          praise: 'The pasta is perfectly al dente.',
        },
        {
          id: 'garlic', label: 'garlic', ing: 'garlic', pts: 25, missing: 'Where is the garlic? It’s the whole point!', core: true, match: M.ing('garlic'),
          grams: { g: 15, ing: 'garlic', few: 'I can barely taste any garlic.', many: 'Whoa, that is a lot of garlic.' },
          forms: { ok: ['sliced'], bad: { minced: [0.12, 'The garlic was minced rather than sliced — fine, but different.'], chopped: [0.1, 'Chopped garlic instead of slices — that works too.'], clove: [0.5, 'Whole garlic cloves? They should be sliced thin.'] } },
          cook: { range: [0.3, 99], soft: [0.1, 99], low: 'The garlic tastes a bit raw and harsh.', veryLow: 'The garlic is completely raw.' },
          brown: { side: 'max', range: [0.25, 1.6], soft: [0.08, 2.3], low: 'The garlic could be a touch more golden.', veryLow: null, high: 'The garlic went a bit too brown.', veryHigh: 'The garlic is burnt — it tastes bitter.' },
          praise: 'The garlic is sweet and golden.',
        },
        {
          id: 'parsley', label: 'parsley', ing: 'parsley', pts: 8, missing: 'Where is the parsley?', match: M.ing('parsley'),
          grams: { g: 8, ing: 'parsley', few: 'Where is the parsley?', many: 'That is a whole lot of parsley.', fewPen: 0.6 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { bunch: [0.6, 'A whole bunch of parsley, not chopped? Is this for a horse?'] } },
          cook: { range: [0, 1.4], soft: [0, 99], high: 'The parsley is all cooked down.' },
        },
      ],
      amounts: [
        { ing: 'oil', g: 40, pts: 10, low: 'It is a bit dry — it needs more olive oil.', high: 'Swimming in oil.' },
      ],
      seasoning: {
        salt: { target: 0.0056, pts: 16 },
        chili: { target: 0.0011, pts: 6 },
      },
      allowed: ['pepper', 'parmesan', 'water', 'butter'],
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'soup',
      cuisine: 'classics',
      title: 'Tomato Soup',
      diner: 'mila',
      blurb: 'A simple, rustic tomato soup with soft onion and garlic.',
      serves: ['soupbowl'],
      ingredients: ['1 onion, diced', '2 garlic cloves, minced', '2 tbsp olive oil (27 ml)', '400 g crushed tomatoes (1 can)', '250 ml water', '1 tsp salt (6 g)', '1 tsp sugar (4 g)', 'a pinch of black pepper'],
      steps: [
        'Warm the olive oil in a saucepan over medium heat. Add the onion and cook, stirring now and then, for about 5 minutes until soft and translucent.',
        'Add the garlic and cook for 1 minute more.',
        'Pour in the tomatoes and water, add the salt and sugar and bring to a simmer. Simmer gently over medium-low heat for 10 minutes.',
        'Season with pepper and ladle into a soup bowl.',
      ],
      hint: 'Chop on the cutting board with the knife — more chops make smaller pieces.',
      components: [
        {
          id: 'soup', label: 'soup', missing: 'Where is the soup?', ing: 'tomato', pts: 40, core: true, match: M.tomato,
          grams: { g: 120, ing: 'tomato', few: "That's a very small bowl of soup.", many: 'Huge bowl! Great.', manyPen: 0 },
          cook: { range: [0.7, 99], soft: [0.35, 99], low: 'It still tastes a bit raw and tinny — simmer it longer.', veryLow: 'This tastes like cold tomatoes from a can.' },
          brown: { side: 'down', range: [0, 0.8], soft: [0, 1.6], high: 'It tastes a little scorched.', veryHigh: 'The soup is burnt on the bottom — it tastes awful.' },
          custom(items) {
            const it = items[0];
            if (!it) return [];
            const t = (it.comp.tomato || 0) / ((it.comp.tomato || 0) + (it.comp.water || 0) + 1e-6);
            if (t < 0.15) return [{ pen: t < 0.11 ? 16 : 8, text: "It's a bit thin and watery." }];
            if (t > 0.36) return [{ pen: t > 0.5 ? 16 : 8, text: "It's so thick — more like a sauce than a soup." }];
            return [];
          },
          praise: 'Rich and tomatoey, perfect thickness.',
        },
        {
          id: 'onion', label: 'onion', missing: 'There’s no onion in this.', ing: 'onion', pts: 25, core: true, match: M.ing('onion'),
          grams: { g: 150, ing: 'onion', few: 'There is hardly any onion.', many: 'Lots of onion in this.', manyPen: 0.08 },
          forms: {
            ok: ['diced', 'chopped', 'minced'],
            bad: { whole: [0.8, 'There is a whole onion floating in my soup!'], halved: [0.6, 'There are giant onion halves in here.'], sliced: [0.12, 'Long onion slices — a bit awkward on the spoon.'] },
          },
          cook: { range: [1.0, 99], soft: [0.6, 99], low: 'The onion is still a bit crunchy.', veryLow: 'The onion is raw!' },
          brown: { side: 'max', range: [0, 1.4], soft: [0, 2.2], high: 'The onion got quite brown.', veryHigh: 'Burnt onion bits — bitter.' },
          praise: 'The onion is meltingly soft.',
        },
        {
          id: 'garlic', label: 'garlic', ing: 'garlic', pts: 8, missing: 'I miss the garlic.', match: M.ing('garlic'),
          grams: { g: 10, ing: 'garlic', few: 'I miss the garlic.', many: 'Very garlicky!', fewPen: 0.5 },
          forms: { ok: ['minced', 'chopped', 'sliced'], bad: { clove: [0.4, 'Whole garlic cloves in my soup.'] } },
          brown: { side: 'max', range: [0, 1.6], soft: [0, 2.4], high: 'The garlic is a bit brown.', veryHigh: 'Burnt garlic — bitter.' },
        },
      ],
      amounts: [
        { ing: 'oil', g: 27, pts: 6, low: null, high: 'There is a slick of oil on top.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0091, pts: 16 },
        sugar: { target: 0.0061, pts: 5, lowOk: true },
        pepper: { target: 0.00023, pts: 3 },
      },
      allowed: ['water', 'butter', 'parsley', 'chili', 'parmesan'],
    },

    // ------------------------------------------------------------------ 6
    {
      id: 'fry-up',
      cuisine: 'classics',
      title: 'Full Breakfast Fry-Up',
      diner: 'kofi',
      blurb: 'Crispy bacon, a fried egg, a fried tomato and toast — all on one plate.',
      serves: ['plate'],
      ingredients: ['2 bacon strips (about 50 g)', '1 tomato (about 120 g)', '1 egg', '1 slice of bread', '1 tsp olive oil (5 ml)', '1 tsp butter (5 g)', 'a pinch of salt', 'a pinch of black pepper'],
      steps: [
        'Cut the tomato in half. Heat the oil in a frying pan over medium heat, lay in the bacon and fry for 3 minutes, until golden underneath. Turn the strips over.',
        'Add the tomato halves to the pan, cut-side down, and cook for 1 minute.',
        'Turn the heat down to medium-low, add the butter and crack in the egg. Fry for about 3 minutes, until the white is set but the yolk is still runny. Meanwhile, toast the bread until golden.',
        'Put everything on a plate, sprinkle the egg with salt and pepper and serve.',
      ],
      hint: 'Everything shares one pan, so start whatever takes longest first. You can drag each piece out of the pan onto the plate on its own.',
      components: [
        {
          id: 'bacon', label: 'bacon', missing: 'Where’s the bacon?! It’s not a fry-up without bacon.', ing: 'bacon', pts: 35, core: true, match: M.ing('bacon'),
          count: { n: 2, few: 'Only one strip of bacon?', many: 'Extra bacon! I’m not complaining.', fewPen: 0.2, manyPen: 0 },
          forms: { ok: ['strip'], bad: { chopped: [0.12, 'The bacon is chopped into bits — I wanted proper strips.'] } },
          cook: {
            range: [0.9, 99], soft: [0.5, 99], veryLowPen: 1.0,
            low: 'The bacon is still a bit chewy and floppy.', veryLow: 'The bacon is raw! I can’t eat that.',
          },
          brown: {
            side: 'both', range: [0.6, 2.2], soft: [0.3, 2.8],
            low: 'The bacon is a bit pale — I like it crispier.', veryLow: 'The bacon is pale and floppy — not crispy at all.',
            high: 'The bacon is very dark.', veryHigh: 'The bacon is burnt to a crisp.',
            oneSide: 'The bacon is only crispy on one side.',
          },
          praise: 'The bacon is perfectly crispy.',
        },
        {
          id: 'egg', label: 'fried egg', missing: 'No egg? A fry-up needs a fried egg.', ing: 'egg', pts: 30, core: true, match: M.egg,
          count: { n: 1, few: 'No egg? A fry-up needs a fried egg.', many: 'Two eggs! Fine by me.', manyPen: 0 },
          forms: {
            ok: ['cracked'],
            bad: {
              whole: [0.8, 'The egg is still in its shell!'], peeled: [0.3, 'A boiled egg? I was hoping for a fried one.'],
              fluid: [0.5, 'The egg is all runny and broken.'], scrambled: [0.2, 'Scrambled egg — not quite a fry-up, but okay.'], set: [0.25, 'An omelette? I wanted a fried egg.'],
            },
          },
          cook: {
            range: [0.75, 1.6], soft: [0.5, 2.0],
            low: 'The egg white is still a bit runny.', veryLow: 'The egg is raw!',
            high: 'The yolk has gone firm — I like to dip my toast in it.', veryHigh: 'The yolk is cooked hard.',
          },
          brown: { side: 'down', range: [0, 2.0], soft: [0, 2.7], high: 'The bottom of the egg is quite crispy.', veryHigh: 'The egg is burnt underneath.' },
          praise: 'Runny yolk, set white — perfect egg.',
        },
        {
          id: 'tomato', label: 'fried tomato', missing: 'Where’s the fried tomato?', ing: 'tomato', pts: 12, match: M.ing('tomato'),
          grams: { g: 120, ing: 'tomato', few: 'That’s a tiny bit of tomato.', many: 'So much tomato!', manyPen: 0.1 },
          forms: { ok: ['halved'], bad: { whole: [0.4, 'A whole tomato? It should be halved and fried cut-side down.'], sliced: [0.1, 'Sliced tomato — fine.'], diced: [0.25, 'The tomato is all diced up.'] } },
          cook: { range: [0.15, 99], soft: [0.05, 99], low: 'The tomato is barely warm.', veryLow: 'The tomato is completely raw — it should be fried.' },
          brown: { side: 'down', range: [0.25, 1.8], soft: [0.08, 2.6], low: 'The tomato could be more caramelised.', veryLow: null, high: 'The tomato is quite dark.', veryHigh: 'The tomato is burnt.' },
        },
        {
          id: 'toast', label: 'toast', missing: 'Where’s my toast?', ing: 'bread', pts: 15, core: true, match: M.ing('bread'),
          count: { n: 1, few: 'Where’s my toast?', many: 'Extra toast — great.', manyPen: 0 },
          forms: { ok: ['slice', 'halved'], bad: { cubes: [0.3, 'Why is my toast cut into cubes?'] } },
          brown: {
            side: 'both', range: [0.6, 1.9], soft: [0.3, 2.5],
            low: 'The toast is barely toasted.', veryLow: 'That’s just plain bread, not toast.',
            high: 'The toast is quite dark.', veryHigh: 'The toast is burnt!',
            oneSide: 'The toast is only toasted on one side.',
          },
        },
      ],
      amounts: [
        { ing: 'oil', g: 5, pts: 4, low: null, high: 'Everything is swimming in grease.', lowOk: true },
        { ing: 'butter', g: 5, pts: 4, low: null, high: 'Very buttery.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0016, pts: 8, lowSoft: true },
        pepper: { target: 0.0006, pts: 3, lowOk: true },
      },
      allowed: ['parsley', 'chives', 'mushroom'],
    },

    // ------------------------------------------------------------------ 7
    {
      id: 'omelette',
      cuisine: 'classics',
      title: 'Cheese & Chive Omelette',
      diner: 'rosa',
      blurb: 'A soft, golden omelette filled with melted cheddar and fresh chives.',
      serves: ['plate'],
      ingredients: ['3 eggs', 'a pinch of salt', '2 tsp butter (10 g)', 'a small handful of grated cheddar (25 g)', 'a few chives (5 g), chopped'],
      steps: [
        'Crack the eggs into a bowl, add the salt and whisk until smooth.',
        'Melt the butter in a frying pan over medium-low heat. Pour in the eggs and leave them alone — don’t stir — for about 2 minutes, until the bottom has set.',
        'Scatter the cheddar over the top and cook for 1–2 minutes more, until the top is just set and the cheese has melted.',
        'Slide the omelette onto a plate and sprinkle with the chopped chives.',
      ],
      hint: 'Leave the eggs alone once they are in the pan: stirring turns them into scrambled eggs. Add the cheese once the eggs have started to set, or it just melts into the raw egg.',
      components: [
        {
          id: 'omelette', label: 'omelette', missing: 'Where is the omelette?', ing: 'egg', pts: 60, core: true, match: M.egg, uses: ['cheddar', 'milk'],
          grams: { g: 150, ing: 'egg', few: 'A rather small omelette — wasn’t it three eggs?', many: 'That’s an enormous omelette.' },
          forms: {
            ok: ['set'],
            bad: {
              scrambled: [0.5, 'This is scrambled egg, not an omelette. It should set in one piece — no stirring!'],
              cracked: [0.4, 'These are fried eggs — I wanted them whisked into an omelette.'],
              whole: [0.85, 'The eggs are still in their shells!'], peeled: [0.6, 'Boiled eggs? I wanted an omelette.'],
              fluid: [0.0, ''],
            },
          },
          cook: {
            range: [0.6, 1.65], soft: [0.35, 2.0], veryLowPen: 0.8,
            low: 'The middle is still a bit wet.', veryLow: 'It’s still raw and runny!',
            high: 'It’s a little firm and dry.', veryHigh: 'Dry and rubbery — overcooked.',
          },
          brown: {
            side: 'max', range: [0, 1.3], soft: [0, 2.1],
            high: 'It’s quite brown underneath — I like it pale and golden.', veryHigh: 'The bottom is burnt.',
          },
          custom(items) {
            const out = [];
            const it = items.find((i) => i.kind === 'fluid');
            if (it && it.mass > 20) out.push({ pen: 22, text: 'There’s raw egg running all over the plate.' });
            const s = items.find((i) => i.kind === 'set');
            if (s && s.smooth < 0.5) out.push({ pen: 6, text: 'It’s streaky — the eggs weren’t whisked properly.' });
            return out;
          },
          praise: 'Soft, golden and just set. Lovely omelette.',
        },
        {
          id: 'chives', label: 'chives', ing: 'chives', pts: 10, missing: 'Where are the chives?', match: M.ing('chives'),
          grams: { g: 5, ing: 'chives', few: 'I can barely see any chives.', many: 'That is a lot of chives!', fewPen: 0.5 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { bunch: [0.6, 'A whole bunch of chives on top? They should be chopped.'] } },
          cook: { range: [0, 1.2], soft: [0, 99], high: 'The chives are all wilted.' },
        },
      ],
      amounts: [
        { ing: 'cheddar', g: 25, pts: 12, low: 'Where’s the cheese? I can hardly taste it.', high: 'So much cheese it’s greasy.' },
        { ing: 'butter', g: 10, pts: 5, low: null, high: 'Very buttery.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0021, pts: 14 },
      },
      allowed: ['pepper', 'oil', 'parsley', 'milk'],
    },

    // ------------------------------------------------------------------ 8
    {
      id: 'french-toast',
      cuisine: 'classics',
      title: 'Cinnamon French Toast',
      dish: 'cinnamon French toast',
      diner: 'theo',
      blurb: 'Golden, custardy French toast with cinnamon and a drizzle of syrup.',
      serves: ['plate'],
      ingredients: ['2 slices of bread', '1 egg', '50 ml milk', '¼ tsp cinnamon (0.6 g)', '1 tsp sugar (4 g)', '2 tsp butter (10 g)', '1 tbsp maple syrup or honey (20 g), to serve'],
      steps: [
        'In a mixing bowl, whisk the egg, milk, cinnamon and sugar until smooth.',
        'Lay the bread in the bowl and leave it for about half a minute, until it has soaked up the egg mixture.',
        'Melt the butter in a frying pan over medium heat. Fry the soaked bread for about 3 minutes per side, until golden brown and the egg inside has set.',
        'Put the French toast on a plate and drizzle with maple syrup or honey.',
      ],
      hint: 'Bread soaks up whatever liquid it sits in. Hover over it in the pan to check whether the egg inside has set.',
      components: [
        {
          id: 'toast', label: 'French toast', missing: 'Where’s the French toast?', ing: 'bread', pts: 65, core: true, match: M.ing('bread'),
          uses: ['egg', 'milk', 'cinnamon', 'sugar'],
          count: { n: 2, few: 'Only one slice? The recipe makes two!', many: 'Extra French toast! Yesss.', fewPen: 0.15, manyPen: 0 },
          forms: { ok: ['slice', 'halved'], bad: { cubes: [0.25, 'Why is it cut into little cubes?'] } },
          cook: {
            range: [0.6, 1.8], soft: [0.35, 2.4], veryLowPen: 0.8,
            low: 'It’s a bit soggy and eggy in the middle.', veryLow: 'It’s raw egg inside! Yuck!',
            high: 'It’s a bit dry.', veryHigh: 'It’s dried out and hard.',
          },
          brown: {
            side: 'both', range: [0.45, 1.85], soft: [0.2, 2.5],
            low: 'It’s quite pale.', veryLow: 'It’s pale and floppy, not golden at all.',
            high: 'It’s quite dark.', veryHigh: 'It’s burnt!',
            oneSide: 'One side is pale — it needed flipping.',
          },
          custom(items) {
            const out = [];
            const egg = sum(items, (i) => i.comp.egg || 0), bread = sum(items, (i) => i.comp.bread || 0);
            if (bread > 0 && egg / bread < 0.25) out.push({ pen: egg / bread < 0.08 ? 30 : 14, text: egg / bread < 0.08 ? 'This is just fried bread — it wasn’t soaked in egg.' : 'It’s a bit dry — it needed a longer soak in the egg.' });
            return out;
          },
          praise: 'Crispy outside, soft and custardy inside!',
        },
      ],
      amounts: [
        { ings: ['syrup', 'honey'], g: 20, pts: 10, low: 'Where’s the syrup? It’s dry!', high: 'It’s drowning in syrup.' },
        { ing: 'butter', g: 10, pts: 4, low: null, high: 'Greasy — so much butter.', lowOk: true },
      ],
      seasoning: {
        cinnamon: { target: 0.003, pts: 10, low: 'I can’t taste any cinnamon.', high: 'Lots of cinnamon — a bit dusty.', veryHigh: 'Way too much cinnamon. It’s bitter!' },
        sugar: { target: 0.02, pts: 4, lowOk: true },
      },
      allowed: ['banana', 'oil'],
    },

    // ------------------------------------------------------------------ 9
    {
      id: 'porridge',
      cuisine: 'classics',
      title: 'Banana & Honey Porridge',
      diner: 'mila',
      blurb: 'Creamy oats simmered in milk, topped with banana and honey.',
      serves: ['soupbowl'],
      vessel: { plate: [16, 'Porridge on a flat plate? It’s sliding everywhere!'] },
      ingredients: ['40 g rolled oats (½ cup)', '250 ml milk', 'a pinch of salt', '1 small banana (about 120 g)', '1 tbsp honey (15 g)'],
      steps: [
        'Put the oats, milk and salt in a saucepan over medium heat and bring to a simmer, stirring now and then.',
        'Turn the heat down to low and cook for 4 minutes, stirring often, until the oats are soft and creamy. It should still be a little loose — porridge thickens as it stands.',
        'Meanwhile, slice the banana.',
        'Pour the porridge into a soup bowl, top with the banana and drizzle with the honey.',
      ],
      hint: 'Oats drink up the milk as they cook. Hover over the saucepan to see how much milk is left, and stir so nothing catches on the bottom.',
      components: [
        {
          id: 'oats', label: 'porridge', missing: 'Where’s the porridge?', ing: 'oats', pts: 55, core: true, match: M.ing('oats'),
          uses: ['milk'],
          grams: { g: 40, ing: 'oats', few: 'That’s a very small bowl of porridge.', many: 'That is a LOT of porridge.', manyPen: 0.06 },
          cook: {
            range: [0.75, 1.9], soft: [0.45, 2.5],
            low: 'The oats are still a bit chewy.', veryLow: 'The oats are hard and raw!',
            high: 'It’s gone a bit thick and gluey.', veryHigh: 'It’s a solid, gluey lump.',
          },
          brown: { side: 'max', range: [0, 0.5], soft: [0, 1.2], high: 'It tastes a little scorched.', veryHigh: 'It’s burnt on the bottom — I can taste it.' },
          custom(items, ctx) {
            const out = [];
            const oats = sum(items, (i) => i.comp.oats || 0);
            if (oats < 1) return out;
            // creaminess: milk still loose in the bowl vs. everything the oats were cooked with
            const liquid = (i) => (i.comp.milk || 0) + (i.comp.water || 0);
            const loose = sum(ctx.items.filter((i) => i.kind === 'fluid'), liquid);
            const total = loose + sum(items, liquid);
            if (loose / oats > 2.6) out.push({ pen: loose / oats > 4 ? 20 : 10, text: 'It’s runny and soupy — it needed longer.' });
            else if (total / oats < 3.4) out.push({ pen: total / oats < 2.4 ? 18 : 9, text: 'It’s very thick and stodgy — it needed more milk.' });
            if (!(ctx.comp.milk > oats)) out.push({ pen: 10, text: 'Made with water? It’s not very creamy.' });
            return out;
          },
          praise: 'Creamy and smooth — perfect porridge.',
        },
        {
          id: 'banana', label: 'banana', ing: 'banana', pts: 15, missing: 'Where’s the banana?', match: M.ing('banana'),
          grams: { g: 120, ing: 'banana', few: 'Just a few bits of banana?', many: 'So much banana!', manyPen: 0.05 },
          forms: {
            ok: ['sliced', 'chopped'],
            bad: { whole: [0.6, 'There’s a whole banana lying in my porridge!'], halved: [0.4, 'Half a banana, unpeeled-looking… it should be sliced.'], mashed: [0.15, 'The banana is all mashed in — I wanted slices.'] },
          },
          cook: { range: [0, 1.2], soft: [0, 99], high: 'The banana has gone all hot and mushy.' },
          praise: 'And sweet banana on top. Yum!',
        },
      ],
      amounts: [
        { ings: ['honey', 'syrup'], g: 15, pts: 10, low: 'It needs a little honey on top.', high: 'Way too much honey — it’s sickly.' },
      ],
      seasoning: {
        salt: { target: 0.001, pts: 6, lowOk: true },
      },
      allowed: ['cinnamon', 'sugar', 'water', 'butter'],
    },

    // ------------------------------------------------------------------ 10
    {
      id: 'bruschetta',
      cuisine: 'classics',
      title: 'Tomato Bruschetta',
      diner: 'ines',
      blurb: 'Crunchy toast piled with fresh tomato, garlic, basil and olive oil.',
      serves: ['plate'],
      hot: false,
      ingredients: ['2 slices of bread', '1 ripe tomato (about 120 g)', '1 garlic clove', 'a few basil leaves (6 g)', '1 tbsp olive oil (14 ml)', 'a good pinch of salt (about 1 g)'],
      steps: [
        'Dice the tomato, mince the garlic and tear the basil.',
        'In a mixing bowl, toss the tomato, garlic and basil with the olive oil and the salt.',
        'Toast the bread until golden on both sides.',
        'Put the toast on a plate and spoon the tomato mixture on top. Serve straight away — the tomatoes stay raw and fresh.',
      ],
      hint: 'Each chop on the board cuts finer: a single cut tears basil, a few more dice a tomato. The topping is never cooked — keep it away from the stove.',
      components: [
        {
          id: 'toast', label: 'toast', missing: 'Where’s the toast? Bruschetta is built on toast.', ing: 'bread', pts: 35, core: true, match: M.ing('bread'),
          count: { n: 2, few: 'Only one slice?', many: 'Plenty of toast!', fewPen: 0.12, manyPen: 0 },
          forms: { ok: ['slice', 'halved'], bad: { cubes: [0.35, 'Bread cubes? This is turning into a salad.'] } },
          brown: {
            side: 'both', range: [0.6, 1.9], soft: [0.3, 2.5],
            low: 'The bread is barely toasted — it should be crunchy.', veryLow: 'That’s soft, untoasted bread.',
            high: 'The toast is a bit dark.', veryHigh: 'The toast is burnt.',
            oneSide: 'The bread is only toasted on one side.',
          },
          custom(items) {
            const it = items[0];
            if (it && it.hyd > 15) return [{ pen: 12, text: 'The bread is soggy.' }];
            if (it && Math.max(it.brownDown, it.brownUp) < 0.3) return [{ pen: 8, text: 'It goes soft under the tomatoes — it needs to be crunchy.' }];
            return [];
          },
          praise: 'The toast is perfectly crunchy.',
        },
        {
          id: 'tomato', label: 'tomatoes', missing: 'There are no tomatoes on this!', ing: 'tomato', pts: 35, core: true, match: M.ing('tomato'),
          grams: { g: 120, ing: 'tomato', few: 'Hardly any tomato on top.', many: 'A mountain of tomato!', manyPen: 0.06 },
          forms: {
            ok: ['diced'],
            bad: { whole: [0.7, 'A whole tomato on toast?'], halved: [0.5, 'Tomato halves? It should be diced.'], sliced: [0.12, 'Tomato slices instead of dice — it works, I suppose.'] },
          },
          cook: {
            range: [0, 0.3], soft: [0, 0.65],
            high: 'The tomatoes are warm and soft — they should be fresh and raw.', veryHigh: 'The tomatoes are cooked to mush. Bruschetta needs fresh tomatoes!',
          },
          brown: { side: 'max', range: [0, 0.4], soft: [0, 1.2], high: 'The tomatoes are browned — they should be raw.', veryHigh: 'The tomatoes are burnt!' },
          praise: 'The tomatoes are sweet and fresh.',
        },
        {
          id: 'basil', label: 'basil', ing: 'basil', pts: 10, missing: 'Where’s the basil?', match: M.ing('basil'),
          grams: { g: 6, ing: 'basil', few: 'Hardly any basil.', many: 'A lot of basil!', fewPen: 0.5 },
          forms: { ok: ['torn', 'chopped'], bad: { leaves: [0.3, 'A whole sprig of basil plonked on top — tear it up.'] } },
          cook: { range: [0, 0.5], soft: [0, 99], high: 'The basil is cooked and wilted.' },
        },
        {
          id: 'garlic', label: 'garlic', ing: 'garlic', pts: 8, missing: 'It needs a little garlic.', match: M.ing('garlic'),
          grams: { g: 5, ing: 'garlic', few: 'I can barely taste the garlic.', many: 'Whoa, that is a LOT of raw garlic.', manyPen: 0.5, fewPen: 0.5 },
          forms: { ok: ['minced', 'chopped'], bad: { clove: [0.6, 'A whole raw garlic clove? Ouch.'], sliced: [0.2, 'Big slices of raw garlic — a bit harsh.'] } },
          brown: { side: 'max', range: [0, 0.8], soft: [0, 2.0], high: 'The garlic is browned.', veryHigh: 'The garlic is burnt and bitter.' },
        },
      ],
      amounts: [
        { ing: 'oil', g: 14, pts: 8, low: 'It’s a bit dry — it needs olive oil.', high: 'It’s swimming in oil.' },
      ],
      seasoning: {
        salt: { target: 0.0035, pts: 14 },
      },
      allowed: ['pepper', 'parmesan', 'butter', 'chili'],
    },

    // ------------------------------------------------------------------ 11
    {
      id: 'mash',
      cuisine: 'classics',
      title: 'Creamy Mashed Potatoes',
      diner: 'otto',
      blurb: 'Smooth, buttery mash — no lumps, no puddles.',
      serves: ['plate', 'soupbowl'],
      ingredients: ['2 potatoes (about 400 g)', 'about 1 litre of water', '2 tbsp butter (30 g)', '4 tbsp milk (60 ml)', '½ tsp salt (3 g)'],
      steps: [
        'Dice the potatoes. Put them in a saucepan, cover with about 1 litre of water and bring to a boil over high heat.',
        'Boil for about 12 minutes, until the potatoes are tender all the way through.',
        'Drain them well, then add the butter, milk and salt and mash with a spoon until smooth and creamy.',
        'Serve hot.',
      ],
      hint: 'Drain the saucepan over the sink first. Then keep stirring the soft potatoes with a spoon: they turn into mash and soak up the butter and milk.',
      components: [
        {
          id: 'mash', label: 'mashed potatoes', missing: 'Where are the potatoes?', ing: 'potato', pts: 65, core: true, match: M.ing('potato'),
          uses: ['milk', 'butter'],
          grams: { g: 400, ing: 'potato', few: 'That’s a small portion of mash.', many: 'A mountain of mash!', manyPen: 0.04 },
          forms: {
            ok: ['mashed'],
            bad: {
              diced: [0.45, 'These are boiled potato chunks — they were supposed to be mashed.'], 'small dice': [0.45, 'These are little boiled potato cubes, not mash.'],
              wedges: [0.5, 'Potato wedges? I wanted mash.'], halved: [0.6, 'Potato halves? I wanted mash.'], whole: [0.75, 'A whole potato! Mash it, please.'],
            },
          },
          cook: {
            range: [0.95, 2.6], soft: [0.75, 3.4],
            low: 'It’s a bit lumpy — the potatoes weren’t quite soft.', veryLow: 'The potatoes are hard and raw in the middle!',
            high: 'It’s a little gluey.', veryHigh: 'Watery, overcooked potato.',
          },
          brown: { side: 'max', range: [0, 0.6], soft: [0, 1.4], high: 'It’s caught and browned on the bottom.', veryHigh: 'It’s burnt!' },
          custom(items, ctx) {
            const out = [];
            const pot = sum(items, (i) => i.comp.potato || 0);
            if (pot < 1) return out;
            const water = sum(ctx.items, (i) => i.comp.water || 0);
            const wet = (water + sum(ctx.items, (i) => i.comp.milk || 0)) / pot;
            if (water / pot > 0.12 || wet > 0.4) out.push({ pen: wet > 0.8 ? 30 : 16, text: wet > 0.8 ? 'It’s soupy and watery — were the potatoes drained?' : 'It’s a bit wet and sloppy.' });
            else if (items.some((i) => i.form === 'mashed') && (ctx.comp.butter || 0) + (ctx.comp.milk || 0) < pot * 0.06) out.push({ pen: 12, text: 'It’s dry and stiff — it needs butter and milk.' });
            return out;
          },
          praise: 'Smooth, creamy and buttery. Just like it should be.',
        },
      ],
      amounts: [
        { ing: 'butter', g: 30, pts: 8, low: 'It could be richer — more butter.', high: 'Very, very buttery.' },
        { ing: 'milk', g: 60, pts: 5, low: null, high: 'It’s quite milky.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0061, pts: 16 },
        pepper: { target: 0.0003, pts: 2, lowOk: true },
      },
      allowed: ['chives', 'parsley', 'garlic', 'cheddar', 'parmesan', 'oil'],
    },

    // ------------------------------------------------------------------ 12
    {
      id: 'stir-fry',
      cuisine: 'classics',
      title: 'Chicken & Pepper Stir-Fry with Rice',
      diner: 'kofi',
      blurb: 'The finale: fluffy rice and a sizzling soy-glazed stir-fry, both at once.',
      serves: ['plate', 'soupbowl'],
      ingredients: ['75 g rice (⅓ cup)', '200 ml water', 'a pinch of salt', '1 chicken breast (about 180 g)', '1 bell pepper', '1 onion', '1 garlic clove', '1 tbsp oil (14 ml)', '2 tbsp soy sauce (30 ml)'],
      steps: [
        'Put the rice, water and salt in a saucepan and bring to a boil over high heat. Turn the heat down to low and simmer for about 12 minutes, until the water has been absorbed and the rice is tender.',
        'Meanwhile, cut the chicken and the pepper into strips, slice the onion and mince the garlic.',
        'Heat the oil in a frying pan over high heat. Stir-fry the chicken for about 4 minutes, until golden and almost cooked through, then lift it out into a bowl.',
        'Add the pepper and onion to the pan and stir-fry for 3 minutes, until just tender.',
        'Return the chicken to the pan, add the garlic and soy sauce and toss for 1 minute.',
        'Serve the stir-fry with the rice.',
      ],
      hint: 'Use two burners: the rice looks after itself on low while you stir-fry. On high heat, keep stirring so everything browns without burning.',
      components: [
        {
          id: 'rice', label: 'rice', missing: 'Where’s the rice?', ing: 'rice', pts: 25, core: true, match: M.ing('rice'),
          grams: { g: 75, ing: 'rice', few: 'That’s not much rice.', many: 'That’s a LOT of rice.' },
          cook: {
            range: [0.82, 1.5], soft: [0.7, 1.85],
            low: 'The rice is a bit hard in the middle.', veryLow: 'The rice is crunchy — undercooked!',
            high: 'The rice is a bit soft and sticky.', veryHigh: 'The rice is mushy.',
          },
          brown: { side: 'max', range: [0, 0.5], soft: [0, 1.3], high: 'The rice has caught on the bottom.', veryHigh: 'Burnt rice!' },
          praise: 'The rice is fluffy and tender.',
        },
        {
          id: 'chicken', label: 'chicken', missing: 'Where’s the chicken?', ing: 'chicken', pts: 35, core: true, match: M.ing('chicken'),
          grams: { g: 180, ing: 'chicken', few: 'Hardly any chicken.', many: 'So much chicken!', manyPen: 0.04 },
          forms: { ok: ['strips', 'diced'], bad: { whole: [0.3, 'A whole chicken breast? For a stir-fry it should be cut into strips.'], halved: [0.25, 'Big chunks of chicken — they should be strips.'] } },
          cook: {
            range: [1.0, 2.1], soft: [0.97, 2.6], veryLowPen: 1.6,
            low: 'The chicken is a touch pink.', veryLow: 'The chicken is raw in the middle — that’s not safe!',
            high: 'The chicken is a bit dry.', veryHigh: 'The chicken is dry and chewy.',
          },
          brown: { side: 'avg', range: [0.3, 2.0], soft: [0.1, 2.6], low: 'The chicken is a bit pale.', veryLow: null, high: 'The chicken is very dark.', veryHigh: 'The chicken is burnt.' },
          praise: 'The chicken is juicy and cooked through.',
        },
        {
          id: 'pepper', label: 'bell pepper', missing: 'Where’s the pepper? It’s chicken AND pepper.', ing: 'bellpepper', pts: 15, core: true, match: M.ing('bellpepper'),
          grams: { g: 150, ing: 'bellpepper', few: 'Only a little bit of pepper.', many: 'Loads of pepper!', manyPen: 0.04 },
          forms: { ok: ['strips', 'diced'], bad: { whole: [0.6, 'A whole bell pepper in a stir-fry?'], halved: [0.4, 'Pepper halves? Cut it into strips.'] } },
          cook: {
            range: [0.35, 2.2], soft: [0.15, 3.2],
            low: 'The pepper is still a bit raw.', veryLow: 'The pepper is completely raw.',
            high: 'The pepper is soft and floppy.', veryHigh: 'The pepper is cooked to mush.',
          },
          brown: { side: 'avg', range: [0, 2.0], soft: [0, 2.6], high: 'The pepper is very charred.', veryHigh: 'The pepper is burnt.' },
          praise: 'The pepper is tender and sweet.',
        },
        {
          id: 'onion', label: 'onion', missing: 'There’s no onion in this.', ing: 'onion', pts: 8, match: M.ing('onion'),
          grams: { g: 150, ing: 'onion', few: 'Hardly any onion.', many: 'Lots of onion!', manyPen: 0.06, fewPen: 0.6 },
          forms: { ok: ['sliced', 'chopped', 'diced'], bad: { whole: [0.8, 'A whole onion?!'], halved: [0.6, 'Onion halves? They should be sliced.'] } },
          cook: { range: [0.35, 99], soft: [0.12, 99], low: 'The onion is a bit raw.', veryLow: 'The onion is raw.' },
          brown: { side: 'avg', range: [0, 2.0], soft: [0, 2.6], high: 'The onion is very dark.', veryHigh: 'The onion is burnt.' },
        },
        {
          id: 'garlic', label: 'garlic', ing: 'garlic', pts: 4, missing: 'A bit of garlic would be nice.', match: M.ing('garlic'),
          forms: { ok: ['minced', 'chopped', 'sliced'], bad: { clove: [0.5, 'A whole garlic clove?'] } },
          brown: { side: 'max', range: [0, 1.8], soft: [0, 2.5], high: 'The garlic is quite brown.', veryHigh: 'The garlic is burnt and bitter.' },
        },
      ],
      amounts: [
        { ing: 'soy', g: 25, pts: 12, low: 'It needs soy sauce — it’s a bit plain.', high: 'Drowning in soy sauce!' },
        { ing: 'oil', g: 14, pts: 4, low: null, high: 'Very oily.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0065, pts: 14 },
      },
      allowed: ['chili', 'pepper', 'water', 'honey', 'sugar', 'butter', 'chives', 'mushroom'],
    },

    // ================================================================== Ukrainian kitchen
    // ------------------------------------------------------------------ U1
    {
      id: 'syrnyky',
      cuisine: 'ukrainian',
      title: 'Syrnyky (Сирники)',
      dish: 'syrnyky',
      diner: 'solomiia',
      blurb: 'Little golden farmer’s-cheese pancakes, just like Mum’s on a Sunday morning — with smetana and cherry jam.',
      serves: ['plate'],
      ingredients: ['½ cup farmer’s cheese (tvorog, about 120 g)', '1 egg', '2 tsp sugar (8 g)', 'a pinch of salt', '1½ tbsp flour (12 g)', '1 tbsp sunflower oil (15 ml), for frying', '2 tbsp smetana (30 g), to serve', '1 tbsp cherry jam or honey (20 g), to serve'],
      steps: [
        'In a mixing bowl, combine the farmer’s cheese, egg, sugar, salt and flour, and whisk into a thick, soft dough.',
        'Heat the sunflower oil in a frying pan over medium heat.',
        'With the ladle, drop 4 dollops of dough into the pan, side by side. Fry for about 4 minutes, until golden underneath.',
        'Flip each syrnyk with the spatula and fry for 3 minutes more, until golden on both sides and cooked through.',
        'Lay them on a plate with a spoonful of smetana and the cherry jam (or honey). Смачного!',
      ],
      hint: 'Ladle: click the bowl of dough to scoop up one dollop, then click in the pan to drop it. Every dollop stays its own little syrnyk, so you can fry four side by side and flip each one.',
      components: [
        {
          id: 'syrnyky', label: 'syrnyky', missing: 'Where are the syrnyky?', ing: 'tvorog', pts: 62, core: true, match: M.curd,
          uses: ['egg', 'flour', 'sugar'],
          count: { n: 4, few: 'Only a couple of syrnyky? Mum always makes at least four.', many: 'So many syrnyky!', fewPen: 0.12, manyPen: 0 },
          forms: { ok: ['set'], bad: { scrambled: [0.4, 'They’ve crumbled into bits — syrnyky should hold together as little patties.'], fluid: [0.0, ''] } },
          cook: {
            range: [0.8, 2.4], soft: [0.6, 2.9], veryLowPen: 0.8,
            low: 'They’re a bit soft and doughy in the middle.', veryLow: 'They’re raw inside — still wet curd dough!',
            high: 'They’re a little dry.', veryHigh: 'Dry and tough — overcooked.',
          },
          brown: {
            side: 'both', range: [0.5, 2.1], soft: [0.25, 2.7],
            low: 'They’re rather pale — I like them golden.', veryLow: 'Pale as can be — no golden crust at all.',
            high: 'They’re quite dark.', veryHigh: 'These syrnyky are burnt!',
            oneSide: 'Only one side is golden — they needed flipping.',
          },
          custom(items) {
            const out = dollopIssues(items, {
              maxG: 90, method: 'fried',
              raw: 'Some of it is just raw curd dough!',
              giant: 'This is one giant syrnyk! They should be little patties, one dollop each.',
              wrongMethod: 'These were boiled — that makes lazy varenyky. Syrnyky are fried!',
            });
            const comp = {};
            for (const it of items) CK.addComp(comp, it.comp);
            const cheese = comp.tvorog || 0;
            if (cheese > 1) {
              const fl = (comp.flour || 0) / cheese;
              if (fl > 0.35) out.push({ pen: fl > 0.6 ? 18 : 9, text: 'They’re heavy and floury — too much flour, not enough cheese.' });
              if (!comp.egg && fl < 0.05) out.push({ pen: 10, text: 'They fall apart — the dough needed an egg to hold it together.' });
            }
            return out;
          },
          praise: 'Golden outside, soft and creamy inside — just like Mum’s!',
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'Where’s the smetana? Syrnyky need a spoonful of smetana!', high: 'They’re drowning in smetana.' },
        { ings: ['cherryjam', 'honey'], g: 20, pts: 8, low: 'A little cherry jam or honey on the side would be lovely.', high: 'So much jam it’s sickly.' },
        { ing: 'sunoil', g: 15, pts: 4, low: null, high: 'They’re greasy — swimming in oil.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0016, pts: 5, lowOk: true },
        sugar: { target: 0.033, pts: 8, lowSoft: true },
      },
      allowed: ['butter'],
    },

    // ------------------------------------------------------------------ U2
    {
      id: 'hrechka',
      cuisine: 'ukrainian',
      title: 'Hrechka with Mushrooms (Гречка з грибами)',
      dish: 'buckwheat with mushrooms',
      diner: 'taras',
      blurb: 'Fluffy buckwheat kasha with mushrooms and onion fried in butter. Simple, filling, perfect.',
      serves: ['plate', 'soupbowl'],
      ingredients: ['½ cup buckwheat (100 g)', '1 cup water (200 ml)', '½ tsp salt (3 g), for the buckwheat', '1 onion, diced', '5 mushrooms (100 g), sliced', '1 tbsp butter (15 g)', 'a pinch of salt and black pepper, for the mushrooms'],
      steps: [
        'Put the buckwheat, water and salt in a saucepan and bring to the boil over high heat. Turn the heat down to low and cook for about 12 minutes, until all the water has been absorbed and the grains are tender and fluffy.',
        'Meanwhile, melt the butter in a frying pan over medium heat. Fry the onion for 3 minutes, stirring, until it starts to soften.',
        'Add the mushrooms and fry for about 6 minutes more, stirring now and then, until they are tender and golden. Season with a pinch of salt and pepper.',
        'Tip the buckwheat into the pan, stir it through the mushrooms and onion, and serve.',
      ],
      hint: 'Buckwheat drinks up its water as it cooks. Keep it on low so it doesn’t catch on the bottom, and hover over the saucepan to check whether any water is left.',
      components: [
        {
          id: 'buckwheat', label: 'buckwheat', missing: 'Where’s the hrechka? I can see mushrooms, but no buckwheat!', ing: 'buckwheat', pts: 45, core: true, match: M.ing('buckwheat'),
          grams: { g: 100, ing: 'buckwheat', few: 'That’s hardly any buckwheat for a grown Cossack.', many: 'A mountain of buckwheat! Good.', manyPen: 0 },
          cook: {
            range: [0.85, 1.6], soft: [0.65, 1.9],
            low: 'The buckwheat is still a bit hard.', veryLow: 'The buckwheat is crunchy — it’s barely cooked!',
            high: 'The buckwheat is a bit soft and sticky.', veryHigh: 'The buckwheat has gone to mush.',
          },
          brown: { side: 'max', range: [0, 0.7], soft: [0, 1.5], high: 'The buckwheat has caught on the bottom.', veryHigh: 'Burnt buckwheat — I can taste it!' },
          custom(items, ctx) {
            const bw = sum(items, (i) => i.comp.buckwheat || 0);
            const loose = sum(ctx.items.filter((i) => i.kind === 'fluid' && !i.lump), (i) => (i.comp.water || 0));
            if (bw > 1 && loose / bw > 0.4) return [{ pen: loose / bw > 1.2 ? 22 : 10, text: 'It’s watery — the buckwheat should soak up all its water.' }];
            return [];
          },
          praise: 'The buckwheat is fluffy, every grain on its own.',
        },
        {
          id: 'mushroom', label: 'mushrooms', missing: 'Where are the mushrooms?', ing: 'mushroom', pts: 28, core: true, match: M.ing('mushroom'),
          grams: { g: 100, ing: 'mushroom', few: 'Only a few bits of mushroom.', many: 'Lots of mushrooms — I like it!', manyPen: 0 },
          forms: { ok: ['sliced', 'chopped', 'halved'], bad: { whole: [0.15, 'Whole mushrooms — they should be sliced.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The mushrooms are a bit underdone.', veryLow: 'The mushrooms are raw!' },
          brown: {
            side: 'avg', range: [0.12, 1.9], soft: [0.04, 2.6],
            low: 'The mushrooms could be a little more golden.', veryLow: 'The mushrooms are pale and steamed, not fried.',
            high: 'The mushrooms are very dark.', veryHigh: 'The mushrooms are burnt.',
          },
          praise: 'The mushrooms are tender and golden.',
        },
        {
          id: 'onion', label: 'onion', missing: 'Where’s the onion?', ing: 'onion', pts: 12, match: M.ing('onion'),
          grams: { g: 150, ing: 'onion', few: 'Hardly any onion.', many: 'Lots of onion!', manyPen: 0.06, fewPen: 0.6 },
          forms: { ok: ['diced', 'chopped', 'minced', 'sliced'], bad: { whole: [0.8, 'A whole onion?!'], halved: [0.6, 'Onion halves? It should be diced.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The onion is still crunchy.', veryLow: 'The onion is raw!' },
          brown: { side: 'avg', range: [0, 1.9], soft: [0, 2.6], high: 'The onion is very dark.', veryHigh: 'The onion is burnt and bitter.' },
        },
      ],
      amounts: [
        { ings: ['butter', 'sunoil'], g: 15, pts: 8, low: 'It’s a bit dry — buckwheat loves butter.', high: 'It’s swimming in fat.' },
      ],
      seasoning: {
        salt: { target: 0.0067, pts: 16 },
        pepper: { target: 0.0003, pts: 3, lowOk: true },
      },
      allowed: ['dill', 'garlic', 'smetana', 'water'],
    },

    // ------------------------------------------------------------------ U3
    {
      id: 'mlyntsi',
      cuisine: 'ukrainian',
      title: 'Mlyntsi (Млинці)',
      dish: 'mlyntsi',
      diner: 'halyna',
      blurb: 'Thin, lacy crêpes the way Babusia makes them: a whole stack, with smetana and honey.',
      serves: ['plate'],
      ingredients: ['1 egg', '⅔ cup milk (150 ml)', '⅓ cup flour (50 g)', '1 tsp sugar (4 g)', 'a pinch of salt', '1 tsp sunflower oil (5 ml), for the pan', '2 tbsp smetana (30 g), to serve', '1 tbsp honey or cherry jam (15 g), to serve'],
      steps: [
        'In a mixing bowl, whisk the egg, milk, sugar and salt, then whisk in the flour until the batter is smooth and runny, like thin cream.',
        'Heat a frying pan over medium heat and grease it with the oil.',
        'Pour in one ladle of batter. Cook for about 1½ minutes, until the underside is lightly golden, then flip it and cook for 1 minute more.',
        'Slide the mlynets onto a plate and cook the rest of the batter the same way — it makes 4.',
        'Serve the stack with smetana and honey or cherry jam.',
      ],
      hint: 'One scoop of the ladle is one crêpe’s worth of batter. Mlyntsi must be thin: a batter as thick as pancake batter gives you fluffy pancakes, and Babusia will notice.',
      components: [
        {
          id: 'mlyntsi', label: 'mlyntsi', missing: 'Where are the mlyntsi?', ing: 'flour', pts: 62, core: true, match: M.batter,
          uses: ['egg', 'milk', 'sugar'],
          count: { n: 4, few: 'Only one or two? A proper stack of mlyntsi has four at least.', many: 'A tall stack! Good.', fewPen: 0.12, manyPen: 0 },
          forms: { ok: ['set'], bad: { scrambled: [0.45, 'The mlyntsi are torn to shreds.'], fluid: [0.0, ''] } },
          cook: {
            range: [0.75, 2.4], soft: [0.55, 3.0],
            low: 'A little gooey in places.', veryLow: 'They’re raw batter in the middle!',
            high: 'They’re dry and stiff.', veryHigh: 'Dry as paper.',
          },
          brown: {
            side: 'both', range: [0.35, 1.9], soft: [0.15, 2.5],
            low: 'They’re rather pale.', veryLow: 'Pale and floppy, no colour at all.',
            high: 'They’re quite dark.', veryHigh: 'Burnt mlyntsi!',
            oneSide: 'One side is pale — they needed flipping.',
          },
          custom(items) {
            const out = dollopIssues(items, {
              maxG: 110,
              raw: 'There’s raw batter on the plate!',
              giant: 'That’s one thick pancake, not thin mlyntsi — one ladle of batter per crêpe.',
            });
            const comp = {};
            for (const it of items) CK.addComp(comp, it.comp);
            const flour = comp.flour || 0;
            if (flour < 1) return out;
            const r = ((comp.milk || 0) + (comp.egg || 0) + (comp.water || 0)) / flour;
            if (r < 2.7) out.push({ pen: r < 2 ? 24 : 12, text: r < 2 ? 'These are thick and fluffy — mlyntsi should be thin as lace! The batter needed much more milk.' : 'They’re a bit thick — the batter needed more milk.' });
            else if (r > 6) out.push({ pen: 10, text: 'So thin they fall apart — too much milk.' });
            if ((comp.bakingpowder || 0) / flour > 0.01) out.push({ pen: 10, text: 'They’re puffy — mlyntsi don’t need baking powder.' });
            if (!comp.egg) out.push({ pen: 6, text: 'They tear easily — was there no egg?' });
            if (items.some((i) => i.smooth < 0.5)) out.push({ pen: 8, text: 'There are little lumps of flour — the batter wasn’t whisked smooth.' });
            return out;
          },
          praise: 'Thin as lace and golden — real mlyntsi.',
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'Where’s the smetana, дитино?', high: 'That’s more smetana than mlyntsi.' },
        { ings: ['honey', 'cherryjam'], g: 15, pts: 8, low: 'A little honey or jam would be nice.', high: 'Far too much honey — sickly.' },
        { ings: ['sunoil', 'butter'], g: 5, pts: 4, low: null, high: 'They’re greasy.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0013, pts: 4, lowOk: true },
        sugar: { target: 0.0134, pts: 5, lowOk: true },
      },
      allowed: ['tvorog', 'water'],
    },

    // ------------------------------------------------------------------ U4
    {
      id: 'lazy-varenyky',
      cuisine: 'ukrainian',
      title: 'Lazy Varenyky (Ліниві вареники)',
      dish: 'lazy varenyky',
      diner: 'solomiia',
      blurb: 'Soft farmer’s-cheese dumplings, boiled and served with butter and smetana. Mum called them “lazy” — but they’re pure love.',
      serves: ['soupbowl', 'plate'],
      ingredients: ['1 cup farmer’s cheese (tvorog, about 200 g)', '1 egg', '1 tbsp sugar (12 g)', 'a pinch of salt', '5 tbsp flour (40 g)', 'about 1.5 litres of water and 1 tsp salt (6 g), for boiling', '2 tsp butter (10 g)', '2 tbsp smetana (30 g)'],
      steps: [
        'In a mixing bowl, whisk the farmer’s cheese, egg, sugar, salt and flour into a soft dough.',
        'Bring the water to a boil in a large pot over high heat and add the salt.',
        'Drop the dough into the boiling water with the ladle, one dollop at a time. Keep it boiling and cook for about 5 minutes, until the dumplings are firm and cooked through.',
        'Drain them over the sink, tip them into a soup bowl and top with the butter and smetana.',
      ],
      hint: 'Hold the pot over the empty sink to drain it: the water goes, the dumplings stay. No need to stir — every dollop is its own dumpling.',
      components: [
        {
          id: 'varenyky', label: 'lazy varenyky', missing: 'Where are the varenyky?', ing: 'tvorog', pts: 62, core: true, match: M.curd,
          uses: ['egg', 'flour', 'sugar'],
          grams: { g: 200, ing: 'tvorog', few: 'Is that all? Just a few little varenyky.', many: 'A whole mountain of varenyky! Mum would be proud.', manyPen: 0 },
          forms: { ok: ['set'], bad: { scrambled: [0.4, 'They’ve broken up into crumbs.'], fluid: [0.0, ''] } },
          cook: {
            range: [0.68, 2.4], soft: [0.5, 2.9], veryLowPen: 0.8,
            low: 'They’re a bit doughy in the middle.', veryLow: 'They’re raw inside!',
            high: 'They’re a little rubbery.', veryHigh: 'Tough and rubbery — overcooked.',
          },
          brown: { side: 'max', range: [0, 0.4], soft: [0, 1.0], high: 'They’re browned, like syrnyky.', veryHigh: 'They’re fried brown and crusty — varenyky should be soft and pale.' },
          custom(items) {
            const out = dollopIssues(items, {
              maxG: 90, method: 'boiled', wrongPen: 28,
              raw: 'Some of it is still raw dough!',
              giant: 'That’s one big lump — they should be little dumplings, one dollop each.',
              wrongMethod: 'You fried them — these are syrnyky! Lazy varenyky are boiled in water.',
            });
            const comp = {};
            for (const it of items) CK.addComp(comp, it.comp);
            const cheese = comp.tvorog || 0;
            if (cheese > 1) {
              const fl = (comp.flour || 0) / cheese;
              if (fl > 0.42) out.push({ pen: fl > 0.55 ? 24 : 14, text: 'They’re heavy and doughy — too much flour.' });
              else if (fl < 0.08) out.push({ pen: 8, text: 'They’re falling apart — the dough needed a bit more flour.' });
            }
            return out;
          },
          praise: 'Soft, tender and creamy — just like Mum’s!',
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'No smetana? Varenyky without smetana are just sad.', high: 'They’re swimming in smetana.' },
        { ing: 'butter', g: 10, pts: 6, low: 'A little butter on top would make them shine.', high: 'Very, very buttery.', lowSoft: true },
      ],
      seasoning: {
        salt: { target: 0.0012, pts: 4, lowOk: true },
        sugar: { target: 0.035, pts: 8, lowSoft: true },
      },
      allowed: ['honey', 'cherryjam', 'sunoil', 'water'],
    },

    // ------------------------------------------------------------------ U5
    {
      id: 'deruny',
      cuisine: 'ukrainian',
      title: 'Deruny (Деруни)',
      dish: 'deruny',
      diner: 'taras',
      blurb: 'Crispy potato pancakes made from grated potato and onion, fried golden and served with smetana.',
      serves: ['plate'],
      ingredients: ['2 potatoes (about 400 g)', '1 onion', '1 egg', '2½ tbsp flour (20 g)', '¾ tsp salt (4 g)', 'a pinch of black pepper', '2 tbsp sunflower oil (30 ml), for frying', '2 tbsp smetana (30 g), to serve'],
      steps: [
        'Grate the potatoes finely and mince the onion as finely as you can.',
        'In a mixing bowl, whisk the potato, onion, egg, flour, salt and pepper into a thick batter.',
        'Heat the oil in a frying pan over medium heat. Ladle in 4 dollops of batter, side by side, and fry for about 4 minutes, until deep golden underneath.',
        'Flip them and fry for 3 minutes more, until crisp and golden on both sides.',
        'Serve the deruny hot, with smetana on the side. (The batter makes about a dozen — fry the rest the same way for seconds.)',
      ],
      hint: 'On the board a potato goes diced → small dice → grated: keep chopping (about 18 chops) until it says grated. Only grated or minced bits whisk into a batter.',
      components: [
        {
          id: 'deruny', label: 'deruny', missing: 'Where are the deruny?', ing: 'potato', pts: 65, core: true, match: M.potatoBatter,
          uses: ['onion', 'egg', 'flour'],
          count: { n: 4, few: 'Just one or two deruny? I’m a hungry man!', many: 'A whole stack of deruny! Now we’re talking.', fewPen: 0.15, manyPen: 0 },
          forms: { ok: ['set'], bad: { scrambled: [0.4, 'They’ve fallen apart into a potato hash.'], fluid: [0.0, ''] } },
          cook: {
            range: [0.8, 2.4], soft: [0.6, 2.9], veryLowPen: 0.8,
            low: 'They’re a bit raw and starchy in the middle.', veryLow: 'They’re raw inside — grey, wet potato!',
            high: 'They’re a little dry.', veryHigh: 'Dry and leathery — overcooked.',
          },
          brown: {
            side: 'both', range: [0.6, 2.0], soft: [0.3, 2.6],
            low: 'They could be crispier — fry them until deep golden.', veryLow: 'Pale and soft — deruny should be crisp and golden!',
            high: 'They’re very dark.', veryHigh: 'These deruny are burnt!',
            oneSide: 'Only one side is crisp — they needed flipping.',
          },
          custom(items) {
            return dollopIssues(items, {
              maxG: 100, method: 'fried',
              raw: 'There’s raw potato batter on the plate!',
              giant: 'That’s one giant potato pancake — deruny are small, one spoonful each.',
              wrongMethod: 'These were boiled — deruny have to be fried!',
            });
          },
          praise: 'Crisp, golden and hot — proper deruny!',
        },
        {
          // only here to explain what went wrong when the potato wasn't grated
          id: 'chunks', label: 'potato', ing: 'potato', pts: 20, missingPen: 1e-6, match: M.ing('potato'),
          forms: { ok: ['grated', 'mashed'], bad: { diced: [1, 'The potato is in chunks — for deruny it has to be grated fine!'], 'small dice': [1, 'The potato is in little cubes — for deruny it has to be grated fine!'], wedges: [1, 'Potato wedges? Deruny are made from grated potato.'], whole: [1, 'A whole potato! It has to be grated.'], halved: [1, 'Potato halves? It has to be grated.'] } },
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'Where’s the smetana? Deruny without smetana — that’s a crime!', high: 'That’s a lot of smetana. Not that I mind.' },
        { ing: 'sunoil', g: 30, pts: 5, low: null, high: 'They’re greasy — dripping with oil.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0056, pts: 14 },
        pepper: { target: 0.0002, pts: 3, lowOk: true },
      },
      allowed: ['garlic', 'dill', 'butter', 'salo', 'lard'],
    },

    // ------------------------------------------------------------------ U6
    {
      id: 'kulish',
      cuisine: 'ukrainian',
      title: 'Kulish (Куліш)',
      dish: 'kulish',
      diner: 'taras',
      blurb: 'The Cossacks’ campfire supper: a thick millet and potato porridge-soup with crackling shkvarky and fried onion.',
      serves: ['soupbowl'],
      soup: true,
      vessel: { plate: [16, 'Kulish on a flat plate? It’s running everywhere!'] },
      ingredients: ['⅓ cup millet (60 g)', '3 cups water (700 ml)', '1 potato, diced', '¾ tsp salt (5 g)', '1 piece of salo (60 g), diced', '1 onion, diced', 'a sprig of dill, chopped'],
      steps: [
        'Bring the water to a boil in a saucepan. Add the millet, the potato and the salt, turn the heat down to medium-low and simmer for about 15 minutes, stirring now and then, until the millet is soft and the potato starts to fall apart.',
        'Meanwhile, put the salo in a dry frying pan over medium heat. Fry it for about 6 minutes, stirring, until the fat has run out and the pieces are crisp and golden — these are shkvarky.',
        'Add the onion to the pan and fry it in the lard for 5 minutes, until soft and golden.',
        'Tip the shkvarky, onion and lard into the saucepan, stir and simmer for 3 minutes more. The kulish should be thick, but still loose enough to ladle.',
        'Ladle it into a soup bowl and scatter the dill on top.',
      ],
      hint: 'Salo needs no oil: in a hot pan it renders its own fat. Stir it with the spatula so the little cubes crisp up evenly into shkvarky.',
      components: [
        {
          id: 'millet', label: 'millet', missing: 'Where’s the millet? Kulish without millet is just potato soup.', ing: 'millet', pts: 30, core: true, match: M.ing('millet'),
          grams: { g: 55, ing: 'millet', few: 'Hardly any millet in this.', many: 'Very thick with millet!', manyPen: 0.04 },
          cook: {
            range: [0.9, 2.6], soft: [0.6, 3.2],
            low: 'The millet is still a bit gritty.', veryLow: 'The millet is hard and raw!',
            high: 'The millet has gone gluey.', veryHigh: 'It’s all turned to glue.',
          },
          brown: { side: 'max', range: [0, 0.6], soft: [0, 1.4], high: 'It has caught on the bottom.', veryHigh: 'It’s burnt on the bottom — I can taste it.' },
          custom(items, ctx) {
            // a thick porridge-soup: some broth, but not a watery soup and not a dry porridge
            const solid = sum(ctx.items.filter((i) => i.kind === 'solid'), (i) => i.mass);
            const loose = sum(ctx.items.filter((i) => i.kind === 'fluid' && !i.lump), (i) => i.mass);
            if (solid < 1) return [];
            const r = loose / solid;
            if (r > 1.1) return [{ pen: r > 2 ? 18 : 9, text: 'It’s thin and watery — kulish should be thick enough to stand a spoon in.' }];
            if (r < 0.06) return [{ pen: 8, text: 'It’s gone dry and stiff — kulish should still be loose enough to ladle.' }];
            return [];
          },
          praise: 'Thick and creamy, just like at a Cossack camp!',
        },
        {
          id: 'potato', label: 'potato', missing: 'Where’s the potato?', ing: 'potato', pts: 15, core: true, match: M.ing('potato'),
          grams: { g: 180, ing: 'potato', few: 'Only a bit of potato.', many: 'Lots of potato!', manyPen: 0 },
          forms: { ok: ['diced', 'small dice', 'mashed'], bad: { whole: [0.7, 'A whole potato in my kulish!'], halved: [0.5, 'Big potato halves — they should be diced.'], wedges: [0.15, 'Big chunks of potato — dice it smaller.'] } },
          cook: { range: [0.85, 2.8], soft: [0.6, 3.6], low: 'The potato is still a bit hard.', veryLow: 'The potato is raw!', high: 'The potato has fallen apart completely.', veryHigh: 'The potato has dissolved into mush.' },
          praise: null,
        },
        {
          id: 'salo', label: 'shkvarky', missing: 'Where are the shkvarky? Kulish needs salo!', ing: 'salo', pts: 22, core: true, match: M.ing('salo'),
          grams: { g: 22, ing: 'salo', few: 'Just a few crumbs of shkvarky.', many: 'Loads of shkvarky — that’s how a Cossack likes it!', manyPen: 0 },
          forms: { ok: ['diced', 'strips'], bad: { slab: [0.4, 'A whole slab of salo? It should be diced and crisped into shkvarky.'] } },
          brown: { side: 'avg', range: [0, 2.2], soft: [0, 2.8], high: 'The shkvarky are very dark.', veryHigh: 'The shkvarky are burnt!' },
          custom(items) {
            const out = [];
            const m = sum(items, (i) => i.mass) || 1;
            const b = sum(items, (i) => (i.brownDown + i.brownUp) / 2 * i.mass) / m;
            const rend = sum(items, (i) => (i.rend || 0) * i.mass) / m;
            if (b < 0.3) out.push({ pen: 20, text: 'The salo is pale and flabby — it should be fried into crisp shkvarky.' });
            else if (b < 0.6) out.push({ pen: 7, text: 'The shkvarky could be crispier.' });
            if (rend < 0.15) out.push({ pen: 10, text: 'The salo is still fatty and chewy — the fat needed to render out.' });
            return out;
          },
          praise: 'Crunchy shkvarky — смачно!',
        },
        {
          id: 'onion', label: 'onion', missing: 'Where’s the fried onion?', ing: 'onion', pts: 10, match: M.ing('onion'),
          grams: { g: 130, ing: 'onion', few: 'Hardly any onion.', many: 'Lots of onion!', manyPen: 0.04, fewPen: 0.6 },
          forms: { ok: ['diced', 'chopped', 'minced', 'sliced'], bad: { whole: [0.8, 'A whole onion?!'], halved: [0.6, 'Onion halves? It should be diced.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The onion is still crunchy.', veryLow: 'The onion is raw!' },
          brown: { side: 'avg', range: [0, 1.9], soft: [0, 2.6], high: 'The onion is very dark.', veryHigh: 'The onion is burnt.' },
        },
        {
          id: 'dill', label: 'dill', ing: 'dill', pts: 6, missing: 'A little dill on top would be nice.', match: M.ing('dill'),
          grams: { g: 6, ing: 'dill', few: 'A little more dill would be nice.', many: 'That’s a whole lot of dill!', fewPen: 0.5 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { sprig: [0.6, 'A whole sprig of dill on top? Chop it!'] } },
        },
      ],
      amounts: [],
      seasoning: {
        salt: { target: 0.0056, pts: 14 },
        pepper: { target: 0.0002, pts: 3, lowOk: true },
      },
      allowed: ['lard', 'water', 'garlic', 'smetana', 'sunoil', 'butter', 'carrot'],
    },

    // ------------------------------------------------------------------ U7
    {
      id: 'green-borscht',
      cuisine: 'ukrainian',
      title: 'Green Borscht (Зелений борщ)',
      dish: 'green borscht',
      diner: 'halyna',
      blurb: 'Babusia’s spring soup: tangy sorrel and potato, with a halved boiled egg, dill and smetana.',
      serves: ['soupbowl'],
      soup: true,
      vessel: { plate: [18, 'Borscht on a flat plate? Ой лишенько, it’s running everywhere!'] },
      ingredients: ['4 cups water (1 litre)', '2 potatoes, diced', '1 onion, diced', '1 carrot, grated', '1 tbsp butter (15 g)', '2 tsp salt (12 g)', '3 bunches of sorrel (90 g), chopped', '1 egg', 'a sprig of dill, chopped', '2 tbsp smetana (30 g)'],
      steps: [
        'Bring the water to a boil in a large pot. Add the potatoes, turn the heat down to medium-low and let them simmer.',
        'Meanwhile, melt the butter in a frying pan over medium heat and fry the onion and carrot for 5 minutes, until soft. Tip them into the pot and add the salt.',
        'Hard-boil the egg: lower it into a saucepan of boiling water and cook for 10 minutes. Peel it and cut it in half.',
        'When the potatoes are tender (about 12 minutes in all), add the sorrel and simmer for 3 minutes more — it turns olive-green and makes the soup pleasantly sour.',
        'Ladle a bowlful into a soup bowl. Add the halved egg, sprinkle with dill and top with a spoonful of smetana.',
      ],
      hint: 'Click a boiled egg to peel it, then chop it once on the board to halve it. Sorrel needs only a few minutes, so add it at the very end.',
      components: [
        {
          id: 'broth', label: 'broth', missing: 'Where’s the soup? Borscht needs its broth!', ing: 'water', pts: 15, core: true, match: M.broth,
          grams: { g: 230, ing: 'water', few: 'There’s hardly any broth — more like a stew.', many: 'Lots of broth — fine.', manyPen: 0 },
          custom(items, ctx) {
            if ((ctx.comp.beet || 0) / (ctx.total || 1) > 0.004) return [{ pen: 14, text: 'Why is it red? Green borscht has no beetroot!' }];
            return [];
          },
        },
        {
          id: 'sorrel', label: 'sorrel', missing: 'Where’s the sorrel? Without sorrel it isn’t green borscht at all!', ing: 'sorrel', pts: 28, core: true, match: M.ing('sorrel'),
          grams: { g: 22, ing: 'sorrel', few: 'I can hardly taste the sorrel — it should be nice and sour.', many: 'So much sorrel — my mouth is puckering!', manyPen: 0.15 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { bunch: [0.4, 'A whole bunch of sorrel in my bowl? It should be chopped.'] } },
          cook: { range: [0.3, 99], soft: [0.1, 99], low: 'The sorrel is still raw — it needs a few minutes in the pot.', veryLow: 'The sorrel is completely raw — it should be simmered in the soup.' },
          praise: 'Lovely and tangy with sorrel.',
        },
        {
          id: 'potato', label: 'potato', missing: 'Where are the potatoes?', ing: 'potato', pts: 18, core: true, match: M.ing('potato'),
          grams: { g: 100, ing: 'potato', few: 'Only a few bits of potato.', many: 'Lots of potato!', manyPen: 0 },
          forms: { ok: ['diced', 'small dice'], bad: { whole: [0.7, 'A whole potato in my soup!'], halved: [0.5, 'Potato halves? Dice them.'], wedges: [0.15, 'Big potato chunks — dice them smaller.'], mashed: [0.2, 'The potato has been mashed into the soup.'], grated: [0.15, 'Grated potato? Dice it, дитино.'] } },
          cook: { range: [0.9, 2.6], soft: [0.65, 3.4], veryLowPen: 1.2, low: 'The potatoes are still a bit hard.', veryLow: 'The potatoes are raw!', high: 'The potatoes are falling apart.', veryHigh: 'The potatoes have turned to mush.' },
          praise: 'The potatoes are just tender.',
        },
        {
          id: 'egg', label: 'egg', missing: 'Where’s the egg? Green borscht needs half a boiled egg!', ing: 'egg', pts: 14, match: M.egg,
          forms: {
            ok: ['halved', 'chopped'],
            bad: { peeled: [0.15, 'A whole egg — cut it in half.'], whole: [0.6, 'The egg is still in its shell!'], cracked: [0.4, 'A runny poached egg? It should be hard-boiled.'], fluid: [0.4, 'Raw egg in the soup?'], set: [0.3, 'Egg pancake? It should be a hard-boiled egg.'], scrambled: [0.3, 'Scrambled egg? It should be a hard-boiled egg, halved.'] },
          },
          cook: { range: [1.15, 2.4], soft: [0.6, 3.0], low: 'The yolk is still soft — it should be hard-boiled.', veryLow: 'The egg is barely cooked!', high: 'The egg is overcooked — the yolk has gone grey.', veryHigh: 'The egg is rubbery.' },
        },
        {
          id: 'onion', label: 'onion', ing: 'onion', pts: 6, missing: 'There’s no onion in this.', match: M.ing('onion'),
          forms: { ok: ['diced', 'chopped', 'minced', 'sliced'], bad: { whole: [0.8, 'A whole onion in my soup!'], halved: [0.6, 'Onion halves? It should be diced.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The onion is still crunchy.', veryLow: 'The onion is raw!' },
          brown: { side: 'avg', range: [0, 1.9], soft: [0, 2.6], high: 'The onion got very dark.', veryHigh: 'Burnt onion — bitter.' },
        },
        {
          id: 'carrot', label: 'carrot', ing: 'carrot', pts: 5, missing: 'A little carrot would add some sweetness.', match: M.ing('carrot'),
          forms: { ok: ['grated', 'strips', 'diced', 'sliced'], bad: { whole: [0.8, 'A whole carrot in my soup!'] } },
          cook: { range: [0.5, 99], soft: [0.25, 99], low: 'The carrot is still crunchy.', veryLow: 'The carrot is raw!' },
        },
        {
          id: 'dill', label: 'dill', ing: 'dill', pts: 6, missing: 'Where’s the dill?', match: M.ing('dill'),
          grams: { g: 6, ing: 'dill', few: 'A little more dill would be nice.', many: 'That’s a whole lot of dill!', fewPen: 0.5 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { sprig: [0.6, 'A whole sprig of dill? Chop it!'] } },
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'Where’s the smetana? Borscht without smetana — ой лишенько!', high: 'That’s a bowl of smetana with a little soup in it.' },
        { ings: ['butter', 'sunoil'], g: 4, pts: 4, low: null, high: 'There’s a slick of fat on top.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0062, pts: 16 },
        pepper: { target: 0.0002, pts: 3, lowOk: true },
      },
      allowed: ['garlic', 'lard', 'salo'],
    },

    // ------------------------------------------------------------------ U8
    {
      id: 'borscht',
      cuisine: 'ukrainian',
      title: 'Ukrainian Borscht (Український борщ)',
      dish: 'Ukrainian borscht',
      diner: 'halyna',
      blurb: 'The finale: Babusia’s ruby-red borscht with beetroot, cabbage and potato, a little garlic, dill and a spoon of smetana.',
      serves: ['soupbowl'],
      soup: true,
      vessel: { plate: [18, 'Borscht on a flat plate?! Ой лишенько, it’s all over the table!'] },
      ingredients: ['5 cups water (1.2 litres)', '1 beetroot, cut into strips', '1 potato, diced', 'a wedge of cabbage (250 g), shredded', '1 carrot, cut into strips', '1 onion, diced', '2 tbsp sunflower oil (20 ml)', '2 tbsp tomato paste (30 g)', '2 tsp salt (12 g)', '1 tsp sugar (4 g)', '1 garlic clove, minced', 'a sprig of dill, chopped', '2 tbsp smetana (30 g), to serve'],
      steps: [
        'Bring the water to a boil in a large pot. Add the beetroot, turn the heat down to medium-low and simmer for 5 minutes — the broth starts to turn ruby red.',
        'Add the potato and keep simmering.',
        'Meanwhile make the zazharka: heat the oil in a frying pan over medium heat and fry the onion and carrot for 5 minutes, stirring, until soft. Stir in the tomato paste and fry for 1 minute more.',
        'Add the cabbage, the zazharka, the salt and the sugar to the pot. Simmer for about 8 minutes, until the cabbage and potato are tender.',
        'Stir in the garlic, simmer for 1 minute more and take the pot off the heat.',
        'Ladle a bowlful into a soup bowl, add a spoonful of smetana and scatter with dill. Смачного!',
      ],
      hint: 'Beetroot only gives up its colour while it simmers in the broth, so cut it into strips and give it time. Use the tasting spoon before you serve to check the salt.',
      components: [
        {
          id: 'broth', label: 'broth', missing: 'Where’s the ruby broth? Without beetroot in the broth, this isn’t borscht!', ing: 'beetroot', pts: 22, core: true, match: M.beetBroth,
          uses: ['beet', 'tomato'],
          grams: { g: 210, ing: 'water', few: 'There’s hardly any broth — this is a stew, not borscht.', many: 'A generous bowl of broth.', manyPen: 0 },
          custom(items) {
            const comp = {};
            for (const it of items) CK.addComp(comp, it.comp);
            const ruby = (comp.beet || 0) / ((comp.beet || 0) + (comp.water || 0) + 1e-6);
            if (ruby < 0.02) return [{ pen: ruby < 0.014 ? 14 : 7, text: 'The broth is pale pink — borscht should be deep ruby red. Give the beetroot more time.' }];
            return [];
          },
          praise: 'Look at that colour — deep ruby red, like it should be.',
        },
        {
          id: 'beetroot', label: 'beetroot', missing: 'Where’s the beetroot?', ing: 'beetroot', pts: 20, core: true, match: M.ing('beetroot'),
          grams: { g: 35, ing: 'beetroot', few: 'Hardly any beetroot in my bowl.', many: 'Lots of beetroot!', manyPen: 0 },
          forms: { ok: ['strips', 'grated'], bad: { whole: [1, 'A whole beetroot in my bowl?! It should be cut into strips.'], halved: [0.6, 'Beetroot halves? Cut it into thin strips!'], sliced: [0.2, 'Big beetroot slices — strips, дитино, thin strips.'], diced: [0.08, 'Beetroot cubes — fine, but I cut mine into strips.'] } },
          cook: { range: [0.9, 2.8], soft: [0.6, 3.4], low: 'The beetroot is still a bit crunchy.', veryLow: 'The beetroot is raw!', high: 'The beetroot has gone very soft.', veryHigh: 'The beetroot is cooked to mush.' },
          praise: 'The beetroot is tender.',
        },
        {
          id: 'cabbage', label: 'cabbage', missing: 'Where’s the cabbage?', ing: 'cabbage', pts: 14, core: true, match: M.ing('cabbage'),
          grams: { g: 55, ing: 'cabbage', few: 'Only a little cabbage.', many: 'Lots of cabbage!', manyPen: 0 },
          forms: { ok: ['shredded', 'finely shredded'], bad: { wedge: [0.7, 'A whole wedge of cabbage in my bowl? It should be shredded!'] } },
          cook: { range: [0.7, 3.2], soft: [0.4, 3.9], low: 'The cabbage is still crunchy.', veryLow: 'The cabbage is raw!', high: 'The cabbage is very soft.', veryHigh: 'The cabbage has boiled to mush.' },
        },
        {
          id: 'potato', label: 'potato', missing: 'Where’s the potato?', ing: 'potato', pts: 12, core: true, match: M.ing('potato'),
          grams: { g: 45, ing: 'potato', few: 'Only a little potato.', many: 'Lots of potato!', manyPen: 0 },
          forms: { ok: ['diced', 'small dice', 'wedges'], bad: { whole: [0.7, 'A whole potato in my bowl!'], halved: [0.5, 'Potato halves? Dice them.'], mashed: [0.2, 'The potato is mashed into the soup.'], grated: [0.15, 'Grated potato? Dice it.'] } },
          cook: { range: [0.9, 2.6], soft: [0.65, 3.4], veryLowPen: 1.2, low: 'The potato is still a bit hard.', veryLow: 'The potato is raw!', high: 'The potato is falling apart.', veryHigh: 'The potato has turned to mush.' },
        },
        {
          id: 'carrot', label: 'carrot', missing: 'Where’s the carrot?', ing: 'carrot', pts: 5, match: M.ing('carrot'),
          forms: { ok: ['strips', 'grated', 'diced'], bad: { whole: [0.8, 'A whole carrot in my soup!'], sliced: [0.15, 'Carrot coins? Strips, please.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The carrot is still crunchy.', veryLow: 'The carrot is raw!' },
        },
        {
          id: 'onion', label: 'onion', missing: 'There’s no onion in this.', ing: 'onion', pts: 5, match: M.ing('onion'),
          forms: { ok: ['diced', 'chopped', 'minced', 'sliced'], bad: { whole: [0.8, 'A whole onion in my soup!'], halved: [0.6, 'Onion halves? It should be diced.'] } },
          cook: { range: [0.6, 99], soft: [0.3, 99], low: 'The onion is still crunchy.', veryLow: 'The onion is raw!' },
          brown: { side: 'avg', range: [0, 1.9], soft: [0, 2.6], high: 'The onion got very dark.', veryHigh: 'Burnt onion — bitter.' },
        },
        {
          id: 'garlic', label: 'garlic', ing: 'garlic', pts: 3, missing: 'A little garlic would make it sing.', match: M.ing('garlic'),
          forms: { ok: ['minced', 'chopped', 'sliced'], bad: { clove: [0.5, 'A whole garlic clove?'] } },
          brown: { side: 'max', range: [0, 1.8], soft: [0, 2.5], high: 'The garlic is quite brown.', veryHigh: 'The garlic is burnt and bitter.' },
        },
        {
          id: 'dill', label: 'dill', ing: 'dill', pts: 5, missing: 'Where’s the dill?', match: M.ing('dill'),
          grams: { g: 6, ing: 'dill', few: 'A little more dill would be nice.', many: 'That’s a whole lot of dill!', fewPen: 0.5 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { sprig: [0.6, 'A whole sprig of dill? Chop it!'] } },
        },
      ],
      amounts: [
        { ing: 'smetana', g: 30, pts: 16, low: 'Where’s the smetana? Borscht without smetana — ой лишенько!', high: 'That’s a bowl of smetana with a little borscht in it.' },
        { ing: 'sunoil', g: 9, pts: 4, low: null, high: 'There’s a slick of oil on top.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0055, pts: 16 },
        // the balance: a little sweetness from sugar against the tang of the tomato
        sugar: { target: 0.0018, pts: 5, lowOk: true },
        tomato: { target: 0.0111, pts: 14, low: 'It tastes flat — it needs the tang of tomato paste.', high: 'Too much tomato — it tastes like tomato soup.', veryHigh: 'This is tomato soup with a bit of beetroot!' },
        pepper: { target: 0.0002, pts: 3, lowOk: true },
      },
      allowed: ['garlic', 'lard', 'salo', 'butter', 'ryebread', 'water'],
    },
  ];

  CK.RECIPE = {};
  for (const r of CK.RECIPES) CK.RECIPE[r.id] = r;
  CK.recipesFor = (cuisine) => CK.RECIPES.filter((r) => (r.cuisine || 'classics') === cuisine);
})();
