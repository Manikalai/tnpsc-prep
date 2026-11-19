"use client";
// Offline download + auto-update. Everything the app has already generated is copied to the phone:
// question bank, lessons (text, key points, facts, revision), explanations, current affairs, notes, flashcards.
import { idb } from "./offline-db";
import { bookKey, pageUrl, PAGES_CACHE } from "./book-pages";

export type OfflineMeta = {
  serverTime: string;
  exams: { code: string; name_ta: string; total_questions: number; total_marks: number; mark_per_q: number; duration_min: number; exam_date: string | null }[];
  parts: { id: string; exam_code: string; name_ta: string; questions: number; gate_min_marks: number | null; sort: number }[];
  units: { id: string; part_id: string; exam_code: string; name_ta: string; questions: number; subject: string; sort: number }[];
  chapters: { id: number; book: string; std: number; term: string | null; subject: string; section: string | null; chapter_no: number; title_ta: string; page_from: number | null; page_to: number | null; source_url: string | null }[];
  ca: { id: string; ca_date: string; region: string; category: string; title_ta: string; note_ta: string; exam_point_ta: string | null; source_name: string | null; source_url: string | null }[];
  notes: { id: string; unit_id: string; kind: string; title: string; content: string; source_ref: string | null }[];
  flashcards: { id: string; front: string; back: string }[];
  questionCount: number;
};
export type Settings = { stds: number[]; lastSync: string | null; lastFull: string | null; auto: boolean };
export type Progress = (msg: string, pct: number) => void;

const get = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: "no-store" });
  if (r.status === 401) throw new Error("உள்நுழையவும் (login)");
  if (!r.ok) throw new Error(`${url.split("?")[0]} ${r.status}`);
  return r.json();
};

export async function getSettings(): Promise<Settings> {
  return (await idb.get<Settings>("settings")) ?? { stds: [], lastSync: null, lastFull: null, auto: true };
}

async function pullQuestions(since: string | null, progress: Progress, base = 10, span = 40, total = 1) {
  let offset = 0, n = 0;
  for (;;) {
    const { rows, done } = await get<{ rows: unknown[]; done: boolean }>(`/api/offline/questions?offset=${offset}${since ? `&since=${encodeURIComponent(since)}` : ""}`);
    await idb.putMany("questions", rows);
    n += rows.length;
    offset += 1000;
    progress(`வினாக்கள்: ${n}`, base + Math.min(span, (n / Math.max(total, 1)) * span));
    if (done) break;
  }
  return n;
}

async function pullChapters(ids: number[], progress: Progress, base: number, span: number, notesOnly = false) {
  for (let i = 0; i < ids.length; i += 12) {
    const batch = ids.slice(i, i + 12);
    const d = await get<{ texts: { chapter_id: number; rows: { p: number; t: string }[] }[]; notes: unknown[] }>(
      `/api/offline/chapters?ids=${batch.join(",")}${notesOnly ? "&notesOnly=1" : ""}`
    );
    if (d.texts.length) await idb.putMany("chtext", d.texts);
    if (d.notes.length) await idb.putMany("chnotes", d.notes);
    progress(`பாடங்கள்: ${Math.min(i + 12, ids.length)}/${ids.length}`, base + ((i + batch.length) / ids.length) * span);
  }
}

async function pullExplanations(since: string | null) {
  let offset = 0;
  for (;;) {
    const { rows, done } = await get<{ rows: unknown[]; done: boolean }>(`/api/offline/explanations?offset=${offset}${since ? `&since=${encodeURIComponent(since)}` : ""}`);
    await idb.putMany("explanations", rows);
    offset += 500;
    if (done) break;
  }
}

