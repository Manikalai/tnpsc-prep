"use client";
// Shows the lesson's actual textbook pages (images of the SCERT PDF pages), so the Tamil, pictures and tables look exactly like the book.
import { useEffect, useState } from "react";
import { bookKey, pageUrl } from "@/lib/book-pages";

export default function BookPages({ book, from, to, pdf }: { book: string; from: number | null; to: number | null; pdf?: string | null }) {
  const [key, setKey] = useState<string | null>(null);
  const [missing, setMissing] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => { bookKey(book).then(setKey); }, [book]);
  if (!from || !to) return <p className="card">இந்தப் பாடத்தின் பக்க எண்கள் இல்லை.</p>;
  const pages = Array.from({ length: Math.min(to - from + 1, 80) }, (_, i) => from + i);
  if (missing >= pages.length || missing >= 3) {
    return (
      <div className="card space-y-2 text-center">
        <p>இந்த நூலின் பக்கங்கள் இன்னும் பயன்பாட்டில் ஏற்றப்படவில்லை.</p>
        <p className="muted">அதுவரை “எளிய குறிப்புகள்” பகுதியைப் படிக்கலாம்{pdf ? " அல்லது PDF-ஐத் திறக்கலாம்" : ""}.</p>
        {pdf && <a className="btn-ghost btn-sm" href={pdf} target="_blank" rel="noreferrer">Read in PDF ↗</a>}
      </div>
    );
  }
  if (!key) return <p className="muted">ஏற்றுகிறது…</p>;
  return (
    <div className="space-y-3">
      <p className="muted text-center">பக்கத்தைத் தொட்டால் பெரிதாகும்</p>
      {pages.map((p) => (
        <figure key={p} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pageUrl(key, p)}
            crossOrigin="anonymous"
            loading="lazy"
            alt={`பக்கம் ${p}`}
            className="block w-full cursor-zoom-in bg-stone-50"
            style={{ aspectRatio: "0.72" }}
            onLoad={(e) => { (e.target as HTMLImageElement).style.aspectRatio = "auto"; }}
            onError={(e) => { (e.target as HTMLImageElement).closest("figure")!.style.display = "none"; setMissing((m) => m + 1); }}
            onClick={() => setZoom(p)}
          />
          <figcaption className="border-t border-stone-100 py-1 text-center text-xs text-stone-400">பக்கம் {p}</figcaption>
        </figure>
      ))}
      {zoom != null && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/90" onClick={() => setZoom(null)}>
          <button className="fixed right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-sm font-bold">✕ Close</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pageUrl(key, zoom)} crossOrigin="anonymous" alt="" className="mx-auto block w-[200%] max-w-none sm:w-full sm:max-w-3xl" />
        </div>
      )}
    </div>
  );
}
