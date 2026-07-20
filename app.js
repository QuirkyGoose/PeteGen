/* ======================================================================
   Peet Pics — The Vault · App logic
   Routes: #/ · #/gallery/:room · #/artwork/:id · #/live · #/search/:q · #/submit
   Also reads clean paths (/artwork/:id) so shared links with OG previews render.
   Kill Wha easter egg removed (its inlined base64 was the only corruption-prone
   asset and the only manual step). Submitter attribution is DORMANT (only lights
   up if submitters.json exists).
====================================================================== */
(function () {
'use strict';

var ROOMS = [
  { id: 'pobots',      name: 'Pobots',        tagline: 'Robots. Peets. The intersection thereof.',          color: 'amber',  hex: '#d4a853' },
  { id: 'prestlers',   name: 'Prestlers',     tagline: 'Peet meets the squared circle and beyond.',         color: 'rust',   hex: '#d49274' },
  { id: 'cultural',    name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.',            color: 'rose',   hex: '#d9a3b8' },
  { id: 'pisc',        name: 'Pisc',          tagline: 'A miscellany. A cornucopia. A Pisc.',                color: 'sage',   hex: '#9bbf9b' },
  { id: 'submissions', name: 'Submissions',   tagline: 'Community contributions from the spreadsheet.',     color: 'violet', hex: '#b894d9' },
  { id: 'nacky',       name: 'Nacky Nook',    tagline: 'A secret corner reserved for the most delightfully unhinged Peet content.', color: 'nacky', hex: '#ff5fa2' },
];

var FALLBACK_TAGS = {
  pobots: ['robot','peet','mech','pobot'], prestlers: ['wrestling','peet','ring','prestler'],
  cultural: ['art','culture','peet','artifact'], pisc: ['misc','abstract','peet','pisc'],
  submissions: ['community','fanart','submission','peet'], nacky: ['nacky','unhinged','chaos','peet'],
};

var GALLERY_DATA = null, ARTWORKS = [], ARTWORKS_BY_ID = {}, WORKS_BY_ROOM = {};
var routeEl = document.getElementById('route');
var footerEl = document.getElementById('footer');
var backBtn = document.getElementById('backBtn');

function loadGalleryData() {
  return new Promise(function (resolve, reject) {
    if (window.GALLERY_DATA) {
      var json = window.GALLERY_DATA;
      GALLERY_DATA = json; ARTWORKS = []; ARTWORKS_BY_ID = {}; WORKS_BY_ROOM = {};
      Object.keys(json.galleries).forEach(function (roomId) {
        var g = json.galleries[roomId];
        var works = (g.works || []).map(function (w) {
          var room = ROOMS.find(function (r) { return r.id === roomId; });
          var augmented = Object.assign({}, w, { roomColor: room ? room.hex : '#d4a853', roomName: g.name, tags: generateFallbackTags(roomId, w.title) });
          ARTWORKS_BY_ID[w.id] = augmented;
          return augmented;
        });
        WORKS_BY_ROOM[roomId] = works;
        ARTWORKS = ARTWORKS.concat(works);
      });
      resolve(json);
    } else reject(new Error('gallery-data.js failed to load — window.GALLERY_DATA is undefined'));
  });
}

function generateFallbackTags(roomId, title) {
  var pool = FALLBACK_TAGS[roomId] || ['peet'];
  var tags = pool.slice(0, 2);
  var words = (title || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) {
    return w.length > 3 && ['with','that','this','from','have','been'].indexOf(w) === -1;
  });
  if (words.length > 0) tags.push(words[0]);
  if (words.length > 2) tags.push(words[1]);
  var seen = {};
  return tags.filter(function (t) { if (seen[t]) return false; seen[t] = true; return true; }).slice(0, 4);
}

function getRecentWorks(days) {
  var cutoff = Date.now() - (days || 30) * 86400000;
  return ARTWORKS.filter(function (w) {
    if (!w.addedAt) return false;
    var t = new Date(w.addedAt).getTime();
    return !isNaN(t) && t >= cutoff;
  }).sort(function (a, b) { return new Date(b.addedAt) - new Date(a.addedAt); });
}

function formatLastUpdated() {
  var d = GALLERY_DATA && GALLERY_DATA.lastUpdated;
  if (!d) return '';
  var dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Router (hash-first, falls back to clean path for shared OG links) ──
function navigate(hash) { if (hash === '') hash = '#/'; window.location.hash = hash; }

function parseRoute() {
  var hash = window.location.hash.slice(1);
  if (!hash || hash === '/') {
    var p = window.location.pathname.slice(1);
    if (p && p !== 'index.html') hash = p;
  }
  if (hash === '' || hash === '/') return { name: 'landing' };
  var parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'gallery' && parts[1]) return { name: 'gallery', room: decodeURIComponent(parts[1]) };
  if (parts[0] === 'artwork' && parts[1]) return { name: 'artwork', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'schedule') return { name: 'schedule' };
  if (parts[0] === 'friends') return { name: 'friends' };
  if (parts[0] === 'shop') return { name: 'shop' };
  if (parts[0] === 'submit') return { name: 'submit' };
  if (parts[0] === 'live' || (parts[0] && parts[0].indexOf('live?') === 0)) {
    return { name: 'live', room: parts[1] ? decodeURIComponent(parts[1].split('?')[0]) : null, query: hash.split('?')[1] || '' };
  }
  if (parts[0] === 'search') return { name: 'search', query: decodeURIComponent(parts[1] || '') };
  return { name: 'landing' };
}

function render() {
  clearMerchCarousel();
  clearLiveOverlay();
  if (!GALLERY_DATA) {
    routeEl.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><div class="loading-text">Loading the vault…</div></div>';
    return;
  }
  var route = parseRoute();
  routeEl.innerHTML = '';
  if (route.name !== 'search') window.scrollTo(0, 0);
  if (route.name === 'landing') { footerEl.style.display = 'flex'; lastSearchQuery = ''; if (searchInput) searchInput.value = ''; renderLanding(); startMerchCarousel(); }
  else if (route.name === 'gallery') { footerEl.style.display = 'none'; if (searchInput && searchInput.value) { lastSearchQuery=''; searchInput.value=''; } renderGallery(route.room); }
  else if (route.name === 'artwork') { footerEl.style.display = 'none'; renderArtwork(route.id); }
  else if (route.name === 'schedule') { footerEl.style.display = 'none'; renderSchedule(); }
  else if (route.name === 'friends') { footerEl.style.display = 'none'; renderFriends(); }
  else if (route.name === 'shop') { footerEl.style.display = 'none'; renderShop(); }
  else if (route.name === 'submit') { footerEl.style.display = 'none'; renderSubmit(); }
  else if (route.name === 'live') { footerEl.style.display = 'none'; renderLive(); }
  else if (route.name === 'search') { footerEl.style.display = 'none'; renderSearch(route.query); }
  updateBackButton(route);
  var gooRoom = 'default';
  if (route.name === 'gallery' && ROOMS.find(function (r) { return r.id === route.room; })) gooRoom = route.room;
  else if (route.name === 'artwork') { var w = ARTWORKS_BY_ID[route.id]; if (w && w.gallery) gooRoom = w.gallery; }
  if (typeof updateGooColors === 'function') updateGooColors(gooRoom);
  syncNavDropdownState();
}

function updateBackButton(route) {
  if (!backBtn) return;
  if (route.name === 'landing') { backBtn.style.display = 'none'; return; }
  backBtn.style.display = '';
  if (route.name === 'artwork') {
    var w = ARTWORKS_BY_ID[route.id];
    if (w && w.gallery) { backBtn.href = '#/gallery/' + w.gallery; backBtn.setAttribute('aria-label', 'Back to ' + (w.galleryName || w.gallery)); }
    else { backBtn.href = '#/'; backBtn.setAttribute('aria-label', 'Back to landing'); }
  } else { backBtn.href = '#/'; backBtn.setAttribute('aria-label', 'Back to landing'); }
}

window.addEventListener('hashchange', function () {
  render(); closeNavDropdown();
  setTimeout(resize, 100); setTimeout(resize, 500); setTimeout(resize, 1500);
});
document.getElementById('brandHome').addEventListener('click', function () { navigate(''); });

document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.target.isContentEditable) return;
  if (e.key === 'Escape' || e.key === 'Backspace') {
    if (shortcutsModal && shortcutsModal.classList.contains('open')) return;
    if (lightbox && lightbox.classList.contains('open')) return;
    if (slideshow && slideshow.classList.contains('open')) return;
    var route = parseRoute();
    if (route.name !== 'landing') {
      e.preventDefault();
      if (backBtn) window.location.hash = backBtn.getAttribute('href') || '#/';
      else navigate('');
    }
  }
});

var randomBtn = document.getElementById('randomBtn');
if (randomBtn) randomBtn.addEventListener('click', function () { navigateToRandom(); });

document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.target.isContentEditable) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); navigateToRandom(); }
});

// ── Nav dropdown ──
var navDropdown = document.getElementById('navDropdown');
var navTrigger = document.getElementById('navDropdownTrigger');
var navMenu = document.getElementById('navDropdownMenu');
var navCurrentLabel = document.getElementById('navDropdownCurrent');

var NAV_VIRTUAL = [
  { id: 'all',        name: 'All Works',      tagline: 'Every piece in the vault',         color: 'amber', hex: '#d4a853', icon: 'grid' },
  { id: 'new',        name: 'Recently Added', tagline: 'Fresh arrivals, last 30 days',     color: 'sage',  hex: '#9bbf9b', icon: 'spark' },
  { id: 'favourites', name: 'Favourites',     tagline: 'Hand-picked from the collections', color: 'rose',  hex: '#d9a3b8', icon: 'heart' },
];

var SVG_ICONS = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="nav-active-mark" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>'
};

function buildNavDropdown() {
  if (!navMenu) return;
  var counts = {};
  ROOMS.forEach(function (r) { counts[r.id] = (WORKS_BY_ROOM[r.id] || []).length; });
  counts.all = ARTWORKS.length;
  counts.new = getRecentWorks(30).length;
  counts.favourites = loadFavourites().length;

  var collectionsHtml = ROOMS.map(function (r) {
    var isActive = currentRoomId() === r.id;
    return '<button class="nav-dropdown-item' + (isActive ? ' is-active' : '') + '" style="--dot-color: ' + r.hex + ';" data-room="' + escapeHtml(r.id) + '" role="option" aria-selected="' + (isActive?'true':'false') + '">' +
      '<span class="nav-dot"></span><span class="nav-item-name">' + escapeHtml(r.name) + '</span>' +
      '<span class="nav-item-tag">' + escapeHtml(r.tagline) + '</span><span class="nav-item-count">' + counts[r.id] + '</span>' + SVG_ICONS.check + '</button>';
  }).join('');

  var virtualHtml = NAV_VIRTUAL.map(function (r) {
    var isActive = currentRoomId() === r.id;
    return '<button class="nav-dropdown-item' + (isActive ? ' is-active' : '') + '" style="--dot-color: ' + r.hex + ';" data-room="' + escapeHtml(r.id) + '" role="option" aria-selected="' + (isActive?'true':'false') + '">' +
      (SVG_ICONS[r.icon] || '') + '<span class="nav-item-name">' + escapeHtml(r.name) + '</span>' +
      '<span class="nav-item-tag">' + escapeHtml(r.tagline) + '</span><span class="nav-item-count">' + counts[r.id] + '</span>' + SVG_ICONS.check + '</button>';
  }).join('');

  var landingActive = currentRouteName() === 'landing';
  var landingHtml = '<button class="nav-dropdown-item' + (landingActive?' is-active':'') + '" style="--dot-color:#ffffff;" data-room="__landing" role="option" aria-selected="' + (landingActive?'true':'false') + '">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' +
    '<span class="nav-item-name">The Vault</span><span class="nav-item-tag">Landing &amp; overview</span><span class="nav-item-count">' + ARTWORKS.length + '</span>' + SVG_ICONS.check + '</button>';

  var scheduleActive = currentRouteName() === 'schedule';
  var friendsActive = currentRouteName() === 'friends';
  var shopActive = currentRouteName() === 'shop';
  var submitActive = currentRouteName() === 'submit';
  var pagesHtml =
    '<button class="nav-dropdown-item' + (scheduleActive?' is-active':'') + '" style="--dot-color:var(--amber);" data-room="__schedule" role="option" aria-selected="' + (scheduleActive?'true':'false') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
      '<span class="nav-item-name">Schedule</span><span class="nav-item-tag">Weekly stream times</span><span class="nav-item-count">7</span>' + SVG_ICONS.check + '</button>' +
    '<button class="nav-dropdown-item' + (friendsActive?' is-active':'') + '" style="--dot-color:var(--rose);" data-room="__friends" role="option" aria-selected="' + (friendsActive?'true':'false') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' +
      '<span class="nav-item-name">Friends</span><span class="nav-item-tag">Pete\'s collaborators</span><span class="nav-item-count">' + (FRIENDS||[]).length + '</span>' + SVG_ICONS.check + '</button>' +
    '<button class="nav-dropdown-item' + (shopActive?' is-active':'') + '" style="--dot-color:var(--sage);" data-room="__shop" role="option" aria-selected="' + (shopActive?'true':'false') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' +
      '<span class="nav-item-name">Shop</span><span class="nav-item-tag">Official merch on Fourthwall</span>' + SVG_ICONS.check + '</button>' +
    '<button class="nav-dropdown-item' + (submitActive?' is-active':'') + '" style="--dot-color:var(--violet);" data-room="__submit" role="option" aria-selected="' + (submitActive?'true':'false') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      '<span class="nav-item-name">Submit a Pic</span><span class="nav-item-tag">Add your own to the vault</span>' + SVG_ICONS.check + '</button>';

  var rvList = loadRecentlyViewed();
  var rvHtml = '';
  if (rvList.length > 0) {
    var rvItems = rvList.map(function (w) {
      return '<a class="nav-dropdown-rv-item" href="#/artwork/' + encodeURIComponent(w.id) + '" title="' + escapeHtml(w.title) + '">' +
        '<img src="' + escapeHtml(w.thumbUrl) + '" alt="' + escapeHtml(w.title) + '" loading="lazy" referrerpolicy="no-referrer" />' +
        '<div class="rv-tooltip">' + escapeHtml(w.title) + '</div></a>';
    }).join('');
    rvHtml = '<div class="nav-dropdown-section" style="margin-top:6px;">Recently Viewed</div>' +
      '<div class="nav-dropdown-rv-section"><div class="nav-dropdown-rv-grid">' + rvItems + '</div></div>';
  }

  navMenu.innerHTML =
    '<div class="nav-dropdown-section">Collections</div>' + collectionsHtml +
    '<div class="nav-dropdown-section" style="margin-top:6px;">Browse</div>' + virtualHtml +
    '<div class="nav-dropdown-section" style="margin-top:6px;">Site</div>' + pagesHtml + rvHtml +
    '<div class="nav-dropdown-section" style="margin-top:6px;">Home</div>' + landingHtml;

  navMenu.querySelectorAll('.nav-dropdown-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var room = btn.getAttribute('data-room');
      closeNavDropdown();
      if (room === '__landing') navigate('');
      else if (room === '__schedule') navigate('#/schedule');
      else if (room === '__friends') navigate('#/friends');
      else if (room === '__shop') navigate('#/shop');
      else if (room === '__submit') navigate('#/submit');
      else navigate('#/gallery/' + room);
    });
  });
  syncNavTriggerLabel();
}

