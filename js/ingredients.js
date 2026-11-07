// Ingredient definitions. Everything the simulation knows about food lives here as data.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;

  // Form helper: id, chop clicks needed to reach it, size factor (cooking speed / heat lag),
  // bulk = many small pieces (merges with same, gets stirred evenly), f = how much of the pan
  // heat reaches the inside when frying (thin things heat through better).
  const F = (id, at, size, bulk, f, label) => ({ id, at, size, bulk: !!bulk, f: f || 0.6, label: label || id });

  const STD_BROWN = [
    [0.3, ''], [0.8, 'lightly golden'], [1.6, 'golden-brown'], [2.4, 'dark brown'], [3.2, 'burnt'], [99, 'charred'],
  ];

  CK.ING = {
    // ---------------- fridge ----------------
    egg: {
      name: 'egg', plural: 'eggs', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 50,
      moist: true, spec: 3.4, cook: { onset: 62, time: 300, tau: 60 }, brownTime: 50, flippable: true,
      color: '#f4e9d8',
      forms: [F('whole', 0, 1, false, 0.5, 'whole'), F('cracked', null, 0.33, false, 0.8), F('peeled', null, 1, false, 0.5),
        F('halved', 1, 0.6, false, 0.6), F('chopped', 3, 0.3, true, 0.7)],
      taste: {},
    },
    butter: {
      name: 'butter', phase: 'fat', source: 'pour', storage: 'fridge', spec: 2.2, perTsp: 4.7, pourRate: 9,
      color: '#f6dc7a', brownTime: 45, burnAt: 135, burnSpan: 60, burnTime: 45,
    },
    milk: {
      name: 'milk', phase: 'liquid', source: 'pour', storage: 'fridge', spec: 3.9, perTsp: 5, pourRate: 45,
      color: '#fbfaf3',
    },
    chicken: {
      overcook: 2.0, name: 'chicken breast', plural: 'chicken breasts', short: 'chicken', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 180,
      moist: true, spec: 3.5, cook: { onset: 55, time: 290, tau: 150 }, brownTime: 120, flippable: true,
      color: '#f2b5ab',
      forms: [F('whole', 0, 1, false, 0.62), F('halved', 1, 0.7, false, 0.66), F('strips', 3, 0.35, true, 0.75), F('diced', 6, 0.22, true, 0.8)],
      stages: [[0.5, 'raw'], [0.95, 'pink inside'], [1.55, 'juicy and cooked through'], [2.0, 'a bit dry'], [99, 'dry and stringy']],
    },
    bacon: {
      name: 'bacon strip', plural: 'bacon strips', short: 'bacon', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 25,
      moist: true, spec: 3, cook: { onset: 60, time: 160, tau: 25 }, brownTime: 85, flippable: true,
      color: '#ec9b93',
      forms: [F('strip', 0, 1, false, 0.8), F('chopped', 2, 0.4, true, 0.8)],
      stages: [[0.4, 'raw'], [1, 'chewy'], [99, 'cooked']],
    },
    parsley: {
      name: 'parsley', plural: 'parsley', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 8,
      moist: true, spec: 3.8, cook: { onset: 55, time: 60, tau: 6 }, brownTime: 30,
      color: '#3f8f3a', herb: true,
      forms: [F('bunch', 0, 1, false, 0.8, 'bunch of'), F('chopped', 2, 0.4, true, 0.9), F('finely chopped', 5, 0.25, true, 0.9)],
      stages: [[0.35, 'fresh'], [1.2, 'wilted'], [99, 'cooked down']],
    },
    tomato: {
      veg: true,
      name: 'tomato', plural: 'tomatoes', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 120,
      moist: true, spec: 3.9, cook: { onset: 55, time: 400, tau: 70 }, brownTime: 140,
      color: '#d8392c',
      forms: [F('whole', 0, 1, false, 0.5), F('halved', 1, 0.7, false, 0.6), F('sliced', 3, 0.4, true, 0.75), F('diced', 6, 0.25, true, 0.8)],
      stages: [[0.3, 'raw'], [1, 'warmed through'], [99, 'stewed']],
    },
    // ---------------- basket / bread box ----------------
    onion: {
      veg: true,
      name: 'onion', plural: 'onions', phase: 'solid', source: 'unit', storage: 'basket', unitMass: 150,
      moist: true, spec: 3.8, cook: { onset: 60, time: 900, tau: 160 }, brownTime: 230,
      color: '#f3ead6',
      forms: [F('whole', 0, 1, false, 0.45), F('halved', 1, 0.75, false, 0.55), F('sliced', 3, 0.35, true, 0.75),
        F('chopped', 6, 0.3, true, 0.75), F('diced', 10, 0.24, true, 0.78), F('minced', 16, 0.15, true, 0.8)],
      stages: [[0.2, 'raw'], [0.7, 'slightly softened'], [1.7, 'soft and translucent'], [3.5, 'very soft'], [99, 'melted']],
    },
    garlic: {
      name: 'garlic clove', plural: 'garlic cloves', short: 'garlic', phase: 'solid', source: 'unit', storage: 'basket', unitMass: 5,
      moist: true, spec: 3.5, cook: { onset: 60, time: 400, tau: 25 }, brownTime: 26,
      color: '#f5efdc',
      forms: [F('clove', 0, 1, false, 0.6, 'whole'), F('sliced', 3, 0.35, true, 0.8), F('chopped', 6, 0.25, true, 0.8), F('minced', 10, 0.15, true, 0.85)],
      stages: [[0.25, 'raw'], [1, 'mellow'], [99, 'soft']],
    },
    potato: {
      veg: true,
      overcook: 2.6, name: 'potato', plural: 'potatoes', phase: 'solid', source: 'unit', storage: 'basket', unitMass: 200,
      moist: true, spec: 3.6, cook: { onset: 65, time: 1700, tau: 300 }, brownTime: 120,
      color: '#f1e2b0',
      forms: [F('whole', 0, 1, false, 0.45), F('halved', 1, 0.75, false, 0.55), F('wedges', 3, 0.45, true, 0.65),
        F('diced', 7, 0.3, true, 0.72), F('small dice', 12, 0.2, true, 0.78), F('grated', 18, 0.12, true, 0.8), F('mashed', 30, 0.15, true, 0.8)],
      stages: [[0.4, 'raw'], [0.85, 'still hard in the middle'], [1.6, 'tender'], [2.6, 'very soft'], [99, 'falling apart']],
    },
    bread: {
      name: 'slice of bread', plural: 'slices of bread', short: 'bread', phase: 'solid', source: 'unit', storage: 'breadbox', unitMass: 35,
      // bread soaks up liquid it sits in (French toast!); its "cook" only matters once soaked in egg
      moist: false, spec: 1.8, cook: { onset: 62, time: 220, tau: 30 }, brownTime: 95, flippable: true, soaks: 1.4, bread: true,
      color: '#f3dfb2',
      forms: [F('slice', 0, 1, false, 0.9), F('halved', 1, 0.7, false, 0.9), F('cubes', 4, 0.3, true, 0.9)],
    },
    // ---------------- pantry (poured) ----------------
    water: { name: 'water', phase: 'liquid', source: 'tap', spec: 4.18, perTsp: 5, color: '#9fd0ee' },
    salt: { name: 'salt', phase: 'powder', source: 'pour', storage: 'shelf', spec: 0.9, perTsp: 6, pinch: 0.4, pourRate: 2.6, color: '#ffffff', brownTime: null, dissolves: true },
    pepper: { name: 'black pepper', short: 'pepper', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1, perTsp: 2.3, pinch: 0.15, pourRate: 0.7, color: '#3a312c', brownTime: 70 },
    chili: { name: 'chili flakes', short: 'chili', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1, perTsp: 1.8, pinch: 0.2, pourRate: 0.9, color: '#c4391f', brownTime: 60 },
    sugar: { name: 'sugar', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1.2, perTsp: 4.2, pinch: 0.4, pourRate: 10, color: '#fffdf6', brownTime: 120, dissolves: true },
    flour: { name: 'flour', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1.6, perTsp: 2.6, pourRate: 45, color: '#f3eee2', brownTime: 160, lumps: true },
    bakingpowder: { name: 'baking powder', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1, perTsp: 4, pinch: 0.3, pourRate: 4, color: '#f7f7f4', brownTime: null, dissolves: true },
    parmesan: { name: 'grated parmesan', short: 'parmesan', phase: 'powder', source: 'pour', storage: 'fridge', spec: 2, perTsp: 1.7, pourRate: 8, color: '#f2e2a0', brownTime: 80 },
    oil: { name: 'olive oil', phase: 'fat', source: 'pour', storage: 'shelf', spec: 2, perTsp: 4.5, pourRate: 20, color: '#d6c04a', brownTime: 70, burnAt: 205, burnSpan: 40, burnTime: 40 },
    syrup: { name: 'maple syrup', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 2.5, perTsp: 6.6, pourRate: 14, color: '#a85a1c' },
    cannedtom: { name: 'crushed tomatoes', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 3.9, perTsp: 5, pourRate: 110, color: '#c6392a', comp: { tomato: 0.3, water: 0.7 } },
    spaghetti: {
      overcook: 1.7, name: 'spaghetti', plural: 'spaghetti', phase: 'solid', source: 'pour', storage: 'shelf', spec: 1.8, perTsp: null, pourRate: 45,
      moist: false, cook: { onset: 70, time: 470, tau: 18 }, brownTime: 110, absorb: 1.5,
      color: '#ead28a',
      forms: [F('strands', 0, 1, true, 0.8), F('broken', 2, 0.6, true, 0.8)],
      stages: [[0.3, 'raw and hard'], [0.85, 'crunchy in the middle'], [1.38, 'al dente'], [1.7, 'soft'], [99, 'mushy']],
    },
    rice: {
      overcook: 1.8, name: 'rice', plural: 'rice', phase: 'solid', source: 'pour', storage: 'shelf', spec: 1.8, perTsp: 4.6, pourRate: 40,
      moist: false, cook: { onset: 70, time: 700, tau: 18 }, brownTime: 110, absorb: 2.0,
      color: '#f6f1e2',
      forms: [F('grains', 0, 1, true, 0.8)],
      stages: [[0.3, 'raw and hard'], [0.8, 'chalky'], [1.3, 'tender'], [1.8, 'soft'], [99, 'mushy']],
    },
    // ---------------- added ingredients ----------------
    bellpepper: {
      veg: true,
      name: 'bell pepper', plural: 'bell peppers', short: 'pepper', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 150,
      moist: true, spec: 3.9, cook: { onset: 60, time: 520, tau: 110 }, brownTime: 140, overcook: 3.5,
      color: '#d8342a',
      forms: [F('whole', 0, 1, false, 0.5), F('halved', 1, 0.7, false, 0.6), F('strips', 3, 0.3, true, 0.78), F('diced', 6, 0.22, true, 0.8)],
      stages: [[0.3, 'raw and crunchy'], [0.8, 'crisp-tender'], [1.8, 'soft'], [99, 'very soft']],
    },
    mushroom: {
      veg: true,
      name: 'mushroom', plural: 'mushrooms', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 20,
      moist: true, spec: 3.9, cook: { onset: 55, time: 600, tau: 45 }, brownTime: 105, overcook: 4,
      color: '#dcc6a6',
      forms: [F('whole', 0, 1, false, 0.6), F('halved', 1, 0.6, false, 0.7), F('sliced', 3, 0.3, true, 0.8), F('chopped', 6, 0.22, true, 0.82)],
      stages: [[0.3, 'raw'], [1, 'tender'], [99, 'soft']],
    },
    chives: {
      name: 'chives', plural: 'chives', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 5,
      moist: true, spec: 3.8, cook: { onset: 55, time: 50, tau: 5 }, brownTime: 30,
      color: '#4c9a3c', herb: true,
      forms: [F('bunch', 0, 1, false, 0.8, 'bunch of'), F('chopped', 2, 0.4, true, 0.9), F('finely chopped', 5, 0.25, true, 0.9)],
      stages: [[0.35, 'fresh'], [1.2, 'wilted'], [99, 'cooked down']],
    },
    basil: {
      name: 'basil', plural: 'basil', phase: 'solid', source: 'unit', storage: 'pot', unitMass: 6,
      moist: true, spec: 3.8, cook: { onset: 55, time: 50, tau: 5 }, brownTime: 30,
      color: '#3d8b40', herb: true,
      forms: [F('leaves', 0, 1, false, 0.8, 'sprig of'), F('torn', 1, 0.5, true, 0.9), F('chopped', 3, 0.3, true, 0.9)],
      stages: [[0.35, 'fresh'], [1.2, 'wilted'], [99, 'cooked down']],
    },
    banana: {
      name: 'banana', plural: 'bananas', phase: 'solid', source: 'unit', storage: 'fruit', unitMass: 120,
      moist: true, spec: 3.4, cook: { onset: 60, time: 300, tau: 60 }, brownTime: 80, mash: 'raw',
      color: '#f5d46a',
      forms: [F('whole', 0, 1, false, 0.5), F('halved', 1, 0.7, false, 0.6), F('sliced', 3, 0.3, true, 0.8), F('chopped', 6, 0.22, true, 0.8), F('mashed', 14, 0.2, true, 0.85)],
      stages: [[0.3, 'fresh'], [1, 'warm'], [99, 'soft and jammy']],
    },
    oats: {
      overcook: 2.4, name: 'rolled oats', short: 'oats', plural: 'oats', phase: 'solid', source: 'pour', storage: 'shelf', spec: 1.8, perTsp: 1.5, pourRate: 30,
      moist: false, cook: { onset: 70, time: 230, tau: 12 }, brownTime: 100, absorb: 4.5,
      color: '#e3cf9f',
      forms: [F('rolled', 0, 1, true, 0.8)],
      stages: [[0.3, 'raw and dry'], [0.8, 'chewy'], [1.6, 'creamy'], [2.4, 'thick'], [99, 'gluey']],
    },
    cheddar: { name: 'grated cheddar', short: 'cheddar', phase: 'powder', source: 'pour', storage: 'fridge', spec: 2, perTsp: 2.5, pourRate: 10, color: '#f2b33d', brownTime: 70 },
    cinnamon: { name: 'cinnamon', phase: 'powder', source: 'pour', storage: 'shelf', spec: 1, perTsp: 2.6, pinch: 0.2, pourRate: 1.2, color: '#9a5b2e', brownTime: 90 },
    honey: { name: 'honey', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 2.5, perTsp: 7, pourRate: 10, color: '#e0a12a' },
    soy: { name: 'soy sauce', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 3.8, perTsp: 5.5, pourRate: 8, color: '#3b2416', comp: { soy: 0.84, salt: 0.16 } },

    // ---------------- Ukrainian kitchen ----------------
    beetroot: {
      veg: true, overcook: 3, name: 'beetroot', plural: 'beetroots', phase: 'solid', source: 'unit', storage: 'fruit', unitMass: 200,
      moist: true, spec: 3.8, cook: { onset: 65, time: 2400, tau: 320 }, brownTime: 160,
      // simmered in liquid it bleeds part of its colour (and a little mass) into the pool as 'beet'
      leach: { key: 'beet', max: 0.22, rate: 0.0006 },
      color: '#7a1f3d',
      forms: [F('whole', 0, 1, false, 0.45), F('halved', 1, 0.75, false, 0.55), F('sliced', 3, 0.4, true, 0.72),
        F('strips', 6, 0.25, true, 0.78, '% strips'), F('diced', 10, 0.22, true, 0.8), F('grated', 15, 0.12, true, 0.85)],
      stages: [[0.4, 'raw and crunchy'], [0.9, 'still firm'], [1.7, 'tender'], [3, 'very soft'], [99, 'mushy']],
    },
    carrot: {
      veg: true, overcook: 3, name: 'carrot', plural: 'carrots', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 100,
      moist: true, spec: 3.8, cook: { onset: 60, time: 1300, tau: 180 }, brownTime: 130,
      color: '#e8792b',
      forms: [F('whole', 0, 1, false, 0.45), F('sliced', 2, 0.35, true, 0.75), F('strips', 5, 0.22, true, 0.8, '% strips'),
        F('diced', 8, 0.2, true, 0.8), F('grated', 13, 0.12, true, 0.85)],
      stages: [[0.35, 'raw and crunchy'], [0.9, 'crisp-tender'], [1.8, 'tender'], [3, 'soft'], [99, 'mushy']],
    },
    cabbage: {
      veg: true, overcook: 4, name: 'cabbage', plural: 'cabbage', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 250,
      moist: true, spec: 3.9, cook: { onset: 60, time: 900, tau: 140 }, brownTime: 170,
      color: '#b9d48a',
      forms: [F('wedge', 0, 1, false, 0.5, 'wedge of'), F('shredded', 3, 0.3, true, 0.8), F('finely shredded', 7, 0.2, true, 0.85)],
      stages: [[0.3, 'raw and crunchy'], [0.8, 'crisp-tender'], [1.8, 'tender'], [3.2, 'soft'], [99, 'very soft']],
    },
    dill: {
      name: 'dill', plural: 'dill', phase: 'solid', source: 'unit', storage: 'pot', unitMass: 6,
      moist: true, spec: 3.8, cook: { onset: 55, time: 50, tau: 5 }, brownTime: 30,
      color: '#5f9e3f', herb: true,
      forms: [F('sprig', 0, 1, false, 0.8, 'sprig of'), F('chopped', 2, 0.4, true, 0.9), F('finely chopped', 5, 0.25, true, 0.9)],
      stages: [[0.35, 'fresh'], [1.2, 'wilted'], [99, 'cooked down']],
    },
    sorrel: {
      name: 'sorrel', plural: 'sorrel', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 30,
      // wilts almost at once and turns olive-green
      moist: true, spec: 3.9, cook: { onset: 50, time: 45, tau: 6 }, brownTime: 40,
      color: '#4f9a36', herb: true,
      forms: [F('bunch', 0, 1, false, 0.8, 'bunch of'), F('chopped', 2, 0.4, true, 0.9), F('finely chopped', 5, 0.25, true, 0.9)],
      stages: [[0.3, 'fresh'], [0.9, 'wilted'], [99, 'melted down']],
    },
    smetana: { name: 'smetana', short: 'smetana', phase: 'liquid', source: 'pour', storage: 'fridge', spec: 3.4, perTsp: 5.5, pourRate: 22, color: '#fbf7ee' },
    // crumbly fresh cheese: piles up like a powder (it doesn't coat food), turns into a dough once mixed with egg
    tvorog: { name: "farmer's cheese", short: "farmer's cheese", phase: 'powder', source: 'pour', storage: 'fridge', spec: 2.8, perTsp: 5, pourRate: 45, color: '#fbf8f0', brownTime: 90, crumbly: true },
    salo: {
      name: 'salo', plural: 'salo', phase: 'solid', source: 'unit', storage: 'fridge', unitMass: 60,
      // cured pork fat: no cooking needed; in a hot pan it renders lard and crisps into shkvarky
      moist: false, spec: 2.3, brownTime: 170, flippable: true, saltiness: 0.035,
      render: { key: 'lard', max: 0.55, rate: 0.00026 },
      color: '#f6efe4',
      forms: [F('slab', 0, 1, false, 0.75, 'slab of'), F('strips', 2, 0.4, true, 0.82, '% strips'), F('diced', 5, 0.25, true, 0.85)],
    },
    buckwheat: {
      overcook: 1.9, name: 'buckwheat', plural: 'buckwheat', phase: 'solid', source: 'pour', storage: 'shelf', spec: 1.8, perTsp: 4.2, pourRate: 40,
      moist: false, cook: { onset: 70, time: 620, tau: 18 }, brownTime: 120, absorb: 2.0,
      color: '#9b6a3f',
      forms: [F('grains', 0, 1, true, 0.8)],
      stages: [[0.3, 'raw and hard'], [0.8, 'chewy'], [1.35, 'tender and fluffy'], [1.9, 'soft'], [99, 'mushy']],
    },
    millet: {
      overcook: 2.6, name: 'millet', plural: 'millet', phase: 'solid', source: 'pour', storage: 'shelf', spec: 1.8, perTsp: 4.4, pourRate: 40,
      moist: false, cook: { onset: 70, time: 600, tau: 16 }, brownTime: 110, absorb: 2.8,
      color: '#efcf62',
      forms: [F('grains', 0, 1, true, 0.8)],
      stages: [[0.3, 'raw and hard'], [0.8, 'gritty'], [1.4, 'tender'], [2.6, 'soft and creamy'], [99, 'mushy']],
    },
    sunoil: { name: 'sunflower oil', phase: 'fat', source: 'pour', storage: 'shelf', spec: 2, perTsp: 4.5, pourRate: 20, color: '#e9c23c', brownTime: 70, burnAt: 215, burnSpan: 40, burnTime: 40 },
    tomatopaste: { name: 'tomato paste', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 3.6, perTsp: 5.5, pourRate: 16, color: '#b8261a', comp: { tomato: 0.8, water: 0.2 } },
    cherryjam: { name: 'cherry jam', short: 'jam', phase: 'liquid', source: 'pour', storage: 'shelf', spec: 2.6, perTsp: 7, pourRate: 12, color: '#7d1426' },
    ryebread: {
      name: 'slice of rye bread', plural: 'slices of rye bread', short: 'rye bread', phase: 'solid', source: 'unit', storage: 'breadbox', unitMass: 40,
      moist: false, spec: 1.8, cook: { onset: 62, time: 220, tau: 30 }, brownTime: 110, flippable: true, soaks: 1.2, bread: true, saltiness: 0.012,
      color: '#6b4a33',
      forms: [F('slice', 0, 1, false, 0.9), F('halved', 1, 0.7, false, 0.9), F('cubes', 4, 0.3, true, 0.9)],
    },
    // not stocked anywhere: they only appear inside other things
    lard: { name: 'lard', phase: 'fat', source: 'none', spec: 2.1, perTsp: 4.3, color: '#f4ecd9', brownTime: 60, burnAt: 190, burnSpan: 45, burnTime: 45 },
    beet: { name: 'beet juice', short: 'beet', phase: 'liquid', source: 'none', spec: 4.1, color: '#9e1636' },
  };
  for (const id in CK.ING) {
    CK.ING[id].id = id;
    if (!CK.ING[id].short) CK.ING[id].short = CK.ING[id].name;
  }

  // Which ingredient-keys count as "liquid that can boil"
  CK.AQUEOUS = { water: 1, milk: 0.9, egg: 0.75, soy: 0.7, tomato: 0, beet: 0.95 };
  // cuts fine enough to disappear into a batter when whisked or stirred in a mixing bowl
  CK.FINE_FORMS = { grated: 1, minced: 1, 'finely chopped': 1, 'finely shredded': 1 };
  // fats that are their own pool in a pan (butter, oils, rendered lard)
  CK.isFatKey = (k) => !!(CK.ING[k] && CK.ING[k].phase === 'fat');

  // Mixture classes for fluids (and what they set into)
  CK.MIX = {
    batter: { name: 'pancake batter', onset: 68, time: 125, tau: 14, brownTime: 52, settable: true, setAt: 0.35, moist: true, spec: 3.2, color: '#f0dca6' },
    eggs: { name: 'beaten eggs', onset: 62, time: 125, tau: 10, brownTime: 48, settable: true, setAt: 0.3, moist: true, spec: 3.4, color: '#f6c94c' },
    tomato: { name: 'tomato sauce', onset: 60, time: 420, tau: 30, brownTime: 90, moist: true, spec: 3.8, color: '#c63a28' },
    milk: { name: 'milk', onset: 60, time: 500, tau: 20, brownTime: 70, moist: true, spec: 3.9, color: '#fbfaf3' },
    syrup: { name: 'syrup', onset: 999, time: 999, tau: 20, brownTime: 80, moist: true, spec: 2.5, color: '#a85a1c' },
    soy: { name: 'soy sauce', onset: 999, time: 999, tau: 20, brownTime: 60, moist: true, spec: 3.8, color: '#3b2416' },
    water: { name: 'water', onset: 999, time: 999, tau: 20, brownTime: null, moist: true, spec: 4.18, color: '#9fd0ee' },
    dough: { name: 'paste', onset: 70, time: 300, tau: 30, brownTime: 80, settable: true, setAt: 0.5, moist: true, spec: 2.5, color: '#efe4c8' },
    // farmer's cheese bound with egg/flour: syrnyky (fried) or lazy varenyky (boiled)
    curd: { name: 'curd dough', onset: 64, time: 240, tau: 22, brownTime: 64, settable: true, setAt: 0.32, moist: true, spec: 3.0, color: '#f6efdc' },
    // grated potato bound with egg/flour: deruny
    potato: { name: 'potato batter', onset: 64, time: 280, tau: 22, brownTime: 62, settable: true, setAt: 0.32, moist: true, spec: 3.4, color: '#e9dcb0' },
    beet: { name: 'beet broth', onset: 999, time: 999, tau: 20, brownTime: 90, moist: true, spec: 4.1, color: '#9e1636' },
    cream: { name: 'smetana', onset: 60, time: 500, tau: 20, brownTime: 70, moist: true, spec: 3.4, color: '#fbf7ee' },
    mixture: { name: 'mixture', onset: 60, time: 400, tau: 20, brownTime: 80, moist: true, spec: 3.5, color: '#e6d6b8' },
  };

  CK.classify = function (comp) {
    let m = 0;
    for (const k in comp) m += comp[k];
    if (m <= 0) return 'mixture';
    const f = (k) => (comp[k] || 0) / m;
    const liquid = f('water') + f('milk') + f('egg') + f('syrup') + f('honey');
    const binder = f('egg') + f('flour');
    if (f('tvorog') >= 0.35 && binder >= 0.04) return 'curd';
    if (f('potato') >= 0.4 && binder >= 0.03) return 'potato';
    if (f('flour') >= 0.12 && liquid >= 0.35) return 'batter';
    if (f('egg') >= 0.35) return 'eggs';
    if (f('beet') >= 0.012 && f('water') + f('beet') >= 0.5) return 'beet';
    if (f('tomato') >= 0.04) return 'tomato';
    if (f('milk') >= 0.4) return 'milk';
    if (f('smetana') >= 0.4) return 'cream';
    if (f('syrup') + f('honey') + f('cherryjam') >= 0.45) return 'syrup';
    if (f('soy') >= 0.4) return 'soy';
    if (f('water') >= 0.5) return 'water';
    if (f('flour') >= 0.3) return 'dough';
    return 'mixture';
  };

  CK.BROWN_WORDS = STD_BROWN;
  CK.brownWord = function (b, toast) {
    if (toast) {
      if (b < 0.3) return 'untoasted';
      if (b < 0.8) return 'lightly toasted';
      if (b < 1.7) return 'golden toast';
      if (b < 2.5) return 'dark toast';
      return 'burnt toast';
    }
    for (const [t, w] of STD_BROWN) if (b < t) return w;
    return 'charred';
  };

  CK.formOf = function (ingId, formId) {
    const d = CK.ING[ingId];
    if (!d || !d.forms) return null;
    return d.forms.find((f) => f.id === formId) || null;
  };
})();
