// Cloudflare Pages Function — shareable room link.
//
//   GET /gallery/<room>  →  the SPA shell, with og:* tags rewritten so the
//                           link unfurls as that collection.
//
// The client router is hash-based (#/room/<id>), so we also nudge the browser
// onto the right hash — otherwise /gallery/pobots would land on the homepage.

import { loadIndex, roomMeta, countInRoom, esc, PAGE_HEADERS } from '../_lib/artworks.js';

export async function onRequest({ request, env, params }) {
  const origin = new URL(request.url).origin;
  const roomId = decodeURIComponent(params.room || '');

  const [htmlResp, index] = await Promise.all([
    env.ASSETS.fetch(new Request(origin + '/index.html')),
    loadIndex(env, origin),
  ]);

  let html = await htmlResp.text();
  const room = roomMeta(roomId);
  const works = Object.values(index).filter((w) => w.gallery === roomId);
  const first = works[0];

  const url = origin + '/gallery/' + encodeURIComponent(roomId);
  const title = `${room.name} — Peet Pics`;
  const description = `${works.length} works in the ${room.name} collection · ${room.tagline}`;

  html = upsert(html, [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ]);

  if (first) {
    html = upsert(html, [
      ['property', 'og:image', first.imageUrl],
      ['property', 'og:image:alt', `${room.name} — a work from the collection`],
      ['name', 'twitter:image', first.imageUrl],
      ['name', 'twitter:card', 'summary_large_image'],
    ]);
  }

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);

  const canonical = `<link rel="canonical" href="${esc(url)}" />`;
  html = /<link rel="canonical"/i.test(html)
    ? html.replace(/<link rel="canonical"[^>]*>/, canonical)
    : html.replace('</head>', `  ${canonical}\n</head>`);

  html = html.replace(
      /<body([^>]*)>/,
      `<body$1><script>(function(){var r=${JSON.stringify(roomId)};` +
        `if(location.hash.indexOf("#/room/")!==0){location.hash="#/room/"+r;` +
        `try{history.replaceState(null,"","/#/room/"+r)}catch(e){}}})();</script>`
    );

  return new Response(html, { status: 200, headers: PAGE_HEADERS });
}

function upsert(html, tags) {
  for (const [attr, key, content] of tags) {
    const tag = `<meta ${attr}="${key}" content="${esc(content)}" />`;
    const re = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, 'i');
    html = re.test(html) ? html.replace(re, tag) : html.replace('</head>', `  ${tag}\n</head>`);
  }
  return html;
}
