// Lists that are the same for every user and change only when a job runs (lessons, question counts,
// which lesson tabs are ready). Kept in the server cache for a few minutes instead of being read from
// the database on every page visit. Pages read 1000-row chunks in parallel on a cache miss.
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "./supabase/admin";

export type ChapterRow = { id: number; book: string; std: number; term: string | null; subject: string; section: string | null; chapter_no: number; title_ta: string };

type Q = PromiseLike<{ data: unknown[] | null; count?: number | null }>;
/** count first, then all 1000-row pages at once */
async function allRows<T>(head: () => Q, page: (from: number, to: number) => Q): Promise<T[]> {
  const { count } = await head();
  const n = Math.min(count ?? 0, 200000);
  const pages = await Promise.all(Array.from({ length: Math.ceil(n / 1000) }, (_, i) => page(i * 1000, i * 1000 + 999)));
  return pages.flatMap((p) => (p.data ?? []) as T[]);
}

export const chapterList = unstable_cache(
  async (): Promise<ChapterRow[]> => {
    const sb = supabaseAdmin();
    const rows = await allRows<ChapterRow>(
      () => sb.from("chapters").select("id", { count: "exact", head: true }),
      (a, b) => sb.from("chapters").select("id,book,std,term,subject,section,chapter_no,title_ta").order("std").order("term").order("chapter_no").order("id").range(a, b),
    );
    return rows.sort((x, y) => x.std - y.std || String(x.term ?? "").localeCompare(String(y.term ?? "")) || x.chapter_no - y.chapter_no || x.id - y.id);
  },
  ["chapter-list-v1"],
  { revalidate: 1800, tags: ["chapters"] },
);

/** active questions per lesson */
export const questionCounts = unstable_cache(
  async (): Promise<Record<number, number>> => {
    const sb = supabaseAdmin();
    const base = () => sb.from("questions").select("chapter_id", { count: "exact", head: true }).not("chapter_id", "is", null).eq("status", "active");
    const rows = await allRows<{ chapter_id: number }>(base, (a, b) =>
      sb.from("questions").select("chapter_id").not("chapter_id", "is", null).eq("status", "active").order("id").range(a, b),
    );
    const out: Record<number, number> = {};
    for (const r of rows) out[r.chapter_id] = (out[r.chapter_id] ?? 0) + 1;
    return out;
  },
  ["question-counts-v1"],
  { revalidate: 600, tags: ["questions"] },
);

/** how many prepared tabs (notes, book-back, …) each lesson has */
export const notesReady = unstable_cache(
  async (): Promise<Record<number, number>> => {
    const sb = supabaseAdmin();
    const rows = await allRows<{ chapter_id: number }>(
      () => sb.from("chapter_notes").select("chapter_id", { count: "exact", head: true }),
      (a, b) => sb.from("chapter_notes").select("chapter_id").order("chapter_id").order("kind").range(a, b),
    );
    const out: Record<number, number> = {};
    for (const r of rows) out[r.chapter_id] = (out[r.chapter_id] ?? 0) + 1;
    return out;
  },
  ["notes-ready-v1"],
  { revalidate: 300, tags: ["notes"] },
);
