// Back-fill past days of current affairs (newest first) from TNPSC Thervupettagam's category pages
// (/ta/currentaffairs-category/<cat>/<page>, 15 items a page) plus Dinamalar's sitemap for that date.
// Each day gets its own notes + fact-checked MCQs, exactly like the daily job. Days already done are skipped,
// so the job can be re-run (or run nightly) until the whole range is filled.
//   CA_MONTHS (12)  how far back · CA_MINUTES (300) time budget · CA_MAX_DAYS (400) per run
import "./env";
import { supabaseAdmin } from "../lib/supabase/admin";
import { buildCurrentAffairs, fetchSitemap, tnptCategory, tnptDetail, todayIST, type FeedItem } from "../lib/ca";
import SOURCES from "../data/ca_sources.json";
import { startProgress } from "../lib/progress";

const admin = supabaseAdmin();
const MONTHS = Number(process.env.CA_MONTHS ?? 12);
const deadline = Date.now() + Number(process.env.CA_MINUTES ?? 300) * 60e3;
const MAX_DAYS = Number(process.env.CA_MAX_DAYS ?? 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Src = { name: string; url: string; region: string; type?: string; max?: number; categories?: Record<string, string>; enabled?: boolean };
const tnpt = (SOURCES as Src[]).find((s) => s.type === "tnpt")!;
const dina = (SOURCES as Src[]).find((s) => s.type === "sitemap" && s.enabled !== false);
const base = tnpt.url.replace(/\/$/, "");

const today = todayIST();
const from = new Date(`${today}T00:00:00Z`);
from.setUTCMonth(from.getUTCMonth() - MONTHS);
const oldest = from.toISOString().slice(0, 10);

// 1. days already filled (≥5 notes)
const have = new Map<string, number>();
for (let f = 0; ; f += 1000) {
  const { data } = await admin.from("current_affairs").select("ca_date").gte("ca_date", oldest).range(f, f + 999);
  for (const r of data ?? []) have.set(r.ca_date, (have.get(r.ca_date) ?? 0) + 1);
  if (!data || data.length < 1000) break;
}
const done = (d: string) => (have.get(d) ?? 0) >= 5;
console.log(`range ${oldest} … ${today}; ${[...have.keys()].filter(done).length} days already filled`);

// 2. index Thervupettagam items by date (walk each category's pages back to the oldest date)
const byDate = new Map<string, { title: string; link: string; region: string }[]>();
const seen = new Set<string>();
for (const [cat, region] of Object.entries(tnpt.categories ?? {})) {
  let n = 0;
  for (let page = 1; page <= 400; page++) {
    let items: { title: string; link: string; pubDate?: string }[] = [];
    try {
      items = await tnptCategory(base, cat, page);
    } catch (e) {
      console.log(`  ${cat} p${page}: ${e instanceof Error ? e.message : e}`);
      await sleep(3000);
      try { items = await tnptCategory(base, cat, page); } catch { break; }
    }
    if (!items.length) break;
    let older = 0;
    for (const it of items) {
      const d = it.pubDate?.slice(0, 10);
      if (!d) continue;
      if (d < oldest) { older++; continue; }
      const key = it.link.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      byDate.set(d, [...(byDate.get(d) ?? []), { title: it.title, link: it.link, region }]);
      n++;
    }
    if (older === items.length) break; // whole page is older than the range
    await sleep(400);
  }
  console.log(`  ${cat}: ${n} items`);
}
const days = [...byDate.keys()].filter((d) => d < today && !done(d)).sort().reverse().slice(0, MAX_DAYS);
console.log(`${byDate.size} dates found on Thervupettagam; ${days.length} to fill (newest first)`);

// 3. fill each day
const prog = await startProgress(admin, "ca_backfill", "பழைய நடப்பு நிகழ்வுகள்", days.length);
let ok = 0, fails = 0;
const log: string[] = [];
for (const day of days) {
  if (Date.now() > deadline - 4 * 60e3) { console.log("time budget used; the next run continues"); break; }
  const items: FeedItem[] = [];
  for (const it of (byDate.get(day) ?? []).slice(0, tnpt.max ?? 40)) {
    let summary = "";
    try { summary = await tnptDetail(it.link); } catch { /* headline only */ }
    items.push({ title: it.title, summary: summary.slice(0, 1500), link: it.link, source: tnpt.name, region: it.region, published: day, guide: true });
    await sleep(250);
  }
  if (dina) {
    try {
      const news = (await fetchSitemap(dina.url, day)).filter((x) => x.title).slice(0, dina.max ?? 25);
      for (const x of news) items.push({ title: x.title, summary: "", link: x.link, source: dina.name, region: dina.region, published: day });
    } catch { /* Thervupettagam alone is enough */ }
  }
  try {
    const r = await buildCurrentAffairs(admin, items, day);
    ok++; fails = 0;
    const line = `${day}: ${items.length} items → ${r.notes} notes, ${r.mcqs} MCQs (${r.provider})`;
    console.log(line); log.push(line);
  } catch (e) {
    fails++;
    const line = `${day}: failed (${e instanceof Error ? e.message.slice(0, 150) : e})`;
    console.log(line); log.push(line);
    if (fails >= 5) { console.log("5 failures in a row (AI busy); stopping, the next run continues"); break; }
    await sleep(30000);
  }
  await prog.update({ done: ok, failed: fails, current: day });
  await sleep(Number(process.env.CA_SLEEP_MS ?? 2000));
}
await prog.update({ done: ok, finished: true }, true);
await admin.from("job_runs").insert({ job: "ca_backfill", ok: ok > 0 || !days.length, detail: { days: ok, remaining: days.length - ok, log: log.slice(-60) } });
console.log(`done: ${ok} days filled, ${days.length - ok} left`);
