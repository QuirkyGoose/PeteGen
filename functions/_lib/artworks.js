// Shared helpers for the Cloudflare Pages Functions.
// Files/directories starting with "_" are not routed, so this is safe to import.

export const SITE = {
  name: 'Peet Pics',
  subtitle: 'The Vault',
  tagline: 'A permanent archive of Peet-adjacent artwork, Pobots, Prestlers and Cultural Artefacts of Our Time.',
  host: 'postimg.cc',
};

// Mirrors the room list in the site bundle so links and plaques match.
export const ROOMS = {
  pisc: { numeral: 'I', name: 'Pisc', tagline: 'A miscellany. A cornucopia. A Pisc.', tone: '#c9a24b' },
  prestlers: { numeral: 'II', name: 'Prestlers', tagline: 'Peet meets the squared circle and beyond.', tone: '#c47b58' },
  pobots: { numeral: 'III', name: 'Pobots', tagline: 'Robots. Peets. The intersection thereof.', tone: '#b08fd4' },
  cultural: { numeral: 'IV', name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.', tone: '#9bbf9b' },
  submissions: { numeral: 'V', name: 'Submissions', tagline: 'Community contributions from the spreadsheet.', tone: '#c99aae' },
};

export function roomMeta(id) {
  return ROOMS[id] || { numeral: '·', name: id || 'Collection', tagline: '', tone: '#c9a24b' };
}

// Parsed once per isolate — artwork-index.json is ~400 KB, so re-reading it
// for every share-link hit would be wasteful. The TTL keeps newly scraped
// pictures from 404ing on a long-lived isolate.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheAt = 0;

export async function loadIndex(env, origin) {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  try {
    const resp = await env.ASSETS.fetch(new Request(origin + '/artwork-index.json'));
    if (!resp.ok) return cache || {};
    cache = await resp.json();
    cacheAt = Date.now();
    return cache;
  } catch (e) {
    return cache || {};
  }
}

export function neighbours(index, id) {
  const ids = Object.keys(index);
  const i = ids.indexOf(id);
  if (i === -1) return { prev: null, next: null, position: 0 };
  const at = (n) => (n >= 0 && n < ids.length ? { id: ids[n], title: index[ids[n]].title } : null);
  return { prev: at(i - 1), next: at(i + 1), position: i + 1 };
}

export function countInRoom(index, room) {
  return Object.values(index).filter((w) => w.gallery === room).length;
}

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function accessionLabel(n) {
  return 'NO. ' + String(n || 0).padStart(5, '0');
}

export function permalink(origin, id) {
  return origin + '/artwork/' + encodeURIComponent(id);
}

// Cache aggressively at the edge but let the browser revalidate, so a new
// picture is shareable within minutes of the scraper running.
export const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400',
};
