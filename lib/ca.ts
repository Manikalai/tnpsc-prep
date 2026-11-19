// Daily current affairs in Tamil: collect headlines from feeds, let the AI pick exam-relevant items,
// write short Tamil notes + an exam point for each, then make 5 Tamil MCQs.
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateJSON } from "./ai";
import { glossaryText, loadGlossary, qHash, validate } from "./questions";
import SOURCES from "../data/ca_sources.json";

export type FeedItem = { title: string; summary: string; link: string; source: string; region: string; published?: string; guide?: boolean };
type Source = { name: string; url: string; region: string; enabled?: boolean; type?: "rss" | "sitemap" | "html" | "tnpt"; guide?: boolean; max?: number; categories?: Record<string, string> };

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

async function fetchFeed(url: string): Promise<{ title: string; link: string; description?: string; pubDate?: string }[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (TNPSC-prep personal study app)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const xml = await res.text();
  const p = new XMLParser({ ignoreAttributes: false });
  const doc = p.parse(xml);
  const items = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  return (Array.isArray(items) ? items : [items]).map((it: Record<string, unknown>) => ({
    title: strip(String((it.title as { "#text"?: string })?.["#text"] ?? it.title ?? "")),
    link: String((it.link as { "@_href"?: string })?.["@_href"] ?? it.link ?? ""),
    description: strip(String(it.description ?? it.summary ?? "")),
    pubDate: String(it.pubDate ?? it.published ?? it.updated ?? ""),
  }));
}

const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;

