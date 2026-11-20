"use client";
// The lesson's actual textbook pages (images of the SCERT PDF pages), so the Tamil, pictures and tables look exactly like the book.
// Margins are trimmed so the text is bigger; tapping a page opens the full-screen Kindle-style reader.
import { useEffect, useState } from "react";
import { IconBook2 } from "@tabler/icons-react";
import { bookKey, pageUrl } from "@/lib/book-pages";
import BookReader, { CroppedPage } from "@/components/BookReader";

export default function BookPages({ book, from, to, pdf }: { book: string; from: number | null; to: number | null; pdf?: string | null }) {
  const [key, setKey] = useState<string | null>(null);
  const [missing, setMissing] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const store = `${book}:${from}`;
  useEffect(() => { bookKey(book).then(setKey); }, [book]);
  useEffect(() => { try { const v = Number(localStorage.getItem(`read:${store}`)); if (v) setLast(v); } catch {} }, [store, open]);
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
  const resume = last && pages.includes(last) && last !== pages[0] ? last : null;
  return (
    <div className="space-y-3">
      <button onClick={() => setOpen(resume ?? pages[0])} className="btn flex w-full items-center justify-center gap-2 !py-3 text-[16px]">
        <IconBook2 size={22} /> {resume ? `Continue reading · page ${resume}` : "Read full screen"}
      </button>
      <p className="muted text-center text-[13px]">Swipe to turn pages · pinch or double-tap to zoom</p>
      {pages.map((p, n) => (
        <figure key={p} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" onClick={() => setOpen(p)}>
          <ProbePage src={pageUrl(key, p)} probe={n < 3} onMissing={() => setMissing((m) => m + 1)}>
            <CroppedPage src={pageUrl(key, p)} alt={`பக்கம் ${p}`} />
          </ProbePage>
          <figcaption className="border-t border-stone-100 py-1 text-center text-xs text-stone-400">பக்கம் {p}</figcaption>
        </figure>
      ))}
      {open != null && <BookReader pages={pages} urlOf={(p) => pageUrl(key, p)} start={open} storeKey={store} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** hides a page whose image does not exist (book not loaded yet) */
function ProbePage({ src, probe, onMissing, children }: { src: string; probe: boolean; onMissing: () => void; children: React.ReactNode }) {
  const [bad, setBad] = useState(false);
  useEffect(() => {
    if (!probe) return;
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onerror = () => { setBad(true); onMissing(); };
    im.src = src;
  }, [src, probe]); // eslint-disable-line react-hooks/exhaustive-deps
  return bad ? null : <>{children}</>;
}