function currentRouteName() { return parseRoute().name; }
function currentRoomId() { var r = parseRoute(); return r.name === 'gallery' ? r.room : null; }

function syncNavTriggerLabel() {
  if (!navCurrentLabel) return;
  var route = parseRoute();
  var label = 'The Vault', colorClass = '';
  if (route.name === 'landing') label = 'The Vault';
  else if (route.name === 'gallery') {
    var room = ROOMS.find(function (r) { return r.id === route.room; });
    if (room) { label = room.name; colorClass = 'is-' + room.color; }
    else if (route.room === 'all') { label = 'All Works'; colorClass = 'is-amber'; }
    else if (route.room === 'new') { label = 'Recently Added'; colorClass = 'is-sage'; }
    else if (route.room === 'favourites') { label = 'Favourites'; colorClass = 'is-rose'; }
    else label = route.room;
  } else if (route.name === 'artwork') {
    var work = ARTWORKS_BY_ID[route.id];
    if (work) { var room2 = ROOMS.find(function (r) { return r.id === work.gallery; }); if (room2) { label = room2.name; colorClass = 'is-' + room2.color; } }
  } else if (route.name === 'schedule') { label = 'Schedule'; colorClass = 'is-amber'; }
  else if (route.name === 'friends') { label = 'Friends'; colorClass = 'is-rose'; }
  else if (route.name === 'shop') { label = 'Shop'; colorClass = 'is-sage'; }
  else if (route.name === 'submit') { label = 'Submit a Pic'; colorClass = 'is-violet'; }
  navCurrentLabel.textContent = label;
  navCurrentLabel.classList.remove('is-amber','is-rust','is-rose','is-sage','is-violet','is-nacky');
  if (colorClass) navCurrentLabel.classList.add(colorClass);
}

function syncNavDropdownState() {
  syncNavTriggerLabel();
  if (!navMenu) return;
  var activeRoom = currentRoomId();
  var routeName = currentRouteName();
  navMenu.querySelectorAll('.nav-dropdown-item').forEach(function (btn) {
    var room = btn.getAttribute('data-room');
    var isActive;
    if (room === '__landing') isActive = (routeName === 'landing');
    else if (room === '__schedule') isActive = (routeName === 'schedule');
    else if (room === '__friends') isActive = (routeName === 'friends');
    else if (room === '__shop') isActive = (routeName === 'shop');
    else if (room === '__submit') isActive = (routeName === 'submit');
    else isActive = (room === activeRoom);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function openNavDropdown() { if (!navDropdown) return; navDropdown.classList.add('open'); navTrigger.setAttribute('aria-expanded','true'); }
function closeNavDropdown() { if (!navDropdown) return; navDropdown.classList.remove('open'); navTrigger.setAttribute('aria-expanded','false'); }
function toggleNavDropdown() { navDropdown.classList.contains('open') ? closeNavDropdown() : openNavDropdown(); }
if (navTrigger) navTrigger.addEventListener('click', function (e) { e.stopPropagation(); toggleNavDropdown(); });
document.addEventListener('click', function (e) { if (!navDropdown) return; if (!navDropdown.contains(e.target)) closeNavDropdown(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNavDropdown(); });

// ── Image loading ──
var lazyObserver = null;
function initLazyObserver() {
  if (lazyObserver) return lazyObserver;
  lazyObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var img = entry.target;
        var src = img.getAttribute('data-src');
        if (src && !img.src) img.src = src;
        lazyObserver.unobserve(img);
      }
    });
  }, { rootMargin: '400px' });
  return lazyObserver;
}
function observeLazyImages(container) {
  var obs = initLazyObserver();
  container.querySelectorAll('img[data-src]').forEach(function (img) { obs.observe(img); });
}

function imgTag(work, cls, alt) {
  var url = work.imageUrl || work.thumbUrl;
  var w = work.width || '', h = work.height || '';
  var aspect = (w && h) ? (w / h) : 1;
  var altText = alt || escapeHtml(work.title || '');
  cls = cls || '';
  var nsfw = isNsfw(work);
  var revealed = nsfw && NSFW_REVEALED.has(work.id);
  var img = '<img' + (cls ? ' class="' + cls + (nsfw && !revealed ? ' nsfw-blur' : '') + '"' : '') +
    ' alt="' + altText + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
    ' data-src="' + escapeHtml(url) + '" data-aspect="' + aspect.toFixed(3) + '"' +
    ' style="opacity:0;transition:opacity 0.4s ease;' + (nsfw && !revealed ? 'filter:blur(20px);' : '') + '"' +
    ' onload="this.style.opacity=1" onerror="this.style.opacity=0.12;this.alt=\'unavailable\'">';
  if (nsfw && !revealed) {
    img = '<div class="nsfw-wrap" data-id="' + escapeHtml(work.id) + '" data-nsfw-reveal="' + escapeHtml(work.id) + '">' + img +
      '<div class="nsfw-overlay"><div class="nsfw-tag">NSFW</div><div class="nsfw-cta">Click to reveal</div></div></div>';
  }
  return img;
}

function revealNsfw(id) {
  if (!id) return;
  NSFW_REVEALED.add(id);
  if (lightbox && lightbox.classList.contains('open') && currentLightboxId === id) { updateLightbox(); return; }
  var handled = false;
  document.querySelectorAll('.nsfw-wrap[data-id="' + cssEscape(id) + '"]').forEach(function (wrap) {
    var img = wrap.querySelector('img');
    if (img) { img.classList.remove('nsfw-blur'); img.style.filter = ''; if (!img.src && img.getAttribute('data-src')) img.src = img.getAttribute('data-src'); }
    var overlay = wrap.querySelector('.nsfw-overlay');
    if (overlay) overlay.remove();
    wrap.removeAttribute('data-nsfw-reveal');
    handled = true;
  });
  var detailOverlay = document.querySelector('.nsfw-overlay-detail');
  if (detailOverlay) {
    var dImg = detailOverlay.parentNode.querySelector('img');
    if (dImg) dImg.style.filter = '';
    detailOverlay.remove();
    var hint = document.querySelector('.artwork-zoom-hint');
    if (hint) hint.style.display = '';
    handled = true;
  }
  if (!handled) render();
}
function cssEscape(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s); }

// One delegated listener replaces all inline onclick handlers (CSP-friendly).
document.addEventListener('click', function (e) {
  var nsfw = e.target.closest('[data-nsfw-reveal]');
  if (nsfw) { e.preventDefault(); revealNsfw(nsfw.getAttribute('data-nsfw-reveal')); return; }
  if (e.target.closest('[data-merch-dismiss]')) { dismissMerchBanner(); return; }
  if (e.target.closest('[data-mute-toggle]')) { toggleShopVideoMute(); return; }
  var copyBtn = e.target.closest('[data-copy-link]');
  if (copyBtn) { e.preventDefault(); copyArtworkLink(copyBtn.getAttribute('data-copy-link')); return; }
  var dlBtn = e.target.closest('[data-download]');
  if (dlBtn) { e.preventDefault(); downloadArtwork(dlBtn.getAttribute('data-download')); return; }
  var fav = e.target.closest('[data-fav-id]');
  if (fav) { e.preventDefault(); toggleFavourite(fav.getAttribute('data-fav-id')); }
});

function dismissMerchBanner() {
  clearMerchCarousel();
  var banner = document.getElementById('merchBanner');
  if (banner) {
    banner.style.opacity = '0'; banner.style.transform = 'translateY(-12px)';
    banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(function() { if (banner && banner.parentNode) banner.remove(); }, 300);
  }
  try { localStorage.setItem('petegen-merch-burger-dismissed', 'true'); } catch(e) {}
}

function toggleShopVideoMute() {
  var video = document.getElementById('shopDropVideo');
  var btn = document.getElementById('videoMuteToggle');
  if (!video) return;
  video.muted = !video.muted;
  if (btn) {
    btn.title = video.muted ? 'Click to unmute' : 'Click to mute';
    var im = btn.querySelector('.icon-muted'), iu = btn.querySelector('.icon-unmuted');
    if (im) im.style.display = video.muted ? '' : 'none';
    if (iu) iu.style.display = video.muted ? 'none' : '';
  }
}

var merchCarouselTimer = null;
function clearMerchCarousel() { if (merchCarouselTimer) { clearInterval(merchCarouselTimer); merchCarouselTimer = null; } }
function startMerchCarousel() {
  var carousel = document.getElementById('merchCarousel');
  if (!carousel) return;
  var imgs = carousel.querySelectorAll('.merch-carousel-img');
  if (imgs.length < 2) return;
  var idx = 0;
  clearMerchCarousel();
  merchCarouselTimer = setInterval(function() {
    imgs[idx].classList.remove('active');
    idx = (idx + 1) % imgs.length;
    imgs[idx].classList.add('active');
  }, 3000);
}

// ── Landing ──
function getPicOfDay() {
  if (!ARTWORKS.length) return null;
  var tz = (SITE_CONFIG && SITE_CONFIG.timezone) || 'UTC';
  var parts;
  try { parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()).split('-'); }
  catch (e) { var d = new Date(); parts = [String(d.getFullYear()), String(d.getMonth()+1), String(d.getDate())]; }
  var seed = parseInt(parts[0] + parts[1] + parts[2], 10);
  var safe = ARTWORKS.filter(function (w) { return !isNsfw(w); });
  var pool = safe.length > 0 ? safe : ARTWORKS;
  return pool[seed % pool.length];
}
function navigateToRandom() {
  if (!ARTWORKS.length) return;
  navigate('#/artwork/' + encodeURIComponent(ARTWORKS[Math.floor(Math.random() * ARTWORKS.length)].id));
}

function renderRecentStrip() {
  var recent = getRecentWorks(30).filter(function (w) { return !isNsfw(w); }).slice(0, 12);
  if (recent.length === 0) {
    return '<section id="recently-added" class="screen"><div class="recent-inner"><div class="recent-header">' +
      '<h2 class="recent-title">Fresh in the <span class="thin">Vault</span></h2>' +
      '<span class="recent-empty-note">No new arrivals in the last 30 days — the vault restocks regularly.</span></div></div></section>';
  }
  var cards = recent.map(function (w) {
    var age = Math.max(0, Math.floor((Date.now() - new Date(w.addedAt).getTime()) / 86400000));
    var badge = age <= 7 ? '<span class="recent-new-badge">NEW</span>' : '';
    return '<a class="recent-card" href="#/artwork/' + encodeURIComponent(w.id) + '">' +
      '<div class="recent-card-imgwrap">' + badge + '<img src="' + escapeHtml(w.imageUrl || w.thumbUrl) + '" alt="' + escapeHtml(w.title || '') + '" loading="lazy" referrerpolicy="no-referrer" decoding="async"></div>' +
      '<div class="recent-card-title">' + escapeHtml(w.title || 'Untitled') + '</div>' +
      '<div class="recent-card-meta">' + escapeHtml(w.galleryName || '') + ' · ' + escapeHtml(w.addedAt) + '</div></a>';
  }).join('');
  return '<section id="recently-added" class="screen"><div class="recent-inner"><div class="recent-header"><div>' +
    '<h2 class="recent-title">Fresh in the <span class="thin">Vault</span></h2>' +
    '<p class="recent-sub">' + recent.length + ' new arrival' + (recent.length===1?'':'s') + ' in the last 30 days</p></div>' +
    '<a class="recent-viewall" href="#/gallery/new">View all new →</a></div>' +
    '<div class="recent-scroll">' + cards + '</div></div></section>';
}

