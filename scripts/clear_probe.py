import sys, re, requests
u = sys.argv[1]
r = requests.get(u, headers={"User-Agent": "Mozilla/5.0 (saranya-prep personal study)"}, timeout=60)
r.encoding = "utf-8"
h = r.text
print("status", r.status_code, "len", len(h))
for pat in [r"__NEXT_DATA__", r"application/json", r"application/ld\+json", r"\.json", r"data-answer", r"Show answer", r"class=\"q", r"<script[^>]+src=\"[^\"]+\""]:
    ms = [m.start() for m in re.finditer(pat, h)]
    print(f"--- {pat}: {len(ms)}")
i = h.find("Show answer")
print("=== around Q1 ===")
print(h[max(0, i - 4000): i + 1500])
j = h.find("Show answer", h.find("Show answer", i + 20) + 20)
print("=== Q3 ===")
print(h[max(0, j - 2500): j + 800])
for m in re.finditer(r"<script>(.{0,600})", h, re.S):
    print("SCRIPT", m.group(1)[:600])
