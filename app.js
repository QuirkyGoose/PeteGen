/* ======================================================================
   Peet Pics — The Vault · App logic
   Routes: #/ (landing) · #/gallery/:room · #/artwork/:id
   Data:  fetched at runtime from ./gallery-data.json (1,377 real works)
   Images: hotlinked from i.postimg.cc (the original image host)
   ====================================================================== */
(function () {
  'use strict';

  // ====================================================================
  // ROOM METADATA (matches the real site's collections)
  // ====================================================================

  var ROOMS = [
    { id: 'pobots',      name: 'Pobots',        tagline: 'Robots. Peets. The intersection thereof.',          color: 'amber',  hex: '#d4a853' },
    { id: 'prestlers',   name: 'Prestlers',     tagline: 'Peet meets the squared circle and beyond.',         color: 'rust',   hex: '#d49274' },
    { id: 'cultural',    name: 'Cultural Pics', tagline: 'Art, culture, and things that are Peet.',            color: 'rose',   hex: '#d9a3b8' },
    { id: 'pisc',        name: 'Pisc',          tagline: 'A miscellany. A cornucopia. A Pisc.',                color: 'sage',   hex: '#9bbf9b' },
    { id: 'submissions', name: 'Submissions',   tagline: 'Community contributions from the spreadsheet.',     color: 'violet', hex: '#b894d9' },
    { id: 'nacky',       name: 'Nacky Nook',    tagline: 'A secret corner reserved for the most delightfully unhinged Peet content.', color: 'amber', hex: '#e8c87a' },
  ];

  // Fallback tag pool (used when no real tags exist — the API doesn't return tags)
  var FALLBACK_TAGS = {
    pobots:      ['robot', 'peet', 'mech', 'pobot'],
    prestlers:   ['wrestling', 'peet', 'ring', 'prestler'],
    cultural:    ['art', 'culture', 'peet', 'artifact'],
    pisc:        ['misc', 'abstract', 'peet', 'pisc'],
    submissions: ['community', 'fanart', 'submission', 'peet'],
    nacky:       ['nacky', 'unhinged', 'chaos', 'peet'],
  };

  // ====================================================================
  // STATE
  // ====================================================================

  var GALLERY_DATA = null;     // populated by fetchGalleryData()
  var ARTWORKS = [];           // flat list of all works
  var ARTWORKS_BY_ID = {};     // id → work
  var WORKS_BY_ROOM = {};      // roomId → [works]

  var routeEl = document.getElementById('route');
  var footerEl = document.getElementById('footer');
  var backBtn = document.getElementById('backBtn');

  // ====================================================================
  // DATA FETCH
  // ====================================================================

  function loadGalleryData() {
    // Data is loaded via gallery-data.js as a global var (file:// compatible)
    return new Promise(function (resolve, reject) {
      if (window.GALLERY_DATA) {
        var json = window.GALLERY_DATA;
        GALLERY_DATA = json;
        // Flatten all works into a single list + lookup map
        ARTWORKS = [];
        ARTWORKS_BY_ID = {};
        WORKS_BY_ROOM = {};
        Object.keys(json.galleries).forEach(function (roomId) {
          var g = json.galleries[roomId];
          var works = (g.works || []).map(function (w) {
            var room = ROOMS.find(function (r) { return r.id === roomId; });
            var augmented = Object.assign({}, w, {
              roomColor: room ? room.hex : '#d4a853',
              roomName: g.name,
              tags: generateFallbackTags(roomId, w.title),
            });
            ARTWORKS_BY_ID[w.id] = augmented;
            return augmented;
          });
          WORKS_BY_ROOM[roomId] = works;
          ARTWORKS = ARTWORKS.concat(works);
        });
        resolve(json);
      } else {
        reject(new Error('gallery-data.js failed to load — window.GALLERY_DATA is undefined'));
      }
    });
  }

  // Generate pseudo-tags from the title + room (the real API doesn't return tags)
  function generateFallbackTags(roomId, title) {
    var pool = FALLBACK_TAGS[roomId] || ['peet'];
    var tags = pool.slice(0, 2); // always include first two room tags
    var lower = (title || '').toLowerCase();
    // Pull notable words from the title
    var words = lower.split(/[^a-z0-9]+/).filter(function (w) {
      return w.length > 3 && ['with', 'that', 'this', 'from', 'have', 'been'].indexOf(w) === -1;
    });
    if (words.length > 0) tags.push(words[0]);
    if (words.length > 2) tags.push(words[1]);
    // Dedupe + cap at 4
    var seen = {};
    return tags.filter(function (t) {
      if (seen[t]) return false;
      seen[t] = true;
      return true;
    }).slice(0, 4);
  }

  // ====================================================================
  // ROUTER
  // ====================================================================

  function navigate(hash) {
    if (hash === '') hash = '#/';
    window.location.hash = hash;
  }

  function parseRoute() {
    var hash = window.location.hash.slice(1);
    if (hash === '' || hash === '/') return { name: 'landing' };
    var parts = hash.split('/').filter(Boolean);
    if (parts[0] === 'gallery' && parts[1]) {
      return { name: 'gallery', room: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'artwork' && parts[1]) {
      return { name: 'artwork', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'schedule') return { name: 'schedule' };
    if (parts[0] === 'friends') return { name: 'friends' };
    if (parts[0] === 'shop') return { name: 'shop' };
    if (parts[0] === 'search') return { name: 'search', query: decodeURIComponent(parts[1] || '') };
    return { name: 'landing' };
  }

  function render() {
    // If data isn't loaded yet, show a loader
    if (!GALLERY_DATA) {
      routeEl.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><div class="loading-text">Loading the vault…</div></div>';
      return;
    }

    var route = parseRoute();
    routeEl.innerHTML = '';

    // Don't scroll to top when rendering search results — the user is
    // actively typing in the search bar and scrolling would dismiss the
    // mobile keyboard and collapse the expanded search overlay.
    if (route.name !== 'search') {
      window.scrollTo(0, 0);
    }

    if (route.name === 'landing') {
      footerEl.style.display = 'flex';
      lastSearchQuery = '';
      if (searchInput) searchInput.value = '';
      renderLanding();
    } else if (route.name === 'gallery') {
      footerEl.style.display = 'none';
      // Clear search when navigating to a gallery (but not when coming from search)
      if (searchInput && searchInput.value && route.name !== 'search') {
        lastSearchQuery = '';
        searchInput.value = '';
      }
      renderGallery(route.room);
    } else if (route.name === 'artwork') {
      footerEl.style.display = 'none';
      renderArtwork(route.id);
    } else if (route.name === 'schedule') {
      footerEl.style.display = 'none';
      renderSchedule();
    } else if (route.name === 'friends') {
      footerEl.style.display = 'none';
      renderFriends();
    } else if (route.name === 'shop') {
      footerEl.style.display = 'none';
      renderShop();
    } else if (route.name === 'search') {
      footerEl.style.display = 'none';
      renderSearch(route.query);
    }

    // Show/hide the back button based on route
    updateBackButton(route);

    // Update goo colors based on the current room
    var gooRoom = 'default';
    if (route.name === 'gallery' && ROOMS.find(function (r) { return r.id === route.room; })) {
      gooRoom = route.room;
    } else if (route.name === 'artwork') {
      var w = ARTWORKS_BY_ID[route.id];
      if (w && w.gallery) gooRoom = w.gallery;
    }
    if (typeof updateGooColors === 'function') updateGooColors(gooRoom);

    // Keep the navbar dropdown in sync with the new route
    syncNavDropdownState();
  }

  // Show the back button on gallery + artwork views, hide on landing.
  // Sets the href to the parent route (gallery → landing, artwork → its gallery).
  function updateBackButton(route) {
    if (!backBtn) return;
    if (route.name === 'landing') {
      backBtn.style.display = 'none';
      return;
    }
    backBtn.style.display = '';
    if (route.name === 'gallery') {
      // Back from a gallery goes to the landing
      backBtn.href = '#/';
      backBtn.setAttribute('aria-label', 'Back to landing');
    } else if (route.name === 'artwork') {
      // Back from an artwork goes to its parent gallery (if we know it)
      var w = ARTWORKS_BY_ID[route.id];
      if (w && w.gallery) {
        backBtn.href = '#/gallery/' + w.gallery;
        backBtn.setAttribute('aria-label', 'Back to ' + (w.galleryName || w.gallery));
      } else {
        backBtn.href = '#/';
        backBtn.setAttribute('aria-label', 'Back to landing');
      }
    } else if (route.name === 'schedule' || route.name === 'friends' || route.name === 'shop' || route.name === 'search') {
      // Back from schedule/friends goes to the landing
      backBtn.href = '#/';
      backBtn.setAttribute('aria-label', 'Back to landing');
    }
  }

  window.addEventListener('hashchange', function () {
    render();
    // Resize background after route change to fill new page height
    setTimeout(resize, 100);
    setTimeout(resize, 500);
    setTimeout(resize, 1500);
  });
  document.getElementById('brandHome').addEventListener('click', function () {
    navigate('');
  });

  // Keyboard shortcut: Esc / Backspace goes back on sub-pages
  document.addEventListener('keydown', function (e) {
    // Ignore when typing in an input/textarea
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    // Ignore if a lightbox or dropdown is open (let those handle Esc)
    if (e.key === 'Escape' || e.key === 'Backspace') {
      var route = parseRoute();
      if (route.name !== 'landing') {
        e.preventDefault();
        if (backBtn) {
          // Simulate clicking the back button (uses its href)
          window.location.hash = backBtn.getAttribute('href') || '#/';
        } else {
          navigate('');
        }
      }
    }
  });

  // Wire up the Random Pic button in the top bar
  var randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', function () {
      navigateToRandom();
    });
  }

  // Keyboard shortcut: R jumps to a random Pete Pic
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var key = e.key.toLowerCase();
    if (key === 'r') {
      e.preventDefault();
      navigateToRandom();
    }
  });

  // ====================================================================
  // NAVBAR DROPDOWN — gallery switcher
  // Mirrors the live site's nav tabs: All Works, the 5 rooms, Favourites.
  // Sits in the top-bar as a single pill button that opens a panel.
  // ====================================================================

  var navDropdown       = document.getElementById('navDropdown');
  var navTrigger        = document.getElementById('navDropdownTrigger');
  var navMenu           = document.getElementById('navDropdownMenu');
  var navCurrentLabel   = document.getElementById('navDropdownCurrent');

  // Extra virtual rooms (mirror the live site's "All Works" + "Favourites" tabs)
  var NAV_VIRTUAL = [
    { id: 'all',         name: 'All Works',  tagline: 'Every piece in the vault',         color: 'amber',  hex: '#d4a853', icon: 'grid' },
    { id: 'favourites',  name: 'Favourites', tagline: 'Hand-picked from the collections', color: 'rose',   hex: '#d9a3b8', icon: 'heart' },
  ];

  var SVG_ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="nav-active-mark" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>'
  };

  function buildNavDropdown() {
    if (!navMenu) return;
    var counts = {};
    ROOMS.forEach(function (r) {
      if (r.id === 'nacky') {
        counts[r.id] = 48; // curated selection
      } else {
        counts[r.id] = (WORKS_BY_ROOM[r.id] || []).length;
      }
    });
    counts.all = ARTWORKS.length;
    counts.favourites = 0; // no favourites store in this build

    // Section: Collections (the 5 real rooms)
    var collectionsHtml = ROOMS.map(function (r) {
      var isActive = currentRoomId() === r.id;
      return '<button class="nav-dropdown-item' + (isActive ? ' is-active' : '') + '" ' +
        'style="--dot-color: ' + r.hex + ';" ' +
        'data-room="' + escapeHtml(r.id) + '" role="option" ' +
        'aria-selected="' + (isActive ? 'true' : 'false') + '">' +
        '<span class="nav-dot"></span>' +
        '<span class="nav-item-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="nav-item-tag">' + escapeHtml(r.tagline) + '</span>' +
        '<span class="nav-item-count">' + counts[r.id] + '</span>' +
        SVG_ICONS.check +
      '</button>';
    }).join('');

    // Section: Virtual (All Works + Favourites)
    var virtualHtml = NAV_VIRTUAL.map(function (r) {
      var isActive = currentRoomId() === r.id;
      var icon = SVG_ICONS[r.icon] || '';
      return '<button class="nav-dropdown-item' + (isActive ? ' is-active' : '') + '" ' +
        'style="--dot-color: ' + r.hex + ';" ' +
        'data-room="' + escapeHtml(r.id) + '" role="option" ' +
        'aria-selected="' + (isActive ? 'true' : 'false') + '">' +
        icon +
        '<span class="nav-item-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="nav-item-tag">' + escapeHtml(r.tagline) + '</span>' +
        '<span class="nav-item-count">' + counts[r.id] + '</span>' +
        SVG_ICONS.check +
      '</button>';
    }).join('');

    // Section: Landing
    var landingActive = currentRouteName() === 'landing';
    var landingHtml = '<button class="nav-dropdown-item' + (landingActive ? ' is-active' : '') + '" ' +
      'style="--dot-color: #ffffff;" ' +
      'data-room="__landing" role="option" ' +
      'aria-selected="' + (landingActive ? 'true' : 'false') + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>' +
      '<span class="nav-item-name">The Vault</span>' +
      '<span class="nav-item-tag">Landing &amp; overview</span>' +
      '<span class="nav-item-count">' + ARTWORKS.length + '</span>' +
      SVG_ICONS.check +
    '</button>';

    // Section: Schedule + Friends (site pages)
    var scheduleActive = currentRouteName() === 'schedule';
    var friendsActive = currentRouteName() === 'friends';
    var shopActive = currentRouteName() === 'shop';
    var pagesHtml =
      '<button class="nav-dropdown-item' + (scheduleActive ? ' is-active' : '') + '" ' +
        'style="--dot-color: var(--amber);" ' +
        'data-room="__schedule" role="option" ' +
        'aria-selected="' + (scheduleActive ? 'true' : 'false') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
        '<span class="nav-item-name">Schedule</span>' +
        '<span class="nav-item-tag">Weekly stream times</span>' +
        '<span class="nav-item-count">7</span>' +
        SVG_ICONS.check +
      '</button>' +
      '<button class="nav-dropdown-item' + (friendsActive ? ' is-active' : '') + '" ' +
        'style="--dot-color: var(--rose);" ' +
        'data-room="__friends" role="option" ' +
        'aria-selected="' + (friendsActive ? 'true' : 'false') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' +
        '<span class="nav-item-name">Friends</span>' +
        '<span class="nav-item-tag">Pete\'s collaborators</span>' +
        '<span class="nav-item-count">' + FRIENDS.length + '</span>' +
        SVG_ICONS.check +
      '</button>' +
      '<button class="nav-dropdown-item' + (shopActive ? ' is-active' : '') + '" ' +
        'style="--dot-color: var(--sage);" ' +
        'data-room="__shop" role="option" ' +
        'aria-selected="' + (shopActive ? 'true' : 'false') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-item-icon" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>' +
        '<span class="nav-item-name">Shop</span>' +
        '<span class="nav-item-tag">Official merch on Fourthwall</span>' +
        SVG_ICONS.check +
      '</button>';

    // Build recently viewed section (only if there are items)
    var rvList = loadRecentlyViewed();
    var rvHtml = '';
    if (rvList.length > 0) {
      var rvItems = rvList.map(function (w) {
        return '<a class="nav-dropdown-rv-item" href="#/artwork/' + encodeURIComponent(w.id) + '" title="' + escapeHtml(w.title) + '">' +
          '<img src="' + escapeHtml(w.thumbUrl) + '" alt="' + escapeHtml(w.title) + '" loading="lazy" referrerpolicy="no-referrer" />' +
          '<div class="rv-tooltip">' + escapeHtml(w.title) + '</div>' +
        '</a>';
      }).join('');
      rvHtml = '<div class="nav-dropdown-section" style="margin-top: 6px;">Recently Viewed</div>' +
        '<div class="nav-dropdown-rv-section"><div class="nav-dropdown-rv-grid">' + rvItems + '</div></div>';
    }

    navMenu.innerHTML =
      '<div class="nav-dropdown-section">Collections</div>' +
      collectionsHtml +
      '<div class="nav-dropdown-section" style="margin-top: 6px;">Browse</div>' +
      virtualHtml +
      '<div class="nav-dropdown-section" style="margin-top: 6px;">Site</div>' +
      pagesHtml +
      rvHtml +
      '<div class="nav-dropdown-section" style="margin-top: 6px;">Home</div>' +
      landingHtml;

    // Wire up item clicks
    navMenu.querySelectorAll('.nav-dropdown-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var room = btn.getAttribute('data-room');
        closeNavDropdown();
        if (room === '__landing') {
          navigate('');
        } else if (room === '__schedule') {
          navigate('#/schedule');
        } else if (room === '__friends') {
          navigate('#/friends');
        } else if (room === '__shop') {
          navigate('#/shop');
        } else {
          navigate('#/gallery/' + room);
        }
      });
    });

    syncNavTriggerLabel();
  }

  function currentRouteName() {
    return parseRoute().name;
  }

  function currentRoomId() {
    var r = parseRoute();
    return r.name === 'gallery' ? r.room : null;
  }

  function syncNavTriggerLabel() {
    if (!navCurrentLabel) return;
    var route = parseRoute();
    var label = 'The Vault';
    var colorClass = '';

    if (route.name === 'landing') {
      label = 'The Vault';
    } else if (route.name === 'gallery') {
      var room = ROOMS.find(function (r) { return r.id === route.room; });
      if (room) {
        label = room.name;
        colorClass = 'is-' + room.color;
      } else if (route.room === 'all') {
        label = 'All Works';
        colorClass = 'is-amber';
      } else if (route.room === 'favourites') {
        label = 'Favourites';
        colorClass = 'is-rose';
      } else {
        label = route.room;
      }
    } else if (route.name === 'artwork') {
      // Show the parent room of the artwork, if we can find it
      var work = ARTWORKS_BY_ID[route.id];
      if (work) {
        var room2 = ROOMS.find(function (r) { return r.id === work.gallery; });
        if (room2) {
          label = room2.name;
          colorClass = 'is-' + room2.color;
        }
      }
    } else if (route.name === 'schedule') {
      label = 'Schedule';
      colorClass = 'is-amber';
    } else if (route.name === 'friends') {
      label = 'Friends';
      colorClass = 'is-rose';
    } else if (route.name === 'shop') {
      label = 'Shop';
      colorClass = 'is-sage';
    }

    navCurrentLabel.textContent = label;
    // Reset color classes, then re-apply the right one
    navCurrentLabel.classList.remove('is-amber', 'is-rust', 'is-rose', 'is-sage', 'is-violet');
    if (colorClass) navCurrentLabel.classList.add(colorClass);
  }

  // Lighter-weight sync: updates is-active classes on existing dropdown items
  // + refreshes the trigger label, without rebuilding the whole menu.
  function syncNavDropdownState() {
    syncNavTriggerLabel();
    if (!navMenu) return;
    var activeRoom = currentRoomId();
    var routeName = currentRouteName();
    var isLanding = routeName === 'landing';
    var isSchedule = routeName === 'schedule';
    var isFriends = routeName === 'friends';
    var isShop = routeName === 'shop';
    navMenu.querySelectorAll('.nav-dropdown-item').forEach(function (btn) {
      var room = btn.getAttribute('data-room');
      var isActive;
      if (room === '__landing') isActive = isLanding;
      else if (room === '__schedule') isActive = isSchedule;
      else if (room === '__friends') isActive = isFriends;
      else if (room === '__shop') isActive = isShop;
      else isActive = (room === activeRoom);
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function openNavDropdown() {
    if (!navDropdown) return;
    navDropdown.classList.add('open');
    navTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeNavDropdown() {
    if (!navDropdown) return;
    navDropdown.classList.remove('open');
    navTrigger.setAttribute('aria-expanded', 'false');
  }

  function toggleNavDropdown() {
    if (navDropdown.classList.contains('open')) {
      closeNavDropdown();
    } else {
      openNavDropdown();
    }
  }

  if (navTrigger) {
    navTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleNavDropdown();
    });
  }

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!navDropdown) return;
    if (!navDropdown.contains(e.target)) closeNavDropdown();
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNavDropdown();
  });

  // Close on hash change (so it doesn't linger open over the new view).
  // The active-state + label sync is handled inside render() so it always
  // runs after the new view is in place.
  window.addEventListener('hashchange', function () {
    closeNavDropdown();
  });

  // ====================================================================
  // IMAGE HELPERS
  // ====================================================================

  // ====================================================================
  // IMAGE LOADING — same approach as the real Petepics site:
  // IntersectionObserver with rootMargin: "400px" to lazy-load images
  // only when they're near the viewport. No queue, no concurrency limit,
  // no retry — just let the browser handle it natively with loading="lazy".
  // ====================================================================

  var lazyObserver = null;

  function initLazyObserver() {
    if (lazyObserver) return lazyObserver;
    lazyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            var src = img.getAttribute('data-src');
            if (src && !img.src) {
              img.src = src;
            }
            lazyObserver.unobserve(img);
          }
        });
      },
      { rootMargin: '400px' }
    );
    return lazyObserver;
  }

  function observeLazyImages(container) {
    var imgs = container.querySelectorAll('img[data-src]');
    var obs = initLazyObserver();
    imgs.forEach(function (img) { obs.observe(img); });
  }

  function imgTag(work, cls, alt, loading) {
    var url = work.thumbUrl || work.imageUrl;
    var w = work.width || '';
    var h = work.height || '';
    var aspect = (w && h) ? (w / h) : 1;
    var altText = alt || escapeHtml(work.title || '');
    cls = cls || '';
    // Render an empty <img> with data-src — IntersectionObserver assigns
    // src when the image is within 400px of the viewport.
    return '<img' +
      (cls ? ' class="' + cls + '"' : '') +
      ' alt="' + altText + '"' +
      ' loading="lazy"' +
      ' decoding="async"' +
      ' referrerpolicy="no-referrer"' +
      ' data-src="' + escapeHtml(url) + '"' +
      ' data-aspect="' + aspect.toFixed(3) + '"' +
      ' style="opacity:0;transition:opacity 0.4s ease;"' +
      ' onload="this.style.opacity=1"' +
      ' onerror="this.style.opacity=0.12;this.alt=\'unavailable\'"' +
      '>';
  }

  // ====================================================================
  // LANDING RENDER
  // ====================================================================

  // Pete Pic of the Day — deterministic by date so everyone sees the same one
  // on the same day. Picks a stable index from ARTWORKS using a YYYYMMDD seed.
  function getPicOfDay() {
    if (!ARTWORKS.length) return null;
    var d = new Date();
    var seed = parseInt(
      String(d.getFullYear()) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0'),
      10
    );
    return ARTWORKS[seed % ARTWORKS.length];
  }

  // Pick a completely random artwork and navigate to its detail page
  function navigateToRandom() {
    if (!ARTWORKS.length) return;
    var pick = ARTWORKS[Math.floor(Math.random() * ARTWORKS.length)];
    navigate('#/artwork/' + encodeURIComponent(pick.id));
  }

  function renderLanding() {
    var counts = {};
    ROOMS.forEach(function (r) {
      if (r.id === 'nacky') {
        counts[r.id] = 48; // curated selection
      } else {
        counts[r.id] = (WORKS_BY_ROOM[r.id] || []).length;
      }
    });
    var totalWorks = ARTWORKS.length;

    // Build a small preview strip using a few real thumbnails from each room
    var previewHtml = ROOMS.map(function (r) {
      var works = WORKS_BY_ROOM[r.id] || [];
      var sample = works.slice(0, 3);
      var thumbs = sample.map(function (w) {
        return '<div class="room-preview-thumb" style="background-image:url(\'' + escapeHtml(w.thumbUrl || w.imageUrl) + '\')"></div>';
      }).join('');
      return '<a class="room-card room-' + r.color + '" href="#/gallery/' + r.id + '">' +
        '<div class="room-card-previews">' + thumbs + '</div>' +
        '<div class="room-card-head"><span class="room-card-name">' + escapeHtml(r.name) + '</span><span class="room-card-count">' + counts[r.id] + ' works</span></div>' +
        '<p class="room-card-tagline">' + escapeHtml(r.tagline) + '</p>' +
        '<div class="room-card-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></div>' +
      '</a>';
    }).join('');

    var html = '' +
    '<section id="landing" class="screen">' +
      '<div class="hero-overlay">' +
        '<div class="hero-content">' +
          '<div class="eyebrow anim">EST. 2024 · PeteGen · ' + ROOMS.length + ' collections · ' + totalWorks.toLocaleString() + ' works</div>' +
          '<h1 class="hero-h1 anim">Peet Pics.<br><span class="thin">A permanent archive of the</span> <span class="amber">Pobots, Prestlers &amp; Cultural Pics</span> <span class="thin">of our time.</span></h1>' +
          '<div class="hero-row anim">' +
            '<div class="hero-main">' +
              '<p class="hero-sub"><b>The Vault</b> — a permanent archive dedicated to the finest Peet-adjacent artwork, Pobots, Prestlers, and Cultural Artefacts of Our Time. Curated by AGoodPete, catalogued by the community, preserved for the foreseeable future.</p>' +
              '<div class="hero-stats">' +
                '<div class="stat"><span class="stat-val">' + totalWorks.toLocaleString() + '</span><span class="stat-label">Works Archived</span></div>' +
                '<div class="stat"><span class="stat-val">' + ROOMS.length + '</span><span class="stat-label">Collections</span></div>' +
                '<div class="stat"><span class="stat-val amber">∞</span><span class="stat-label">Pobots</span></div>' +
                '<div class="stat"><span class="stat-val">100%</span><span class="stat-label">Community-run</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="hero-side">' +
              '<div class="hero-actions">' +
                '<a class="btn-primary" href="#/gallery/all"><span>Enter the Archive</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M4 7l4 4 4-4"/></svg></a>' +
                '<a class="btn-secondary" href="https://twitch.tv/AGoodPete" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg><span>AGoodPete on Twitch</span></a>' +
                '<a class="btn-secondary btn-shop" href="#/shop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>The Vault Shop</span></a>' +
              '</div>' +
              '<div class="hero-foot">' +
                '<a class="foot-note-cta" href="#collections">Five chambers of the vault, <b>each with its own character</b> &nbsp;→</a>' +
                '<span class="hero-foot-note">Live data · ' + totalWorks.toLocaleString() + ' works · updated continuously</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="scroll-cue" id="scrollCue"><span>Browse the archive</span><div class="scroll-cue-line"></div></div>' +
      '</div>' +
    '</section>' +
    (function () {
      // Pete Pic of the Day — deterministic daily pick
      var potd = getPicOfDay();
      if (!potd) return '';
      var today = new Date();
      var dateStr = today.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      return '' +
      '<section id="potd" class="screen">' +
        '<div class="potd-inner">' +
          '<div class="potd-header">' +
            '<div class="potd-eyebrow"><span class="potd-dot">★</span> Pete Pic of the Day · ' + escapeHtml(dateStr) + '</div>' +
            '<h2 class="potd-title">Today\'s <span class="thin">selection</span></h2>' +
            '<p class="potd-sub">A different pic, every day. Curated by date — everyone sees the same one.</p>' +
          '</div>' +
          '<a class="potd-card" href="#/artwork/' + encodeURIComponent(potd.id) + '">' +
            '<div class="potd-image">' +
              '<img src="' + escapeHtml(potd.imageUrl || potd.thumbUrl) + '" alt="' + escapeHtml(potd.title || 'Untitled') + '" loading="lazy" referrerpolicy="no-referrer">' +
              '<div class="potd-image-overlay"></div>' +
              '<div class="potd-badge">' + escapeHtml(potd.galleryName || 'Vault') + '</div>' +
            '</div>' +
            '<div class="potd-info">' +
              '<div class="potd-info-eyebrow">From the archive</div>' +
              '<h3 class="potd-info-title">' + escapeHtml(potd.title || 'Untitled') + '</h3>' +
              '<div class="potd-info-meta">' +
                '<span>' + escapeHtml(potd.galleryName || '') + '</span>' +
                (potd.width && potd.height ? '<span class="sep">·</span><span>' + potd.width + ' × ' + potd.height + '</span>' : '') +
              '</div>' +
              '<div class="potd-info-cta">View in archive <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></div>' +
            '</div>' +
          '</a>' +
          '<div class="potd-foot">' +
            '<button class="potd-random-btn" id="potdRandomBtn">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>' +
              '<span>Surprise me — random Pete Pic</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</section>';
    })() +
    '<section id="collections" class="screen">' +
      '<div class="collections-inner">' +
        '<div class="collections-header">' +
          '<h2 class="collections-title">Browse by <span class="thin">Collection</span></h2>' +
          '<p class="collections-sub">Five chambers of the vault, each with its own character. Click any room to step inside and browse the works.</p>' +
        '</div>' +
        '<div class="collections-grid">' + previewHtml + '</div>' +
      '</div>' +
    '</section>';

    routeEl.innerHTML = html;

    // Wire up the "Surprise me" random button on the landing page
    var potdRandomBtn = document.getElementById('potdRandomBtn');
    if (potdRandomBtn) {
      potdRandomBtn.addEventListener('click', function () {
        navigateToRandom();
      });
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        routeEl.querySelectorAll('.anim').forEach(function (el) { el.classList.add('in'); });
        var cue = document.getElementById('scrollCue');
        if (cue) cue.classList.add('in');
      });
    });
  }

  // ====================================================================
  // GALLERY RENDER (with lazy-loading + "load more" pagination)
  // ====================================================================

  var PAGE_SIZE = 48; // load 48 at a time

  function renderGallery(roomId) {
    var room = ROOMS.find(function (r) { return r.id === roomId; });
    var works;
    var title;
    var tagline;
    var hex = '#d4a853';

    if (room && roomId === 'nacky') {
      // Nacky Nook — curated random selection from all galleries (the most "unhinged" works)
      // Pick 48 random works across all collections for a chaotic mix
      var allShuffled = ARTWORKS.slice().sort(function () { return Math.random() - 0.5; });
      works = allShuffled.slice(0, Math.min(48, allShuffled.length));
      title = room.name;
      tagline = room.tagline;
      hex = room.hex;
    } else if (room) {
      works = WORKS_BY_ROOM[roomId] || [];
      title = room.name;
      tagline = room.tagline;
      hex = room.hex;
    } else if (roomId === 'all' || roomId === 'favourites') {
      works = ARTWORKS.slice();
      title = roomId === 'all' ? 'The Full Archive' : 'Favourites';
      tagline = roomId === 'all'
        ? 'Every piece in the vault, all at once. Browse at your own pace.'
        : 'Hand-picked favourites from across the collections.';
    } else {
      routeEl.innerHTML = '<div class="gallery-view"><div class="gallery-empty"><h3>Collection not found</h3><p>That chamber of the vault doesn\'t exist.</p><a class="btn-secondary" href="#/" style="margin-top: 20px; display: inline-flex;">Back to landing</a></div></div>';
      return;
    }

    // Build filter chips
    var tagCounts = {};
    works.forEach(function (w) {
      (w.tags || []).forEach(function (t) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });
    var topTags = Object.keys(tagCounts).sort(function (a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 10);

    var html = '' +
    '<div class="gallery-view screen" data-room="' + escapeHtml(roomId) + '">' +
      '<div class="gallery-header">' +
        '<div class="gallery-breadcrumb">' +
          '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
          '<span style="color: var(--t1);">Gallery</span><span class="sep">/</span>' +
          '<span class="cur">' + escapeHtml(title) + '</span>' +
        '</div>' +
        '<h1 class="gallery-title" style="--room-color: ' + hex + ';">' + escapeHtml(title) + '</h1>' +
        '<p class="gallery-tagline">' + escapeHtml(tagline) + '</p>' +
        '<div class="gallery-meta">' +
          '<span><span class="count">' + works.length.toLocaleString() + '</span> works</span>' +
          '<span class="dot">·</span>' +
          '<span>' + topTags.length + ' tags</span>' +
          '<span class="dot">·</span>' +
          '<span>Live from the vault</span>' +
          '<span class="dot">·</span>' +
          '<button class="gallery-slideshow-btn" id="gallerySlideshowBtn" title="Start slideshow (S)">▶ Slideshow</button>' +
        '</div>' +
      '</div>' +
      '<div class="filter-bar" id="filterBar">' +
        '<button class="filter-chip active" data-tag="__all">All <span class="chip-count">' + works.length + '</span></button>' +
        topTags.map(function (t) {
          return '<button class="filter-chip" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + ' <span class="chip-count">' + tagCounts[t] + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="artwork-grid" id="artworkGrid"></div>' +
      '<div class="load-more-wrap" id="loadMoreWrap" style="text-align:center; padding: 32px 0;">' +
        '<button class="btn-secondary" id="loadMoreBtn">Load more</button>' +
        '<div class="load-more-meta" id="loadMoreMeta" style="margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--t3); letter-spacing: 0.1em; text-transform: uppercase;"></div>' +
      '</div>' +
    '</div>';

    routeEl.innerHTML = html;

    // State for this gallery
    var state = {
      allWorks: works,
      filtered: works.slice(),
      shown: 0,
      activeTag: '__all',
    };

    var grid = document.getElementById('artworkGrid');
    var loadMoreBtn = document.getElementById('loadMoreBtn');
    var loadMoreMeta = document.getElementById('loadMoreMeta');

    function renderPage() {
      var end = Math.min(state.shown + PAGE_SIZE, state.filtered.length);
      var fragment = '';
      for (var i = state.shown; i < end; i++) {
        var w = state.filtered[i];
        fragment += '<a class="artwork-card" href="#/artwork/' + encodeURIComponent(w.id) + '" data-tags="' + (w.tags || []).join(',') + '">' +
          '<div class="artwork-card-image">' +
            imgTag(w, 'artwork-card-img', w.title, 'lazy') +
            '<div class="artwork-card-overlay"><span class="artwork-card-overlay-text">View →</span></div>' +
          '</div>' +
          '<div class="artwork-card-info">' +
            '<div class="artwork-card-title">' + escapeHtml(w.title || 'Untitled') + '</div>' +
            '<div class="artwork-card-meta">' + escapeHtml(w.galleryName || '') + (w.width ? '<span class="dot">·</span>' + w.width + '×' + w.height : '') + '</div>' +
          '</div>' +
        '</a>';
      }
      grid.insertAdjacentHTML('beforeend', fragment);
      state.shown = end;
      // Observe newly inserted images for lazy loading
      observeLazyImages(grid);
      updateLoadMore();
    }

    function updateLoadMore() {
      loadMoreMeta.textContent = state.shown.toLocaleString() + ' / ' + state.filtered.length.toLocaleString() + ' works';
      if (state.shown >= state.filtered.length) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = '';
      }
    }

    function applyFilter(tag) {
      state.activeTag = tag;
      if (tag === '__all') {
        state.filtered = state.allWorks.slice();
      } else {
        state.filtered = state.allWorks.filter(function (w) {
          return (w.tags || []).indexOf(tag) !== -1;
        });
      }
      state.shown = 0;
      grid.innerHTML = '';
      renderPage();
    }

    // Wire filter chips
    document.getElementById('filterBar').addEventListener('click', function (e) {
      var chip = e.target.closest('.filter-chip');
      if (!chip) return;
      document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      applyFilter(chip.getAttribute('data-tag'));
    });

    // Wire load more
    loadMoreBtn.addEventListener('click', renderPage);

    // Wire up slideshow button
    var slideshowBtn = document.getElementById('gallerySlideshowBtn');
    if (slideshowBtn) {
      slideshowBtn.addEventListener('click', function () {
        openSlideshow(state.filtered, 0);
      });
    }

    // Initial page
    renderPage();

    // Auto-load more on scroll near bottom (debounced)
    var scrollTimer = null;
    window.addEventListener('scroll', function () {
      if (scrollTimer) return;
      scrollTimer = setTimeout(function () {
        scrollTimer = null;
        if (state.shown >= state.filtered.length) return;
        var scrollY = window.scrollY + window.innerHeight;
        var docHeight = document.body.scrollHeight;
        if (docHeight - scrollY < 800) {
          renderPage();
        }
      }, 200);
    });
  }

  // ====================================================================
  // ARTWORK DETAIL RENDER
  // ====================================================================

  function renderArtwork(id) {
    var w = ARTWORKS_BY_ID[id];
    if (!w) {
      routeEl.innerHTML = '<div class="artwork-view"><div class="gallery-empty"><h3>Artwork not found</h3><p>That piece isn\'t in the vault.</p><a class="btn-secondary" href="#/" style="margin-top: 20px; display: inline-flex;">Back to landing</a></div></div>';
      return;
    }

    // Find prev/next within the same room
    var roomWorks = WORKS_BY_ROOM[w.gallery] || ARTWORKS;
    var idx = roomWorks.findIndex(function (x) { return x.id === id; });
    var prev = idx > 0 ? roomWorks[idx - 1] : null;
    var next = idx < roomWorks.length - 1 ? roomWorks[idx + 1] : null;

    var aspect = (w.width && w.height) ? (w.width / w.height) : 1;
    var html = '' +
    '<div class="artwork-view screen">' +
      '<div class="artwork-detail">' +
        '<div class="artwork-image-wrap" id="artworkImageWrap" style="aspect-ratio: ' + aspect.toFixed(3) + ';">' +
          '<img src="' + escapeHtml(w.imageUrl) + '" alt="' + escapeHtml(w.title) + '" decoding="async" referrerpolicy="no-referrer" loading="eager" style="width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 0.4s ease;" onload="this.style.opacity=1" onerror="this.style.opacity=0.15;this.alt=\'unavailable\'">' +
          '<div class="artwork-zoom-hint">Click to expand</div>' +
        '</div>' +
        '<div class="artwork-sidebar">' +
          '<div class="artwork-breadcrumb">' +
            '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
            '<a href="#/gallery/' + w.gallery + '">' + escapeHtml(w.galleryName) + '</a><span class="sep">/</span>' +
            '<span class="cur">' + escapeHtml(w.title) + '</span>' +
          '</div>' +
          '<div>' +
            '<h1 class="artwork-title">' + escapeHtml(w.title) + '</h1>' +
            '<div class="artwork-artist">from <b>' + escapeHtml(w.galleryName) + '</b></div>' +
          '</div>' +
          '<div class="artwork-meta-list">' +
            '<div class="artwork-meta-row"><span class="k">Collection</span><span class="v" style="color: ' + w.roomColor + ';">' + escapeHtml(w.galleryName) + '</span></div>' +
            (w.width ? '<div class="artwork-meta-row"><span class="k">Dimensions</span><span class="v mono">' + w.width + ' × ' + w.height + '</span></div>' : '') +
            '<div class="artwork-meta-row"><span class="k">Aspect ratio</span><span class="v mono">' + aspect.toFixed(2) + ':1</span></div>' +
            '<div class="artwork-meta-row"><span class="k">Catalogue ID</span><span class="v mono">#' + escapeHtml(w.id) + '</span></div>' +
            '<div class="artwork-meta-row"><span class="k">Hosted on</span><span class="v mono">postimg.cc</span></div>' +
          '</div>' +
          '<p class="artwork-description">A piece from the ' + escapeHtml(w.galleryName) + ' collection. Originally submitted to the AGoodPete community archive and preserved here for posterity.</p>' +
          '<div class="artwork-tags">' +
            (w.tags || []).map(function (t) { return '<span class="artwork-tag">#' + escapeHtml(t) + '</span>'; }).join('') +
          '</div>' +
          '<div class="artwork-nav">' +
            '<a class="artwork-nav-btn" href="' + (prev ? '#/artwork/' + encodeURIComponent(prev.id) : '#') + '"' + (prev ? '' : ' style="pointer-events: none; opacity: 0.3;"') + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Prev' +
            '</a>' +
            '<a class="artwork-merch-btn" href="#/shop">Get as merch →</a>' +
            '<span class="artwork-nav-position">' + (idx + 1) + ' / ' + roomWorks.length + '</span>' +
            '<a class="artwork-nav-btn" href="' + (next ? '#/artwork/' + encodeURIComponent(next.id) : '#') + '"' + (next ? '' : ' style="pointer-events: none; opacity: 0.3;"') + '>' +
              'Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    routeEl.innerHTML = html;

    // Preload the full-res image in the background so the lightbox
    // opens instantly when clicked. The thumbnail loads first (fast),
    // then the full-res version loads silently behind it.
    if (w.imageUrl && w.imageUrl !== w.thumbUrl) {
      var preloader = new Image();
      preloader.decoding = 'async';
      preloader.referrerPolicy = 'no-referrer';
      preloader.src = w.imageUrl;
    }

    // Wire image click → lightbox
    var imgWrap = document.getElementById('artworkImageWrap');
    imgWrap.addEventListener('click', function () {
      openLightbox(id, roomWorks);
    });
  }

  // ====================================================================
  // SCHEDULE PAGE
  // ====================================================================

  var SCHEDULE = [
    { day: 'Monday',    shows: [{ title: "Cait's Wide Hole", host: 'Cait',     time: '~8:00 PM',  hour: 20, minute: 0, desc: 'Culture, chat, and chaos with Cait.' }] },
    { day: 'Tuesday',   shows: [{ title: 'Puzzle Tuesday',        host: 'Dr Plem', time: 'Evening',   hour: 19, minute: 0, desc: 'Puzzles, brain teasers, and Peet.' }] },
    { day: 'Wednesday', shows: [
      { title: 'Peet Pics',      host: 'Pete', time: '~4:30 PM', hour: 16, minute: 30, desc: 'The main event — live Peet Pics drawing.' },
      { title: 'Late Nite Pite', host: 'Pete', time: '~10:00 PM', hour: 22, minute: 0, desc: 'Late-night edition. Same energy, later hour.' },
    ]},
    { day: 'Thursday',  shows: [{ title: 'Wrestling',  host: 'Pete', time: '~7:30 PM',  hour: 19, minute: 30, desc: 'Prestlers, squared circles, and beyond.' }] },
    { day: 'Friday',    shows: [
      { title: 'Peet Pics',      host: 'Pete', time: '~4:30 PM',  hour: 16, minute: 30, desc: 'Friday edition of the main Peet Pics stream.' },
      { title: 'Late Nite Pite', host: 'Pete', time: '~10:00 PM', hour: 22, minute: 0, desc: 'Late-night Friday vibes.' },
    ]},
    { day: 'Saturday',  shows: [{ title: 'Wrestling',  host: 'Pete', time: '~7:30 PM',  hour: 19, minute: 30, desc: 'Saturday wrestling night.' }] },
    { day: 'Sunday',    shows: [{ title: 'Bobots',     host: 'Pete', time: '~8:00 PM',  hour: 20, minute: 0, desc: 'Sunday Bobots — robots, Peets, the intersection thereof.' }] },
  ];

  var DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  function renderSchedule() {
    var today = new Date().getDay(); // 0=Sunday
    // Reorder SCHEDULE so today is first
    var todayName = Object.keys(DAY_INDEX).find(function (k) { return DAY_INDEX[k] === today; });
    var todayIdx = SCHEDULE.findIndex(function (d) { return d.day === todayName; });
    var ordered = SCHEDULE.slice(todayIdx).concat(SCHEDULE.slice(0, todayIdx));

    var cardsHtml = ordered.map(function (d) {
      var isToday = d.day === todayName;
      var showsHtml = d.shows.map(function (s) {
        return '<div class="schedule-show">' +
          '<div class="schedule-show-time">' + escapeHtml(s.time) + '</div>' +
          '<div class="schedule-show-body">' +
            '<div class="schedule-show-title">' + escapeHtml(s.title) + '</div>' +
            '<div class="schedule-show-host">with <b>' + escapeHtml(s.host) + '</b></div>' +
            '<div class="schedule-show-desc">' + escapeHtml(s.desc) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      return '<div class="schedule-day' + (isToday ? ' is-today' : '') + '">' +
        '<div class="schedule-day-header">' +
          '<span class="schedule-day-name">' + escapeHtml(d.day) + (isToday ? ' · Today' : '') + '</span>' +
        '</div>' +
        '<div class="schedule-day-shows">' + showsHtml + '</div>' +
      '</div>';
    }).join('');

    var html = '' +
    '<div class="schedule-view screen">' +
      '<div class="schedule-header">' +
        '<div class="gallery-breadcrumb">' +
          '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
          '<span class="cur">Schedule</span>' +
        '</div>' +
        '<h1 class="schedule-title">Stream <span class="thin">Schedule</span></h1>' +
        '<p class="schedule-subtitle">Weekly recurring shows. Times are approximate and in your local timezone. Follow <a href="https://twitch.tv/AGoodPete" target="_blank" rel="noopener" style="color: var(--amber); text-decoration: underline;">AGoodPete on Twitch</a> for notifications.</p>' +
      '</div>' +
      '<div class="schedule-grid">' + cardsHtml + '</div>' +
    '</div>';

    routeEl.innerHTML = html;
  }

  // ====================================================================
  // FRIENDS PAGE
  // ====================================================================

  var FRIENDS = [
    { name: 'FizzyCait',  channel: 'https://twitch.tv/FizzyCait',    handle: 'FizzyCait',  desc: "Cait's Wide Hole co-host. Culture, chat, and chaos." },
    { name: 'Dr Plem',    channel: 'https://twitch.tv/dr_plem',          handle: 'dr_plem',    desc: 'Puzzle Tuesday co-host. Puzzles, brain teasers, and Peet.' },
    { name: 'Harry Hardy',channel: 'https://twitch.tv/harryhardy',   handle: 'harryhardy', desc: 'Peet Pics community member and frequent contributor to the vault.' },
    { name: 'Bekabyx',    channel: 'https://twitch.tv/bekabyx',      handle: 'bekabyx',    desc: 'Peet Pics community member and streamer.' },
    { name: 'grgrsmth',   channel: 'https://twitch.tv/grgrsmth',     handle: 'grgrsmth',   desc: 'Peet Pics community member and streamer.' },
    { name: 'BreadSanta', channel: 'https://twitch.tv/breadsanta',   handle: 'breadsanta', desc: 'Peet Pics community member and streamer.' },
    { name: 'Albrot',     channel: 'https://twitch.tv/albrot',       handle: 'albrot',     desc: 'Peet Pics community member and streamer.' },
    { name: 'JosieRustle',channel: 'https://twitch.tv/josierustle',  handle: 'josierustle',desc: 'Peet Pics community member and streamer.' },
    { name: 'AngelInterceptor', channel: 'https://twitch.tv/angelinterceptor', handle: 'angelinterceptor', desc: 'Peet Pics community member and streamer.' },
    { name: 'AliDooLalli', channel: 'https://twitch.tv/alidoolalli',  handle: 'alidoolalli', desc: 'Peet Pics community member and streamer.' },
    { name: 'AlexKiddInShinobiWorld', channel: 'https://twitch.tv/alexkiddinshinobiworld', handle: 'alexkiddinshinobiworld', desc: 'Peet Pics community member and streamer.' },
  ];

  function renderFriends() {
    var cardsHtml = FRIENDS.map(function (f) {
      return '<a class="friend-card" href="' + escapeHtml(f.channel) + '" target="_blank" rel="noopener" data-handle="' + escapeHtml(f.handle) + '">' +
        '<div class="friend-card-bg" aria-hidden="true"></div>' +
        '<div class="friend-card-inner">' +
          '<div class="friend-card-head">' +
            '<div class="friend-avatar" data-avatar="' + escapeHtml(f.handle) + '">' + escapeHtml(f.name.charAt(0)) + '</div>' +
            '<div class="friend-info">' +
              '<div class="friend-name">' + escapeHtml(f.name) + '</div>' +
              '<div class="friend-handle">@' + escapeHtml(f.handle) + '</div>' +
            '</div>' +
            '<div class="friend-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg></div>' +
          '</div>' +
          '<p class="friend-desc">' + escapeHtml(f.desc) + '</p>' +
          '<div class="friend-foot">' +
            '<span class="friend-platform">' +
              '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>' +
              'Twitch' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</a>';
    }).join('');

    var html = '' +
    '<div class="friends-view screen">' +
      '<div class="friends-header">' +
        '<div class="gallery-breadcrumb">' +
          '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
          '<span class="cur">Friends</span>' +
        '</div>' +
        '<h1 class="friends-title">Pete\'s <span class="thin">Friends</span></h1>' +
        '<p class="friends-subtitle">Streamers, collaborators, and members of the Peet Pics community. Click any card to visit their channel.</p>' +
      '</div>' +
      '<div class="friends-grid">' + cardsHtml + '</div>' +
    '</div>';

    routeEl.innerHTML = html;

    // Fetch each friend's Twitch avatar and wire it into the card.
    // Uses DecAPI (https://decapi.me/twitch/avatar/<handle>) which returns
    // the CDN URL as plain text. On failure the card keeps its initial-letter
    // placeholder avatar and no background image.
    FRIENDS.forEach(function (f) {
      var handle = f.handle;
      var avatarEl = routeEl.querySelector('.friend-avatar[data-avatar="' + CSS.escape(handle) + '"]');
      var cardEl = avatarEl && avatarEl.closest('.friend-card');
      var bgEl = cardEl && cardEl.querySelector('.friend-card-bg');
      if (!avatarEl) return;

      fetch('https://decapi.me/twitch/avatar/' + encodeURIComponent(handle))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (url) {
          url = (url || '').trim();
          if (!url || url.indexOf('http') !== 0) throw new Error('no url');
          var safeUrl = encodeURI(url);

          // 1) Replace initial-letter avatar with the real profile pic.
          var img = new Image();
          img.onload = function () {
            avatarEl.innerHTML = '';
            avatarEl.classList.add('friend-avatar--has-img');
            avatarEl.style.backgroundImage = 'url("' + safeUrl + '")';
            // 2) Use the same image as a heavily-blurred background layer
            //    behind the glass panel, matching the schedule aesthetic.
            if (bgEl) {
              bgEl.style.backgroundImage = 'url("' + safeUrl + '")';
              cardEl.classList.add('friend-card--has-bg');
            }
          };
          img.src = safeUrl;
        })
        .catch(function (err) {
          // Silent — keep the initial-letter avatar and clean background.
          console.warn('[PeteGen] avatar fetch failed for', handle, err);
        });
    });
  }

  // ====================================================================
  // SHOP PAGE
  // ====================================================================

  // ⚠️ CHANGE THIS to your actual store URL when ready.
  // Options: Redbubble (https://redbubble.com/people/YOURSHOP),
  //          Printful + Shopify, Spring (https://spring.com/YOURSHOP),
  //          or any other print-on-demand store URL.
  var SHOP_URL = 'https://agoodpete-shop.fourthwall.com/en-gbp';

  function renderShop() {
    var html = '' +
    '<div class="shop-view screen">' +
      '<div class="shop-header">' +
        '<div class="gallery-breadcrumb">' +
          '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
          '<span class="cur">Shop</span>' +
        '</div>' +
        '<h1 class="shop-title">The <span class="thin">Vault Shop</span></h1>' +
        '<p class="shop-subtitle">Wear the Peet Pics. Drink from the Peet Pics. Stick the Peet Pics on your laptop. Official Peet Pics merch now available on Fourthwall.</p>' +
      '</div>' +
      '<div class="shop-cta">' +
        '<div class="shop-cta-text">Visit the official store</div>' +
        '<div class="shop-cta-sub">T-shirts, hoodies, mugs, stickers, prints and more — all featuring Pete Pic designs.</div>' +
        '<a class="shop-external-btn" href="' + SHOP_URL + '" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
          'agoodpete-shop.fourthwall.com' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:6px;"><path d="M7 17 17 7M7 7h10v10"/></svg>' +
        '</a>' +
      '</div>' +
      '<div class="shop-features">' +
        '<div class="shop-feature"><div class="shop-feature-icon">👕</div><div class="shop-feature-text">Apparel</div><div class="shop-feature-sub">Tees, hoodies & more</div></div>' +
        '<div class="shop-feature"><div class="shop-feature-icon">☕</div><div class="shop-feature-text">Drinkware</div><div class="shop-feature-sub">Mugs & cups</div></div>' +
        '<div class="shop-feature"><div class="shop-feature-icon">📋</div><div class="shop-feature-text">Stickers</div><div class="shop-feature-sub">Vinyl die-cuts</div></div>' +
        '<div class="shop-feature"><div class="shop-feature-icon">🖼️</div><div class="shop-feature-text">Prints</div><div class="shop-feature-sub">Art prints & posters</div></div>' +
      '</div>' +
    '</div>';

    routeEl.innerHTML = html;
  }

  // ====================================================================
  // SEARCH
  // ====================================================================

  function renderSearch(query) {
    query = (query || '').trim();
    var results = [];
    if (query) {
      var lower = query.toLowerCase();
      results = ARTWORKS.filter(function (w) {
        var title = (w.title || '').toLowerCase();
        var gallery = (w.galleryName || '').toLowerCase();
        return title.indexOf(lower) !== -1 || gallery.indexOf(lower) !== -1;
      });
    }

    var cardsHtml = results.slice(0, 48).map(function (w) {
      return '<a class="artwork-card" href="#/artwork/' + encodeURIComponent(w.id) + '">' +
        '<div class="artwork-card-image">' +
          imgTag(w, 'artwork-card-img', w.title, 'lazy') +
          '<div class="artwork-card-overlay"><span class="artwork-card-overlay-text">View →</span></div>' +
        '</div>' +
        '<div class="artwork-card-info">' +
          '<div class="artwork-card-title">' + escapeHtml(w.title || 'Untitled') + '</div>' +
          '<div class="artwork-card-meta">' + escapeHtml(w.galleryName || '') + '</div>' +
        '</div>' +
      '</a>';
    }).join('');

    var html = '' +
    '<div class="gallery-view screen">' +
      '<div class="gallery-header">' +
        '<div class="gallery-breadcrumb">' +
          '<a href="#/">Peet Pics</a><span class="sep">/</span>' +
          '<span class="cur">Search: "' + escapeHtml(query) + '"</span>' +
        '</div>' +
        '<h1 class="gallery-title" style="--room-color: var(--amber);">Search Results</h1>' +
        '<p class="gallery-tagline">' + results.length + ' work' + (results.length === 1 ? '' : 's') + ' found for "' + escapeHtml(query) + '"' + (results.length > 48 ? ' — showing first 48' : '') + '</p>' +
      '</div>' +
      (results.length > 0 ?
        '<div class="artwork-grid" id="artworkGrid">' + cardsHtml + '</div>' :
        '<div class="gallery-empty"><h3>No results</h3><p>No artworks match "' + escapeHtml(query) + '". Try a different search.</p></div>'
      ) +
    '</div>';

    routeEl.innerHTML = html;
    var grid = document.getElementById('artworkGrid');
    if (grid) observeLazyImages(grid);
  }

  // Wire up the search input
  var searchInput = document.getElementById('searchInput');
  var searchWrap = document.getElementById('searchWrap');
  var searchTimer = null;
  var lastSearchQuery = ''; // preserve input value across re-renders

  if (searchInput) {
    // Restore previous search value if we navigated away and back
    if (lastSearchQuery) {
      searchInput.value = lastSearchQuery;
    }

    searchInput.addEventListener('input', function () {
      var q = this.value.trim();
      lastSearchQuery = this.value; // save raw input (not trimmed)
      if (searchTimer) clearTimeout(searchTimer);
      if (q.length < 2) return; // need at least 2 chars
      searchTimer = setTimeout(function () {
        navigate('#/search/' + encodeURIComponent(q));
      }, 400); // debounce 400ms
    });
    // Also search on Enter
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var q = this.value.trim();
        if (q.length >= 1) navigate('#/search/' + encodeURIComponent(q));
      }
      // Escape collapses the expanded search on mobile
      if (e.key === 'Escape' && searchWrap) {
        searchWrap.classList.remove('expanded');
        searchInput.blur();
      }
    });

    // Mobile: tap the search icon to expand the search bar
    if (searchWrap) {
      // Use a flag to prevent the document click handler from immediately
      // collapsing the search when it was just expanded by the same tap.
      var searchJustExpanded = false;

      searchWrap.addEventListener('click', function (e) {
        // Only intercept clicks on the icon area, not on the input itself
        if (e.target === searchWrap || e.target.tagName === 'svg' || e.target.tagName === 'path' || e.target.tagName === 'circle') {
          if (window.innerWidth <= 600 && !searchWrap.classList.contains('expanded')) {
            e.preventDefault();
            e.stopPropagation();
            searchWrap.classList.add('expanded');
            searchJustExpanded = true;
            setTimeout(function () {
              searchInput.focus();
              searchJustExpanded = false;
            }, 150);
          }
        }
      });

      // Collapse when clicking elsewhere — but not if we just expanded
      document.addEventListener('click', function (e) {
        if (searchJustExpanded) return;
        if (searchWrap.classList.contains('expanded') && !searchWrap.contains(e.target)) {
          searchWrap.classList.remove('expanded');
        }
      }, true); // use capture phase so we run before other handlers

      // Don't collapse when the input itself gains focus or receives input
      searchInput.addEventListener('focus', function () {
        if (window.innerWidth <= 600) {
          searchWrap.classList.add('expanded');
        }
      });
    }
  }

  // ====================================================================
  // LIGHTBOX
  // ====================================================================

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

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    var w = ARTWORKS_BY_ID[currentLightboxId];
    if (!w) return;
    var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
    lightboxContent.innerHTML = '<img src="' + escapeHtml(w.imageUrl) + '" alt="' + escapeHtml(w.title) + '" decoding="async" referrerpolicy="no-referrer" style="max-width:90vw;max-height:85vh;object-fit:contain;opacity:0;transition:opacity 0.4s ease;" onload="this.style.opacity=1" onerror="this.style.opacity=0.15;this.alt=\'unavailable\'">';
    lightboxCaption.innerHTML = '<b>' + escapeHtml(w.title) + '</b> · ' + (idx + 1) + ' / ' + currentLightboxList.length;
  }

  function lightboxPrev() {
    var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
    if (idx === -1) return;
    var newIdx = (idx - 1 + currentLightboxList.length) % currentLightboxList.length;
    currentLightboxId = currentLightboxList[newIdx].id;
    updateLightbox();
  }

  function lightboxNext() {
    var idx = currentLightboxList.findIndex(function (x) { return x.id === currentLightboxId; });
    if (idx === -1) return;
    var newIdx = (idx + 1) % currentLightboxList.length;
    currentLightboxId = currentLightboxList[newIdx].id;
    updateLightbox();
  }

  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightboxPrev').addEventListener('click', function (e) { e.stopPropagation(); lightboxPrev(); });
  document.getElementById('lightboxNext').addEventListener('click', function (e) { e.stopPropagation(); lightboxNext(); });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') lightboxPrev();
    else if (e.key === 'ArrowRight') lightboxNext();
  });

  // ====================================================================
  // HELPERS
  // ====================================================================

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ====================================================================
  // METABALLS BACKGROUND
  // ====================================================================

  var PARAMS = {
    cellSize: 24, maxDotFrac: 0.4, count: 6, blur: 22, sharpness: 18,
    speed: 0.45, maxAlpha: 0.18, baseAlpha: 0.03,
    halftone: [212, 168, 83]
  };

  var canvas = document.getElementById('halftone');
  var ctx = canvas.getContext('2d');
  var svg = document.getElementById('metaballs-svg');
  var group = document.getElementById('metaballs-group');
  var grad = document.getElementById('metaballGrad');

  var size = { w: 0, h: 0, dpr: 1 };
  var metaballs = [];
  var circleEls = [];
  var rafId = 0;

  function rebuildMetaballs() {
    metaballs = [];
    for (var i = 0; i < PARAMS.count; i++) {
      var r = 60 + Math.random() * 70;
      metaballs.push({
        x: r + Math.random() * Math.max(1, size.w - 2 * r),
        y: r + Math.random() * Math.max(1, size.h - 2 * r),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: r
      });
    }
    while (group.firstChild) group.removeChild(group.firstChild);
    circleEls = [];
    var SVGNS = 'http://www.w3.org/2000/svg';
    for (var j = 0; j < PARAMS.count; j++) {
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', size.w / 2);
      c.setAttribute('cy', size.h / 2);
      c.setAttribute('r', 60);
      c.setAttribute('fill', 'url(#metaballGrad)');
      c.setAttribute('opacity', '0.35');
      group.appendChild(c);
      circleEls.push(c);
    }
  }

  function drawHalftone() {
    if (size.w === 0 || size.h === 0) return;
    canvas.width = Math.floor(size.w * size.dpr);
    canvas.height = Math.floor(size.h * size.dpr);
    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    var cell = PARAMS.cellSize;
    var maxR = cell * PARAMS.maxDotFrac;
    var cx = size.w / 2;
    var cy = size.h * 0.35;
    var maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
    var hr = PARAMS.halftone[0], hg = PARAMS.halftone[1], hb = PARAMS.halftone[2];

    for (var y = cell / 2; y < size.h + cell; y += cell) {
      for (var x = cell / 2; x < size.w + cell; x += cell) {
        var dx = x - cx;
        var dy = y - cy;
        var d = Math.sqrt(dx * dx + dy * dy) / maxDist;
        var v = Math.max(0, 1 - d * 1.3);
        v *= 0.55 + 0.45 * Math.sin(x * 0.006 + y * 0.008 + d * 3.2);
        if (v < 0) v = 0; else if (v > 1) v = 1;
        var r = v * maxR;
        if (r < 0.4) continue;
        var alpha = (PARAMS.baseAlpha + v * PARAMS.maxAlpha).toFixed(3);
        ctx.fillStyle = 'rgba(' + hr + ', ' + hg + ', ' + hb + ', ' + alpha + ')';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function resize() {
    size.w = window.innerWidth;
    size.h = Math.max(window.innerHeight, document.body.scrollHeight);
    size.dpr = Math.min(window.devicePixelRatio || 1, 2);
    svg.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
    svg.setAttribute('width', size.w);
    svg.setAttribute('height', size.h);
    grad.setAttribute('x2', size.w);
    grad.setAttribute('y2', size.h);
    if (metaballs.length === 0) rebuildMetaballs();
    drawHalftone();
  }
  window.addEventListener('resize', resize);

  // Update the goo gradient + halftone color based on the current room
  var GOO_COLOR_SETS = {
    default:    ['#d4a853', '#a0522d', '#b5707e'],
    pobots:     ['#d4a853', '#b8922f', '#8a6f1e'],
    prestlers:  ['#d49274', '#a0522d', '#c4473a'],
    cultural:   ['#d9a3b8', '#b5707e', '#9a5f6e'],
    pisc:       ['#9bbf9b', '#6b7c5e', '#4a5d42'],
    submissions:['#b894d9', '#8e6bb0', '#6b4d8e'],
    nacky:       ['#e8c87a', '#d4a853', '#a0522d'],
  };

  function updateGooColors(roomId) {
    var key = GOO_COLOR_SETS[roomId] ? roomId : 'default';
    var colors = GOO_COLOR_SETS[key];
    // Update SVG gradient stops
    var stops = svg.querySelectorAll('stop');
    if (stops.length >= 3) {
      stops[0].setAttribute('stop-color', colors[0]);
      stops[1].setAttribute('stop-color', colors[1]);
      stops[2].setAttribute('stop-color', colors[2]);
    }
    // Update halftone color to the first (lightest) color
    var hex = colors[0];
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    PARAMS.halftone = [r, g, b];
    drawHalftone();
  }

  // Apply goo settings from the controls panel
  function applyGooSettings(settings) {
    if (settings.count !== undefined) PARAMS.count = settings.count;
    if (settings.sizeMin !== undefined || settings.sizeMax !== undefined) {
      // Size range stored as {sizeMin, sizeMax}
    }
    if (settings.opacity !== undefined) {
      for (var i = 0; i < circleEls.length; i++) {
        circleEls[i].setAttribute('opacity', settings.opacity);
      }
    }
    if (settings.speed !== undefined) PARAMS.speed = settings.speed;
    if (settings.blur !== undefined) {
      var blurEl = document.getElementById('goo-blur');
      if (blurEl) blurEl.setAttribute('stdDeviation', settings.blur);
    }
    // Rebuild if count or size changed
    if (settings.count !== undefined || settings.sizeMin !== undefined) {
      rebuildMetaballs();
      // Re-apply opacity after rebuild
      if (settings.opacity !== undefined) {
        for (var j = 0; j < circleEls.length; j++) {
          circleEls[j].setAttribute('opacity', settings.opacity);
        }
      }
    }
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (size.w === 0 || size.h === 0) return;
    for (var i = 0; i < metaballs.length; i++) {
      var b = metaballs[i];
      b.vx *= 0.997; b.vy *= 0.997;
      var v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (v < 0.15) {
        b.vx += (Math.random() - 0.5) * 0.025;
        b.vy += (Math.random() - 0.5) * 0.025;
      }
      if (v > 1.0) { b.vx = (b.vx / v) * 1.0; b.vy = (b.vy / v) * 1.0; }
      b.x += b.vx * PARAMS.speed;
      b.y += b.vy * PARAMS.speed;
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

  // ====================================================================
  // BOOT
  // ====================================================================

  // Show loader immediately, then fetch data
  routeEl.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div><div class="loading-text">Loading the vault…</div></div>';

  resize();
  rebuildMetaballs();
  rafId = requestAnimationFrame(loop);
  setTimeout(resize, 200);

  loadGalleryData()
    .then(function () {
      // Build the navbar dropdown once data is available (so we have real
      // work counts per room), then render the current route.
      buildNavDropdown();
      render();
      // Resize the background multiple times after render to catch
      // the page height changing as content/images load
      setTimeout(resize, 100);
      setTimeout(resize, 500);
      setTimeout(resize, 1500);
      setTimeout(resize, 3000);
    })
    .catch(function (err) {
      console.error('Failed to load gallery data:', err);
      routeEl.innerHTML = '<div class="loading-screen"><div class="loading-text" style="color: var(--danger);">Failed to load the vault.</div><div class="loading-text" style="margin-top: 12px; font-family: var(--mono); font-size: 11px; color: var(--t3);">' + escapeHtml(err.message) + '</div><a class="btn-secondary" href="#/" style="margin-top: 24px;">Retry</a></div>';
    });

  // ====================================================================
  // TWITCH LIVE INDICATOR
  // Checks if AGoodPete is live on Twitch using the DecAPI proxy
  // (https://decapi.me/twitch/uptime/CHANNEL — supports CORS, returns
  //  "CHANNEL is offline" or a duration string like "1h 23m 15s").
  // Polls every 2 minutes.
  // ====================================================================

  var TWITCH_CHANNEL = 'AGoodPete';
  var TWITCH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
  var TWITCH_UPTIME_URL = 'https://decapi.me/twitch/uptime/' + TWITCH_CHANNEL;
  var TWITCH_VIEWERS_URL = 'https://decapi.me/twitch/viewercount/' + TWITCH_CHANNEL;

  var liveIndicator = document.getElementById('twitchLiveIndicator');
  var liveDot = document.getElementById('liveDot');
  var liveText = document.getElementById('liveText');

  function setLiveState(state, label) {
    if (!liveIndicator) return;
    liveIndicator.classList.remove('is-checking', 'is-live', 'is-offline', 'is-error');
    liveIndicator.classList.add('is-' + state);
    if (liveText) liveText.textContent = label;
    // Update tooltip
    if (state === 'live') {
      liveIndicator.title = 'Pete is LIVE on Twitch — click to watch';
    } else if (state === 'offline') {
      liveIndicator.title = 'Pete is offline — click to visit channel';
    } else if (state === 'error') {
      liveIndicator.title = "Can't reach Twitch — click to visit channel";
    } else {
      liveIndicator.title = 'Checking live status...';
    }
  }

  function checkTwitchLive() {
    if (!liveIndicator) return;
    setLiveState('checking', 'Checking');

    fetch(TWITCH_UPTIME_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        // DecAPI returns "AGoodPete is offline" when offline,
        // or a duration string like "1h 2m 3s" when live
        text = text.trim();
        if (text.toLowerCase().indexOf('offline') !== -1) {
          setLiveState('offline', 'Offline');
        } else {
          // Channel is live — text is the uptime duration
          setLiveState('live', 'Live');
          // Optionally fetch viewer count (non-blocking)
          fetch(TWITCH_VIEWERS_URL)
            .then(function (r) { return r.text(); })
            .then(function (viewers) {
              viewers = viewers.trim();
              if (viewers && !isNaN(parseInt(viewers, 10))) {
                if (liveText) liveText.textContent = 'Live · ' + parseInt(viewers, 10).toLocaleString();
              }
            })
            .catch(function () { /* viewer count is optional */ });
        }
      })
      .catch(function (err) {
        console.warn('Twitch live check failed:', err.message);
        setLiveState('error', 'Twitch');
      });
  }

  // Start checking on load + poll every 2 minutes
  checkTwitchLive();
  setInterval(checkTwitchLive, TWITCH_CHECK_INTERVAL);

  // ====================================================================
  // NEXT STREAM PILL — shows the next upcoming show in the top bar
  // ====================================================================

  var nextStreamLabel = document.getElementById('nextStreamLabel');

  function getNextStream() {
    var now = new Date();
    var nowDay = now.getDay(); // 0=Sunday
    var nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Flatten all shows into a list with absolute day+time
    var allShows = [];
    for (var d = 0; d < 7; d++) {
      var checkDay = (nowDay + d) % 7;
      var dayName = Object.keys(DAY_INDEX).find(function (k) { return DAY_INDEX[k] === checkDay; });
      var dayEntry = SCHEDULE.find(function (s) { return s.day === dayName; });
      if (!dayEntry) continue;
      for (var s = 0; s < dayEntry.shows.length; s++) {
        var show = dayEntry.shows[s];
        var showMinutes = show.hour * 60 + (show.minute || 0);
        // If it's today, only include shows that haven't started yet
        // (give a 2-hour window — if a show started less than 2h ago, it might still be live)
        if (d === 0 && showMinutes < nowMinutes - 120) continue;
        var daysAhead = d;
        return {
          title: show.title,
          time: show.time,
          day: dayName,
          daysAhead: daysAhead,
          host: show.host,
        };
      }
    }
    // Fallback: first show of the next week (Monday)
    var monday = SCHEDULE.find(function (s) { return s.day === 'Monday'; });
    if (monday && monday.shows[0]) {
      return { title: monday.shows[0].title, time: monday.shows[0].time, day: 'Monday', daysAhead: 7, host: monday.shows[0].host };
    }
    return null;
  }

  function updateNextStreamPill() {
    if (!nextStreamLabel) return;
    var next = getNextStream();
    if (!next) {
      nextStreamLabel.textContent = 'No schedule';
      return;
    }
    var label;
    if (next.daysAhead === 0) {
      label = next.title + ' · ' + next.time;
    } else if (next.daysAhead === 1) {
      label = 'Tomorrow · ' + next.title;
    } else {
      label = next.day + ' · ' + next.title;
    }
    nextStreamLabel.textContent = label;
  }

  updateNextStreamPill();
  setInterval(updateNextStreamPill, 60000); // update every minute

  // ====================================================================
  // SCROLL PROGRESS BAR
  // ====================================================================

  var scrollProgressBar = document.getElementById('scrollProgressBar');
  function updateScrollProgress() {
    if (!scrollProgressBar) return;
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    scrollProgressBar.style.width = Math.min(100, pct) + '%';
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ====================================================================
  // RECENTLY VIEWED BAR
  // ====================================================================

  var RECENTLY_VIEWED_KEY = 'peetpics_recently_viewed';
  var RECENTLY_VIEWED_MAX = 12;

  function loadRecentlyViewed() {
    try {
      var s = localStorage.getItem(RECENTLY_VIEWED_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return [];
  }

  function saveRecentlyViewed(list) {
    try { localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function addToRecentlyViewed(work) {
    if (!work || !work.id) return;
    var list = loadRecentlyViewed();
    // Remove if already in the list (so it moves to the front)
    list = list.filter(function (w) { return w.id !== work.id; });
    // Add to front
    list.unshift({
      id: work.id,
      title: work.title || 'Untitled',
      thumbUrl: work.thumbUrl || work.imageUrl,
      gallery: work.gallery,
      galleryName: work.galleryName
    });
    // Cap at max
    if (list.length > RECENTLY_VIEWED_MAX) list = list.slice(0, RECENTLY_VIEWED_MAX);
    saveRecentlyViewed(list);
    // Rebuild the nav dropdown so the new item appears
    if (typeof buildNavDropdown === 'function') buildNavDropdown();
  }

  // Call addToRecentlyViewed when viewing an artwork
  var originalRenderArtwork = renderArtwork;
  renderArtwork = function (id) {
    originalRenderArtwork(id);
    var w = ARTWORKS_BY_ID[id];
    if (w) addToRecentlyViewed(w);
  };

  // ====================================================================
  // SLIDESHOW MODE
  // ====================================================================

  var slideshow = document.getElementById('slideshow');
  var slideshowImage = document.getElementById('slideshowImage');
  var slideshowCaptionTitle = document.getElementById('slideshowCaptionTitle');
  var slideshowCaptionMeta = document.getElementById('slideshowCaptionMeta');
  var slideshowCounter = document.getElementById('slideshowCounter');
  var slideshowPlayBtn = document.getElementById('slideshowPlayBtn');
  var slideshowPlayLabel = document.getElementById('slideshowPlayLabel');
  var slideshowSpeedBtn = document.getElementById('slideshowSpeedBtn');
  var slideshowProgressFill = document.getElementById('slideshowProgressFill');

  var slideshowState = {
    works: [],
    index: 0,
    playing: false,
    speed: 5000, // ms per slide
    speedOptions: [3000, 5000, 8000, 12000],
    speedIndex: 1,
    timer: null,
    progressTimer: null
  };

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
    // Fade out, swap, fade in
    slideshowImage.classList.remove('visible');
    setTimeout(function () {
      slideshowImage.src = w.imageUrl || w.thumbUrl;
      slideshowImage.alt = w.title || '';
      slideshowImage.onload = function () { slideshowImage.classList.add('visible'); };
      // Fallback in case onload doesn't fire
      setTimeout(function () { slideshowImage.classList.add('visible'); }, 500);
    }, 300);

    slideshowCaptionTitle.textContent = w.title || 'Untitled';
    var metaParts = [];
    if (w.galleryName) metaParts.push(w.galleryName);
    if (w.width && w.height) metaParts.push(w.width + ' × ' + w.height);
    slideshowCaptionMeta.textContent = metaParts.join(' · ');

    slideshowCounter.textContent = (slideshowState.index + 1) + ' / ' + slideshowState.works.length;

    // Reset progress bar
    if (slideshowProgressFill) slideshowProgressFill.style.width = '0%';

    // If playing, schedule next advance
    if (slideshowState.playing) {
      scheduleSlideshowAdvance();
    }
  }

  function scheduleSlideshowAdvance() {
    if (slideshowState.timer) clearTimeout(slideshowState.timer);
    if (slideshowState.progressTimer) cancelAnimationFrame(slideshowState.progressTimer);

    var startTime = performance.now();
    var duration = slideshowState.speed;

    function tickProgress() {
      var elapsed = performance.now() - startTime;
      var pct = Math.min(100, (elapsed / duration) * 100);
      if (slideshowProgressFill) slideshowProgressFill.style.width = pct + '%';
      if (pct < 100 && slideshowState.playing) {
        slideshowState.progressTimer = requestAnimationFrame(tickProgress);
      }
    }
    slideshowState.progressTimer = requestAnimationFrame(tickProgress);

    slideshowState.timer = setTimeout(function () {
      slideshowNext();
    }, duration);
  }

  function slideshowNext() {
    slideshowState.index = (slideshowState.index + 1) % slideshowState.works.length;
    updateSlideshowSlide();
  }

  function slideshowPrev() {
    slideshowState.index = (slideshowState.index - 1 + slideshowState.works.length) % slideshowState.works.length;
    updateSlideshowSlide();
  }

  function toggleSlideshowPlay() {
    slideshowState.playing = !slideshowState.playing;
    updateSlideshowPlayButton();
    if (slideshowState.playing) {
      scheduleSlideshowAdvance();
    } else {
      if (slideshowState.timer) { clearTimeout(slideshowState.timer); slideshowState.timer = null; }
      if (slideshowState.progressTimer) { cancelAnimationFrame(slideshowState.progressTimer); slideshowState.progressTimer = null; }
    }
  }

  function updateSlideshowPlayButton() {
    if (slideshowState.playing) {
      slideshowPlayLabel.textContent = 'Pause';
      slideshowPlayBtn.classList.add('active');
    } else {
      slideshowPlayLabel.textContent = 'Play';
      slideshowPlayBtn.classList.remove('active');
    }
  }

  function cycleSlideshowSpeed() {
    slideshowState.speedIndex = (slideshowState.speedIndex + 1) % slideshowState.speedOptions.length;
    slideshowState.speed = slideshowState.speedOptions[slideshowState.speedIndex];
    slideshowSpeedBtn.textContent = (slideshowState.speed / 1000) + 's';
    if (slideshowState.playing) scheduleSlideshowAdvance();
  }

  // Wire up slideshow events
  document.getElementById('slideshowClose').addEventListener('click', closeSlideshow);
  document.getElementById('slideshowPrev').addEventListener('click', slideshowPrev);
  document.getElementById('slideshowNext').addEventListener('click', slideshowNext);
  slideshowPlayBtn.addEventListener('click', toggleSlideshowPlay);
  slideshowSpeedBtn.addEventListener('click', cycleSlideshowSpeed);

  // Start slideshow from the current gallery's works
  function startSlideshowFromCurrentGallery() {
    var route = parseRoute();
    var works = [];
    if (route.name === 'gallery') {
      works = WORKS_BY_ROOM[route.room] || ARTWORKS;
    } else if (route.name === 'artwork') {
      var w = ARTWORKS_BY_ID[route.id];
      if (w) works = WORKS_BY_ROOM[w.gallery] || ARTWORKS;
    } else {
      works = ARTWORKS;
    }
    if (works.length === 0) return;

    // Find current artwork index if we're on an artwork page
    var startIndex = 0;
    if (route.name === 'artwork') {
      for (var i = 0; i < works.length; i++) {
        if (works[i].id === route.id) { startIndex = i; break; }
      }
    }
    openSlideshow(works, startIndex);
  }

  // ====================================================================
  // KEYBOARD SHORTCUTS (Slideshow only — goo controls removed for release)
  // ====================================================================

  // Keyboard shortcuts: S for slideshow, arrows/Esc/Space in slideshow
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    // Slideshow keyboard controls (when slideshow is open)
    if (slideshow.classList.contains('open')) {
      switch (e.key) {
        case 'Escape': e.preventDefault(); closeSlideshow(); return;
        case 'ArrowLeft': e.preventDefault(); slideshowPrev(); return;
        case 'ArrowRight': e.preventDefault(); slideshowNext(); return;
        case ' ': e.preventDefault(); toggleSlideshowPlay(); return;
      }
      return;
    }

    // S for slideshow
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      startSlideshowFromCurrentGallery();
    }
  });

  // Render on hash change (will be a no-op until data loads)
  window.addEventListener('hashchange', function () {
    render();
    // Resize background after route change to fill new page height
    setTimeout(resize, 100);
    setTimeout(resize, 500);
    setTimeout(resize, 1500);
  });

  // ====================================================================
  // SECRET THEME — KILL WHA MODE
  // ====================================================================
  var KILL_WHA_GIF = 'data:image/gif;base64,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';

  var konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var konamiPos = 0;
  var killWhaActive = false;

  function activateKillWha() {
    if (killWhaActive) return;
    killWhaActive = true;
    var style = document.createElement('style');
    style.id = 'kill-wha-theme';
    style.textContent = '' +
      'body * { background-image: url("' + KILL_WHA_GIF + '") !important; background-size: contain !important; background-repeat: repeat !important; background-position: center !important; color: transparent !important; text-shadow: none !important; border-color: transparent !important; box-shadow: none !important; outline: none !important; }' +
      'body img, body video, body canvas, body svg { display: none !important; }' +
      'body *::before, body *::after { content: "" !important; background-image: url("' + KILL_WHA_GIF + '") !important; background-size: contain !important; background-repeat: repeat !important; color: transparent !important; }' +
      'body { background-image: url("' + KILL_WHA_GIF + '") !important; background-size: 177px 160px !important; background-repeat: repeat !important; }' +
      '#kill-wha-overlay { position: fixed; inset: 0; z-index: 999999; background-image: url("' + KILL_WHA_GIF + '") !important; background-size: 177px 160px !important; background-repeat: repeat !important; pointer-events: none; animation: killWhaScroll 8s linear infinite; }' +
      '@keyframes killWhaScroll { from { background-position: 0 0; } to { background-position: 177px 160px; } }' +
      '#kill-wha-hint { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 1000000; padding: 10px 20px; background: #000; color: #fff !important; font-family: monospace; font-size: 12px; letter-spacing: 0.1em; border-radius: 100px; border: 2px solid #fff; text-shadow: none !important; }';
    document.head.appendChild(style);
    var overlay = document.createElement('div');
    overlay.id = 'kill-wha-overlay';
    document.body.appendChild(overlay);
    var hint = document.createElement('div');
    hint.id = 'kill-wha-hint';
    hint.textContent = 'KILL WHA MODE \u2014 press Esc to exit';
    document.body.appendChild(hint);
    console.log('%c\ud83d\udc33 KILL WHA MODE ACTIVATED \ud83d\udc33', 'font-size:24px;color:#00ffff;');
  }

  function deactivateKillWha() {
    if (!killWhaActive) return;
    killWhaActive = false;
    var style = document.getElementById('kill-wha-theme');
    if (style) style.remove();
    var overlay = document.getElementById('kill-wha-overlay');
    if (overlay) overlay.remove();
    var hint = document.getElementById('kill-wha-hint');
    if (hint) hint.remove();
  }

  document.addEventListener('keydown', function (e) {
    if (killWhaActive) { if (e.key === 'Escape') deactivateKillWha(); return; }
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var key = e.key;
    var expected = konamiSequence[konamiPos];
    if (key === expected || key.toLowerCase() === expected) {
      konamiPos++;
      if (konamiPos === konamiSequence.length) { activateKillWha(); konamiPos = 0; }
    } else {
      konamiPos = (key === konamiSequence[0] || key.toLowerCase() === konamiSequence[0]) ? 1 : 0;
    }
  });


})();
