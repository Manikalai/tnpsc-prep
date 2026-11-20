import sys, re, requests
u = sys.argv[1]
r = requests.get(u, headers={"User-Agent": "Mozilla/5.0 (saranya-prep personal study)"}, timeout=60)
h = r.text
print("status", r.status_code, "len", len(h))
for pat in [r"__NEXT_DATA__", r"application/json", r"application/ld\+json", r"\.json", r"data-answer", r"Show answer", r"class=\"q", r"<script[^>]+src=\"[^\"]+\""]:
    ms = [m.start() for m in re.finditer(pat, h)]
    print(f"--- {pat}: {len(ms)}")
i = h.find("பிழையான தொடரைக் கண்டறிக")
print("=== around Q1 ===")
print(h[max(0, i - 2500): i + 3500])
for m in re.finditer(r"<script[^>]*>", h):
    print("SCRIPT", m.group(0)[:200])
