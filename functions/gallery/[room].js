// Cloudflare Pages Function — dynamic OG tags for /gallery/:room
export async function onRequest({ request, env, params }) {
  const room = params.room;
  const origin = new URL(request.url).origin;

  const [indexResp, htmlResp] = await Promise.all([
    env.ASSETS.fetch(new Request(origin + '/artwork-index.json')),
    env.ASSETS.fetch(new Request(origin + '/index.html')),
  ]);
  let html = await htmlResp.text();
  let index = {};
  try { index = await indexResp.json(); } catch (e) {}

  // Find the first work in this room for the preview image
  const works = Object.values(index).filter(w => w.gallery === room);
  const first = works[0];
  const roomNames = { pobots:'Pobots', prestlers:'Prestlers', cultural:'Cultural Pics', pisc:'Pisc', submissions:'Submissions', nacky:'Nacky Nook', all:'All Works', new:'Recently Added', favourites:'Favourites' };
  const name = roomNames[room] || room;
  const desc = `${works.length} works in the ${name} collection · Peet Pics — The Vault`;
  const image = first ? first.imageUrl : '';

  html = html
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(name)} — Peet Pics" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, (image ? `<meta property="og:image" content="${esc(image)}" />` : `$&`))
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(name)} — Peet Pics" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(desc)}" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(name)} — Peet Pics</title>`);

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}