function renderLanding() {
  var counts = {};
  ROOMS.forEach(function (r) { counts[r.id] = (WORKS_BY_ROOM[r.id] || []).length; });
  var totalWorks = ARTWORKS.length;
  var lastUpdated = formatLastUpdated();
  var previewCount = (SITE_CONFIG && SITE_CONFIG.previewCount) || 3;
  var previewMode = (SITE_CONFIG && SITE_CONFIG.previewMode) || 'static';
  var previewHtml = ROOMS.map(function (r) {
    var works = (WORKS_BY_ROOM[r.id] || []).filter(function (w) { return !isNsfw(w); });
    var sample;
    if (previewMode === 'random' && works.length > previewCount) {
      var shuffled = works.slice();
      for (var i = shuffled.length - 1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var tmp = shuffled[i]; shuffled[i]=shuffled[j]; shuffled[j]=tmp; }
      sample = shuffled.slice(0, previewCount);
    } else sample = works.slice(0, previewCount);
    var thumbs = sample.map(function (w) { return '<div class="room-preview-thumb" style="background-image:url(\'' + escapeHtml(w.thumbUrl || w.imageUrl) + '\')"></div>'; }).join('');
    return '<a class="room-card room-' + r.color + '" href="#/gallery/' + r.id + '">' +
      '<div class="room-card-previews">' + thumbs + '</div>' +
      '<div class="room-card-head"><span class="room-card-name">' + escapeHtml(r.name) + '</span><span class="room-card-count">' + counts[r.id] + ' works</span></div>' +
      '<p class="room-card-tagline">' + escapeHtml(r.tagline) + '</p>' +
      '<div class="room-card-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></div></a>';
  }).join('');

  var html = '<section id="landing" class="screen">' +
    (function() {
      var dismissed = false;
      try { dismissed = localStorage.getItem('petegen-merch-burger-dismissed') === 'true'; } catch(e) {}
      if (dismissed) return '';
      return '<div class="merch-banner" id="merchBanner"><div class="merch-banner-inner">' +
        '<div class="merch-banner-carousel" id="merchCarousel">' +
          '<img class="merch-carousel-img active" src="https://imgproxy.fourthwall.dev/Zret4ee8Hfm1TNx9Puy2aLavHahAEdmVIudQ3xeMvDc/w:720/sm:1/enc/4hv55ZYBz-XLTsST/BJHvtP9Z-Bq6v2u7/1oqTgXPn1K-ph1tW/pnjSuXyRs9c4_qUz/rkznrPXByCQLTQOf/tLExhEJxjKOKkKaP/JQ51DYP4X713H8NN/kkkpfUwzPbyAVC3_/hizMYC3dMTt1A2yK/9KDzoztDsswh8pyj/CepTYpTQHFIVPA9X/jkbNLENbxH4k8hDK/InyL9mK7YNx-6Vf5/cTjWP5fDYO2Usj3X/v0K_ZkBZm4I.jpg" alt="Mean Gene\'s Burger Revival — product 1" loading="eager" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/e7HXLfkGN79mM40YNEs1nubgul4GnorOIuSQB7Y9FlQ/w:1920/sm:1/enc/Prl8-2yoqioNCHqa/3Nonh-HOJz9JJNoe/aukNSA4bP5EYPV0l/AlDLUlu_wlWDbMEF/trmnssC6E90q307e/n8MxKKA9CjGLGCbg/8YOeoMFCh-8pbckc/-e88XLOPSoxfndTi/6V2fYZWSFhdE9MzQ/81-50b7o1qc8VRr4/dU3WCZI-VZReq55w/OEEY_1kqXv_RCE6e/PGKmS6nqlHA-Teo8/T5r_yR6hOplKZwnw/Imn2J67GU8A.jpg" alt="Mean Gene\'s Burger Revival — product 2" loading="lazy" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/1tftAXUwM9fBp0p-6p9m6XtQyFo52TTaUW_px_qTgLo/w:720/sm:1/enc/2SzkJoVLbgOQCa-C/6Idz-yYcuPbj4RQw/XagWQ-_kRYzcPIZa/JhLFzlYZgqIervgZ/5DnktycqteepmvHD/ADFP10a14eISyP94/M1q94AdHck3apvQn/vR2M-Pa4F14l2W-3/kMygo4d3Jiv5azvS/WAhAEEpShumgqiSr/Cerk9MrufT5W6ee0/6UvchuOwRIhDyIcL/4KGmwUqvvrmEKdgl/Po9z4SdW3-GMbI5c/MqbWGCx5y9w.webp" alt="Mean Gene\'s Burger Revival — product 3" loading="lazy" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/eGBbtYwnoQkKbvCIDjXvL7h9Ewmw24_t8Er9c6teutc/w:1920/sm:1/enc/3TuvBqDU8TszqpNI/ZgJ83FbKMdk5aGUS/BRhbA8OuIBzGHyaf/kOFBx4w3ZqR3jGP0/-cfwJlqsyZn13gmV/MbdoW6pnngkqBru_/6Esd2h4YzxDxy8kA/l1fg5hrc_5yzQmgS/-1ssNnszLwEun4dY/xdKiEBVs2aFZpAlv/HMa26tD1ZZG1pJgc/6kCFqvRNheVIvCY0/DpQctU18QDKLrfuM/KXlUiljQ-mi2AxsU/LfvSNcWdB_Y.jpg" alt="Mean Gene\'s Burger Revival — product 4" loading="lazy" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/7xS9gFl8afUIn25_0jolshAqmSSG06rvoRdc18YG-oA/w:1920/sm:1/enc/IktB9XPhgvXMDj1v/Jx93Zxj2SNybnlab/COdGZEN_Tbor_mJq/ekEyOsccqPH-OjBf/xW6IFFsS8fhj7Mk_/z0RhUzyE7M1IkExT/Iu2EZbykMTQqrpGg/rjapg4TgjYB6Pw7Z/JU3NP5TqkN-8REpL/asbBVbNcEkq4HO37/-GtkR0M5zkM5Q-Pk/u2jkJZxQA2D7ALsw/AEd3gVw6kJ1IvAIy/PchlyNUggxoI-wHT/J02VhWNYOAQ.jpg" alt="Mean Gene\'s Burger Revival — product 5" loading="lazy" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/52D__Km22WjLzet9hz2D6yvxOSOC2ssmR2lSIfl6Iao/w:1920/sm:1/enc/D7w1jo8Ekh_18MLY/P8VZnL35qbSSEnqL/0221Z36sfprH-9sG/ZKEm49_JMKEMFKpZ/8AygSF8KULHV_tzF/SbBlP0zXM_3Karkf/AUmtMbeKNMx3GsEF/cjnzDMf1w4KPyp7a/OmUD-_FCdT8PpOHc/aTXETGcble25Ru0F/4ss4nR2mLzmQwKoP/kQrfZ2ub7z08SxPA/Y4irZkABIONMERFQ/fdUJfmldXIZHMGcr/-8O1xgw6TQ8.jpg" alt="Mean Gene\'s Burger Revival — product 6" loading="lazy" />' +
          '<img class="merch-carousel-img" src="https://imgproxy.fourthwall.dev/yWx9hXR1uRo0jxjB33GRptFsCjpQvCCpa57nA2T1FnI/w:1920/sm:1/enc/HoGA__vrCn_dh99G/tWiIENzm8t8IUiEr/dmze2nfzWkyTsaU7/x4Xv_FqGgd3nofqA/-TSU0Tf2IVrjfS4v/Znf8Tf2zdxlLI2Jg/4hE80YTKd_nr2nzn/menDN12I9iZsBmC7/oLTOy53Fsic-exew/fopwkZLiLMMqkP6E/-E9pdR55AMIRp-j5/vgzx0o4FVW6qYHln/5sBVnJGYFl6xkbqn/IlAFVx6s7sWVHymr/ARLezZ8KOZs.jpg" alt="Mean Gene\'s Burger Revival — product 7" loading="lazy" />' +
        '</div>' +
        '<div class="merch-banner-badge">MERCH DROP</div>' +
        '<div class="merch-banner-body">' +
          '<div class="merch-banner-title">Mean Gene\'s Burger Revival</div>' +
          '<div class="merch-banner-copy">Watch out Big Burger Boys! In 1998 Mean Gene went toe-to-toe with the Big Burger Boys when he established Mean Gene\'s Burgers. I don\'t think he won but I\'m not sure that matters! The shirt in the advert was beautiful and I wanted to recreate it for a new generation. Probably don\'t call the phone number…and nobody tell Gene!</div>' +
          '<a class="merch-banner-btn" href="https://agoodpete-shop.fourthwall.com/en-gbp/collections/mean-genes-burger-revival" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Shop the Collection' +
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>' +
        '<button class="merch-banner-close" id="merchBannerClose" title="Dismiss" data-merch-dismiss>' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>';
    })() +
    '<div class="hero-overlay"><div class="hero-content">' +
      '<div class="eyebrow anim">EST. 2024 · PeteGen · ' + ROOMS.length + ' collections · ' + totalWorks.toLocaleString() + ' works</div>' +
      '<h1 class="hero-h1 anim">Peet Pics.<br><span class="thin">A permanent archive of the</span> <span class="amber">Pobots, Prestlers &amp; Cultural Pics</span> <span class="thin">of our time.</span></h1>' +
      '<div class="hero-row anim"><div class="hero-main">' +
        '<p class="hero-sub"><b>The Vault</b> — a permanent archive dedicated to the finest Peet-adjacent artwork, Pobots, Prestlers, and Cultural Artefacts of Our Time. Curated by AGoodPete, catalogued by the community, preserved for the foreseeable future.</p>' +
        '<div class="hero-stats">' +
          '<div class="stat"><span class="stat-val">' + totalWorks.toLocaleString() + '</span><span class="stat-label">Works Archived</span></div>' +
          '<div class="stat"><span class="stat-val">' + ROOMS.length + '</span><span class="stat-label">Collections</span></div>' +
          '<div class="stat"><span class="stat-val amber">∞</span><span class="stat-label">Pobots</span></div>' +
          '<div class="stat"><span class="stat-val">100%</span><span class="stat-label">Community-run</span></div></div></div>' +
      '<div class="hero-side"><div class="hero-actions">' +
        '<a class="btn-primary" href="#/gallery/all"><span>Enter the Archive</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4"/></svg></a>' +
        '<a class="btn-secondary" href="https://twitch.tv/AGoodPete" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg><span>AGoodPete on Twitch</span></a>' +
        '<a class="btn-secondary btn-shop" href="#/shop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>The Vault Shop</span></a></div>' +
      '<div class="hero-foot">' +
        '<a class="foot-note-cta" href="#collections">Five chambers of the vault, <b>each with its own character</b> &nbsp;→</a>' +
        '<span class="hero-foot-note">Live data · ' + totalWorks.toLocaleString() + ' works' + (lastUpdated ? ' · last updated ' + lastUpdated : '') + '</span></div></div></div></div>' +
      '<div class="scroll-cue" id="scrollCue"><span>Browse the archive</span><div class="scroll-cue-line"></div></div></div>' +
    '</section>' +
    (function () {
      var potd = getPicOfDay();
      if (!potd) return '';
      var dateStr = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' });
      return '<section id="potd" class="screen"><div class="potd-inner"><div class="potd-header">' +
        '<div class="potd-eyebrow"><span class="potd-dot">★</span> Pete Pic of the Day · ' + escapeHtml(dateStr) + '</div>' +
        '<h2 class="potd-title">Today\'s <span class="thin">selection</span></h2>' +
        '<p class="potd-sub">A different pic, every day. Curated by date — everyone sees the same one.</p></div>' +
        '<a class="potd-card" href="#/artwork/' + encodeURIComponent(potd.id) + '"><div class="potd-image">' +
          '<img src="' + escapeHtml(potd.imageUrl || potd.thumbUrl) + '" alt="' + escapeHtml(potd.title || 'Untitled') + '" loading="lazy" referrerpolicy="no-referrer">' +
          '<div class="potd-image-overlay"></div><div class="potd-badge">' + escapeHtml(potd.galleryName || 'Vault') + '</div></div>' +
        '<div class="potd-info"><div class="potd-info-eyebrow">From the archive</div>' +
          '<h3 class="potd-info-title">' + escapeHtml(potd.title || 'Untitled') + '</h3>' +
          '<div class="potd-info-meta"><span>' + escapeHtml(potd.galleryName || '') + '</span>' +
            (potd.width && potd.height ? '<span class="sep">·</span><span>' + potd.width + ' × ' + potd.height + '</span>' : '') + '</div>' +
          '<div class="potd-info-cta">View in archive <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></div></div></a>' +
        '<div class="potd-foot"><button class="potd-random-btn" id="potdRandomBtn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>' +
          '<span>Surprise me — random Pete Pic</span></button></div></div></section>';
    })() +
    renderRecentStrip() +
    '<section id="collections" class="screen"><div class="collections-inner"><div class="collections-header">' +
      '<h2 class="collections-title">Browse by <span class="thin">Collection</span></h2>' +
      '<p class="collections-sub">Five chambers of the vault, each with its own character. Click any room to step inside and browse the works.</p></div>' +
      '<div class="collections-grid">' + previewHtml + '</div></div></section>';

  routeEl.innerHTML = html;
  var potdRandomBtn = document.getElementById('potdRandomBtn');
  if (potdRandomBtn) potdRandomBtn.addEventListener('click', function () { navigateToRandom(); });
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    routeEl.querySelectorAll('.anim').forEach(function (el) { el.classList.add('in'); });
    var cue = document.getElementById('scrollCue');
    if (cue) cue.classList.add('in');
  }); });
}

