#!/usr/bin/env node
/**
 * Pete Pics Gallery Scraper
 * Fetches images from postimg.cc albums, updates gallery-data.js,
 * and emits artwork-index.json (lightweight, powers OG previews).
 *
 * Usage: node scripts/update-gallery.js [--dry-run]
 * Exit:  0 = success · 2 = error / safety guard
 *
 * 2026-07-26 HARDENING (after the 1560 -> 240 wipe):
 *  - The "big drop" check is a HARD ABORT, not a console.warn.
 *  - Any guard trip anywhere means gallery-data.js is never written.
 *
 * 2026-08-05 FIX (root cause of the 240-image ceiling):
 *  - postimg.cc does NOT paginate galleries with URLs like
 *    /gallery/{hex}/2, ?page=2, or /page/2 — those all silently
 *    re-serve page 1's HTML instead of erroring. The old pageUrls()
 *    guesses hit exactly that: page 2 "succeeded", parsed the same
 *    48 images as page 1, every id was already seen, and the loop
 *    concluded "reached the end" with zero error output. That's why
 *    every gallery capped at exactly one page (48) and the total sat
 *    at 5 x 48 = 240 with the safety guards never tripping.
 *  - Real pagination happens via the JSON endpoint the gallery page
 *    itself calls on scroll: https://postimg.cc/json?action=list&page=N&album={hex}
 *    which returns { images: [...], has_page_next: bool }. We now
 *    use that endpoint for every page (including page 1) and trust
 *    has_page_next as the authoritative "is there more" signal
 *    instead of inferring it from page size.
 *  - Row shape per image: [imageHash, pageSlug, filename, ext, width,
 *    height, fullImageUrl, "", 0, "", ""]. pageSlug (index 1) is what
 *    the old HTML scrape extracted as `id` from the anchor href
 *    (postimg.cc/{pageSlug}) — submitters.json is keyed on this, so
 *    we map it the same way to keep existing submitter credits intact.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const GALLERIES = [
  { id: 'pobots',      name: 'Pobots',        tagline: 'Robots. Peets. The intersection thereof.',   albumHex: 'VML2tRn', wallClass: 'room-wall-1' },
  { id: 'prestlers',   name: 'Prestlers',     tagline: 'Peet meets the squared circle and beyond.',  albumHex: 'RFbFrht', wallClass: 'room-wall-2' },
  { id: 'cultural',    name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.',    albumHex: 'HVYDkG8', wallClass: 'room-wall-3' },
  { id: 'pisc',        name: 'Pisc',          tagline: 'A miscellany. A cornucopia. A Pisc.',        albumHex: 'Yt9J3Xt', wallClass: 'room-wall-4' },
  { id: 'submissions', name: 'Submissions',   tagline: 'Community contributions from the spreadsheet.', albumHex: 'nMN0w6j', wallClass: 'room-wall-submissions' },
];

const GALLERY_DATA_PATH = path.join(__dirname, '..', 'gallery-data.js');
const INDEX_PATH = path.join(__dirname, '..', 'artwork-index.json');
const SUBMITTERS_PATH = path.join(__dirname, '..', 'submitters.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 500;
const MAX_PAGES = 40;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const MAX_REDIRECTS = 5;

// Abort the whole run if a gallery shrinks by more than this fraction.
const MAX_SHRINK = 0.20;

function fetch(url, attempt = 1, redirects = 0) {
  return new Promise((resolve, reject) => {
    const retryOrReject = (err) => {
      if (attempt <= MAX_RETRIES) {
        console.log(`\n    ⚠ ${err.message} — retrying (${attempt}/${MAX_RETRIES})...`);
        sleep(RETRY_DELAY_MS).then(() => resolve(fetch(url, attempt + 1, redirects)));
      } else reject(err);
    };
    https.get(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json, text/html' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects >= MAX_REDIRECTS) return reject(new Error(`Too many redirects for ${url}`));
        return resolve(fetch(res.headers.location, attempt, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return retryOrReject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', retryOrReject);
    }).on('error', retryOrReject);
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// postimg's real pagination source — the same endpoint the gallery page
// itself calls on infinite-scroll. Works for page 1 too, so we use it
// uniformly instead of scraping HTML for page 1 and guessing URLs after.
function jsonPageUrl(albumHex, page) {
  return `https://postimg.cc/json?action=list&page=${page}&album=${albumHex}`;
}

// Parses one JSON page. Throws on anything that isn't the shape we expect —
// callers treat a throw as a real error, never as "end of album".
function parseJsonPage(raw) {
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error(`Not valid JSON: ${e.message}`); }
  if (!data || !Array.isArray(data.images)) {
    throw new Error('Unexpected response shape (no "images" array)');
  }
  const images = data.images.map(row => {
    const [, pageSlug, filename, , width, height, imageUrl] = row;
    if (!pageSlug || !imageUrl) return null;
    return {
      id: pageSlug, // matches the old HTML scrape's id (postimg.cc/{pageSlug} from the anchor href)
      title: (filename || '').replace(/-/g, ' '),
      imageUrl,
      thumbUrl: imageUrl, // postimg serves the same URL for both grid + lightbox — confirmed against a live gallery
      width: width || 0,
      height: height || 0,
    };
  }).filter(Boolean);
  return { images, hasNext: !!data.has_page_next };
}

async function fetchPage(albumHex, page) {
  const url = jsonPageUrl(albumHex, page);
  const raw = await fetch(url); // fetch() already retries transient failures
  return parseJsonPage(raw);
}

async function scrapeAlbum(albumHex, galleryId, existingCount) {
  const allImages = [];
  const seen = new Set();
  let page = 1, hasMore = true, hadError = false;

  while (hasMore && page <= MAX_PAGES) {
    process.stdout.write(`  Fetching ${galleryId} page ${page}...`);

    let res;
    try {
      res = await fetchPage(albumHex, page);
    } catch (err) {
      // A page that fails to load or fails to parse is an ERROR, never
      // "end of album" — that ambiguity is exactly what caused the
      // silent 240-image ceiling before.
      console.error(` ERROR: ${err.message}`);
      hadError = true;
      hasMore = false;
      break;
    }

    const fresh = res.images.filter(i => !seen.has(i.id));
    fresh.forEach(i => seen.add(i.id));
    allImages.push(...fresh);
    console.log(` ${res.images.length} images (${fresh.length} new to this scrape), more=${res.hasNext}`);

    if (res.images.length === 0 && res.hasNext) {
      // Shouldn't be possible, but if the API ever says "more" with an
      // empty page, don't spin — treat it as an error, not the end.
      console.error(`  ⚠ API reports more pages but returned 0 images — treating as ERROR.`);
      hadError = true;
      hasMore = false;
      break;
    }

    if (!res.hasNext) { console.log(`  has_page_next=false — end of album.`); hasMore = false; break; }

    page++;
    await sleep(DELAY_MS);
  }

  if (page > MAX_PAGES) { console.error(`  ⚠ Hit MAX_PAGES (${MAX_PAGES}) — album may be truncated.`); hadError = true; }

  // ---- Safety guards. Any of these returns null and aborts the run. ----
  if (allImages.length === 0 && existingCount > 0) {
    console.error(`  ⚠ SAFETY GUARD: scraped 0 images but gallery had ${existingCount}.`);
    return null;
  }
  if (hadError && allImages.length < existingCount) {
    console.error(`  ⚠ SAFETY GUARD: scrape aborted early (${allImages.length}/${existingCount}).`);
    return null;
  }
  if (existingCount > 10 && allImages.length < existingCount * (1 - MAX_SHRINK)) {
    const pct = (100 * (1 - allImages.length / existingCount)).toFixed(1);
    console.error(`  ⚠ SAFETY GUARD: scraped ${allImages.length} vs existing ${existingCount} (−${pct}%). Refusing to shrink the vault.`);
    return null;
  }
  return allImages;
}

function loadExistingData() {
  try {
    const raw = fs.readFileSync(GALLERY_DATA_PATH, 'utf8');
    const sandbox = {};
    new Function('window', raw + '\nreturn window.GALLERY_DATA;')(sandbox);
    return sandbox.GALLERY_DATA;
  } catch (e) { console.error('Could not load existing gallery-data.js:', e.message); return null; }
}

function loadSubmitters() {
  try { return JSON.parse(fs.readFileSync(SUBMITTERS_PATH, 'utf8')); }
  catch (e) { return {}; }
}

function saveData(data) {
  fs.writeFileSync(GALLERY_DATA_PATH,
`/* Auto-generated from postimg.cc albums — ${data.totalWorks} works · last updated ${data.lastUpdated} */
window.GALLERY_DATA = ${JSON.stringify(data)};
`);
}

// Lightweight per-artwork index for OG previews + fast lookups
function saveIndex(data, submitters) {
  const index = {};
  Object.values(data.galleries).forEach(g => {
    (g.works || []).forEach(w => {
      const s = submitters[w.id];
      index[w.id] = {
        title: w.title, gallery: g.id, galleryName: g.name,
        imageUrl: w.imageUrl, width: w.width, height: w.height,
        addedAt: w.addedAt || null,
        submitter: s ? { name: s.name, handle: s.handle } : null,
      };
    });
  });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
}

async function main() {
  console.log('=== Pete Pics Gallery Scraper ===');
  console.log(DRY_RUN ? 'DRY RUN — no files will be written\n' : '');

  const existing = loadExistingData();
  if (!existing) { console.error('Failed to load existing gallery-data.js'); process.exit(2); }
  const submitters = loadSubmitters();

  const existingIds = new Set();
  const existingCounts = {};
  if (existing.galleries) {
    Object.entries(existing.galleries).forEach(([gid, g]) => {
      existingCounts[gid] = (g.works || []).length;
      (g.works || []).forEach(w => existingIds.add(w.id));
    });
  }
  console.log(`Existing gallery: ${existingIds.size} images across ${Object.keys(existing.galleries || {}).length} galleries\n`);

  const today = new Date().toISOString().slice(0, 10);
  const newData = { galleries: {}, totalWorks: 0, lastUpdated: today };
  let totalNew = 0, guardTriggered = false;

  for (const gallery of GALLERIES) {
    console.log(`\nScraping ${gallery.name} (${gallery.albumHex})...`);
    const images = await scrapeAlbum(gallery.albumHex, gallery.id, existingCounts[gallery.id] || 0);
    if (images === null) {
      guardTriggered = true;
      if (existing.galleries[gallery.id]) {
        newData.galleries[gallery.id] = existing.galleries[gallery.id];
        newData.totalWorks += existingCounts[gallery.id] || 0;
      }
      continue;
    }
    const works = images.map(img => {
      const base = Object.assign({}, img, { gallery: gallery.id, galleryName: gallery.name });
      if (!existingIds.has(img.id)) base.addedAt = today;
      return base;
    });
    const newCount = works.filter(w => !existingIds.has(w.id)).length;
    totalNew += newCount;
    console.log(`  Total: ${works.length} images (${newCount} new)`);
    newData.galleries[gallery.id] = { id: gallery.id, name: gallery.name, tagline: gallery.tagline, wallClass: gallery.wallClass, works };
    newData.totalWorks += works.length;
  }

  console.log(`\n=== Summary ===\nExisting: ${existingIds.size}\nScraped: ${newData.totalWorks}\nNew: ${totalNew}`);

  if (guardTriggered) {
    console.error('\n⚠ Safety guard triggered — gallery-data.js NOT updated.');
    process.exit(2);
  }

  // Belt and braces: never let the grand total collapse either.
  if (existingIds.size > 50 && newData.totalWorks < existingIds.size * (1 - MAX_SHRINK)) {
    console.error(`\n⚠ SAFETY GUARD: total would drop ${existingIds.size} -> ${newData.totalWorks}. NOT writing.`);
    process.exit(2);
  }

  if (totalNew === 0) {
    console.log('\nGallery is up to date. No changes needed.');
    if (!DRY_RUN) saveIndex(newData, submitters);
    process.exit(0);
  }

  for (const gallery of GALLERIES) {
    const newGallery = newData.galleries[gallery.id];
    const oldGallery = existing.galleries[gallery.id];
    if (newGallery && oldGallery && oldGallery.works) {
      const oldById = {};
      oldGallery.works.forEach(w => { oldById[w.id] = w; });
      newGallery.works = newGallery.works.map(w => oldById[w.id] ? Object.assign({}, w, oldById[w.id]) : w);
    }
  }
  Object.keys(existing.galleries).forEach(gid => {
    if (!newData.galleries[gid]) {
      newData.galleries[gid] = existing.galleries[gid];
      newData.totalWorks += (existing.galleries[gid].works || []).length;
    }
  });

  console.log(`\nFinal total: ${newData.totalWorks} images`);

  if (DRY_RUN) {
    console.log('\nDry run — would have written gallery-data.js + artwork-index.json');
  } else {
    saveData(newData);
    saveIndex(newData, submitters);
    console.log('\ngallery-data.js + artwork-index.json updated successfully!');
  }
  process.exit(0);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(2); });
