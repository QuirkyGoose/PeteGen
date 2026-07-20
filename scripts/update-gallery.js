#!/usr/bin/env node
/**
 * Pete Pics Gallery Scraper
 * Fetches images from postimg.cc albums, updates gallery-data.js,
 * and emits artwork-index.json (lightweight, powers OG previews).
 *
 * Usage:  node scripts/update-gallery.js [--dry-run]
 * Exit:   0 = success · 2 = error / safety guard
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const GALLERIES = [
  { id: 'pobots',      name: 'Pobots',        tagline: 'Robots. Peets. The intersection thereof.',          albumHex: 'VML2tRn', wallClass: 'room-wall-1' },
  { id: 'prestlers',   name: 'Prestlers',     tagline: 'Peet meets the squared circle and beyond.',          albumHex: 'RFbFrht', wallClass: 'room-wall-2' },
  { id: 'cultural',    name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.',            albumHex: 'HVYDkG8', wallClass: 'room-wall-3' },
  { id: 'pisc',        name: 'Pisc',          tagline: 'A miscellany. A cornucopia. A Pisc.',                albumHex: 'Yt9J3Xt', wallClass: 'room-wall-4' },
  { id: 'submissions', name: 'Submissions',   tagline: 'Community contributions from the spreadsheet.',       albumHex: 'nMN0w6j', wallClass: 'room-wall-submissions' },
];

const GALLERY_DATA_PATH = path.join(__dirname, '..', 'gallery-data.js');
const INDEX_PATH        = path.join(__dirname, '..', 'artwork-index.json');
const SUBMITTERS_PATH   = path.join(__dirname, '..', 'submitters.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 500;
const MAX_PAGES = 20;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const MAX_REDIRECTS = 5;

function fetch(url, attempt = 1, redirects = 0) {
  return new Promise((resolve, reject) => {
    const retryOrReject = (err) => {
      if (attempt <= MAX_RETRIES) {
        console.log(`\n  ⚠ ${err.message} — retrying (${attempt}/${MAX_RETRIES})...`);
        sleep(RETRY_DELAY_MS).then(() => resolve(fetch(url, attempt + 1, redirects)));
      } else reject(err);
    };
    https.get(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' } }, (res) => {
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

function attr(tagHtml, name) {
  const m = tagHtml.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : '';
}

function parseAlbumPage(html) {
  const images = [];
  const anchorRe = /<a\b[^>]*data-pswp-src="[^"]*"[^>]*>/g;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const tag = m[0];
    const imageUrl = attr(tag, 'data-pswp-src');
    const href = attr(tag, 'href');
    const width = parseInt(attr(tag, 'data-pswp-width'), 10) || 0;
    const height = parseInt(attr(tag, 'data-pswp-height'), 10) || 0;
    const idMatch = href.match(/postimg\.cc\/([^"/?#]+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    const after = html.slice(m.index + tag.length, m.index + tag.length + 800);
    const imgTag = after.match(/<img\b[^>]*>/);
    if (!imgTag) continue;
    const thumbUrl = attr(imgTag[0], 'src');
    const altText = attr(imgTag[0], 'alt');
    if (!imageUrl || !thumbUrl) continue;
    const title = altText.replace(/-/g, ' ').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
    images.push({ id, title, imageUrl, thumbUrl, width, height });
  }
  return images;
}

async function scrapeAlbum(albumHex, galleryId, existingCount) {
  const allImages = [];
  let page = 1, hasMore = true, hadError = false;
  while (hasMore && page <= MAX_PAGES) {
    const url = page === 1 ? `https://postimg.cc/gallery/${albumHex}` : `https://postimg.cc/gallery/${albumHex}/${page}`;
    process.stdout.write(`  Fetching ${galleryId} page ${page}...`);
    try {
      const html = await fetch(url);
      const images = parseAlbumPage(html);
      if (images.length === 0) { console.log(` 0 images, done.`); hasMore = false; }
      else {
        allImages.push(...images);
        console.log(` ${images.length} images found.`);
        if (page > 1) {
          const pageSize = images.length;
          const prevBatch = allImages.slice(allImages.length - pageSize * 2, allImages.length - pageSize);
          const currentIds = new Set(images.map(i => i.id));
          if (prevBatch.length > 0 && prevBatch.every(i => currentIds.has(i.id))) {
            console.log(`  Duplicate page detected — reached the end.`);
            allImages.splice(allImages.length - images.length, images.length);
            hasMore = false;
          }
        }
        if (hasMore) { page++; await sleep(DELAY_MS); }
      }
    } catch (err) { console.error(` ERROR: ${err.message}`); hadError = true; hasMore = false; }
  }
  if (allImages.length === 0 && existingCount > 0) {
    console.error(`  ⚠ SAFETY GUARD: scraped 0 images but gallery had ${existingCount}.`);
    return null;
  }
  if (hadError && allImages.length < existingCount) {
    console.error(`  ⚠ SAFETY GUARD: scrape aborted early (${allImages.length}/${existingCount}).`);
    return null;
  }
  if (existingCount > 10 && allImages.length < existingCount * 0.5) {
    console.warn(`  ⚠ WARNING: scraped ${allImages.length} vs existing ${existingCount} — big drop, verify.`);
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
      const base = { ...img, gallery: gallery.id, galleryName: gallery.name };
      if (!existingIds.has(img.id)) base.addedAt = today;
      return base;
    });
    const newCount = works.filter(w => !existingIds.has(w.id)).length;
    totalNew += newCount;
    console.log(`  Total: ${works.length} images (${newCount} new)`);
    newData.galleries[gallery.id] = { id: gallery.id, name: gallery.name, tagline: gallery.tagline, wallClass: gallery.wallClass, works };
    newData.totalWorks += works.length;
  }

  console.log(`\n=== Summary ===\nExisting: ${existingIds.size}\nScraped:  ${newData.totalWorks}\nNew:      ${totalNew}`);

  if (guardTriggered) {
    console.error('\n⚠ Safety guard triggered — gallery-data.js NOT updated.');
    process.exit(2);
  }
  if (totalNew === 0) {
    console.log('\nGallery is up to date. No changes needed.');
    // Still refresh the index (cheap, keeps OG data + submitters current)
    if (!DRY_RUN) saveIndex(mergeAll(newData, existing), submitters);
    process.exit(0);
  }

  for (const gallery of GALLERIES) {
    const newGallery = newData.galleries[gallery.id];
    const oldGallery = existing.galleries[gallery.id];
    if (oldGallery && oldGallery.works) {
      const oldById = {};
      oldGallery.works.forEach(w => { oldById[w.id] = w; });
      newGallery.works = newGallery.works.map(w => oldById[w.id] ? { ...w, ...oldById[w.id] } : w);
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

function mergeAll(newData, existing) { return newData; }

main().catch(err => { console.error('Fatal error:', err); process.exit(2); });