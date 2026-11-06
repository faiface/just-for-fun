// Levels: a recipe (written like a real one), who you're cooking for, and what the finished dish
// should be like. The judge compares the served dish against `components`, `amounts` and
// `seasoning` — it never looks at which steps you took.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;

  const clsOf = (it) => (it.kind === 'set' ? it.cls : it.kind === 'fluid' ? CK.classify(it.comp) : null);
  const M = {
    ing: (...ids) => (it) => it.kind === 'solid' && ids.includes(it.ing),
    egg: (it) => (it.kind === 'solid' && it.ing === 'egg') || ((it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'eggs'),
    batter: (it) => (it.kind === 'set' || it.kind === 'fluid') && clsOf(it) === 'batter',
    tomato: (it) => it.kind === 'fluid' && clsOf(it) === 'tomato',
  };
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
  };

  CK.RECIPES = [
    // ------------------------------------------------------------------ 1
    {
      id: 'fried-egg',
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
      id: 'egg-toast',
      title: 'Soft-Boiled Egg & Toast',
      diner: 'mila',
      blurb: 'A jammy boiled egg with buttered toast.',
      serves: ['plate'],
      ingredients: ['1 egg', '1 slice of bread', '1 tsp butter (5 g)', 'a pinch of salt', 'about 1 litre of water'],
      steps: [
        'Fill a saucepan with about 1 litre of water and bring it to a rolling boil over high heat.',
        'Gently lower in the egg and boil it for 6 minutes for a set white and a soft, jammy yolk.',
        'Meanwhile, toast the bread until golden on both sides and put it on a plate with the butter.',
        'Lift the egg out of the water onto the plate, add a pinch of salt and serve.',
      ],
      hint: 'Put the saucepan in the sink and turn on the tap to fill it. The toaster dial sets how dark the toast gets.',
      components: [
        {
          id: 'egg', label: 'boiled egg', missing: 'Where is the egg?', ing: 'egg', pts: 45, core: true, match: M.egg,
          count: { n: 1, few: 'Where is the egg?', many: 'Two eggs? I only wanted one.' },
          forms: {
            ok: ['whole', 'peeled', 'halved'],
            bad: {
              cracked: [0.6, 'This is a fried egg — I wanted it boiled in its shell.'],
              fluid: [0.6, "That's not a boiled egg at all."], scrambled: [0.6, "Scrambled? I wanted a boiled egg."], set: [0.6, 'An omelette? I wanted a boiled egg.'],
              chopped: [0.25, "You chopped my egg up! I wanted to dip my toast in it."],
            },
          },
          cook: {
            range: [0.62, 1.2], soft: [0.4, 1.55],
            low: 'The yolk is still a bit too runny, and the white is wobbly.', veryLow: 'The egg is barely cooked — runny white!',
            high: 'The yolk is a bit firm. I wanted it jammy.', veryHigh: "It's hard-boiled. I can't dip my toast!",
          },
          custom(items) {
            const it = items[0];
            if (it && it.form === 'whole' && it.method === 'fried') return [{ pen: 20, text: 'This egg was cooked in a pan… in its shell?' }];
            return [];
          },
          praise: 'Oh, the yolk is perfectly jammy!',
        },
        {
          id: 'toast', label: 'toast', missing: 'No toast?', ing: 'bread', pts: 30, core: true, match: M.ing('bread'),
          count: { n: 1, few: 'No toast?', many: 'Extra toast! I won’t complain… much.' , manyPen: 0.05 },
          forms: { ok: ['slice', 'halved'], bad: { cubes: [0.3, 'Why is my toast cut into little cubes?'] } },
          brown: {
            side: 'both', range: [0.6, 1.8], soft: [0.3, 2.5],
            low: 'The toast is barely toasted.', veryLow: "That's just plain bread, not toast.",
            high: 'The toast is quite dark.', veryHigh: 'The toast is burnt!',
            oneSide: 'The toast is only toasted on one side.',
          },
          praise: 'And the toast is nice and golden.',
        },
      ],
      amounts: [
        { ing: 'butter', g: 5, pts: 8, low: 'Dry toast… where’s the butter?', high: 'That is a LOT of butter.' },
      ],
      seasoning: {
        salt: { target: 0.0045, pts: 10, lowSoft: true },
      },
      allowed: ['oil', 'pepper'],
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'scrambled',
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

    // ------------------------------------------------------------------ 4
    {
      id: 'pancakes',
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

    // ------------------------------------------------------------------ 5
    {
      id: 'aglio',
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

    // ------------------------------------------------------------------ 6
    {
      id: 'soup',
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

    // ------------------------------------------------------------------ 7
    {
      id: 'home-fries',
      title: 'Golden Home Fries',
      diner: 'theo',
      blurb: 'Crispy, golden, tender cubes of potato.',
      serves: ['plate'],
      ingredients: ['1 large potato (about 200 g), diced', '2 tbsp olive oil (27 ml)', '¼ tsp salt (1.5 g)', 'a pinch of black pepper', 'a little chopped parsley, to finish'],
      steps: [
        'Dice the potato into small cubes.',
        'Heat the olive oil in a frying pan over medium heat. Add the potato in a single layer.',
        'Cook for about 12–15 minutes, stirring every couple of minutes, until golden on all sides and tender inside.',
        'Season with the salt and pepper, toss with the parsley and serve hot.',
      ],
      hint: 'Use the spatula or a spoon on the pan to stir so every side gets golden.',
      components: [
        {
          id: 'potato', label: 'potatoes', missing: 'Where are the potatoes?', ing: 'potato', pts: 60, core: true, match: M.ing('potato'),
          grams: { g: 200, ing: 'potato', few: 'Only a few bits of potato?', many: 'A mountain of potatoes!', manyPen: 0.05 },
          forms: {
            ok: ['diced', 'small dice'],
            bad: { whole: [0.75, 'A whole potato? I thought these were fries.'], halved: [0.5, 'These are giant potato halves, not home fries.'], wedges: [0.15, 'These are wedges — big chunks, but okay.'], mashed: [0.5, 'This is basically mashed potato.'] },
          },
          cook: {
            range: [0.95, 2.6], soft: [0.75, 3.2],
            low: 'The potatoes are still a bit hard inside.', veryLow: 'The potatoes are raw and crunchy inside!',
            high: 'They are a little mushy.', veryHigh: 'Mushy potatoes, falling apart.',
          },
          brown: {
            side: 'avg', range: [0.75, 2.0], soft: [0.4, 2.6],
            low: 'They are quite pale — not very crispy.', veryLow: 'No colour at all. Boiled potatoes?',
            high: 'Quite dark and a bit bitter.', veryHigh: 'Burnt potatoes!',
          },
          custom(items) {
            const it = items[0];
            if (!it) return [];
            const hi = Math.max(it.brownDown, it.brownUp), lo = Math.min(it.brownDown, it.brownUp);
            if (hi - lo > 1.1) return [{ pen: hi > 2.5 ? 16 : 11, text: (hi > 2.5 ? 'Burnt' : 'Brown') + ' on one side and pale on the other — they needed more stirring.' }];
            return [];
          },
          praise: 'Crispy outside, fluffy inside. Yes!',
        },
        {
          id: 'parsley', label: 'parsley', ing: 'parsley', pts: 6, missing: 'You forgot the green stuff. I mean… I don’t mind.', match: M.ing('parsley'),
          grams: { g: 8, ing: 'parsley', few: 'You forgot the green stuff. I mean… I don’t mind.', many: 'So much parsley.', fewPen: 0.4 },
          forms: { ok: ['chopped', 'finely chopped'], bad: { bunch: [0.6, 'Why is there a whole bunch of parsley on my plate?'] } },
        },
      ],
      amounts: [
        { ing: 'oil', g: 27, pts: 8, low: 'They seem dry — not enough oil.', high: 'So greasy!' },
      ],
      seasoning: {
        salt: { target: 0.0064, pts: 16 },
        pepper: { target: 0.0007, pts: 4 },
      },
      allowed: ['butter', 'garlic', 'onion', 'chili'],
    },

    // ------------------------------------------------------------------ 8
    {
      id: 'chicken',
      title: 'Pan-Seared Chicken Breast',
      diner: 'ines',
      blurb: 'Golden outside, juicy inside — and cooked through!',
      serves: ['plate'],
      ingredients: ['1 chicken breast (about 180 g)', '¼ tsp salt (1.5 g)', 'a pinch of black pepper', '1 tbsp olive oil (14 ml)', '1 tbsp butter (14 g)'],
      steps: [
        'Season the chicken breast all over with the salt and pepper.',
        'Heat the olive oil in a frying pan over medium heat.',
        'Lay the chicken in the pan and cook it without moving it for about 6 minutes, until deep golden underneath. Flip it.',
        'Add the butter and cook for another 5–6 minutes, until cooked through.',
        'Let it rest for a minute, then serve.',
      ],
      hint: 'Use the spatula: click the chicken in the pan to flip it.',
      components: [
        {
          id: 'chicken', label: 'chicken', missing: 'Where is the chicken?', ing: 'chicken', pts: 70, core: true, match: M.ing('chicken'),
          count: { n: 1, few: 'Where is the chicken?', many: 'Two chicken breasts! Generous.', manyPen: 0.04 },
          forms: { ok: ['whole', 'halved'], bad: { strips: [0.15, 'Chicken strips — not quite what I expected, but fine.'], diced: [0.25, 'Little chicken cubes? I wanted a breast.'] } },
          cook: {
            range: [1.0, 1.55], soft: [0.97, 2.0],
            low: 'It is a touch pink in the very middle.', veryLow: 'This chicken is raw in the middle. I am not eating that — it is not safe!',
            high: 'It is a little dry.', veryHigh: 'Dry and stringy. Overcooked.',
            veryLowPen: 1.1,
          },
          brown: {
            side: 'both', range: [0.8, 2.2], soft: [0.45, 2.8],
            low: 'It is quite pale.', veryLow: 'There is no colour on it at all.',
            high: 'The outside is very dark.', veryHigh: 'The outside is burnt.',
            oneSide: 'One side is golden, the other is pale.',
          },
          praise: 'Juicy, golden and cooked just right.',
        },
      ],
      amounts: [
        { ing: 'butter', g: 14, pts: 5, low: 'A bit of butter would have made it richer.', high: 'Very buttery.', lowSoft: true },
        { ing: 'oil', g: 14, pts: 4, low: null, high: 'Greasy.', lowOk: true },
      ],
      seasoning: {
        salt: { target: 0.0076, pts: 16 },
        pepper: { target: 0.0008, pts: 4 },
      },
      allowed: ['garlic', 'parsley'],
    },
  ];

  CK.RECIPE = {};
  for (const r of CK.RECIPES) CK.RECIPE[r.id] = r;
})();