// ====================================================================
// GALLERY VIEW CONTROLS — density + sort (persisted per browser)
// ====================================================================
var SORT_OPTIONS = [
  { id: 'archived', label: 'As archived' },
  { id: 'new',      label: 'Newest' },
  { id: 'az',       label: 'A–Z' },
  { id: 'za',       label: 'Z–A' },
  { id: 'random',   label: 'Random' },
];
var DENSITY_OPTIONS = [
  { id: 'spacious',    label: 'Spacious' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact',     label: 'Compact' },
];
var SORT_KEY = 'peetpics_gallery_sort';
var DENSITY_KEY = 'peetpics_grid_density';
function loadGallerySort() {
  try { var s = localStorage.getItem(SORT_KEY); if (s && SORT_OPTIONS.some(function (o) { return o.id === s; })) return s; } catch (e) {}
  return 'archived';
}
function saveGallerySort(s) { try { localStorage.setItem(SORT_KEY, s); } catch (e) {} }
function loadGridDensity() {
  try { var d = localStorage.getItem(DENSITY_KEY); if (d && DENSITY_OPTIONS.some(function (o) { return o.id === d; })) return d; } catch (e) {}
  return 'comfortable';
}
function saveGridDensity(d) { try { localStorage.setItem(DENSITY_KEY, d); } catch (e) {} }
function sortWorks(list, mode) {
  var out = list.slice();
  if (mode === 'new') {
    out.sort(function (a, b) {
      var ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
      var tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
      return tb - ta;
    });
  } else if (mode === 'az') {
    out.sort(function (a, b) { return (a.title || '').localeCompare(b.title || ''); });
  } else if (mode === 'za') {
    out.sort(function (a, b) { return (b.title || '').localeCompare(a.title || ''); });
  } else if (mode === 'random') {
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = out[i]; out[i] = out[j]; out[j] = t; }
  }
  return out;
}
function galleryControlsHtml(sort, density) {
  function group(opts, current, kind) {
    return '<div class="gc-group" role="group" aria-label="' + (kind === 'sort' ? 'Sort order' : 'Grid density') + '">' +
      '<span class="gc-label">' + (kind === 'sort' ? 'Sort' : 'Density') + '</span>' +
      opts.map(function (o) {
        return '<button class="gc-btn' + (o.id === current ? ' active' : '') + '" data-' + kind + '="' + o.id + '" aria-pressed="' + (o.id === current ? 'true' : 'false') + '">' + o.label + '</button>';
      }).join('') + '</div>';
  }
  return group(SORT_OPTIONS, sort, 'sort') + group(DENSITY_OPTIONS, density, 'density');
}

// ====================================================================
// GALLERY RENDER (lazy-loading + "load more" + density/sort controls)
// ====================================================================
var PAGE_SIZE = 48;
var galleryScrollHandler = null;
function renderGallery(roomId) {
  var room = ROOMS.find(function (r) { return r.id === roomId; });
  var works, title, tagline, hex = '#d4a853';
  if (room && roomId === 'nacky') {
    if (NACKY_CONFIG && NACKY_CONFIG.ids && NACKY_CONFIG.ids.length > 0) {
      works = NACKY_CONFIG.ids.map(function(id){ return ARTWORKS_BY_ID[id]; }).filter(function(w){ return w; });
    } else {
      var nackyCount = (NACKY_CONFIG && NACKY_CONFIG.count) || 48;
      var allShuffled = ARTWORKS.slice().sort(function(){ return Math.random()-0.5; });
      works = allShuffled.slice(0, Math.min(nackyCount, allShuffled.length));
    }
    title = room.name; tagline = room.tagline; hex = room.hex;
  } else if (room) { works = WORKS_BY_ROOM[roomId] || []; title = room.name; tagline = room.tagline; hex = room.hex; }
  else if (roomId === 'all') { works = ARTWORKS.slice(); title = 'The Full Archive'; tagline = 'Every piece in the vault, all at once. Browse at your own pace.'; }
  else if (roomId === 'new') { works = getRecentWorks(30); title = 'Recently Added'; tagline = 'Fresh arrivals from the last 30 days, newest first.'; hex = '#9bbf9b'; }
  else if (roomId === 'favourites') {
    var favIds = loadFavourites();
    works = ARTWORKS.filter(function (w) { return favIds.indexOf(w.id) !== -1; });
    title = 'Favourites'; tagline = 'Your hand-picked favourites, stored in this browser.'; hex = '#d9a3b8';
  } else {
    routeEl.innerHTML = '<div class="gallery-view"><div class="gallery-empty"><h3>Collection not found</h3><p>That chamber of the vault doesn\'t exist.</p><a class="btn-secondary" href="#/" style="margin-top:20px;display:inline-flex;">Back to landing</a></div></div>';
    return;
  }

  var tagCounts = {};
  works.forEach(function (w) { (w.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t]||0)+1; }); });
  var topTags = Object.keys(tagCounts).sort(function (a,b){ return tagCounts[b]-tagCounts[a]; }).slice(0, 10);

  var html = '<div class="gallery-view screen" data-room="' + escapeHtml(roomId) + '" style="--room-color:' + hex + ';">' +
    '<div class="gallery-header">' +
    '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span style="color:var(--t1);">Gallery</span><span class="sep">/</span><span class="cur">' + escapeHtml(title) + '</span></div>' +
    '<h1 class="gallery-title" style="--room-color:' + hex + ';">' + escapeHtml(title) + '</h1>' +
    '<p class="gallery-tagline">' + escapeHtml(tagline) + '</p>' +
    '<div class="gallery-meta"><span><span class="count">' + works.length.toLocaleString() + '</span> works</span><span class="dot">·</span>' +
      '<span>' + topTags.length + ' tags</span><span class="dot">·</span><span>Live from the vault</span><span class="dot">·</span>' +
      '<button class="gallery-slideshow-btn" id="gallerySlideshowBtn" title="Start slideshow (S)">▶ Slideshow</button></div></div>' +
    '<div id="galleryControls" class="gallery-controls"></div>' +
    '<div class="filter-bar" id="filterBar"><button class="filter-chip active" data-tag="__all">All <span class="chip-count">' + works.length + '</span></button>' +
      topTags.map(function (t) { return '<button class="filter-chip" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + ' <span class="chip-count">' + tagCounts[t] + '</span></button>'; }).join('') + '</div>' +
    '<div class="artwork-grid" id="artworkGrid"></div>' +
    '<div class="load-more-wrap" style="text-align:center;padding:32px 0;"><button class="btn-secondary" id="loadMoreBtn">Load more</button>' +
      '<div class="load-more-meta" id="loadMoreMeta" style="margin-top:12px;font-family:var(--mono);font-size:11px;color:var(--t3);letter-spacing:0.1em;text-transform:uppercase;"></div></div></div>';

  routeEl.innerHTML = html;

  var state = { allWorks: works, filtered: works.slice(), shown: 0, activeTag: '__all', sort: loadGallerySort(), density: loadGridDensity() };
  var grid = document.getElementById('artworkGrid');
  var loadMoreBtn = document.getElementById('loadMoreBtn');
  var loadMoreMeta = document.getElementById('loadMoreMeta');
  var controlsEl = document.getElementById('galleryControls');
  if (controlsEl) controlsEl.innerHTML = galleryControlsHtml(state.sort, state.density);
  grid.setAttribute('data-density', state.density);

  function renderPage() {
    var end = Math.min(state.shown + PAGE_SIZE, state.filtered.length);
    var fragment = '';
    for (var i = state.shown; i < end; i++) {
      var w = state.filtered[i];
      fragment += '<a class="artwork-card" href="#/artwork/' + encodeURIComponent(w.id) + '" data-tags="' + (w.tags||[]).join(',') + '">' +
        '<div class="artwork-card-image">' + imgTag(w, 'artwork-card-img', w.title) + '<div class="artwork-card-overlay"><span class="artwork-card-overlay-text">View →</span></div></div>' +
        '<div class="artwork-card-info"><div class="artwork-card-title">' + escapeHtml(w.title || 'Untitled') + '</div>' +
        '<div class="artwork-card-meta">' + escapeHtml(w.galleryName || '') + (w.width ? '<span class="dot">·</span>' + w.width + '×' + w.height : '') + '</div></div></a>';
    }
    grid.insertAdjacentHTML('beforeend', fragment);
    state.shown = end;
    observeLazyImages(grid);
    updateLoadMore();
  }
  function updateLoadMore() {
    loadMoreMeta.textContent = state.shown.toLocaleString() + ' / ' + state.filtered.length.toLocaleString() + ' works';
    loadMoreBtn.style.display = (state.shown >= state.filtered.length) ? 'none' : '';
  }
  function rebuild() {
    var list = state.allWorks.slice();
    if (state.activeTag !== '__all') list = list.filter(function (w) { return (w.tags||[]).indexOf(state.activeTag) !== -1; });
    list = sortWorks(list, state.sort);
    state.filtered = list;
    state.shown = 0;
    grid.innerHTML = '';
    if (list.length === 0) {
      if (roomId === 'favourites' || roomId === 'new') {
        grid.innerHTML = '<div class="gallery-empty" style="grid-column:1 / -1;"><h3>' + (roomId==='favourites'?'No favourites yet':'Nothing new right now') + '</h3><p>' +
          (roomId==='favourites' ? 'Open any artwork and hit “♡ Add to favourites” — your picks are saved in this browser.' : 'The vault restocks regularly — check back soon for fresh arrivals.') + '</p></div>';
      }
      updateLoadMore();
      return;
    }
    renderPage();
  }
  function applyFilter(tag) { state.activeTag = tag; rebuild(); }
  function applySort(s) {
    state.sort = s; saveGallerySort(s);
    if (controlsEl) controlsEl.querySelectorAll('[data-sort]').forEach(function (b) {
      var on = b.getAttribute('data-sort') === s; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false');
    });
    rebuild();
  }
  function applyDensity(d) {
    state.density = d; saveGridDensity(d);
    grid.setAttribute('data-density', d);
    if (controlsEl) controlsEl.querySelectorAll('[data-density]').forEach(function (b) {
      var on = b.getAttribute('data-density') === d; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false');
    });
  }

  document.getElementById('filterBar').addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    applyFilter(chip.getAttribute('data-tag'));
  });
  if (controlsEl) {
    controlsEl.addEventListener('click', function (e) {
      var sb = e.target.closest('[data-sort]');
      if (sb) { applySort(sb.getAttribute('data-sort')); return; }
      var db = e.target.closest('[data-density]');
      if (db) { applyDensity(db.getAttribute('data-density')); return; }
    });
  }
  loadMoreBtn.addEventListener('click', renderPage);
  var slideshowBtn = document.getElementById('gallerySlideshowBtn');
  if (slideshowBtn) slideshowBtn.addEventListener('click', function () { openSlideshow(state.filtered, 0); });

  rebuild();

  if (galleryScrollHandler) window.removeEventListener('scroll', galleryScrollHandler);
  var scrollTimer = null;
  galleryScrollHandler = function () {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      if (state.shown >= state.filtered.length) return;
      if (document.body.scrollHeight - (window.scrollY + window.innerHeight) < 800) renderPage();
    }, 200);
  };
  window.addEventListener('scroll', galleryScrollHandler);
}

