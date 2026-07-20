// Cloudflare Pages Function — dynamic OG tags for /artwork/:id
// Crawlers fetch the path (hash fragments are never sent to servers),
// so we serve index.html with og:* tags rewritten to this artwork.
export async function onRequest({ request, env, params }) {
  const id = params.id;
  const origin = new URL(request.url).origin;

  // Load the site shell + the lightweight artwork index
  const [indexResp, htmlResp] = await Promise.all([
    env.ASSETS.fetch(new Request(origin + '/artwork-index.json')),
    env.ASSETS.fetch(new Request(origin + '/index.html')),
  ]);
  let html = await htmlResp.text();
  let work = null;
  try { work = (await indexResp.json())[id] || null; } catch (e) {}

  if (work) {
    const title = work.title || 'Untitled';
    const desc = `From the ${work.galleryName} collection · Peet Pics — The Vault` +
      (work.submitter ? ` · submitted by ${work.submitter.name}` : '');
    const image = work.imageUrl || '';
    const url = origin + '/artwork/' + encodeURIComponent(id);

    html = html
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(title)} — Peet Pics" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`)
      .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${esc(image)}" />`)
      .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${esc(url)}" />`)
      .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(title)} — Peet Pics" />`)
      .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(desc)}" />`)
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} — Peet Pics</title>`);
  }

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}