#!/usr/bin/env node
/**
 * Pete Pics Gallery Scraper
 * 
 * Fetches all images from postimg.cc albums and updates gallery-data.js
 * with any new images found. Can be run manually or as a GitHub Action.
 *
 * Usage:
 *   node scripts/update-gallery.js [--dry-run]
 *
 * Exit codes:
 *   0 — changes were made (or would be in dry-run)
 *   1 — no changes needed (gallery is up to date)
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
const DELAY_MS = 500; // delay between page fetches to be polite

// ─── Helpers ────────────────────────────────────────────────────
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return resolve(fetch(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse an album page and extract image entries
function parseAlbumPage(html) {
  const images = [];
  
  // Match image card blocks: each has data-pswp-src (full URL), src (thumb URL),
  // data-pswp-width, data-pswp-height, alt (title), and href (postimg page URL with ID)
  // Pattern: data-pswp-src="URL" data-pswp-width="W" data-pswp-height="H" href="https://postimg.cc/ID"
  const cardRegex = /data-pswp-src="([^"]+)"[^>]*data-pswp-width="([^"]*)"[^>]*data-pswp-height="([^"]*)"[^>]*href="https:\/\/postimg\.cc\/([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g;
  
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const imageUrl = match[1];
    const width = parseInt(match[2], 10) || 0;
    const height = parseInt(match[3], 10) || 0;
    const id = match[4]; // postimg ID (used as the thumbUrl code)
    const thumbUrl = match[5];
    const altText = match[6];
    
    // Skip template/placeholder entries (empty src)
    if (!imageUrl || !thumbUrl || imageUrl === '') continue;
    
    // Convert filename to title: "15-14-Peters" → "15 14 Peters"
    const title = altText.replace(/-/g, ' ').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
    
    images.push({
      id: id,
      title: title,
      imageUrl: imageUrl,
      thumbUrl: thumbUrl,
      width: width,
      height: height,
    });
  }
  
  return images;
}

// Scrape all pages of an album
async function scrapeAlbum(albumHex, galleryId) {
  const allImages = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const url = page === 1 
      ? `https://postimg.cc/gallery/${albumHex}`
      : `https://postimg.cc/gallery/${albumHex}/${page}`;
    
    process.stdout.write(`  Fetching ${galleryId} page ${page}...`);
    
    try {
      const html = await fetch(url);
      const images = parseAlbumPage(html);
      
      if (images.length === 0) {
        console.log(` 0 images, done.`);
        hasMore = false;
      } else {
        allImages.push(...images);
        console.log(` ${images.length} images found.`);
        // If we got fewer than 48, we've reached the last page
        if (images.length < 48) {
          hasMore = false;
        } else {
          page++;
          await sleep(DELAY_MS);
        }
      }
    } catch (err) {
      console.error(` ERROR: ${err.message}`);
      hasMore = false;
    }
  }
  
  return allImages;
}

// Load existing gallery-data.js
function loadExistingData() {
  try {
    const raw = fs.readFileSync(GALLERY_DATA_PATH, 'utf8');
    // Use Function constructor to safely eval the file (it assigns to window.GALLERY_DATA)
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
  console.log('=== Pete Pics Gallery Scraper ===');
  console.log(DRY_RUN ? 'DRY RUN — no files will be written\n' : '');
  
  // Load existing data
  const existing = loadExistingData();
  if (!existing) {
    console.error('Failed to load existing gallery-data.js');
    process.exit(2);
  }
  
  // Build a set of existing image IDs for quick lookup
  const existingIds = new Set();
  if (existing.galleries) {
    Object.values(existing.galleries).forEach(g => {
      (g.works || []).forEach(w => existingIds.add(w.id));
    });
  }
  console.log(`Existing gallery: ${existingIds.size} images across ${Object.keys(existing.galleries || {}).length} galleries\n`);
  
  // Scrape all albums
  const newData = { galleries: {}, totalWorks: 0 };
  let totalNew = 0;
  
  for (const gallery of GALLERIES) {
    console.log(`\nScraping ${gallery.name} (${gallery.albumHex})...`);
    const images = await scrapeAlbum(gallery.albumHex, gallery.id);
    
    // Attach gallery metadata to each image
    const works = images.map(img => ({
      ...img,
      gallery: gallery.id,
      galleryName: gallery.name,
    }));
    
    // Count new images
    const newCount = works.filter(w => !existingIds.has(w.id)).length;
    totalNew += newCount;
    
    console.log(`  Total: ${works.length} images (${newCount} new)`);
    
    newData.galleries[gallery.id] = {
      id: gallery.id,
      name: gallery.name,
      tagline: gallery.tagline,
      wallClass: gallery.wallClass,
      works: works,
    };
    newData.totalWorks += works.length;
  }
  
  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Existing: ${existingIds.size} images`);
  console.log(`Scraped:  ${newData.totalWorks} images`);
  console.log(`New:      ${totalNew} images`);
  
  if (totalNew === 0) {
    console.log('\nGallery is up to date. No changes needed.');
    process.exit(1); // exit 1 = no changes
  }
  
  // Merge: keep existing image data where possible (preserves any manual edits),
  // but add new images from the scrape
  for (const gallery of GALLERIES) {
    const newGallery = newData.galleries[gallery.id];
    const oldGallery = existing.galleries[gallery.id];
    
    if (oldGallery && oldGallery.works) {
      // For images that already exist, keep the old data (in case of manual edits)
      // For new images, use the scraped data
      const oldById = {};
      oldGallery.works.forEach(w => { oldById[w.id] = w; });
      
      newGallery.works = newGallery.works.map(w => {
        if (oldById[w.id]) {
          // Keep old data but update any missing fields from scrape
          return { ...w, ...oldById[w.id] };
        }
        return w;
      });
    }
  }
  
  // Preserve any galleries not in our scrape list (e.g. "nacky" if it was manually added)
  Object.keys(existing.galleries).forEach(gid => {
    if (!newData.galleries[gid]) {
      newData.galleries[gid] = existing.galleries[gid];
      newData.totalWorks += (existing.galleries[gid].works || []).length;
    }
  });
  
  console.log(`\nFinal total: ${newData.totalWorks} images`);
  
  if (DRY_RUN) {
    console.log('\nDry run — would have written gallery-data.js');
    
    // List new images
    for (const gallery of GALLERIES) {
      const newGallery = newData.galleries[gallery.id];
      const newImages = newGallery.works.filter(w => !existingIds.has(w.id));
      if (newImages.length > 0) {
        console.log(`\nNew in ${gallery.name}:`);
        newImages.forEach(img => {
          console.log(`  + ${img.title} (${img.width}x${img.height}) — ${img.id}`);
        });
      }
    }
  } else {
    saveData(newData);
    console.log('\ngallery-data.js updated successfully!');
  }
  
  process.exit(0); // exit 0 = changes made
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
