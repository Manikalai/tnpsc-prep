import sys, requests, fitz
for u in sys.argv[1:]:
    b = requests.get(u, timeout=120, headers={"User-Agent": "Mozilla/5.0"}).content
    d = fitz.open(stream=b, filetype="pdf")
    print(f"\n######## {u.split('/')[-1]} · {len(d)} pages · {len(b)//1024} KB")
    for i in [0, 1, 2, len(d) // 2]:
        if i >= len(d): continue
        p = d[i]
        t = p.get_text()
        print(f"--- page {i+1}: {len(t)} chars text, {len(p.get_images())} images, {len(p.get_drawings())} drawings")
        print(t[:1200])
