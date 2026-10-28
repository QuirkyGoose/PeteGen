// Server-rendered shell for /artwork/:id — the page people actually land on
// when someone shares a picture. Deliberately standalone: no React bundle,
// no 900 KB payload, and every meta tag is real HTML so Discord, X, WhatsApp,
// Slack and iMessage unfurl the picture itself.

import { SITE, roomMeta, esc, formatDate, accessionLabel, permalink } from './artworks.js';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap';

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='46' fill='%23070605'/%3E%3Ccircle cx='50' cy='50' r='46' fill='none' stroke='%23c9a24b' stroke-width='4'/%3E%3Ctext x='50' y='68' font-size='52' text-anchor='middle' fill='%23c9a24b' font-family='Georgia,serif' font-style='italic'%3EP%3C/text%3E%3C/svg%3E";

const CSS = `
:root{--ink:#070605;--ink-2:#0c0a08;--ink-3:#14110c;--bone:#f2ede3;--fog:rgba(242,237,227,.56);--ash:rgba(242,237,227,.34);--faint:rgba(242,237,227,.16);--brass:#c9a24b;--brass-hi:#ecd28c;--line:rgba(242,237,227,.09);--line-soft:rgba(242,237,227,.05);--tone:#c9a24b;--mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--display:"Instrument Serif",Georgia,"Times New Roman",serif}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--ink);color:var(--bone);font-family:"Geist",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:300;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(120% 70% at 50% -12%,rgba(201,162,75,.11),transparent 62%)}
a{color:inherit;text-decoration:none}
img{max-width:100%}
.wrap{width:100%;max-width:1340px;margin:0 auto;padding:0 24px;position:relative;z-index:1}

/* ── top bar ── */
.top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0 18px;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:11px}
.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:1px solid rgba(201,162,75,.55);background:var(--ink-2);font-family:var(--display);font-style:italic;font-size:19px;line-height:1;color:var(--brass);padding-bottom:2px}
.brand-txt{display:flex;flex-direction:column;line-height:1.1}
.brand-txt b{font-family:var(--display);font-weight:400;font-size:17px;letter-spacing:.01em}
.brand-txt i{font-family:var(--mono);font-style:normal;font-size:8px;letter-spacing:.34em;text-transform:uppercase;color:var(--ash);margin-top:3px}
.top-links{display:flex;align-items:center;gap:26px;font-family:var(--mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--ash)}
.top-links a{transition:color .25s}
.top-links a:hover{color:var(--brass-hi)}
.top-links .cta{color:var(--brass);border:1px solid rgba(201,162,75,.4);padding:9px 14px;border-radius:2px}
.top-links .cta:hover{background:rgba(201,162,75,.1);color:var(--brass-hi)}

/* ── breadcrumb ── */
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:26px 0 0;font-family:var(--mono);font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--faint)}
.crumbs a{color:var(--ash);transition:color .25s}
.crumbs a:hover{color:var(--brass)}
.crumbs .sep{color:var(--faint)}
.crumbs .cur{color:var(--fog);max-width:60ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── layout ── */
.layout{display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:44px;align-items:start;padding:26px 0 72px}
.frame{margin:0;padding:10px;border:1px solid rgba(201,162,75,.22);border-radius:3px;background:linear-gradient(180deg,var(--ink-2),var(--ink));box-shadow:0 40px 90px -40px rgba(0,0,0,.95),inset 0 0 0 1px rgba(242,237,227,.03)}
.frame a{display:flex;align-items:center;justify-content:center;cursor:zoom-in}
.frame img{display:block;width:100%;height:auto;max-height:min(74vh,860px);object-fit:contain}
.caption{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;font-family:var(--mono);font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--faint)}
.caption a{color:var(--ash);border-bottom:1px solid var(--line);padding-bottom:2px;transition:color .25s,border-color .25s}
.caption a:hover{color:var(--brass);border-color:rgba(201,162,75,.5)}

/* ── plaque ── */
.plaque{position:sticky;top:24px;border:1px solid var(--line);border-top:2px solid var(--tone);border-radius:3px;background:linear-gradient(180deg,rgba(20,17,12,.92),rgba(10,9,7,.94));padding:24px 24px 22px;backdrop-filter:blur(6px)}
.eyebrow{font-family:var(--mono);font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--tone)}
h1{margin:12px 0 0;font-family:var(--display);font-weight:400;font-size:clamp(27px,2.6vw,38px);line-height:1.03;letter-spacing:-.005em;color:var(--bone)}
.sub{margin:10px 0 0;font-size:12.5px;line-height:1.6;color:var(--fog)}
.room-link{display:inline-block;margin-top:12px;font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--brass);border-bottom:1px solid rgba(201,162,75,.35);padding-bottom:2px}
.room-link:hover{color:var(--brass-hi)}

.meta{margin:22px 0 0;padding:0;border-top:1px solid var(--line-soft)}
.meta-row{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--line-soft)}
.meta-row dt{font-family:var(--mono);font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--faint);margin:0}
.meta-row dd{margin:0;font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--fog);text-align:right}
.meta-row dd.hot{color:var(--bone)}

/* ── actions ── */
.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 10px;border:1px solid var(--line);border-radius:2px;background:transparent;color:var(--fog);font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;transition:border-color .25s,color .25s,background .25s;-webkit-appearance:none}
.btn:hover{border-color:rgba(201,162,75,.5);color:var(--brass-hi);background:rgba(201,162,75,.06)}
.btn:active{transform:translateY(1px)}
.btn.primary{border-color:rgba(201,162,75,.55);background:rgba(201,162,75,.1);color:var(--brass-hi)}
.btn.primary:hover{background:rgba(201,162,75,.18)}
.btn svg{width:12px;height:12px;flex:none}
.btn.wide{grid-column:1/-1}
.btn[hidden]{display:none}
.urlbox{margin-top:12px;padding:10px 11px;border:1px dashed var(--line);border-radius:2px;font-family:var(--mono);font-size:9px;line-height:1.5;color:var(--ash);word-break:break-all;cursor:pointer;transition:color .25s,border-color .25s}
.urlbox:hover{color:var(--fog);border-color:rgba(201,162,75,.35)}

/* ── pager ── */
.pager{display:flex;align-items:stretch;gap:8px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line-soft)}
.pager a{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;padding:10px 11px;border:1px solid var(--line);border-radius:2px;transition:border-color .25s,background .25s}
.pager a:hover{border-color:rgba(201,162,75,.45);background:rgba(201,162,75,.05)}
.pager .dir{font-family:var(--mono);font-size:8px;letter-spacing:.26em;text-transform:uppercase;color:var(--faint)}
.pager .ttl{font-family:var(--display);font-size:14px;line-height:1.2;color:var(--fog);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pager a:hover .ttl{color:var(--brass-hi)}
.pager .next{text-align:right}
.pager .off{opacity:.32;pointer-events:none}

/* ── footer ── */
.foot{margin-top:auto;border-top:1px solid var(--line);padding:20px 0 26px}
.foot-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font-family:var(--mono);font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--faint)}
.foot-in a{color:var(--ash);transition:color .25s}
.foot-in a:hover{color:var(--brass)}

/* ── toast ── */
#toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,14px);z-index:60;padding:11px 18px;border:1px solid rgba(201,162,75,.45);border-radius:2px;background:rgba(12,10,8,.96);color:var(--brass-hi);font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}
#toast.on{opacity:1;transform:translate(-50%,0)}

@media (max-width:960px){
  .layout{grid-template-columns:1fr;gap:26px;padding-bottom:52px}
  .plaque{position:static}
  .top-links{display:none}
  .frame img{max-height:62vh}
  .crumbs{padding-top:20px}
}
@media (max-width:560px){
  .wrap{padding:0 16px}
  .plaque{padding:20px 18px}
  .actions{grid-template-columns:1fr}
  .btn.wide{grid-column:auto}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const ICON = {
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>',
};

function head({ title, description, url, image, imageWidth, imageHeight, imageAlt, type = 'article', tone = '#c9a24b' }) {
  const img = image
    ? `<meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:alt" content="${esc(imageAlt || title)}" />
    ${imageWidth ? `<meta property="og:image:width" content="${imageWidth}" />` : ''}
    ${imageHeight ? `<meta property="og:image:height" content="${imageHeight}" />` : ''}
    <meta name="twitter:image" content="${esc(image)}" />
    <meta name="twitter:image:alt" content="${esc(imageAlt || title)}" />`
    : '';

  return `<meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta name="theme-color" content="#070605" />
  <link rel="icon" href="${FAVICON}" />
  <meta property="og:type" content="${esc(type)}" />
  <meta property="og:site_name" content="${SITE.name} — ${SITE.subtitle}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  ${img}
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT_HREF}" rel="stylesheet" />`;
}

