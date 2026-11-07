// Cuisines: each one stocks the same kitchen differently and gives it its own light decor.
// The slots (where things stand and where you can grab them) are fixed; a cuisine only decides
// what sits in each slot and how it looks. Recipes say which cuisine they belong to.
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = root.CK;

  // ---------------------------------------------------------------- slot geometry
  // Front-view sources stand on their base (x, y); w/h are the hit area. Round ones use r.
  // (Shelf heights match CK.LAYOUT: shelfA 134, shelfB 268, shelfC 400.)
  const A = 134, B = 268, C = 400;
  CK.SLOTS = {
    // pantry shelves
    shelfA1: { x: 300, y: A, w: 40, h: 70 },
    shelfA2: { x: 360, y: A, w: 34, h: 82 },
    shelfA3: { x: 420, y: A, w: 44, h: 64 },
    shelfA4: { x: 482, y: A, w: 44, h: 64 },
    shelfA5: { x: 552, y: A, w: 56, h: 80 },
    shelfA6: { x: 634, y: A, w: 48, h: 62 },
    shelfB1: { x: 312, y: B, w: 70, h: 100 },
    shelfB2: { x: 400, y: B, w: 66, h: 96 },
    shelfB3: { x: 484, y: B, w: 60, h: 92 },
    shelfB4: { x: 566, y: B, w: 64, h: 116 },
    shelfB5: { x: 648, y: B, w: 34, h: 96 },
    shelfC1: { x: 300, y: C, w: 42, h: 116 },
    shelfC2: { x: 366, y: C, w: 40, h: 96 },
    shelfC3: { x: 436, y: C, w: 54, h: 70 },
    shelfC4: { x: 512, y: C, w: 60, h: 76 },
    // fridge (only reachable while it's open)
    fridgeTop1: { fridge: true, x: 92, y: 168, w: 104, h: 42 },
    fridgeTop2: { fridge: true, x: 196, y: 168, w: 70, h: 34 },
    fridgeMid1: { fridge: true, x: 74, y: 340, w: 46, h: 110 },
    fridgeMid2: { fridge: true, x: 132, y: 340, w: 44, h: 56 },
    fridgeMid3: { fridge: true, x: 188, y: 340, w: 44, h: 56 },
    fridgeLow1: { fridge: true, x: 90, y: 508, w: 86, h: 46 },
    fridgeLow2: { fridge: true, x: 162, y: 508, w: 52, h: 40 },
    fridgeLow3: { fridge: true, x: 213, y: 508, w: 40, h: 34 },
    crisper1: { fridge: true, x: 84, y: 694, w: 46, h: 40 },
    crisper2: { fridge: true, x: 144, y: 694, w: 44, h: 46 },
    crisper3: { fridge: true, x: 204, y: 694, w: 50, h: 56 },
    crisper4: { fridge: true, x: 110, y: 772, w: 70, h: 50 },
    // on the counter
    basket1: { basket: true, x: 312, y: 502, r: 36 },
    basket2: { basket: true, x: 394, y: 502, r: 30 },
    basket3: { basket: true, x: 476, y: 502, r: 36 },
    fruit: { fruit: true, x: 1508, y: 512, r: 40 },
    plant: { plant: true, x: 1518, y: 404, w: 80, h: 96 },
    bread: { bread: true, x: 1345, y: 507, w: 150, h: 82 },
  };

  // ---------------------------------------------------------------- stock
  const CLASSICS = {
    shelfA1: { ing: 'salt', look: 'shaker', label: 'Salt' },
    shelfA2: { ing: 'pepper', look: 'grinder', label: 'Pepper' },
    shelfA3: { ing: 'chili', look: 'jar', color: '#c4391f', label: 'Chili flakes' },
    shelfA4: { ing: 'cinnamon', look: 'jar', color: '#9a5b2e', label: 'Cinnamon' },
    shelfA5: { ing: 'sugar', look: 'jar', color: '#fffdf6', label: 'Sugar' },
    shelfA6: { ing: 'bakingpowder', look: 'tin', color: '#e2574c', label: 'Baking powder' },
    shelfB1: { ing: 'flour', look: 'bag', color: '#e9dcc0', tag: 'FLOUR', tagColor: '#5b86b8', label: 'Flour' },
    shelfB2: { ing: 'oats', look: 'bag', color: '#d9c08a', tag: 'OATS', tagColor: '#7a9a4a', label: 'Rolled oats' },
    shelfB3: { ing: 'rice', look: 'jar', color: '#f6f1e2', label: 'Rice' },
    shelfB4: { ing: 'spaghetti', look: 'tall', color: '#ead28a', label: 'Spaghetti' },
    shelfB5: { ing: 'soy', look: 'bottle', fill: 'rgba(55,32,20,0.95)', tag: ['SOY', 'SAUCE'], tagInk: '#b8322a', cap: '#c0392b', label: 'Soy sauce' },
    shelfC1: { ing: 'oil', look: 'bottle', fill: 'rgba(170,190,90,0.9)', tag: ['OLIVE', 'OIL'], tagInk: '#5a6a2a', label: 'Olive oil' },
    shelfC2: { ing: 'syrup', look: 'bottle', fill: 'rgba(150,80,30,0.95)', tag: ['MAPLE', 'SYRUP'], tagInk: '#7a3b1f', label: 'Maple syrup' },
    shelfC3: { ing: 'honey', look: 'jar', color: '#e0a12a', label: 'Honey' },
    shelfC4: { ing: 'cannedtom', look: 'can', color: '#c6392a', label: 'Crushed tomatoes' },
    fridgeTop1: { ing: 'egg', look: 'eggs', label: 'Eggs' },
    fridgeTop2: { ing: 'butter', look: 'butter', label: 'Butter' },
    fridgeMid1: { ing: 'milk', look: 'carton', label: 'Milk' },
    fridgeMid2: { ing: 'parmesan', look: 'tub', color: '#2f6b45', tag: 'PARM', label: 'Grated parmesan' },
    fridgeMid3: { ing: 'cheddar', look: 'tub', color: '#d9822b', tag: 'CHED', label: 'Grated cheddar' },
    fridgeLow1: { ing: 'chicken', look: 'chicken', label: 'Chicken breast' },
    fridgeLow2: { ing: 'bacon', look: 'bacon', label: 'Bacon' },
    fridgeLow3: { ing: 'mushroom', look: 'mushrooms', label: 'Mushrooms' },
    crisper1: { ing: 'tomato', look: 'tomato', label: 'Tomatoes' },
    crisper2: { ing: 'bellpepper', look: 'pepperveg', label: 'Bell peppers' },
    crisper3: { ing: 'parsley', look: 'parsley', label: 'Parsley' },
    crisper4: { ing: 'chives', look: 'chives', label: 'Chives' },
    basket1: { ing: 'onion', label: 'Onions' },
    basket2: { ing: 'garlic', label: 'Garlic' },
    basket3: { ing: 'potato', label: 'Potatoes' },
    fruit: { ing: 'banana', label: 'Bananas' },
    plant: { ing: 'basil', label: 'Basil plant (pick a sprig)', pot: 'basil' },
    bread: { ing: 'bread', label: 'Bread', loaf: 'white' },
  };

  const UKRAINIAN = {
    shelfA1: { ing: 'salt', look: 'shaker', label: 'Salt' },
    shelfA2: { ing: 'pepper', look: 'grinder', label: 'Pepper' },
    shelfA3: { ing: 'cherryjam', look: 'jar', color: '#7d1426', cloth: '#d23a3a', label: 'Cherry jam (varennya)' },
    shelfA5: { ing: 'sugar', look: 'jar', color: '#fffdf6', label: 'Sugar' },
    shelfB1: { ing: 'flour', look: 'bag', color: '#ece2c8', tag: 'FLOUR', tagColor: '#4f7fb0', label: 'Flour' },
    shelfB2: { ing: 'buckwheat', look: 'bag', color: '#c9a77a', tag: 'ГРЕЧКА', tagColor: '#8a5a32', label: 'Buckwheat (hrechka)' },
    shelfB3: { ing: 'millet', look: 'jar', color: '#efcf62', label: 'Millet (pshono)' },
    shelfC1: { ing: 'sunoil', look: 'bottle', fill: 'rgba(232,178,40,0.9)', tag: ['ОЛІЯ', 'sunflower'], tagInk: '#8a5a12', cap: '#3d6b2e', label: 'Sunflower oil' },
    shelfC3: { ing: 'honey', look: 'jar', color: '#e0a12a', label: 'Honey' },
    shelfC4: { ing: 'tomatopaste', look: 'can', color: '#b8261a', band: '#f2c94c', label: 'Tomato paste' },
    fridgeTop1: { ing: 'egg', look: 'eggs', label: 'Eggs' },
    fridgeTop2: { ing: 'butter', look: 'butter', label: 'Butter' },
    fridgeMid1: { ing: 'milk', look: 'carton', label: 'Milk' },
    fridgeMid2: { ing: 'smetana', look: 'tub', color: '#3f74b5', tag: 'СМЕТАНА', label: 'Smetana (sour cream)' },
    fridgeMid3: { ing: 'tvorog', look: 'curd', color: '#c94a3a', tag: 'СИР', label: "Farmer's cheese (syr)" },
    fridgeLow1: { ing: 'salo', look: 'salo', label: 'Salo (cured pork fat)' },
    fridgeLow3: { ing: 'mushroom', look: 'mushrooms', label: 'Mushrooms' },
    crisper1: { ing: 'carrot', look: 'carrots', label: 'Carrots' },
    crisper3: { ing: 'sorrel', look: 'sorrel', label: 'Sorrel' },
    crisper4: { ing: 'cabbage', look: 'cabbage', label: 'Cabbage' },
    basket1: { ing: 'onion', label: 'Onions' },
    basket2: { ing: 'garlic', label: 'Garlic' },
    basket3: { ing: 'potato', label: 'Potatoes' },
    fruit: { ing: 'beetroot', label: 'Beetroots', bowl: '#c9563f' },
    plant: { ing: 'dill', label: 'Dill (pick a sprig)', pot: 'dill' },
    bread: { ing: 'ryebread', label: 'Dark rye bread', loaf: 'rye' },
  };

  // ---------------------------------------------------------------- themes
  const THEMES = {
    classic: {
      id: 'classic',
      wall: ['#f8eedc', '#f4e6cd', '#f0dfc2'], stripes: true, letterbox: '#f1e1c6',
      tiles: { grout: '#c9ddd6', bases: ['#d6ebe4', '#e4f1ec', '#dfeee8'], accent: 'flower', top: '#e9f2ee' },
      window: 'curtains', sill: null, motif: null, shelfDeco: [],
      ideas: ['Bacon & eggs with toast', 'Garlicky tomato pasta', 'Crispy potatoes with a fried egg on top', 'Pancakes with maple syrup', 'A rice bowl with chicken'],
    },
    ukrainian: {
      id: 'ukrainian',
      // whitewashed walls of a village khata, a painted Petrykivka spray, an embroidered rushnyk
      wall: ['#fbf6ec', '#f7f0e2', '#f2e8d6'], stripes: false, letterbox: '#f4ecdd',
      tiles: { grout: '#d9d2c4', bases: ['#f6f2ea', '#fbf8f2', '#f2ede3'], accent: 'stitch', top: '#f7f3ec' },
      window: 'rushnyk', sill: 'sunflowers', motif: 'petrykivka',
      shelfDeco: [{ look: 'jug', x: 570, y: 268 }, { look: 'bowlstack', x: 368, y: 400 }, { look: 'jug', x: 484, y: 134, small: true }],
      ideas: ['Fried potatoes with salo and onion', 'Buckwheat with mushrooms', 'Syrnyky with smetana and cherry jam', 'A bowl of borscht', 'Deruny with smetana'],
    },
  };

  CK.CUISINES = [
    {
      id: 'classics', name: 'Comfort Classics', subtitle: '',
      tagline: 'Hearty home cooking from Britain, Italy and the American diner: fry-ups, pasta, pancakes and soup.',
      theme: THEMES.classic, sources: CLASSICS,
    },
    {
      id: 'ukrainian', name: 'Ukrainian Kitchen', subtitle: 'Українська кухня',
      tagline: 'Grandma’s table: ruby borscht, golden syrnyky, crispy deruny and kasha, always with a spoon of smetana.',
      theme: THEMES.ukrainian, sources: UKRAINIAN,
    },
  ];
  CK.CUISINE = {};
  for (const c of CK.CUISINES) CK.CUISINE[c.id] = c;

  // The concrete source list for a cuisine: slot geometry + what the cuisine puts there.
  CK.stockFor = function (id) {
    const cu = CK.CUISINE[id] || CK.CUISINES[0];
    const out = [];
    for (const slot in CK.SLOTS) {
      const e = cu.sources[slot];
      if (!e) continue;
      const d = CK.ING[e.ing];
      out.push(Object.assign({ slot }, CK.SLOTS[slot], e, { unit: !!d && d.source === 'unit' }));
    }
    return out;
  };
  // every ingredient you can take out of a cuisine's kitchen (plus tap water)
  CK.stockedIngredients = function (id) {
    const set = new Set(['water']);
    for (const s of CK.stockFor(id)) set.add(s.ing);
    return set;
  };
})();
