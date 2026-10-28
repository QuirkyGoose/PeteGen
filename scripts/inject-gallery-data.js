#!/usr/bin/env node
/**
 * Injects the freshly scraped gallery-data.js into the prebuilt index.html.
 *
 * The React bundle shipped in index.html has its gallery snapshot embedded as:
 *   G8="YYYY-MM-DD",<var>=JSON.parse('[...]')
 * The site does NOT request gallery-data.js at runtime, so the scheduled
 * scraper only changes the standalone data file. This script rewrites the
 * embedded snapshot (and the displayed "last updated" date) so a refresh is
 * actually visible on the deployed site.
 *
 * Usage: node scripts/inject-gallery-data.js
 * Exit:  0 = success · 2 = error
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GALLERY_DATA_PATH = path.join(ROOT, 'gallery-data.js');
const INDEX_PATH = path.join(ROOT, 'index.html');

function loadGalleryData() {
  const raw = fs.readFileSync(GALLERY_DATA_PATH, 'utf8');
  const sandbox = {};
  new Function('window', raw + '\nreturn window.GALLERY_DATA;')(sandbox);
  return sandbox.GALLERY_DATA;
}

// The bundle's compact shape: { id, t, img, th, w, h, g, d }
function toBundleWorks(data) {
  const works = [];
  for (const [galleryId, gallery] of Object.entries(data.galleries || {})) {
    for (const work of gallery.works || []) {
      works.push({
        id: work.id,
        t: work.title,
        img: work.imageUrl,
        th: work.thumbUrl || work.imageUrl,
        w: work.width || 0,
        h: work.height || 0,
        g: work.gallery || galleryId,
        d: work.addedAt || data.lastUpdated,
      });
    }
  }
  return works;
}

function main() {
  const data = loadGalleryData();
  const works = toBundleWorks(data);
  const jsonText = JSON.stringify(works);
  const jsLiteral = JSON.stringify(jsonText); // double-quoted JS string
  const date = data.lastUpdated || new Date().toISOString().slice(0, 10);

  if (!Array.isArray(works) || works.length === 0) {
    throw new Error('gallery-data.js contains no works');
  }
  if (/<\/script/i.test(jsonText)) {
    throw new Error('Refusing to inject data containing </script>');
  }

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const beforeLength = html.length;

  // Match the embedded gallery JSON.parse(...) call, whether it is currently
  // single-quoted (original bundle) or double-quoted (already injected).
  const galleryRe = /(G8="\d{4}-\d{2}-\d{2}",\s*[A-Za-z_$][\w$]*=JSON\.parse\()(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/;
  if (!galleryRe.test(html)) {
    throw new Error('Could not find the embedded gallery JSON in index.html');
  }
  html = html.replace(galleryRe, `$1${jsLiteral})`);

  const dateRe = /G8="\d{4}-\d{2}-\d{2}"/;
  if (!dateRe.test(html)) {
    throw new Error('Could not find the bundle date (G8) in index.html');
  }
  html = html.replace(dateRe, `G8="${date}"`);

  // Keep the static <head> meta descriptions in sync with the real count.
  const countText = works.length.toLocaleString('en-US');
  const headEnd = html.indexOf('</head>');
  if (headEnd !== -1) {
    const head = html.slice(0, headEnd).replace(/\b\d{1,3}(?:,\d{3})*\s+works\b/g, `${countText} works`);
    html = head + html.slice(headEnd);
  }

  fs.writeFileSync(INDEX_PATH, html);
  console.log(`Injected ${works.length} works into index.html (${beforeLength} -> ${html.length} bytes, updated ${date})`);
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error('Fatal error:', err.message);
  process.exit(2);
}