/** A daily news sitemap (e.g. Dinamalar's sitemap_DD-MM-YYYY.xml): article links with their headlines. */
async function fetchSitemap(url: string) {
  const now = new Date(Date.now() + 5.5 * 3600e3);
  const res = await fetch(url.replace("{DD-MM-YYYY}", dmy(now)), { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const doc = new XMLParser({ ignoreAttributes: false }).parse(await res.text());
  const urls = doc?.urlset?.url ?? [];
  return (Array.isArray(urls) ? urls : [urls]).map((u: Record<string, unknown>) => {
    const news = (u["news:news"] ?? {}) as Record<string, unknown>;
    const img = (u["image:image"] ?? {}) as Record<string, unknown>;
    return {
      title: strip(String(news["news:title"] ?? img["image:title"] ?? "")),
      link: String(u.loc ?? ""),
      description: "",
      pubDate: String(news["news:publication_date"] ?? u.lastmod ?? ""),
    };
  });
}

/** A plain listing page (coaching site's daily current affairs): headline links + the text right after each. */
async function fetchListing(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const html = await res.text();
  const out: { title: string; link: string; description: string; pubDate?: string }[] = [];
  const rx = /<h[23][^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>([\s\S]{0,1500}?)(?=<h[23]|$)/gi;
  for (let m; (m = rx.exec(html)); ) {
    const title = strip(m[2]);
    if (title.length < 8) continue;
    out.push({ title, link: m[1], description: strip(m[3]).slice(0, 500) });
  }
  return out;
}

// ───────── TNPSC Thervupettagam (tnpscthervupettagam.com): daily TNPSC current affairs in Tamil, by category ─────────
const MONTHS: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

async function getHtml(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ta,en;q=0.8" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

/** Items on one category page: <h3>title</h3> … <span class="calendar">November 19, 2026</span> … <a title="Continue Reading …" href="…/currentaffairs-detail/…">. */
async function tnptCategory(base: string, cat: string) {
  const html = await getHtml(`${base}/ta/currentaffairs-category/${cat}`);
  const out: { title: string; link: string; pubDate?: string }[] = [];
  const rx = /<h3>([\s\S]{1,400}?)<\/h3>[\s\S]{0,800}?class="calendar">[\s\S]{0,200}?([A-Z][a-z]+)\s+(\d{1,2})\s*,\s*(\d{4})[\s\S]{0,4000}?title="Continue Reading[^"]*"\s+href="([^"]+currentaffairs-detail[^"]+)"/g;
  for (let m; (m = rx.exec(html)); ) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month == null) continue;
    out.push({
      title: decode(strip(m[1])),
      link: m[5].startsWith("http") ? m[5] : base + m[5],
      pubDate: new Date(Date.UTC(Number(m[4]), month, Number(m[3]))).toISOString(),
    });
  }
  return out;
}

/** The article text of one item (its bullet points). */
async function tnptDetail(link: string) {
  const html = await getHtml(link);
  const at = html.indexOf("view-currentaffairs");
  const part = (at >= 0 ? html.slice(at, at + 20000) : html).replace(/<\/li>|<\/p>|<br\s*\/?>/gi, " • ");
  const text = decode(strip(part.replace(/^[^>]*>/, "")));
  return text.replace(/(\s*•\s*)+/g, " • ").trim().slice(0, 1800);
}

async function fetchTnpt(s: Source, cutoff: number) {
  const base = s.url.replace(/\/$/, "");
  const items: { title: string; link: string; description: string; pubDate?: string; region: string }[] = [];
  for (const [cat, region] of Object.entries(s.categories ?? {})) {
    try {
      for (const it of await tnptCategory(base, cat)) {
        const t = it.pubDate ? Date.parse(it.pubDate) : NaN;
        if (Number.isNaN(t) || t < cutoff - 864e5) continue; // date-only, so allow the previous day too
        items.push({ ...it, description: "", region });
      }
    } catch {
      /* one category failing is fine */
    }
  }
  const uniq = [...new Map(items.map((i) => [i.link.split("?")[0], i])).values()].slice(0, s.max ?? 40);
  for (const it of uniq) {
    try {
      it.description = await tnptDetail(it.link);
    } catch {
      /* headline only */
    }
  }
  return uniq;
}

export async function collect(hours = 36): Promise<{ items: FeedItem[]; log: string[] }> {
  const log: string[] = [];
  const cutoff = Date.now() - hours * 3600e3;
  const all: FeedItem[] = [];
  for (const s of SOURCES as Source[]) {
    if (s.enabled === false) continue;
    try {
      const items: { title: string; link: string; description?: string; pubDate?: string; region?: string }[] =
        s.type === "tnpt" ? await fetchTnpt(s, cutoff) : s.type === "sitemap" ? await fetchSitemap(s.url) : s.type === "html" ? await fetchListing(s.url) : await fetchFeed(s.url);
      let n = 0;
      for (const it of items) {
        const t = it.pubDate ? Date.parse(it.pubDate) : NaN;
        if (!Number.isNaN(t) && t < cutoff) continue;
        if (!it.title) continue;
        if (n >= (s.max ?? 40)) break;
        all.push({ title: it.title, summary: (it.description ?? "").slice(0, s.guide ? 1500 : 400), link: it.link, source: s.name, region: it.region ?? s.region, published: it.pubDate, guide: s.guide });
        n++;
      }
      log.push(`${s.name}: ${n}`);
    } catch (e) {
      log.push(`${s.name}: failed (${e instanceof Error ? e.message : e})`);
    }
  }
  // de-duplicate by normalised title
  const seen = new Set<string>();
  const items = all.filter((i) => {
    const k = i.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 60);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // TNPSC coaching-site picks first (they mark what is exam-worthy), then the newspapers / PIB
  items.sort((a, b) => Number(!!b.guide) - Number(!!a.guide));
  return { items: items.slice(0, 110), log };
}

const CATEGORIES = "திட்டங்கள், நியமனங்கள், விருதுகள், அறிவியல் தொழில்நுட்பம், விளையாட்டு, பொருளாதாரம், அரசியலமைப்பு–சட்டம், சுற்றுச்சூழல், முக்கிய நாட்கள், உலகம், பிற";

type Note = { region: "tn" | "india"; category: string; title_ta: string; note_ta: string; exam_point_ta: string; source_index: number };

/** Turn collected items (or text pasted by the user) into Tamil notes and MCQs and store them. */
export async function buildCurrentAffairs(admin: SupabaseClient, items: FeedItem[], date = todayIST()) {
  if (!items.length) return { notes: 0, mcqs: 0, provider: null as string | null };
  const glossary = await loadGlossary(admin);
  const list = items.map((it, i) => `[${i}] ${it.guide ? "★TNPSC " : ""}(${it.source}; ${it.region}) ${it.title}${it.summary ? ` — ${it.summary}` : ""}`).join("\n");

  const system = `You prepare daily current affairs notes for TNPSC Group 1, 2 and 4 candidates who study in Tamil medium.
Write in simple, formal Tamil as used in TNPSC papers. Official terms: ${glossaryText(glossary)}.
From the numbered news items:
- Items marked ★TNPSC were picked by TNPSC coaching teachers as exam-relevant and come with the article text: include all of them (merge duplicates), keep their facts (names, numbers, places, dates, static GK points), and use the newspaper items only to add detail on the same events.
- Then keep only other items useful for the exam: government schemes and decisions, appointments, awards, reports and indices, science and space, sports results, economy, important days, constitutional and legal changes, environment, Tamil Nadu government orders and announcements, major international events involving India.
- Drop crime, gossip, party politics without a policy decision, and film news.
- Merge items that are about the same event.
- Use ONLY facts written in the items. Never add numbers, names or dates that are not in them. If a detail is unclear, leave it out.
- region: "tn" for Tamil Nadu news, "india" for national/international.
- category: one of ${CATEGORIES}.
- note_ta: 2–4 short Tamil sentences. exam_point_ta: one line starting with what is most likely to be asked.
- At most 35 notes, Tamil Nadu first.
Return JSON: {"notes":[{"region":"tn","category":"","title_ta":"","note_ta":"","exam_point_ta":"","source_index":0}]}`;

  const r = await generateJSON<{ notes: Note[] }>({ system, user: list, temperature: 0.3 });
  const notes = (r.data.notes ?? []).filter((n) => n && n.title_ta && n.note_ta);
  const rows = notes.map((n) => {
    const src = items[n.source_index] ?? items[0];
    return {
      ca_date: date,
      region: n.region === "tn" ? "tn" : "india",
      category: n.category || "பிற",
      title_ta: n.title_ta.trim(),
      note_ta: n.note_ta.trim(),
      exam_point_ta: n.exam_point_ta?.trim() ?? null,
      source_name: src?.source ?? null,
      source_url: src?.link ?? null,
      hash: createHash("sha1").update(date + n.title_ta).digest("hex"),
    };
  });
  if (rows.length) await admin.from("current_affairs").upsert(rows, { onConflict: "hash", ignoreDuplicates: true });

  // 5 MCQs from today's notes
  let mcqs = 0;
  if (rows.length >= 3) {
    const notesText = rows.map((n, i) => `[${i}] ${n.title_ta}: ${n.note_ta}`).join("\n");
    try {
      const q = await generateJSON<{ questions: unknown[] }>({
        system: `Write 5 TNPSC-style multiple choice questions in Tamil from these current affairs notes. Use only facts in the notes. Exactly 4 options, one correct. explanation in Tamil.
Return JSON: {"questions":[{"stem":"","options":["","","",""],"answer_index":0,"explanation":"","source":0}]}`,
        user: notesText,
        temperature: 0.4,
      });
      const qrows = (q.data.questions ?? [])
        .map((x) => validate(x))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .map((x) => ({
          stem: x.stem,
          options: x.options,
          answer_index: x.answer_index,
          explanation: x.explanation,
          origin: "ca",
          ca_date: date,
          source_ref: `நடப்பு நிகழ்வுகள் ${date}`,
          hash: qHash(x.stem, x.options),
        }));
      if (qrows.length) {
        const { data } = await admin.from("questions").upsert(qrows, { onConflict: "hash", ignoreDuplicates: true }).select("id");
        mcqs = data?.length ?? 0;
      }
    } catch {
      /* notes are still saved */
    }
  }
  return { notes: rows.length, mcqs, provider: r.provider };
}

export async function runDaily(admin: SupabaseClient) {
  const date = todayIST();
  const { items, log } = await collect();
  let out = { notes: 0, mcqs: 0, provider: null as string | null };
  let ok = true;
  let error: string | undefined;
  try {
    out = await buildCurrentAffairs(admin, items, date);
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }
  await admin.from("job_runs").insert({ job: "daily_ca", ok, detail: { date, collected: items.length, log, ...out, error } });
  return { ok, date, collected: items.length, log, ...out, error };
}
