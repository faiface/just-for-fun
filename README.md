# A Pinch of Salt 🧂

A cozy home-cooking simulator for the browser. You get a real recipe, cook it in a little kitchen
however you like, and serve it. Your guest tastes it and tells you what they think. They judge the food,
not the steps you took.

## Run it

No build step and no dependencies. Either:

- **Open `index.html` directly** in a browser (it works from `file://`), or
- serve the folder and open http://localhost:8000:

```bash
python3 -m http.server 8000
```

Scores are saved in the browser's localStorage.

## How to play

- **Drag** food and containers. Pans and pots hang on the wall; plates and bowls sit on the shelf.
- **Pour** by holding a jar, bottle or container over another container. Pouring starts after a moment
  and the amount is shown as you go. Salt and spices start slowly, so a quick dip is a pinch.
- **Eggs:** drop one into a bowl or pan, then click it to crack it. Click a boiled egg to peel it.
- **Utensils** hang on the rail. Click one to pick it up, then use it:
  - spoon or whisk: hold on a container to stir or whisk
  - spatula: click food in a pan to flip it, or hold to stir
  - tasting spoon: click a dish to taste it
  - knife (on the board): click or hold on food. More chops make finer pieces.

  Right-click or `Esc` puts the utensil back down.
- **Stove:** click the right half of a knob to turn the heat up, the left half to turn it down (scrolling works too).
- **Sink:** put a pot in the sink and click the tap to fill it. Hold a pot over the empty sink to drain it;
  the solids stay in the pot.
- **Toaster:** drop bread in and press the lever. The dial sets how dark it gets.
- **Serve:** put the dish on the serving tray and ring the bell.
- Hover over anything to see its temperature and how cooked it is. The **1× / 3× / 8×** buttons speed up the waiting.

## How the kitchen works

The same simulation runs for every recipe ([js/sim.js](js/sim.js), data in [js/ingredients.js](js/ingredients.js)):

- **Heat.** Each burner level puts out a fixed power. A vessel's temperature comes from that power, its
  heat capacity, its losses, and its contents. Water caps at 100 °C and boils away. Wet food in a pan
  cools the pan, so a crowded pan fries cooler.
- **Cooking.** Each food has its own internal temperature, which lags behind the pan (smaller cuts heat
  faster). Doneness builds up above the food's setting temperature, so you get eggs that set, pasta that
  softens and chicken that cooks through. Browning only happens on surfaces above about 115 °C. Food
  sitting in water can't brown or burn. A pot that boils dry *will* burn.
- **Sides.** Food touching the pan browns underneath. Flip it with the spatula, or stir small pieces, to
  brown evenly.
- **Mixtures.** Whisking merges liquids, powders and cracked eggs into one mixture. The mixture's
  composition decides what it is (batter, beaten eggs, tomato sauce…) and what it turns into when heated:
  stirred eggs scramble, unstirred eggs become an omelette, and batter sets into a pancake.
- **Seasoning and absorption.** Salt dissolves into liquids. Pasta absorbs its cooking water, along with
  whatever salt is in it. Draining throws away the rest.

## The judge

[js/judge.js](js/judge.js) compares only what's on the served plate against the recipe's description in
[js/recipes.js](js/recipes.js): the components, their cut, doneness and browning, supporting amounts,
seasoning ratios (relative to the recipe made as written), unexpected ingredients, temperature and the
serving vessel. It turns that into the guest's comments and a score out of 100 (★ 40+, ★★ 65+, ★★★ 85+).
If the plate barely resembles the dish, the guest says so and describes what you actually served.

## Tests

Headless playthroughs of every recipe. Following each recipe as written should score highly, and common
mistakes (burnt garlic, raw chicken, undrained pasta…) should get the right complaint:

```bash
node tests/scenarios.test.js        # add -v for the guest's comments
```

## Single-file build / Claude artifact

```bash
node build.mjs
```

This writes `dist/pinch-of-salt.html`: everything inlined into one self-contained page, ready to share or
publish as a Claude artifact. The only external resource is Google Fonts, and it falls back to system fonts.
