"""Debug: print the HTML structure of brainkart pages (to write the parser)."""
import re, sys, requests
H = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile"}
for url in sys.argv[1:]:
    r = requests.get(url, headers=H, timeout=60)
    h = r.text
    print(f"\n######## {url} -> {r.status_code} {len(h)} bytes, final {r.url}")
    links = re.findall(r'href="([^"]*/(?:subject|article|menu|materials)/[^"]+)"[^>]*>([^<]{0,120})<', h)
    print("LINKS:", len(links))
    for l, t in links[:60]:
        print("  ", l, "|", t.strip()[:80])
    i = h.find("விடை")
    if i < 0:
        i = h.find("<h1")
    print("---- SNIPPET ----")
    print(h[max(0, i - 3000): i + 3000])