/** Upload tests taken offline. Returns how many were synced. */
export async function syncAttempts() {
  const list = await idb.attempts<{ localId: string }>();
  if (!list.length || !navigator.onLine) return 0;
  const r = await fetch("/api/offline/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attempts: list }) });
  if (!r.ok) return 0;
  const { synced } = await r.json();
  for (const id of synced as string[]) await idb.deleteAttempt(id);
  return (synced as string[]).length;
}

/** Save the real textbook page images of these lessons on the phone (skips pages already saved or not uploaded yet). */
export async function cachePages(chapters: OfflineMeta["chapters"], progress: Progress, base: number, span: number) {
  let cache: Cache;
  try {
    cache = await caches.open(PAGES_CACHE);
  } catch {
    return;
  }
  const keys = new Map<string, string>();
  const urls: string[] = [];
  for (const c of chapters) {
    if (!c.page_from || !c.page_to) continue;
    if (!keys.has(c.book)) keys.set(c.book, await bookKey(c.book));
    for (let p = c.page_from; p <= c.page_to; p++) urls.push(pageUrl(keys.get(c.book)!, p));
  }
  const todo: string[] = [];
  for (const u of [...new Set(urls)]) if (!(await cache.match(u))) todo.push(u);
  let done = 0;
  let missingBooks = 0;
  const work = async () => {
    for (let u = todo.shift(); u; u = todo.shift()) {
      try {
        const r = await fetch(u, { mode: "cors" });
        if (r.ok) await cache.put(u, r);
        else missingBooks++;
      } catch {
        /* next time */
      }
      done++;
      if (done % 20 === 0) progress(`பாடநூல் பக்கங்கள் ${done}/${done + todo.length}`, base + Math.round((span * done) / (done + todo.length)));
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  return missingBooks;
}

/** Download everything for the chosen classes. Replaces the question bank so retired questions disappear. */
export async function fullDownload(stds: number[], progress: Progress) {
  progress("பட்டியலைப் பெறுகிறது…", 2);
  const meta = await get<OfflineMeta>("/api/offline/manifest");
  await idb.set("meta", meta);
  await idb.clear("questions");
  await pullQuestions(null, progress, 5, 40, meta.questionCount);
  const ids = meta.chapters.filter((c) => stds.includes(c.std)).map((c) => c.id);
  await idb.clear("chtext");
  await idb.clear("chnotes");
  await pullChapters(ids, progress, 45, 45);
  progress("விளக்கங்கள்…", 88);
  await pullExplanations(null);
  await cachePages(meta.chapters.filter((c) => stds.includes(c.std)), progress, 90, 9);
  await syncAttempts();
  const s: Settings = { stds, lastSync: meta.serverTime, lastFull: meta.serverTime, auto: (await getSettings()).auto };
  await idb.set("settings", s);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  try {
    const c = await caches.open("tnpsc-v1");
    await c.addAll(["/offline"]);
  } catch {
    /* ignore */
  }
  progress("முடிந்தது", 100);
}

/** Quick update: new questions, new lessons, refreshed notes/summaries, new explanations, today's current affairs. */
export async function incrementalSync(progress: Progress = () => {}) {
  const s = await getSettings();
  if (!s.lastSync) return false;
  if (s.lastFull && Date.now() - new Date(s.lastFull).getTime() > 3 * 864e5) {
    await fullDownload(s.stds, progress); // every 3 days: full refresh so retired / corrected questions are replaced
    return true;
  }
  const meta = await get<OfflineMeta>("/api/offline/manifest");
  await idb.set("meta", meta);
  await pullQuestions(s.lastSync, progress, 10, 40);
  const have = new Set((await idb.all<{ chapter_id: number }>("chtext")).map((t) => t.chapter_id));
  const mine = meta.chapters.filter((c) => s.stds.includes(c.std)).map((c) => c.id);
  const missing = mine.filter((id) => !have.has(id));
  if (missing.length) await pullChapters(missing, progress, 50, 25);
  const notesHave = new Set((await idb.all<{ key: string }>("chnotes")).map((n) => n.key));
  const notesMissing = mine.filter((id) => ["clean", "bookback", "summary", "facts", "revision"].some((k) => !notesHave.has(`${id}:${k}`)));
  if (notesMissing.length) await pullChapters(notesMissing, progress, 75, 15, true);
  await pullExplanations(s.lastSync);
  await cachePages(meta.chapters.filter((c) => s.stds.includes(c.std)), progress, 92, 7);
  await syncAttempts();
  await idb.set("settings", { ...s, lastSync: meta.serverTime });
  progress("முடிந்தது", 100);
  return true;
}

export async function storageInfo() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usedMB: Math.round((e.usage ?? 0) / 1048576), quotaMB: Math.round((e.quota ?? 0) / 1048576) } : null;
  } catch {
    return null;
  }
}