function brand() {
  return `<a class="brand" href="/">
        <span class="mark">P</span>
        <span class="brand-txt"><b>${SITE.name}</b><i>${SITE.subtitle}</i></span>
      </a>`;
}

function footer(total) {
  return `<footer class="foot"><div class="wrap"><div class="foot-in">
      <span>${SITE.name} — ${SITE.subtitle}${total ? ` · ${total.toLocaleString('en-GB')} works archived` : ''}</span>
      <span><a href="/#/archive">Browse the archive →</a></span>
    </div></div></footer>`;
}

const SCRIPT = `<script>
(function(){
  var toastEl=document.getElementById('toast'),t;
  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(t);t=setTimeout(function(){toastEl.classList.remove('on')},1900);}
  function fallbackCopy(text,msg){
    var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,text.length);
    try{document.execCommand('copy');toast(msg);}catch(e){window.prompt('Copy this link:',text);}
    ta.remove();
  }
  function copy(text,msg){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){toast(msg);},function(){fallbackCopy(text,msg);});
    }else{fallbackCopy(text,msg);}
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'),function(el){
    el.addEventListener('click',function(e){
      e.preventDefault();
      copy(el.getAttribute('data-copy'),el.getAttribute('data-msg')||'Copied');
    });
  });
  var shareBtn=document.getElementById('nativeShare');
  if(shareBtn){
    if(navigator.share){shareBtn.hidden=false;}
    shareBtn.addEventListener('click',function(){
      navigator.share({title:document.title,text:shareBtn.getAttribute('data-text'),url:location.href})
        .catch(function(){});
    });
  }
  document.addEventListener('keydown',function(e){
    if(e.target&&/input|textarea/i.test(e.target.tagName))return;
    var prev=document.getElementById('prevLink'),next=document.getElementById('nextLink');
    if(e.key==='ArrowLeft'&&prev)location.href=prev.href;
    if(e.key==='ArrowRight'&&next)location.href=next.href;
  });
})();
</script>`;

