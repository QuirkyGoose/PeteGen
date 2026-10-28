// Cloudflare Pages Function — shareable permalink for a single picture.
//
//   GET /artwork/<id>  →  a real, server-rendered page for that picture
//
// Crawlers (Discord, X, Slack, WhatsApp, iMessage, Google) get complete
// og:* / twitter:* tags pointing at the actual image, so a shared link
// unfurls as the picture instead of a blank card.

import { loadIndex, neighbours, countInRoom, PAGE_HEADERS } from '../_lib/artworks.js';
import { renderArtworkPage, renderNotFoundPage } from '../_lib/page.js';

export async function onRequest({ request, env, params }) {
  const origin = new URL(request.url).origin;
  const id = decodeURIComponent(params.id || '');

  const index = await loadIndex(env, origin);
  const entry = index[id];
  const work = entry ? { id, ...entry } : null;

  if (!work) {
    return new Response(renderNotFoundPage({ origin, id }), {
      status: 404,
      headers: PAGE_HEADERS,
    });
  }

  const { prev, next, position } = neighbours(index, id);

  const html = renderArtworkPage({
    work,
    prev,
    next,
    position,
    total: Object.keys(index).length,
    roomCount: countInRoom(index, work.gallery),
    origin,
  });

  return new Response(html, { status: 200, headers: PAGE_HEADERS });
}