// ── Artwork detail ──
function renderArtwork(id) {
  var w = ARTWORKS_BY_ID[id];
  if (!w) {
    routeEl.innerHTML = '<div class="artwork-view"><div class="gallery-empty"><h3>Artwork not found</h3><p>That piece isn\'t in the vault.</p><a class="btn-secondary" href="#/" style="margin-top:20px;display:inline-flex;">Back to landing</a></div></div>';
    return;
  }
  var roomWorks = WORKS_BY_ROOM[w.gallery] || ARTWORKS;
  var idx = roomWorks.findIndex(function (x) { return x.id === id; });
  var prev = idx > 0 ? roomWorks[idx-1] : null;
  var next = idx < roomWorks.length - 1 ? roomWorks[idx+1] : null;
  var aspect = (w.width && w.height) ? (w.width / w.height) : 1;
  var nsfw = isNsfw(w);
  var revealed = nsfw && NSFW_REVEALED.has(w.id);
  var nsfwBlurStyle = (nsfw && !revealed) ? 'filter:blur(24px);' : '';
  var nsfwOverlay = (nsfw && !revealed) ? '<div class="nsfw-overlay nsfw-overlay-detail" data-nsfw-reveal="' + escapeHtml(w.id) + '"><div class="nsfw-tag">NSFW</div><div class="nsfw-cta">Click image to reveal</div></div>' : '';
  var isNew = w.addedAt && (Date.now() - new Date(w.addedAt).getTime()) < 7 * 86400000;

  // Submitter credit — DORMANT unless submitters.json has this id
  var sub = SUBMITTERS[w.id];
  var creditHtml = '';
  if (sub) {
    creditHtml = '<div class="artwork-credit">' +
      '<span class="artwork-credit-label">Submitted by</span>' +
      '<a class="artwork-credit-name" href="https://twitch.tv/' + escapeHtml(sub.handle || '') + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>' +
        escapeHtml(sub.name || sub.handle) + '</a></div>';
  }

  var html = '<div class="artwork-view screen"><div class="artwork-detail">' +
    '<div class="artwork-image-wrap" id="artworkImageWrap" style="aspect-ratio:' + aspect.toFixed(3) + ';' + (nsfw&&!revealed?'cursor:pointer;':'') + '"' + (nsfw&&!revealed?' data-nsfw-reveal="' + escapeHtml(w.id) + '"':'') + '>' +
      '<img src="' + escapeHtml(w.imageUrl) + '" alt="' + escapeHtml(w.title) + '" decoding="async" referrerpolicy="no-referrer" loading="eager" style="width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 0.4s ease;' + nsfwBlurStyle + '" onload="this.style.opacity=1" onerror="this.style.opacity=0.15;this.alt=\'unavailable\'">' +
      nsfwOverlay + '<div class="artwork-zoom-hint"' + (nsfw&&!revealed?' style="display:none;"':'') + '>Click to expand</div></div>' +
    '<div class="artwork-sidebar">' +
      '<div class="artwork-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><a href="#/gallery/' + w.gallery + '">' + escapeHtml(w.galleryName) + '</a><span class="sep">/</span><span class="cur">' + escapeHtml(w.title) + '</span></div>' +
      '<div><h1 class="artwork-title">' + escapeHtml(w.title) + (isNew ? ' <span class="artwork-new-flag">NEW</span>' : '') + '</h1>' +
        '<div class="artwork-artist">from <b>' + escapeHtml(w.galleryName) + '</b></div></div>' +
      creditHtml +
      '<div class="artwork-meta-list">' +
        '<div class="artwork-meta-row"><span class="k">Collection</span><span class="v" style="color:' + w.roomColor + ';">' + escapeHtml(w.galleryName) + '</span></div>' +
        (w.width ? '<div class="artwork-meta-row"><span class="k">Dimensions</span><span class="v mono">' + w.width + ' × ' + w.height + '</span></div>' : '') +
        '<div class="artwork-meta-row"><span class="k">Aspect ratio</span><span class="v mono">' + aspect.toFixed(2) + ':1</span></div>' +
        (w.addedAt ? '<div class="artwork-meta-row"><span class="k">Added</span><span class="v mono">' + escapeHtml(w.addedAt) + '</span></div>' : '') +
        '<div class="artwork-meta-row"><span class="k">Catalogue ID</span><span class="v mono">#' + escapeHtml(w.id) + '</span></div>' +
        '<div class="artwork-meta-row"><span class="k">Hosted on</span><span class="v mono">postimg.cc</span></div></div>' +
      '<p class="artwork-description">A piece from the ' + escapeHtml(w.galleryName) + ' collection. Originally submitted to the AGoodPete community archive and preserved here for posterity.</p>' +
      '<div class="artwork-tags">' + (w.tags||[]).map(function (t) { return '<span class="artwork-tag">#' + escapeHtml(t) + '</span>'; }).join('') + '</div>' +
      '<div class="artwork-actions">' +
        '<button class="btn-fav' + (isFavourite(w.id)?' active':'') + '" data-fav-id="' + escapeHtml(w.id) + '">' + (isFavourite(w.id)?'♥ In your favourites':'♡ Add to favourites') + '</button>' +
        '<button class="btn-action" data-copy-link="' + escapeHtml(w.id) + '" title="Copy a shareable link (rich preview in Discord/Twitter)">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Copy link</button>' +
        '<button class="btn-action" data-download="' + escapeHtml(w.id) + '" title="Download full-resolution image">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button></div>' +
      '<div class="artwork-nav">' +
        '<a class="artwork-nav-btn" href="' + (prev?'#/artwork/'+encodeURIComponent(prev.id):'#') + '"' + (prev?'':' style="pointer-events:none;opacity:0.3;"') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Prev</a>' +
        '<a class="artwork-merch-btn" href="#/shop">Get as merch →</a>' +
        '<span class="artwork-nav-position">' + (idx+1) + ' / ' + roomWorks.length + '</span>' +
        '<a class="artwork-nav-btn" href="' + (next?'#/artwork/'+encodeURIComponent(next.id):'#') + '"' + (next?'':' style="pointer-events:none;opacity:0.3;"') + '>Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></a></div>' +
    '</div></div></div>';

  routeEl.innerHTML = html;
  if (w.imageUrl && w.imageUrl !== w.thumbUrl) {
    var preloader = new Image();
    preloader.decoding = 'async'; preloader.referrerPolicy = 'no-referrer'; preloader.src = w.imageUrl;
  }
  document.getElementById('artworkImageWrap').addEventListener('click', function () {
    if (isNsfw(w) && !NSFW_REVEALED.has(w.id)) return;
    openLightbox(id, roomWorks);
  });
}

// ── Config ─
var SCHEDULE = null, FRIENDS = null, NACKY_CONFIG = null;
var NSFW_IDS = [], NSFW_SET = new Set(), NSFW_REVEALED = new Set();
var SITE_CONFIG = null;
var SUBMITTERS = {}; // DORMANT: empty unless you populate submitters.json

function isNsfw(work) { return !!(work && work.id && NSFW_SET.has(work.id)); }
function rebuildNsfwSet() { NSFW_SET = new Set(NSFW_IDS); }

