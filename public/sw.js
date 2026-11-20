// Offline support.
// - The offline practice page (/offline) and its code are saved on the phone ahead of time ("warm"), so the
//   app opens with no internet: opening the app (/) offline goes straight to offline practice, which works
//   from the pack downloaded on the phone (books, notes, quizzes, current affairs).
// - Pages she has opened are kept; with no connection they open from the phone.
// - On a weak signal a page waits up to 6 seconds for the network, then shows its saved copy (if it has one).
const CACHE = "tnpsc-v3"; // pages + app code; textbook page images live in "tnpsc-pages"
const PAGES = "tnpsc-pages";

async function warm() {
  try {
    const c = await caches.open(CACHE);
    for (const url of ["/offline", "/"]) {
      const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok || new URL(res.url).pathname.startsWith("/login")) continue; // not signed in yet
      const html = await res.clone().text();
      await c.put(url, res);
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
      await Promise.all(assets.map(async (a) => { if (!(await c.match(a))) await c.add(a).catch(() => {}); }));
    }
  } catch { /* offline now: try next time */ }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE && k !== PAGES) await caches.delete(k);
    await self.clients.claim();
    await warm();
  })()),
);
self.addEventListener("message", (e) => { if (e.data === "warm") e.waitUntil(warm()); });

const OFFLINE_HTML = `<!doctype html><html lang="ta"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Saranya Prep</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf4e8;font-family:'Mukta Malar','Noto Sans Tamil',sans-serif;text-align:center;padding:24px">
<div><div style="font-size:52px">🪔</div><p style="color:#7a1414;font-weight:700;font-size:20px;margin:12px 0 4px">வேல் உண்டு வினை இல்லை</p>
<p style="color:#57534e">இணைய இணைப்பு இல்லை, சரண்யா.</p>
<a href="/offline" style="display:inline-block;margin-top:14px;padding:12px 20px;border-radius:14px;background:linear-gradient(90deg,#8a1717,#ec7f1f);color:#fff;font-weight:700;text-decoration:none">Offline practice</a></div></body></html>`;

function timeout(p, ms) {
  return new Promise((ok, no) => { const t = setTimeout(() => no(new Error("slow")), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); no(e); }); });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // textbook page images (Supabase Storage): saved on the phone, served from there first
  if (req.method === "GET" && req.url.includes("/storage/v1/object/public/pages/")) {
    e.respondWith(
      caches.open(PAGES).then(async (c) => {
        const hit = await c.match(req.url);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type !== "opaque") c.put(req.url, res.clone());
        return res;
      }),
    );
    return;
  }
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // app code never changes under the same name: phone copy first
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  const isPage = req.mode === "navigate";
  const net = fetch(req).then((res) => {
    if (res.ok && isPage && !new URL(res.url).pathname.startsWith("/login")) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  });
  e.respondWith(
    (isPage ? timeout(net, 6000) : net).catch(async (err) => {
      if (isPage) {
        const slow = err && err.message === "slow";
        const hit = await caches.match(req, { ignoreSearch: true });
        if (slow) return hit || net; // weak signal: saved copy of this page if any, else keep waiting
        const offline = await caches.match("/offline");
        if (url.pathname === "/offline" && offline) return offline;
        if (url.pathname === "/" && offline) return Response.redirect("/offline", 302); // opening the app with no internet
        if (hit) return hit;
        if (offline) return Response.redirect("/offline", 302);
        return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      const hit = await caches.match(req);
      return hit || new Response("", { status: 503 });
    }),
  );
});
