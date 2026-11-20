// Offline support: pages you have opened are kept for offline reading; with no connection, unknown pages open the
// offline practice page (/offline), which works from the pack saved on the phone.
const CACHE = "tnpsc-v2"; // pages of the app; textbook page images live in "tnpsc-pages"
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  // textbook page images (Supabase Storage): saved on the phone, served from there first
  if (req.method === "GET" && req.url.includes("/storage/v1/object/public/pages/")) {
    e.respondWith(
      caches.open("tnpsc-pages").then(async (c) => {
        const hit = await c.match(req.url);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type !== "opaque") c.put(req.url, res.clone());
        return res;
      })
    );
    return;
  }
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || req.url.includes("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || req.url.includes("/_next/static/"))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          const page = await caches.match("/offline");
          if (page) return page;
        }
        return new Response("இணைய இணைப்பு இல்லை", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      })
  );
});