function loadConfigData() {
  var cacheBust = '?v=' + Date.now();
  var prevSnapshot = JSON.stringify([SCHEDULE, FRIENDS, NACKY_CONFIG, NSFW_IDS, SITE_CONFIG, SUBMITTERS]);
  Promise.all([
    fetch('schedule.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
    fetch('friends.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
    fetch('nacky.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
    fetch('nsfw.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
    fetch('site-config.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
    fetch('submitters.json' + cacheBust).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
  ]).then(function(results) {
    if (results[0]) SCHEDULE = results[0];
    if (results[1]) FRIENDS = results[1];
    if (results[2]) NACKY_CONFIG = results[2];
    if (Array.isArray(results[3])) { NSFW_IDS = results[3]; rebuildNsfwSet(); }
    if (results[4] && typeof results[4] === 'object') SITE_CONFIG = results[4];
    if (results[5] && typeof results[5] === 'object') SUBMITTERS = results[5];
    var changed = JSON.stringify([SCHEDULE, FRIENDS, NACKY_CONFIG, NSFW_IDS, SITE_CONFIG, SUBMITTERS]) !== prevSnapshot;
    if (typeof updateNextStreamPill === 'function') updateNextStreamPill();
    if (typeof buildNavDropdown === 'function') buildNavDropdown();
    if (changed) {
      var route = parseRoute();
      if (route.name === 'schedule' || route.name === 'friends' || route.name === 'gallery' || route.name === 'landing' || route.name === 'artwork' || route.name === 'submit') render();
    }
  });
}

var DAY_INDEX = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };

function renderSchedule() {
  if (!SCHEDULE) { routeEl.innerHTML = '<div class="schedule-view screen"><div class="gallery-empty"><h3>Loading schedule…</h3></div></div>'; return; }
  var today = new Date().getDay();
  var todayName = Object.keys(DAY_INDEX).find(function (k) { return DAY_INDEX[k] === today; });
  var todayIdx = (SCHEDULE || []).findIndex(function (d) { return d.day === todayName; });
  var schedList = SCHEDULE || [];
  if (todayIdx < 0) todayIdx = 0;
  var ordered = schedList.slice(todayIdx).concat(schedList.slice(0, todayIdx));
  var cardsHtml = ordered.map(function (d) {
    var isToday = d.day === todayName;
    var showsHtml = d.shows.map(function (s) {
      return '<div class="schedule-show"><div class="schedule-show-time">' + escapeHtml(s.time) + '</div><div class="schedule-show-body">' +
        '<div class="schedule-show-title">' + escapeHtml(s.title) + '</div><div class="schedule-show-host">with <b>' + escapeHtml(s.host) + '</b></div>' +
        '<div class="schedule-show-desc">' + escapeHtml(s.desc) + '</div></div></div>';
    }).join('');
    return '<div class="schedule-day' + (isToday?' is-today':'') + '"><div class="schedule-day-header"><span class="schedule-day-name">' + escapeHtml(d.day) + (isToday?' · Today':'') + '</span></div>' +
      '<div class="schedule-day-shows">' + showsHtml + '</div></div>';
  }).join('');
  routeEl.innerHTML = '<div class="schedule-view screen"><div class="schedule-header">' +
    '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span class="cur">Schedule</span></div>' +
    '<h1 class="schedule-title">Stream <span class="thin">Schedule</span></h1>' +
    '<p class="schedule-subtitle">Weekly recurring shows. Times are approximate and in your local timezone. Follow <a href="https://twitch.tv/AGoodPete" target="_blank" rel="noopener" style="color:var(--amber);text-decoration:underline;">AGoodPete on Twitch</a> for notifications.</p></div>' +
    '<div class="schedule-grid">' + cardsHtml + '</div></div>';
}

function renderFriends() {
  if (!FRIENDS) { routeEl.innerHTML = '<div class="friends-view screen"><div class="gallery-empty"><h3>Loading friends…</h3></div></div>'; return; }
  var cardsHtml = (FRIENDS || []).map(function (f) {
    return '<a class="friend-card" href="' + escapeHtml(f.channel) + '" target="_blank" rel="noopener" data-handle="' + escapeHtml(f.handle) + '">' +
      '<div class="friend-card-bg" aria-hidden="true"></div><div class="friend-card-inner"><div class="friend-card-head">' +
      '<div class="friend-avatar" data-avatar="' + escapeHtml(f.handle) + '">' + escapeHtml(f.name.charAt(0)) + '</div>' +
      '<div class="friend-info"><div class="friend-name">' + escapeHtml(f.name) + '</div><div class="friend-handle">@' + escapeHtml(f.handle) + '</div></div>' +
      '<div class="friend-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg></div></div>' +
      '<p class="friend-desc">' + escapeHtml(f.desc) + '</p><div class="friend-foot"><span class="friend-platform">' +
      '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>Twitch</span></div></div></a>';
  }).join('');
  routeEl.innerHTML = '<div class="friends-view screen"><div class="friends-header">' +
    '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span class="cur">Friends</span></div>' +
    '<h1 class="friends-title">Pete\'s <span class="thin">Friends</span></h1>' +
    '<p class="friends-subtitle">Streamers, collaborators, and members of the Peet Pics community. Click any card to visit their channel.</p></div>' +
    '<div class="friends-grid">' + cardsHtml + '</div></div>';
  (FRIENDS || []).forEach(function (f) {
    var handle = f.handle;
    var avatarEl = routeEl.querySelector('.friend-avatar[data-avatar="' + cssEscape(handle) + '"]');
    var cardEl = avatarEl && avatarEl.closest('.friend-card');
    var bgEl = cardEl && cardEl.querySelector('.friend-card-bg');
    if (!avatarEl) return;
    fetch('https://decapi.me/twitch/avatar/' + encodeURIComponent(handle))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (url) {
        url = (url || '').trim();
        if (!url || url.indexOf('http') !== 0) throw new Error('no url');
        var safeUrl = encodeURI(url);
        var img = new Image();
        img.onload = function () {
          avatarEl.innerHTML = '';
          avatarEl.classList.add('friend-avatar--has-img');
          avatarEl.style.backgroundImage = 'url("' + safeUrl + '")';
          if (bgEl) { bgEl.style.backgroundImage = 'url("' + safeUrl + '")'; cardEl.classList.add('friend-card--has-bg'); }
        };
        img.src = safeUrl;
      })
      .catch(function (err) { console.warn('[PeteGen] avatar fetch failed for', handle, err); });
  });
}

// ── Shop ─
var SHOP_URL = 'https://agoodpete-shop.fourthwall.com/en-gbp';
function renderShop() {
  routeEl.innerHTML = '<div class="shop-view screen"><div class="shop-header">' +
    '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span class="cur">Shop</span></div>' +
    '<h1 class="shop-title">The <span class="thin">Vault Shop</span></h1>' +
    '<p class="shop-subtitle">Wear the Peet Pics. Drink from the Peet Pics. Stick the Peet Pics on your laptop. Official Peet Pics merch now available on Fourthwall.</p></div>' +
    '<div class="shop-drop"><div class="shop-drop-video"><video id="shopDropVideo" autoplay muted loop playsinline preload="metadata" src="https://cdn.fourthwall.com/sr-creators/resources/c265b651-ab7f-4fde-a4fe-4c44ba9d656c/339b4b9057230f213028b8a82a5c6f2e_78b027ff63ef.mp4"></video>' +
    '<button class="video-mute-toggle" id="videoMuteToggle" title="Click to unmute" data-mute-toggle>' +
      '<svg class="icon-muted" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>' +
      '<svg class="icon-unmuted" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg></button></div>' +
    '<div class="shop-drop-content"><div class="shop-drop-badge">NEW DROP</div><h2 class="shop-drop-title">Mean Gene\'s Burger Revival</h2>' +
      '<p class="shop-drop-copy">Watch out Big Burger Boys! In 1998 Mean Gene went toe-to-toe with the Big Burger Boys when he established Mean Gene\'s Burgers. I don\'t think he won but I\'m not sure that matters! The shirt in the advert was beautiful and I wanted to recreate it for a new generation. Probably don\'t call the phone number…and nobody tell Gene!</p>' +
      '<a class="shop-drop-btn" href="https://agoodpete-shop.fourthwall.com/en-gbp/collections/mean-genes-burger-revival" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Shop Mean Gene\'s Collection' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div></div>' +
    '<div class="shop-cta"><div class="shop-cta-text">Visit the official store</div><div class="shop-cta-sub">T-shirts, hoodies, mugs, stickers, prints and more — all featuring Pete Pic designs.</div>' +
      '<a class="shop-external-btn" href="' + SHOP_URL + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>agoodpete-shop.fourthwall.com' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>' +
    '<div class="shop-features">' +
      '<div class="shop-feature"><div class="shop-feature-icon">👕</div><div class="shop-feature-text">Apparel</div><div class="shop-feature-sub">Tees, hoodies & more</div></div>' +
      '<div class="shop-feature"><div class="shop-feature-icon">☕</div><div class="shop-feature-text">Drinkware</div><div class="shop-feature-sub">Mugs & cups</div></div>' +
      '<div class="shop-feature"><div class="shop-feature-icon">📋</div><div class="shop-feature-text">Stickers</div><div class="shop-feature-sub">Vinyl die-cuts</div></div>' +
      '<div class="shop-feature"><div class="shop-feature-icon">🖼️</div><div class="shop-feature-text">Prints</div><div class="shop-feature-sub">Art prints & posters</div></div></div></div>';
}

// ====================================================================
// SUBMIT A PIC PAGE
// Real flow: make a pic → grab the Discord invite from Pete's Twitch chat
// (posted while he's live) → share it in the Discord. There is NO permanent
// Discord URL, so the CTA points at the Twitch channel and the copy explains
// the hop. IF a permanent invite ever exists, change SUBMIT_CTA_URL + the
// button label — that's the only edit needed. The Wall of Fame below stays
// DORMANT unless submitters.json exists.
// ====================================================================
var SUBMIT_CTA_URL = 'https://twitch.tv/AGoodPete'; // Discord invite lives in this channel's chat during streams

function getContributors() {
  var counts = {};
  Object.keys(SUBMITTERS || {}).forEach(function (id) {
    var s = SUBMITTERS[id];
    var key = s.handle || s.name;
    if (!counts[key]) counts[key] = { name: s.name, handle: s.handle, count: 0 };
    counts[key].count++;
  });
  return Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return b.count - a.count; });
}

function renderSubmit() {
  var contributors = getContributors();
  var wallHtml = '';
  if (contributors.length > 0) {
    var rows = contributors.slice(0, 12).map(function (c, i) {
      var rank = i === 0 ? ' gold' : (i === 1 ? ' silver' : (i === 2 ? ' bronze' : ''));
      return '<a class="contributor-card" href="https://twitch.tv/' + escapeHtml(c.handle || '') + '" target="_blank" rel="noopener">' +
        '<span class="contributor-rank' + rank + '">' + (i + 1) + '</span>' +
        '<div class="contributor-info"><div class="contributor-name">' + escapeHtml(c.name || c.handle) + '</div>' +
        '<div class="contributor-handle">@' + escapeHtml(c.handle || '') + '</div></div>' +
        '<span class="contributor-count">' + c.count + ' pic' + (c.count === 1 ? '' : 's') + '</span></a>';
    }).join('');
    wallHtml = '<div class="submit-section"><h2 class="submit-h2">Wall of <span class="thin">Fame</span></h2>' +
      '<p class="submit-lead">The community members keeping the vault stocked. Credits appear on every artwork they submit.</p>' +
      '<div class="contributors-grid">' + rows + '</div></div>';
  }

  routeEl.innerHTML = '<div class="submit-view screen">' +
    '<div class="submit-header">' +
      '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span class="cur">Submit a Pic</span></div>' +
      '<h1 class="submit-title">Submit a <span class="thin">Pic</span></h1>' +
      '<p class="submit-subtitle">The Vault is built by the community. Made some Peet-adjacent art, or found a legendary Peet moment? Here\'s how to get it into the archive.</p>' +
      '<a class="submit-cta" href="' + SUBMIT_CTA_URL + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>' +
        ' Open Pete\'s Twitch channel' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="M7 17 17 7M7 7h10v10"/></svg>' +
      '</a>' +
      '<span style="display:block;margin-top:12px;font-family:var(--mono);font-size:10.5px;letter-spacing:0.06em;color:var(--t3);max-width:54ch;line-height:1.6;">The Discord invite is posted in Pete\'s chat while he\'s live. Copy it, join the server, then drop your pic in the right channel.</span>' +
    '</div>' +
    '<div class="submit-steps">' +
      '<div class="submit-step"><div class="submit-step-num">1</div><div class="submit-step-body"><h3 class="submit-h3">Make a Peet Pic</h3><p class="submit-step-text">A screenshot, a drawing, a cursed photoshop — anything Peet-adjacent counts. Pobots, Prestlers, Cultural Artefacts, and the occasional unhinged Pisc.</p></div></div>' +
      '<div class="submit-step"><div class="submit-step-num">2</div><div class="submit-step-body"><h3 class="submit-h3">Grab the Discord link from Twitch</h3><p class="submit-step-text">While Pete\'s streaming, the Discord invite is posted in chat. Pop into the stream, copy the link, and join the server. (There\'s no permanent link on the site — invites are shared live.)</p></div></div>' +
      '<div class="submit-step"><div class="submit-step-num">3</div><div class="submit-step-body"><h3 class="submit-h3">Share it in the Discord</h3><p class="submit-step-text">Drop your pic in the right channel. The community reacts, mods take a look, and the best ones get archived into the Vault — credited to you.</p></div></div>' +
    '</div>' +
    '<div class="submit-section"><h2 class="submit-h2">House <span class="thin">Rules</span></h2>' +
      '<ul class="submit-rules">' +
        '<li><b>Keep it Peet-adjacent.</b> If it wouldn\'t make chat spam emotes, it probably doesn\'t belong.</li>' +
        '<li><b>Credit original artists</b> when you know them — especially for fan art.</li>' +
        '<li><b>Flag anything NSFW</b> in Discord so mods can gate it. The Vault blurs approved NSFW behind a click-to-reveal.</li>' +
        '<li><b>No duplicates.</b> Have a quick look through the Vault first — your pic might already be archived.</li>' +
        '<li><b>Be excellent to each other.</b> Mods have the final say, and they\'re lovely about it.</li>' +
      '</ul></div>' +
    wallHtml +
  '</div>';
}

// ── Search ─
function renderSearch(query) {
  query = (query || '').trim();
  var results = [];
  if (query) {
    var lower = query.toLowerCase();
    results = ARTWORKS.filter(function (w) {
      return (w.title||'').toLowerCase().indexOf(lower) !== -1 || (w.galleryName||'').toLowerCase().indexOf(lower) !== -1;
    });
  }
  var cardsHtml = results.slice(0, 48).map(function (w) {
    return '<a class="artwork-card" href="#/artwork/' + encodeURIComponent(w.id) + '"><div class="artwork-card-image">' + imgTag(w, 'artwork-card-img', w.title) +
      '<div class="artwork-card-overlay"><span class="artwork-card-overlay-text">View →</span></div></div>' +
      '<div class="artwork-card-info"><div class="artwork-card-title">' + escapeHtml(w.title || 'Untitled') + '</div><div class="artwork-card-meta">' + escapeHtml(w.galleryName || '') + '</div></div></a>';
  }).join('');
  routeEl.innerHTML = '<div class="gallery-view screen"><div class="gallery-header">' +
    '<div class="gallery-breadcrumb"><a href="#/">Peet Pics</a><span class="sep">/</span><span class="cur">Search: "' + escapeHtml(query) + '"</span></div>' +
    '<h1 class="gallery-title" style="--room-color:var(--amber);">Search Results</h1>' +
    '<p class="gallery-tagline">' + results.length + ' work' + (results.length===1?'':'s') + ' found for "' + escapeHtml(query) + '"' + (results.length>48?' — showing first 48':'') + '</p></div>' +
    (results.length > 0 ? '<div class="artwork-grid" id="artworkGrid">' + cardsHtml + '</div>' : '<div class="gallery-empty"><h3>No results</h3><p>No artworks match "' + escapeHtml(query) + '". Try a different search.</p></div>') + '</div>';
  var grid = document.getElementById('artworkGrid');
  if (grid) observeLazyImages(grid);
}

var searchInput = document.getElementById('searchInput');
var searchWrap = document.getElementById('searchWrap');
var searchTimer = null;
var lastSearchQuery = '';
if (searchInput) {
  if (lastSearchQuery) searchInput.value = lastSearchQuery;
  searchInput.addEventListener('input', function () {
    var q = this.value.trim();
    lastSearchQuery = this.value;
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) return;
    searchTimer = setTimeout(function () { navigate('#/search/' + encodeURIComponent(q)); }, 400);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var q = this.value.trim(); if (q.length >= 1) navigate('#/search/' + encodeURIComponent(q)); }
    if (e.key === 'Escape' && searchWrap) { searchWrap.classList.remove('expanded'); searchInput.blur(); }
  });
  if (searchWrap) {
    var searchJustExpanded = false;
    searchWrap.addEventListener('click', function (e) {
      if (e.target === searchWrap || e.target.tagName === 'svg' || e.target.tagName === 'path' || e.target.tagName === 'circle') {
        if (window.innerWidth <= 600 && !searchWrap.classList.contains('expanded')) {
          e.preventDefault(); e.stopPropagation();
          searchWrap.classList.add('expanded');
          searchJustExpanded = true;
          setTimeout(function () { searchInput.focus(); searchJustExpanded = false; }, 150);
        }
      }
    });
    document.addEventListener('click', function (e) {
      if (searchJustExpanded) return;
      if (searchWrap.classList.contains('expanded') && !searchWrap.contains(e.target)) searchWrap.classList.remove('expanded');
    }, true);
    searchInput.addEventListener('focus', function () { if (window.innerWidth <= 600) searchWrap.classList.add('expanded'); });
  }
}

// ── Lightbox ──
var lightbox = document.getElementById('lightbox');
var lightboxContent = document.getElementById('lightboxContent');
var lightboxCaption = document.getElementById('lightboxCaption');
var currentLightboxId = null;
var currentLightboxList = [];
function openLightbox(id, list) {
  currentLightboxId = id;
  currentLightboxList = list || ARTWORKS;
  updateLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
function updateLightbox() {
  var w = ARTWORKS_BY_ID[currentLightboxId];
  if (!w) return;
  var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
  var nsfw = isNsfw(w);
  var revealed = nsfw && NSFW_REVEALED.has(w.id);
  var blurStyle = (nsfw && !revealed) ? 'filter:blur(24px);' : '';
  var nsfwBadge = nsfw ? '<span style="color:var(--danger);font-family:var(--mono);font-size:10px;letter-spacing:0.2em;text-transform:uppercase;">· NSFW</span>' : '';
  var overlayHtml = (nsfw && !revealed) ? '<div class="nsfw-overlay nsfw-overlay-lightbox" data-nsfw-reveal="' + escapeHtml(w.id) + '"><div class="nsfw-tag">NSFW</div><div class="nsfw-cta">Click to reveal</div></div>' : '';
  lightboxContent.innerHTML = '<div style="position:relative;"><img src="' + escapeHtml(w.imageUrl) + '" alt="' + escapeHtml(w.title) + '" decoding="async" referrerpolicy="no-referrer" style="max-width:90vw;max-height:85vh;object-fit:contain;opacity:0;transition:opacity 0.4s ease;' + blurStyle + '" onload="this.style.opacity=1" onerror="this.style.opacity=0.15;this.alt=\'unavailable\'">' + overlayHtml + '</div>';
  var posText = (idx === -1) ? '' : ' · ' + (idx + 1) + ' / ' + currentLightboxList.length;
  lightboxCaption.innerHTML = '<b>' + escapeHtml(w.title) + '</b>' + nsfwBadge + posText;
}
function lightboxPrev() {
  var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
  if (idx === -1) return;
  currentLightboxId = currentLightboxList[(idx - 1 + currentLightboxList.length) % currentLightboxList.length].id;
  updateLightbox();
}
function lightboxNext() {
  var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
  if (idx === -1) return;
  currentLightboxId = currentLightboxList[(idx + 1) % currentLightboxList.length].id;
  updateLightbox();
}
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', function (e) { e.stopPropagation(); lightboxPrev(); });
document.getElementById('lightboxNext').addEventListener('click', function (e) { e.stopPropagation(); lightboxNext(); });
lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', function (e) {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') lightboxPrev();
  else if (e.key === 'ArrowRight') lightboxNext();
});

