// Finding textbook passages for a topic.
// 1) meaning search (pgvector) when passages have embeddings;
// 2) otherwise — or when the embedding quota is used up — lesson + keyword search:
//    syllabus unit → matching subjects/sections (History, Civics, …) → lessons → passages that contain the topic's words.
import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "./ai";

export type Passage = { id: number; book: string; std: number; subject: string; page_from: number | null; content: string; chapter_id?: number | null };

const SECTIONS_FOR: Record<string, string[] | null> = {
  history: ["history"], polity: ["civics"], economy: ["economics"], geography: ["geography"],
  tn: ["history", "literature", "prose"], current: null, science: null, tamil: null,
};
const STOP = new Set(["மற்றும்", "ஆகியவை", "தொடர்பான", "செய்திகள்", "அறிதல்", "குறித்த", "முதல்", "வரை", "இந்திய", "இந்தியா", "தமிழ்நாடு", "தமிழ்நாட்டின்"]);

/** Topic words → short stems that survive Tamil suffixes (உரிமைகள் → உரிமை). */
export function keywords(text: string) {
  return [...new Set(
    text
      .replace(/[()–\-,;:.]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .map((w) => w.replace(/(கள்|களின்|களை|களுக்கு|த்தின்|த்தை|ின்|ில்|ுக்கு|ை)$/u, ""))
      .filter((w) => w.length >= 3)
  )].slice(0, 8);
}

let vectorsAvailable: boolean | null = null;

export async function findPassages(
  admin: SupabaseClient,
  opts: { text: string; subjects?: string[] | null; unitSubject?: string | null; maxStd?: number; count?: number }
): Promise<Passage[]> {
  const count = opts.count ?? 6;
  const maxStd = opts.maxStd ?? 12;

  // 1) vector search (skipped quickly once we know there are no embeddings / no quota)
  if (vectorsAvailable !== false) {
    try {
      const [vec] = await embed([opts.text], "RETRIEVAL_QUERY");
      const subjects = opts.subjects?.length ? [...opts.subjects, ...(opts.subjects.some((s) => s === "science" || s === "social") ? ["sciso"] : [])] : null;
      const { data } = await admin.rpc("match_chunks", { query_embedding: vec as unknown as string, match_count: count * 3, subjects, max_std: maxStd });
      const rows = (data ?? []) as Passage[];
      if (rows.length) {
        vectorsAvailable = true;
        return rows.sort(() => Math.random() - 0.5).slice(0, count);
      }
      vectorsAvailable = false;
    } catch {
      vectorsAvailable = false;
    }
  }

  // 2) lessons for this subject/section, then keyword search inside them
  let cq = admin.from("chapters").select("id,section").lte("std", maxStd).limit(2000);
  if (opts.subjects?.length) cq = cq.in("subject", opts.subjects);
  const { data: chs } = await cq;
  const want = opts.unitSubject ? SECTIONS_FOR[opts.unitSubject] : null;
  let chapterIds = (chs ?? []).filter((c) => !want || !c.section || want.includes(c.section)).map((c) => c.id);
  if (!chapterIds.length) chapterIds = (chs ?? []).map((c) => c.id);
  if (!chapterIds.length) return [];

  const words = keywords(opts.text);
  const cols = "id,book,std,subject,page_from,content,chapter_id";
  let hits: Passage[] = [];
  if (words.length) {
    const { data } = await admin
      .from("textbook_chunks")
      .select(cols)
      .in("chapter_id", chapterIds.slice(0, 400))
      .or(words.map((w) => `content.ilike.%${w.replace(/[%,()]/g, "")}%`).join(","))
      .limit(200);
    hits = ((data ?? []) as Passage[])
      .map((p) => ({ p, score: words.reduce((s, w) => s + (p.content.includes(w) ? 1 : 0), 0) + Math.random() * 0.5 }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }
  if (hits.length < count) {
    // fill with random passages from the same lessons
    const pick = chapterIds.sort(() => Math.random() - 0.5).slice(0, 6);
    const { data } = await admin.from("textbook_chunks").select(cols).in("chapter_id", pick).limit(60);
    const extra = ((data ?? []) as Passage[]).filter((p) => !hits.some((h) => h.id === p.id)).sort(() => Math.random() - 0.5);
    hits = [...hits, ...extra];
  }
  return hits.slice(0, count);
}
