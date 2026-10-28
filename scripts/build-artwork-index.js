#!/usr/bin/env node
/**
 * Builds artwork-index.json from gallery-data.js (+ submitters.json).
 *
 * artwork-index.json is what the Cloudflare Pages Functions read when they
 * render a shareable link (/artwork/:id) or a room link (/gallery/:room).
 * It is a flat { id: {...} } map in the same order as gallery-data.js, so
 * neighbours (prev/next) can be derived by position.
 *
 * Run after the scraper:
 *   node scripts/build-artwork-index.js
 * Exit: 0 = ok · 2 = error
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'gallery-data.js');
const SUBMITTERS_PATH = path.join(ROOT, 'submitters.json');
const OUT_PATH = path.join(ROOT, 'artwork-index.json');

function loadGalleryData() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const sandbox = {};
  new Function('window', raw + '\nreturn window.GALLERY_DATA;')(sandbox);
  return sandbox.GALLERY_DATA;
}

function loadSubmitters() {
  try {
    return JSON.parse(fs.readFileSync(SUBMITTERS_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function main() {
  const data = loadGalleryData();
  const submitters = loadSubmitters();

  const galleries = Object.values(data.galleries || {});
  const total = galleries.reduce((n, g) => n + (g.works || []).length, 0);

  const index = {};
  let i = 0;

  for (const gallery of galleries) {
    for (const work of gallery.works || []) {
      const s = submitters[work.id];
      index[work.id] = {
        title: work.title || 'Untitled',
        gallery: gallery.id,
        galleryName: gallery.name,
        imageUrl: work.imageUrl,
        width: work.width || 0,
        height: work.height || 0,
        addedAt: work.addedAt || null,
        // Mirrors the "NO. 00000" accession numbers used on the plaques.
        accession: total - i,
        submitter: s ? { name: s.name, handle: s.handle } : null,
      };
      i++;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(index));
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`artwork-index.json written — ${total} works, ${kb} KB`);
}

try {
  main();
} catch (err) {
  console.error('Failed to build artwork-index.json:', err.message);
  process.exit(2);
}