// ── Share + download ──
function showToast(msg) {
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(function () { t.classList.add('show'); });
  setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 1800);
}
function copyArtworkLink(id) {
  var url = window.location.origin + '/artwork/' + encodeURIComponent(id);
  function done() { showToast('Share link copied — rich preview included'); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url, done); });
  else fallbackCopy(url, done);
}
function fallbackCopy(text, cb) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) { window.prompt('Copy this link:', text); }
  ta.remove();
}
function downloadArtwork(id) {
  var w = ARTWORKS_BY_ID[id];
  if (!w) return;
  var url = w.imageUrl || w.thumbUrl;
  var filename = (w.title || w.id).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') + '.jpg';
  showToast('Preparing download…');
  fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
    .then(function (blob) {
      var a = document.createElement('a');
      var objUrl = URL.createObjectURL(blob);
      a.href = objUrl; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 1500);
      showToast('Downloading "' + (w.title || 'image') + '"');
    })
    .catch(function () { window.open(url, '_blank', 'noopener'); showToast('Opened full-res in a new tab'); });
}
(function injectLightboxTools() {
  if (!lightbox) return;
  var tools = document.createElement('div');
  tools.className = 'lightbox-tools';
  tools.innerHTML =
    '<button class="lightbox-tool" id="lightboxCopy" title="Copy link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>' +
    '<button class="lightbox-tool" id="lightboxDownload" title="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>';
  lightbox.appendChild(tools);
  document.getElementById('lightboxCopy').addEventListener('click', function (e) { e.stopPropagation(); if (currentLightboxId) copyArtworkLink(currentLightboxId); });
  document.getElementById('lightboxDownload').addEventListener('click', function (e) { e.stopPropagation(); if (currentLightboxId) downloadArtwork(currentLightboxId); });
})();

// ── OBS / stream overlay ──
var liveTimer = null;
function parseQueryParams(qs) {
  var params = {};
  (qs || '').split('&').forEach(function (pair) {
    if (!pair) return;
    var kv = pair.split('=');
    params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });
  return params;
}
function clearLiveOverlay() {
  if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
  document.body.classList.remove('live-mode');
  var bg = document.getElementById('metaballs-bg');
  var bgFade = document.querySelector('.bg-fade');
  if (bg) bg.style.display = '';
  if (bgFade) bgFade.style.display = '';
}
function renderLive() {
  var route = parseRoute();
  var params = parseQueryParams(route.query || '');
  var speed = (parseInt(params.speed, 10) || 10) * 1000;
  var pos = params.pos || 'center';
  var size = params.size || (pos === 'center' ? 'l' : 'm');
  var showCaption = params.caption !== '0';
  var showBg = params.bg === '1';
  document.body.classList.add('live-mode');
  if (!showBg) {
    var bg = document.getElementById('metaballs-bg');
    var bgFade = document.querySelector('.bg-fade');
    if (bg) bg.style.display = 'none';
    if (bgFade) bgFade.style.display = 'none';
  }
  var works = (route.room && WORKS_BY_ROOM[route.room] ? WORKS_BY_ROOM[route.room] : ARTWORKS).filter(function (w) { return !isNsfw(w); });
  for (var i = works.length - 1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var tmp = works[i]; works[i]=works[j]; works[j]=tmp; }
  if (!works.length) { routeEl.innerHTML = '<div class="live-empty">No works to display</div>'; return; }
  routeEl.innerHTML = '<div class="live-overlay live-pos-' + pos + '"><div class="live-card">' +
    '<div class="live-frame live-size-' + size + '"><img class="live-image" id="liveImage" alt="" referrerpolicy="no-referrer" decoding="async" /></div>' +
    (showCaption ? '<div class="live-caption" id="liveCaption"></div>' : '') + '</div></div>';
  var imgEl = document.getElementById('liveImage');
  var capEl = document.getElementById('liveCaption');
  var idx = 0, first = true;
  function showSlide() {
    var w = works[idx];
    function load() {
      imgEl.onload = function () { imgEl.classList.add('visible'); if (capEl) capEl.classList.add('visible'); };
      imgEl.src = w.imageUrl || w.thumbUrl;
      imgEl.alt = w.title || '';
      if (capEl) capEl.innerHTML = '<span class="live-cap-title">' + escapeHtml(w.title || 'Untitled') + '</span><span class="live-cap-meta">' + escapeHtml(w.galleryName || '') + '</span>';
      setTimeout(function () { imgEl.classList.add('visible'); if (capEl) capEl.classList.add('visible'); }, 900);
    }
    if (first) { first = false; load(); }
    else { imgEl.classList.remove('visible'); if (capEl) capEl.classList.remove('visible'); setTimeout(load, 550); }
    idx = (idx + 1) % works.length;
    liveTimer = setTimeout(showSlide, speed);
  }
  showSlide();
}

// ── Keyboard shortcuts overlay (the easter-egg "Secret" row was removed with Kill Wha) ──
var shortcutsModal = null;
function buildShortcutsModal() {
  var el = document.createElement('div');
  el.className = 'shortcuts-overlay';
  el.innerHTML = '<div class="shortcuts-panel" role="dialog" aria-label="Keyboard shortcuts"><div class="shortcuts-head">' +
    '<span class="shortcuts-eyebrow">The Vault</span><h2 class="shortcuts-title">Keyboard <span class="thin">Shortcuts</span></h2>' +
    '<button class="shortcuts-close" id="shortcutsClose" aria-label="Close"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
    '<div class="shortcuts-body">' +
    '<div class="shortcuts-group"><div class="shortcuts-group-label">Browse</div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Random Pete Pic</span><span class="shortcut-keys"><kbd>R</kbd></span></div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Start slideshow</span><span class="shortcut-keys"><kbd>S</kbd></span></div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Go back</span><span class="shortcut-keys"><kbd>Esc</kbd><kbd>⌫</kbd></span></div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">This panel</span><span class="shortcut-keys"><kbd>?</kbd></span></div></div>' +
    '<div class="shortcuts-group"><div class="shortcuts-group-label">Lightbox &amp; Slideshow</div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Previous / Next</span><span class="shortcut-keys"><kbd>←</kbd><kbd>→</kbd></span></div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Play / Pause</span><span class="shortcut-keys"><kbd>Space</kbd></span></div>' +
      '<div class="shortcut-row"><span class="shortcut-desc">Close</span><span class="shortcut-keys"><kbd>Esc</kbd></span></div></div>' +
    '</div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) { if (e.target === el) toggleShortcuts(); });
  el.querySelector('#shortcutsClose').addEventListener('click', toggleShortcuts);
  return el;
}
function toggleShortcuts() {
  if (!shortcutsModal) shortcutsModal = buildShortcutsModal();
  shortcutsModal.classList.toggle('open');
}
document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.target.isContentEditable) return;
  if (e.key === '?') { e.preventDefault(); toggleShortcuts(); }
  else if (e.key === 'Escape' && shortcutsModal && shortcutsModal.classList.contains('open')) toggleShortcuts();
});

// ── Helpers ──
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Metaballs background ──
var PARAMS = { cellSize:24, maxDotFrac:0.4, count:6, blur:22, sharpness:18, speed:0.45, maxAlpha:0.18, baseAlpha:0.03, halftone:[212,168,83] };
var canvas = document.getElementById('halftone');
var ctx = canvas.getContext('2d');
var svg = document.getElementById('metaballs-svg');
var group = document.getElementById('metaballs-group');
var grad = document.getElementById('metaballGrad');
var size = { w:0, h:0, dpr:1 };
var metaballs = [], circleEls = [], rafId = 0;
function rebuildMetaballs() {
  metaballs = [];
  for (var i = 0; i < PARAMS.count; i++) {
    var r = 60 + Math.random() * 70;
    metaballs.push({ x: r + Math.random()*Math.max(1, size.w-2*r), y: r + Math.random()*Math.max(1, size.h-2*r), vx:(Math.random()-0.5)*0.5, vy:(Math.random()-0.5)*0.5, r:r });
  }
  while (group.firstChild) group.removeChild(group.firstChild);
  circleEls = [];
  var SVGNS = 'http://www.w3.org/2000/svg';
  for (var j = 0; j < PARAMS.count; j++) {
    var c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', size.w/2); c.setAttribute('cy', size.h/2); c.setAttribute('r', 60);
    c.setAttribute('fill', 'url(#metaballGrad)'); c.setAttribute('opacity', '0.35');
    group.appendChild(c); circleEls.push(c);
  }
}
function drawHalftone() {
  if (size.w === 0 || size.h === 0) return;
  canvas.width = Math.floor(size.w * size.dpr); canvas.height = Math.floor(size.h * size.dpr);
  canvas.style.width = size.w + 'px'; canvas.style.height = size.h + 'px';
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  ctx.clearRect(0, 0, size.w, size.h);
  var cell = PARAMS.cellSize, maxR = cell * PARAMS.maxDotFrac;
  var cx = size.w/2, cy = size.h*0.35;
  var maxDist = Math.sqrt(cx*cx + cy*cy) || 1;
  var hr = PARAMS.halftone[0], hg = PARAMS.halftone[1], hb = PARAMS.halftone[2];
  for (var y = cell/2; y < size.h + cell; y += cell) {
    for (var x = cell/2; x < size.w + cell; x += cell) {
      var dx = x - cx, dy = y - cy;
      var d = Math.sqrt(dx*dx + dy*dy) / maxDist;
      var v = Math.max(0, 1 - d * 1.3);
      v *= 0.55 + 0.45 * Math.sin(x*0.006 + y*0.008 + d*3.2);
      if (v < 0) v = 0; else if (v > 1) v = 1;
      var r = v * maxR;
      if (r < 0.4) continue;
      ctx.fillStyle = 'rgba(' + hr + ',' + hg + ',' + hb + ',' + (PARAMS.baseAlpha + v*PARAMS.maxAlpha).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  }
}
function resize() {
  size.w = window.innerWidth;
  size.h = Math.max(window.innerHeight, document.body.scrollHeight);
  size.dpr = Math.min(window.devicePixelRatio || 1, 2);
  svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
  svg.setAttribute('width', size.w); svg.setAttribute('height', size.h);
  grad.setAttribute('x2', size.w); grad.setAttribute('y2', size.h);
  if (metaballs.length === 0) rebuildMetaballs();
  drawHalftone();
}
window.addEventListener('resize', resize);
var GOO_COLOR_SETS = {
  default:['#d4a853','#a0522d','#b5707e'], pobots:['#d4a853','#b8922f','#8a6f1e'],
  prestlers:['#d49274','#a0522d','#c4473a'], cultural:['#d9a3b8','#b5707e','#9a5f6e'],
  pisc:['#9bbf9b','#6b7c5e','#4a5d42'], submissions:['#b894d9','#8e6bb0','#6b4d8e'],
  nacky:['#ff5fa2','#b84dff','#ff8c42'],
};
function updateGooColors(roomId) {
  var colors = GOO_COLOR_SETS[GOO_COLOR_SETS[roomId] ? roomId : 'default'];
  var stops = svg.querySelectorAll('stop');
  if (stops.length >= 3) { stops[0].setAttribute('stop-color', colors[0]); stops[1].setAttribute('stop-color', colors[1]); stops[2].setAttribute('stop-color', colors[2]); }
  var hex = colors[0];
  PARAMS.halftone = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  drawHalftone();
}
function loop() {
  rafId = requestAnimationFrame(loop);
  if (size.w === 0 || size.h === 0) return;
  for (var i = 0; i < metaballs.length; i++) {
    var b = metaballs[i];
    b.vx *= 0.997; b.vy *= 0.997;
    var v = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
    if (v < 0.15) { b.vx += (Math.random()-0.5)*0.025; b.vy += (Math.random()-0.5)*0.025; }
    if (v > 1.0) { b.vx = (b.vx/v)*1.0; b.vy = (b.vy/v)*1.0; }
    b.x += b.vx * PARAMS.speed; b.y += b.vy * PARAMS.speed;
    if (b.x - b.r < -50) { b.x = -50 + b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > size.w + 50) { b.x = size.w + 50 - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < -50) { b.y = -50 + b.r; b.vy = Math.abs(b.vy); }
    if (b.y + b.r > size.h + 50) { b.y = size.h + 50 - b.r; b.vy = -Math.abs(b.vy); }
  }
  for (var k = 0; k < circleEls.length; k++) {
    var b2 = metaballs[k];
    if (!b2) continue;
    circleEls[k].setAttribute('cx', b2.x.toFixed(1));
    circleEls[k].setAttribute('cy', b2.y.toFixed(1));
    circleEls[k].setAttribute('r', b2.r.toFixed(1));
  }
}

// ── Boot ─
routeEl.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><div class="loading-text">Loading the vault…</div></div>';
resize(); rebuildMetaballs();
rafId = requestAnimationFrame(loop);
setTimeout(resize, 200);
loadGalleryData().then(function () {
  buildNavDropdown();
  render();
  loadConfigData();
  setTimeout(resize, 100); setTimeout(resize, 500); setTimeout(resize, 1500); setTimeout(resize, 3000);
}).catch(function (err) {
  console.error('Failed to load gallery data:', err);
  routeEl.innerHTML = '<div class="loading-screen"><div class="loading-text" style="color:var(--danger);">Failed to load the vault.</div><div class="loading-text" style="margin-top:12px;font-family:var(--mono);font-size:11px;color:var(--t3);">' + escapeHtml(err.message) + '</div><a class="btn-secondary" href="#/" style="margin-top:24px;">Retry</a></div>';
});

// ── Twitch live indicator ──
var TWITCH_CHANNEL = 'AGoodPete';
var TWITCH_CHECK_INTERVAL = 2 * 60 * 1000;
var TWITCH_UPTIME_URL = 'https://decapi.me/twitch/uptime/' + TWITCH_CHANNEL;
var TWITCH_VIEWERS_URL = 'https://decapi.me/twitch/viewercount/' + TWITCH_CHANNEL;
var liveIndicator = document.getElementById('twitchLiveIndicator');
var liveText = document.getElementById('liveText');
function setLiveState(state, label) {
  if (!liveIndicator) return;
  liveIndicator.classList.remove('is-checking','is-live','is-offline','is-error');
  liveIndicator.classList.add('is-' + state);
  liveIndicator.setAttribute('data-state', state);
  if (liveText) { liveText.textContent = label; liveText.setAttribute('aria-live','polite'); }
  if (state === 'live') liveIndicator.title = 'Pete is LIVE on Twitch — click to watch';
  else if (state === 'offline') liveIndicator.title = 'Pete is offline — click to visit channel';
  else if (state === 'error') liveIndicator.title = "Can't reach Twitch — click to visit channel";
  else liveIndicator.title = 'Checking live status...';
}
function checkTwitchLive() {
  if (!liveIndicator) return;
  setLiveState('checking', 'Checking');
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timeoutId = null;
  if (controller) timeoutId = setTimeout(function(){ try{ controller.abort(); }catch(e){} }, 6000);
  var fetchOpts = controller ? { signal: controller.signal, cache: 'no-store' } : { cache: 'no-store' };
  fetch(TWITCH_UPTIME_URL, fetchOpts).then(function (res) {
    if (timeoutId) clearTimeout(timeoutId);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }).then(function (text) {
    text = text.trim();
    if (text.toLowerCase().indexOf('offline') !== -1) setLiveState('offline', 'Offline');
    else {
      setLiveState('live', 'Live');
      var vcController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var vcTimeout = null;
      if (vcController) vcTimeout = setTimeout(function(){ try{ vcController.abort(); }catch(e){} }, 4000);
      var vcOpts = vcController ? { signal: vcController.signal, cache: 'no-store' } : {};
      fetch(TWITCH_VIEWERS_URL, vcOpts).then(function (r) { if(vcTimeout) clearTimeout(vcTimeout); return r.text(); })
        .then(function (viewers) {
          viewers = viewers.trim();
          if (viewers && !isNaN(parseInt(viewers,10))) { if (liveText) liveText.textContent = 'Live \u00b7 ' + parseInt(viewers,10).toLocaleString(); }
        }).catch(function () { if(vcTimeout) clearTimeout(vcTimeout); });
    }
  }).catch(function (err) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('Twitch live check failed:', err && err.message ? err.message : err);
    setLiveState('offline', 'Offline');
  });
}
checkTwitchLive();
setInterval(checkTwitchLive, TWITCH_CHECK_INTERVAL);

