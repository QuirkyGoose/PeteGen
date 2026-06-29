#!/usr/bin/env node
/**
 * Pete Pics Gallery Scraper v2
 * 
 * Uses postimg.cc's JSON API to fetch all images from each album.
 * Much faster and more reliable than HTML scraping.
 *
 * Usage:
 *   node scripts/update-gallery.js [--dry-run]
 *
 * Exit codes:
 *   0 — success (changes made or no changes needed)
 *   2 — error occurred
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Config ─────────────────────────────────────────────────────
const GALLERIES = [
  { id: 'pobots',      name: 'Pobots',        tagline: 'Robots. Peets. The intersection thereof.',          albumHex: 'VML2tRn', wallClass: 'room-wall-1' },
  { id: 'prestlers',   name: 'Prestlers',     tagline: 'Peet meets the squared circle and beyond.',          albumHex: 'RFbFrht', wallClass: 'room-wall-2' },
  { id: 'cultural',    name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.',            albumHex: 'HVYDkG8', wallClass: 'room-wall-3' },
  { id: 'pisc',        name: 'Pisc',          tagline: 'A miscellany. A cornucopia. A Pisc.',                albumHex: 'Yt9J3Xt', wallClass: 'room-wall-4' },
  { id: 'submissions', name: 'Submissions',   tagline: 'Community contributions from the spreadsheet.',       albumHex: 'nMN0w6j', wallClass: 'room-wall-submissions' },
];

const GALLERY_DATA_PATH = path.join(__dirname, '..', 'gallery-data.js');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 300;

// ─── Helpers ────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + e.message)); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Scrape all pages of an album via the JSON API
async function scrapeAlbum(albumHex, galleryId) {
  const allImages = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://postimg.cc/json?action=list&page=${page}&album=${albumHex}`;
    process.stdout.write(`  Fetching ${galleryId} page ${page}...`);

    try {
      const data = await fetchJson(url);
      const images = data.images || [];

      if (images.length === 0) {
        console.log(` 0 images, done.`);
        hasMore = false;
      } else {
        // Each image is an array: [id, hotlink, name, ext, width, height, thumbUrl, ...]
        for (const img of images) {
          const id = img[0];
          const hotlink = img[1];     // e.g. "pLb9RVcs" (used in CDN URL)
          const name = img[2];        // e.g. "15-14-Peters"
          const ext = img[3];         // e.g. "png"
          const width = img[4] || 0;
          const height = img[5] || 0;
          const thumbUrl = img[6] || `https://i.postimg.cc/${id}/${name}.${ext}`;
          const imageUrl = `https://i.postimg.cc/${hotlink}/${name}.${ext}`;

          allImages.push({
            id: id,
            title: name.replace(/-/g, ' '),
            imageUrl: imageUrl,
            thumbUrl: thumbUrl,
            width: width,
            height: height,
          });
        }
        console.log(` ${images.length} images.`);
        hasMore = data.has_page_next === true;
        if (hasMore) {
          page++;
          await sleep(DELAY_MS);
        }
      }
    } catch (err) {
      console.error(` ERROR: ${err.message}`);
      hasMore = false;
    }
  }

  console.log(`  Total: ${allImages.length} images`);
  return allImages;
}

// Load existing gallery-data.js
function loadExistingData() {
  try {
    const raw = fs.readFileSync(GALLERY_DATA_PATH, 'utf8');
    const sandbox = {};
    new Function('window', raw + '\nreturn window.GALLERY_DATA;')(sandbox);
    return sandbox.GALLERY_DATA;
  } catch (e) {
    console.error('Could not load existing gallery-data.js:', e.message);
    return null;
  }
}

// Save updated gallery-data.js
function saveData(data) {
  const out = `/* Auto-generated from postimg.cc albums — ${data.totalWorks} works */\nwindow.GALLERY_DATA = ${JSON.stringify(data)};\n`;
  fs.writeFileSync(GALLERY_DATA_PATH, out);
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('=== Pete Pics Gallery Scraper v2 ===');
  console.log(DRY_RUN ? 'DRY RUN — no files will be written\n' : '');

  const existing = loadExistingData();
  if (!existing) {
    console.error('Failed to load existing gallery-data.js');
    process.exit(2);
  }

  const existingIds = new Set();
  if (existing.galleries) {
    Object.values(existing.galleries).forEach(g => {
      (g.works || []).forEach(w => existingIds.add(w.id));
    });
  }
  console.log(`Existing gallery: ${existingIds.size} images\n`);

  const newData = { galleries: {}, totalWorks: 0 };
  let totalNew = 0;

  for (const gallery of GALLERIES) {
    console.log(`\nScraping ${gallery.name} (${gallery.albumHex})...`);
    const images = await scrapeAlbum(gallery.albumHex, gallery.id);

    const works = images.map(img => ({
      ...img,
      gallery: gallery.id,
      galleryName: gallery.name,
    }));

    const newCount = works.filter(w => !existingIds.has(w.id)).length;
    totalNew += newCount;
    console.log(`  New: ${newCount}`);

    newData.galleries[gallery.id] = {
      id: gallery.id,
      name: gallery.name,
      tagline: gallery.tagline,
      wallClass: gallery.wallClass,
      works: works,
    };
    newData.totalWorks += works.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Existing: ${existingIds.size} images`);
  console.log(`Scraped:  ${newData.totalWorks} images`);
  console.log(`New:      ${totalNew} images`);

  // Merge: start with ALL existing works, add new ones (gallery never shrinks)
  for (const gallery of GALLERIES) {
    const oldGallery = existing.galleries[gallery.id];
    const newGallery = newData.galleries[gallery.id];

    if (oldGallery && oldGallery.works) {
      const existingWorks = oldGallery.works.slice();
      const existingIdsLocal = new Set(existingWorks.map(w => w.id));
      const newWorks = (newGallery.works || []).filter(w => !existingIdsLocal.has(w.id));
      newGallery.works = existingWorks.concat(newWorks);
    }

    if (oldGallery) {
      newGallery.name = oldGallery.name || newGallery.name;
      newGallery.tagline = oldGallery.tagline || newGallery.tagline;
      newGallery.wallClass = oldGallery.wallClass || newGallery.wallClass;
    }
  }

  // Preserve galleries not in scrape list (e.g. "nacky")
  Object.keys(existing.galleries).forEach(gid => {
    if (!newData.galleries[gid]) {
      newData.galleries[gid] = existing.galleries[gid];
    }
  });

  // Recalculate total
  newData.totalWorks = Object.values(newData.galleries).reduce((sum, g) => sum + (g.works || []).length, 0);

  console.log(`Final total: ${newData.totalWorks} images`);

  if (totalNew === 0) {
    console.log('\nGallery is up to date. No changes needed.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('\nDry run — would have written gallery-data.js');
    for (const gallery of GALLERIES) {
      const g = newData.galleries[gallery.id];
      const newImages = (g.works || []).filter(w => !existingIds.has(w.id));
      if (newImages.length > 0) {
        console.log(`\nNew in ${gallery.name}:`);
        newImages.forEach(img => console.log(`  + ${img.title} (${img.width}x${img.height}) — ${img.id}`));
      }
    }
  } else {
    saveData(newData);
    console.log('\ngallery-data.js updated successfully!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
