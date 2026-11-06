// Bundles the game into one self-contained HTML file (dist/pinch-of-salt.html), e.g. for
// publishing as a Claude artifact or sharing as a single file.  Usage:  node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(here, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, p) =>
  `<style>\n${readFileSync(join(here, p), 'utf8')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, p) =>
  `<script>\n// ---- ${p}\n${readFileSync(join(here, p), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);

mkdirSync(join(here, 'dist'), { recursive: true });
const out = join(here, 'dist', 'pinch-of-salt.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