// ── Next stream pill ──
var nextStreamLabel = document.getElementById('nextStreamLabel');
function getNextStream() {
  var now = new Date();
  var nowDay = now.getDay();
  var nowMinutes = now.getHours()*60 + now.getMinutes();
  for (var d = 0; d < 7; d++) {
    var checkDay = (nowDay + d) % 7;
    var dayName = Object.keys(DAY_INDEX).find(function (k) { return DAY_INDEX[k] === checkDay; });
    var dayEntry = (SCHEDULE || []).find(function (s) { return s.day === dayName; });
    if (!dayEntry || !dayEntry.shows || !dayEntry.shows.length) continue;
    var shows = dayEntry.shows.slice().sort(function (a,b){ return (a.hour*60+(a.minute||0)) - (b.hour*60+(b.minute||0)); });
    for (var s = 0; s < shows.length; s++) {
      var show = shows[s];
      if (d === 0 && (show.hour*60+(show.minute||0)) < nowMinutes - 120) continue;
      return { title: show.title, time: show.time, day: dayName, daysAhead: d, host: show.host };
    }
  }
  var monday = (SCHEDULE || []).find(function (s) { return s.day === 'Monday'; });
  if (monday && monday.shows && monday.shows[0]) return { title: monday.shows[0].title, time: monday.shows[0].time, day: 'Monday', daysAhead: 7, host: monday.shows[0].host };
  return null;
}
function updateNextStreamPill() {
  if (!nextStreamLabel) return;
  var next = getNextStream();
  if (!next) { nextStreamLabel.textContent = 'No schedule'; return; }
  var label;
  if (next.daysAhead === 0) label = next.title + ' · ' + next.time;
  else if (next.daysAhead === 1) label = 'Tomorrow · ' + next.title;
  else label = next.day + ' · ' + next.title;
  nextStreamLabel.textContent = label;
}
updateNextStreamPill();
setInterval(updateNextStreamPill, 60000);
setInterval(function(){ if (typeof loadConfigData === 'function') loadConfigData(); }, 5 * 60 * 1000);

// ── Scroll progress ──
var scrollProgressBar = document.getElementById('scrollProgressBar');
function updateScrollProgress() {
  if (!scrollProgressBar) return;
  var scrollTop = window.scrollY || document.documentElement.scrollTop;
  var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgressBar.style.width = Math.min(100, scrollHeight > 0 ? (scrollTop/scrollHeight)*100 : 0) + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });

// ── Recently viewed ──
var RECENTLY_VIEWED_KEY = 'peetpics_recently_viewed';
var RECENTLY_VIEWED_MAX = 12;
function loadRecentlyViewed() { try { var s = localStorage.getItem(RECENTLY_VIEWED_KEY); if (s) return JSON.parse(s); } catch(e){} return []; }
function saveRecentlyViewed(list) { try { localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list)); } catch(e){} }
function addToRecentlyViewed(work) {
  if (!work || !work.id) return;
  var list = loadRecentlyViewed().filter(function (w) { return w.id !== work.id; });
  list.unshift({ id: work.id, title: work.title || 'Untitled', thumbUrl: work.imageUrl || work.thumbUrl, gallery: work.gallery, galleryName: work.galleryName });
  if (list.length > RECENTLY_VIEWED_MAX) list = list.slice(0, RECENTLY_VIEWED_MAX);
  saveRecentlyViewed(list);
  if (typeof buildNavDropdown === 'function') buildNavDropdown();
}
var originalRenderArtwork = renderArtwork;
renderArtwork = function (id) { originalRenderArtwork(id); var w = ARTWORKS_BY_ID[id]; if (w) addToRecentlyViewed(w); };

// ── Favourites ──
var FAVOURITES_KEY = 'peetpics_favourites';
function loadFavourites() { try { var s = localStorage.getItem(FAVOURITES_KEY); var list = s ? JSON.parse(s) : []; return Array.isArray(list) ? list : []; } catch(e){ return []; } }
function saveFavourites(ids) { try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids)); } catch(e){} }
function isFavourite(id) { return loadFavourites().indexOf(id) !== -1; }
function toggleFavourite(id) {
  if (!id) return;
  var favs = loadFavourites();
  var idx = favs.indexOf(id);
  if (idx === -1) favs.push(id); else favs.splice(idx, 1);
  saveFavourites(favs);
  document.querySelectorAll('[data-fav-id="' + cssEscape(id) + '"]').forEach(function (btn) {
    var on = favs.indexOf(id) !== -1;
    btn.classList.toggle('active', on);
    btn.innerHTML = on ? '♥ In your favourites' : '♡ Add to favourites';
  });
  if (navMenu) { var badge = navMenu.querySelector('[data-room="favourites"] .nav-item-count'); if (badge) badge.textContent = String(favs.length); }
  var route = parseRoute();
  if (route.name === 'gallery' && route.room === 'favourites') render();
}

// ── Slideshow ──
var slideshow = document.getElementById('slideshow');
var slideshowImage = document.getElementById('slideshowImage');
var slideshowCaptionTitle = document.getElementById('slideshowCaptionTitle');
var slideshowCaptionMeta = document.getElementById('slideshowCaptionMeta');
var slideshowCounter = document.getElementById('slideshowCounter');
var slideshowPlayBtn = document.getElementById('slideshowPlayBtn');
var slideshowPlayLabel = document.getElementById('slideshowPlayLabel');
var slideshowSpeedBtn = document.getElementById('slideshowSpeedBtn');
var slideshowProgressFill = document.getElementById('slideshowProgressFill');
var slideshowState = { works: [], index: 0, playing: false, speed: 5000, speedOptions: [3000,5000,8000,12000], speedIndex: 1, timer: null, progressTimer: null };
function openSlideshow(workList, startIndex) {
  if (!workList || workList.length === 0) return;
  slideshowState.works = workList;
  slideshowState.index = startIndex || 0;
  slideshow.classList.add('open');
  document.body.style.overflow = 'hidden';
  updateSlideshowSlide();
}
function closeSlideshow() {
  slideshow.classList.remove('open');
  document.body.style.overflow = '';
  slideshowState.playing = false;
  if (slideshowState.timer) { clearTimeout(slideshowState.timer); slideshowState.timer = null; }
  if (slideshowState.progressTimer) { cancelAnimationFrame(slideshowState.progressTimer); slideshowState.progressTimer = null; }
  updateSlideshowPlayButton();
}
function updateSlideshowSlide() {
  var w = slideshowState.works[slideshowState.index];
  if (!w) return;
  slideshowImage.classList.remove('visible');
  setTimeout(function () {
    slideshowImage.src = w.imageUrl || w.thumbUrl;
    slideshowImage.alt = w.title || '';
    slideshowImage.onload = function () { slideshowImage.classList.add('visible'); };
    setTimeout(function () { slideshowImage.classList.add('visible'); }, 500);
  }, 300);
  slideshowCaptionTitle.textContent = w.title || 'Untitled';
  var metaParts = [];
  if (w.galleryName) metaParts.push(w.galleryName);
  if (w.width && w.height) metaParts.push(w.width + ' × ' + w.height);
  slideshowCaptionMeta.textContent = metaParts.join(' · ');
  slideshowCounter.textContent = (slideshowState.index + 1) + ' / ' + slideshowState.works.length;
  if (slideshowProgressFill) slideshowProgressFill.style.width = '0%';
  if (slideshowState.playing) scheduleSlideshowAdvance();
}
function scheduleSlideshowAdvance() {
  if (slideshowState.timer) clearTimeout(slideshowState.timer);
  if (slideshowState.progressTimer) cancelAnimationFrame(slideshowState.progressTimer);
  var startTime = performance.now();
  var duration = slideshowState.speed;
  function tickProgress() {
    var pct = Math.min(100, ((performance.now() - startTime) / duration) * 100);
    if (slideshowProgressFill) slideshowProgressFill.style.width = pct + '%';
    if (pct < 100 && slideshowState.playing) slideshowState.progressTimer = requestAnimationFrame(tickProgress);
  }
  slideshowState.progressTimer = requestAnimationFrame(tickProgress);
  slideshowState.timer = setTimeout(function () { slideshowNext(); }, duration);
}
function slideshowNext() { slideshowState.index = (slideshowState.index + 1) % slideshowState.works.length; updateSlideshowSlide(); }
function slideshowPrev() { slideshowState.index = (slideshowState.index - 1 + slideshowState.works.length) % slideshowState.works.length; updateSlideshowSlide(); }
function toggleSlideshowPlay() {
  slideshowState.playing = !slideshowState.playing;
  updateSlideshowPlayButton();
  if (slideshowState.playing) scheduleSlideshowAdvance();
  else {
    if (slideshowState.timer) { clearTimeout(slideshowState.timer); slideshowState.timer = null; }
    if (slideshowState.progressTimer) { cancelAnimationFrame(slideshowState.progressTimer); slideshowState.progressTimer = null; }
  }
}
function updateSlideshowPlayButton() {
  if (slideshowState.playing) { slideshowPlayLabel.textContent = 'Pause'; slideshowPlayBtn.classList.add('active'); }
  else { slideshowPlayLabel.textContent = 'Play'; slideshowPlayBtn.classList.remove('active'); }
}
function cycleSlideshowSpeed() {
  slideshowState.speedIndex = (slideshowState.speedIndex + 1) % slideshowState.speedOptions.length;
  slideshowState.speed = slideshowState.speedOptions[slideshowState.speedIndex];
  slideshowSpeedBtn.textContent = (slideshowState.speed / 1000) + 's';
  if (slideshowState.playing) scheduleSlideshowAdvance();
}
document.getElementById('slideshowClose').addEventListener('click', closeSlideshow);
document.getElementById('slideshowPrev').addEventListener('click', slideshowPrev);
document.getElementById('slideshowNext').addEventListener('click', slideshowNext);
slideshowPlayBtn.addEventListener('click', toggleSlideshowPlay);
slideshowSpeedBtn.addEventListener('click', cycleSlideshowSpeed);
function startSlideshowFromCurrentGallery() {
  var route = parseRoute();
  var works = [];
  if (route.name === 'gallery') works = WORKS_BY_ROOM[route.room] || ARTWORKS;
  else if (route.name === 'artwork') { var w = ARTWORKS_BY_ID[route.id]; if (w) works = WORKS_BY_ROOM[w.gallery] || ARTWORKS; }
  else works = ARTWORKS;
  if (works.length === 0) return;
  var startIndex = 0;
  if (route.name === 'artwork') { for (var i = 0; i < works.length; i++) { if (works[i].id === route.id) { startIndex = i; break; } } }
  openSlideshow(works, startIndex);
}
document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.target.isContentEditable) return;
  if (slideshow.classList.contains('open')) {
    switch (e.key) {
      case 'Escape': e.preventDefault(); closeSlideshow(); return;
      case 'ArrowLeft': e.preventDefault(); slideshowPrev(); return;
      case 'ArrowRight': e.preventDefault(); slideshowNext(); return;
      case ' ': e.preventDefault(); toggleSlideshowPlay(); return;
    }
    return;
  }
  if (shortcutsModal && shortcutsModal.classList.contains('open')) return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); startSlideshowFromCurrentGallery(); }
});

})();