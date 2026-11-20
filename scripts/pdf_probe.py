import sys, requests, fitz, subprocess, tempfile, os
for spec in sys.argv[1:]:
    u, pages = spec.split("#")
    b = requests.get(u, timeout=180, headers={"User-Agent": "Mozilla/5.0"}).content
    d = fitz.open(stream=b, filetype="pdf")
    print(f"\n######## {u.split('/')[-1]} · {len(d)} pages")
    for i in [int(x) - 1 for x in pages.split(",")]:
        pix = d[i].get_pixmap(dpi=300)
        f = tempfile.mktemp(suffix=".png"); pix.save(f)
        out = subprocess.run(["tesseract", f, "-", "-l", "tam+eng", "--psm", "4"], capture_output=True, text=True).stdout
        print(f"--- page {i+1} ({pix.width}x{pix.height}) OCR:\n{out[:3000]}")
