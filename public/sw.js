// Offline support: pages you have opened are kept for offline reading; with no connection, unknown pages open the
// offline practice page (/offline), which works from the pack saved on the phone.
const CACHE = "tnpsc-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
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