function pager(prev, next) {
  const cell = (work, dir) =>
    work
      ? `<a id="${dir === 'prev' ? 'prevLink' : 'nextLink'}" class="${dir}" href="/artwork/${encodeURIComponent(work.id)}">
          <span class="dir">${dir === 'prev' ? '← Previous' : 'Next →'}</span>
          <span class="ttl">${esc(work.title)}</span>
        </a>`
      : `<a class="${dir} off" href="#" tabindex="-1" aria-disabled="true">
          <span class="dir">${dir === 'prev' ? '← Previous' : 'Next →'}</span>
          <span class="ttl">—</span>
        </a>`;

  return `<div class="pager">${cell(prev, 'prev')}${cell(next, 'next')}</div>`;
}

export function renderArtworkPage({ work, prev, next, position, total, roomCount, origin }) {
  const room = roomMeta(work.gallery);
  const url = permalink(origin, work.id);
  const image = work.imageUrl;
  const title = `${work.title} — ${SITE.name}`;
  const description =
    `${work.title} · ${room.name} (Room ${room.numeral}) · ${accessionLabel(work.accession)} · ` +
    `from ${SITE.name}, the permanent archive of Peet-adjacent artwork.`;

  const credit = work.submitter
    ? `<div class="meta-row"><dt>Submitted by</dt><dd>${esc(work.submitter.name)}${
        work.submitter.handle ? ` · @${esc(work.submitter.handle)}` : ''
      }</dd></div>`
    : '';

  const dims = work.width && work.height ? `${work.width} × ${work.height}` : 'Unknown';
  const acquired = formatDate(work.addedAt);

  const html = `<!doctype html>
<html lang="en">
<head>
  ${head({
    title,
    description,
    url,
    image,
    imageWidth: work.width || null,
    imageHeight: work.height || null,
    imageAlt: work.title,
    tone: room.tone,
  })}
  <style>${CSS}</style>
</head>
<body style="--tone:${room.tone}">
  <div class="wrap">
    <header class="top">
      ${brand()}
      <nav class="top-links">
        <a href="/#/archive">Archive</a>
        <a href="/#/programme">Programme</a>
        <a class="cta" href="/#/">Enter the Vault →</a>
      </nav>
    </header>
  </div>

  <main class="wrap" style="flex:1">
    <nav class="crumbs">
      <a href="/">${SITE.name}</a><span class="sep">/</span>
      <a href="/#/room/${esc(work.gallery)}">${esc(room.name)}</a><span class="sep">/</span>
      <span class="cur">${esc(work.title)}</span>
    </nav>

    <div class="layout">
      <div>
        <figure class="frame">
          <a href="${esc(image)}" target="_blank" rel="noreferrer" title="Open full resolution">
            <img src="${esc(image)}" alt="${esc(work.title)}" width="${work.width || ''}" height="${
    work.height || ''
  }" fetchpriority="high" decoding="async" />
          </a>
        </figure>
        <div class="caption">
          <span>${accessionLabel(work.accession)} · ${esc(room.name)}</span>
          <a href="${esc(image)}" target="_blank" rel="noreferrer">Full resolution ↗</a>
        </div>
      </div>
      <div>
        <aside class="plaque">
          <div class="eyebrow">${esc(room.name)} · Room ${esc(room.numeral)}</div>
          <h1>${esc(work.title)}</h1>
          <p class="sub">${esc(room.tagline)}</p>
          <a class="room-link" href="/#/room/${esc(work.gallery)}">View all ${roomCount} in ${esc(room.name)} →</a>

          <dl class="meta">
            <div class="meta-row"><dt>Catalogue</dt><dd class="hot">#${esc(work.id)}</dd></div>
            <div class="meta-row"><dt>Accession</dt><dd>${accessionLabel(work.accession)}</dd></div>
            <div class="meta-row"><dt>Collection</dt><dd>${esc(room.name)}</dd></div>
            <div class="meta-row"><dt>Dimensions</dt><dd>${dims}</dd></div>
            ${acquired ? `<div class="meta-row"><dt>Acquired</dt><dd>${esc(acquired)}</dd></div>` : ''}
            ${credit}
            <div class="meta-row"><dt>Hosted on</dt><dd>${SITE.host}</dd></div>
          </dl>

          <div class="actions">
            <button class="btn primary" type="button" data-copy="${esc(url)}" data-msg="Link copied">${ICON.link} Copy link</button>
            <button class="btn" type="button" data-copy="${esc(image)}" data-msg="Image link copied">${ICON.image} Image link</button>
            <a class="btn" href="${esc(image)}" download target="_blank" rel="noreferrer">${ICON.download} Download</a>
            <a class="btn" href="${esc(image)}" target="_blank" rel="noreferrer">${ICON.external} Original</a>
            <button class="btn wide" id="nativeShare" type="button" hidden data-text="${esc(work.title)}">${ICON.share} Share…</button>
          </div>

          <div class="urlbox" data-copy="${esc(url)}" data-msg="Link copied" title="Click to copy">${esc(url)}</div>

          ${pager(prev, next)}
          <div style="margin-top:14px;font-family:var(--mono);font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--faint)">
            ${position} of ${total.toLocaleString('en-GB')} in the archive
          </div>
        </aside>
      </div>
    </div>
  </main>

  ${footer(total)}
  <div id="toast" role="status" aria-live="polite"></div>
  ${SCRIPT}
</body>
</html>`;

  return html;
}

export function renderNotFoundPage({ origin, id }) {
  const url = origin + '/artwork/' + encodeURIComponent(id || '');
  const html = `<!doctype html>
<html lang="en">
<head>
  ${head({
    title: `Not in the vault — ${SITE.name}`,
    description: 'This catalogue number is not in the Peet Pics archive.',
    url,
    image: null,
    type: 'website',
  })}
  <style>${CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">${brand()}
      <nav class="top-links"><a class="cta" href="/#/">Enter the Vault →</a></nav>
    </header>
  </div>
  <main class="wrap" style="flex:1;display:flex;align-items:center;padding:80px 0">
    <div class="plaque" style="max-width:560px;margin:0 auto;text-align:center">
      <div class="eyebrow" style="color:var(--ash)">Catalogue #${esc(id || '—')}</div>
      <h1>Not in the vault</h1>
      <p class="sub">That catalogue number isn't in the archive. It may have been re-catalogued, or the link may be a typo.</p>
      <div class="actions" style="grid-template-columns:1fr">
        <a class="btn primary" href="/#/archive">Browse the archive →</a>
      </div>
    </div>
  </main>
  ${footer(0)}
</body>
</html>`;
  return html;
}
