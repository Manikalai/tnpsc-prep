# TNPSC தயாரிப்பு — Tamil-medium prep app for Group 1, 2/2A and 4

A free, installable web app (PWA) for two people preparing for TNPSC exams in Tamil medium.

**What's inside**

| Feature | Where |
|---|---|
| Syllabus tracker for Group 4, Group 2/2A and Group 1 (Tamil), per-topic status for each of you | பாடத்திட்டம் |
| Topic / unit quiz generated from the Tamil Samacheer textbooks | பாடத்திட்டம் → "வினா" |
| Full 200-question mock test following each exam's blueprint, 3-hour timer, Group 4 Tamil 60/150 gate | மாதிரித் தேர்வு |
| Results by part and unit, explanations, textbook reference, "report wrong" button | after each test |
| Wrong answers come back after 1, 3, 7, 15, 30, 60 days | திருப்புதல் |
| Daily Tamil current affairs (Tamil Nadu first, then India) + 5 MCQs, monthly printable compilation | நடப்பு நிகழ்வுகள் |
| Mnemonics, one-page summaries, tables, flashcards made from the textbooks | நினைவுக் குறிப்புகள், நினைவு அட்டைகள் |
| Aptitude methods + shortcuts in Tamil, timed drills with computed (always correct) answers | திறனறிவு |
| Weak-unit analysis, previous-year frequency by unit and year | பகுப்பாய்வு |
| Day-by-day plan counted back from the exam date | படிப்புத் திட்டம் |
| Ask a doubt, answered from the textbooks with page references | பாடநூலிடம் கேள் |
| Group 1 Mains answer-writing practice with AI marking | முதன்மைத் தேர்வு |
| Question bank status, previous-year import, reported questions | வினா வங்கி |

**Free stack:** Next.js on Vercel (Hobby) · Supabase (Postgres + pgvector + password login) · Gemini API free tier (Groq / OpenRouter as fallbacks) · GitHub Actions for the daily and nightly jobs.

---

## Setup (about 30 minutes, once)

### 1. Supabase — database
1. supabase.com → **New project** → name `tnpsc-prep`, region **South Asia (Mumbai)**, save the database password.
2. **SQL Editor → New query** → paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
3. New query again → paste all of [`supabase/seed/0002_seed.sql`](supabase/seed/0002_seed.sql) → **Run**. (Loads the syllabus for all three exams and the Tamil glossary.)
4. New query again → paste all of [`supabase/migrations/0003_chapters.sql`](supabase/migrations/0003_chapters.sql) → **Run**. (Chapter-wise textbook structure.)
   Then the same for [`supabase/migrations/0004_explanations.sql`](supabase/migrations/0004_explanations.sql) (saved explanations) [`supabase/migrations/0005_chapter_sections.sql`](supabase/migrations/0005_chapter_sections.sql) (quiz builder sections) and [`supabase/migrations/0006_verification.sql`](supabase/migrations/0006_verification.sql) (fact-check).
5. **Project Settings → API Keys**: copy the **Project URL**, the **anon / publishable** key and the **service_role / secret** key.

### 2. Supabase — the two logins
1. **Authentication → Users → Add user → Create new user**: enter your email and a password, tick **Auto Confirm User**, click **Create user**. Do the same for your wife.
2. **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**, so nobody else can create an account.
3. Log in to the app with that email and password. To change a password later: Users → click the user → **Reset password** / update.

### 3. AI keys
- **Gemini** (main): aistudio.google.com → **Get API key** → Create.
- **Groq** (backup, optional): console.groq.com → API Keys → Create.
- **OpenRouter** (2nd backup, optional): openrouter.ai → Keys.

### 4. Vercel — hosting
vercel.com → **Sign up with GitHub** → **Add New → Project** → import `tnpsc-prep` → open **Environment Variables** and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
| `ALLOWED_EMAILS` | `you@gmail.com,wife@gmail.com` (only these can use the app) |
| `GEMINI_API_KEY` | Gemini key |
| `GROQ_API_KEY` | Groq key (optional) |
| `OPENROUTER_API_KEY` | OpenRouter key (optional) |
| `CRON_SECRET` | any long random text |

Optional: `GEMINI_MODELS` (comma-separated, tried in order; default `gemini-3.8-flash,gemini-3.5-flash,gemini-flash-latest,gemini-2.5-flash,gemini-3.5-flash-lite`), `GEMINI_EMBED_MODEL` (default `gemini-embedding-001`), `GROQ_MODEL` (default `openai/gpt-oss-120b`), `OPENROUTER_MODELS` (comma-separated `:free` model ids), `AI_PROVIDERS` (default `gemini,groq,openrouter`).

Click **Deploy**. Open the URL on both phones → browser menu → **Add to Home screen**.

### 5. GitHub — scheduled jobs
Repo → **Settings → Secrets and variables → Actions → New repository secret**, add:
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, and (optional) `GROQ_API_KEY`, `OPENROUTER_API_KEY`.

Jobs (see the **Actions** tab):
- **Daily current affairs (Tamil)** — 05:47 IST every day. Also keeps the free Supabase project from pausing.
- **Nightly question bank** — 02:17 IST, tops up every unit to 3× its share of the paper (Group 4 first). Run it by hand once now: Actions → Nightly question bank → **Run workflow**.
- **Load textbooks** — run by hand after step 6.

### 6. Textbooks (the most important step for question quality)
1. Open `textbooks/manifest.csv` and add one line per **Tamil-medium** Samacheer book: Std 6–10 for Group 4, plus 11–12 for Groups 1 and 2. Subjects: `social`, `science`, `tamil`, `maths`. The `source` is either the direct PDF link from the official TN textbook site, or a PDF you upload into the `textbooks/` folder.
2. Actions → **Load textbooks** → tick **Only check text extraction** → Run. Open the log: each book prints a sample paragraph. If the Tamil looks broken, those pages are OCR'd automatically.
3. Run it again without the tick to load everything. Re-running is safe; finished books are skipped.

Until textbooks are loaded, AI questions are marked **⚠ பாடநூல் ஆதாரம் இல்லை** — check those answers.

---

## Quality checks before trusting the questions
1. **Tamil quality per AI model:** generate 20 questions on the same units with each provider (set `AI_PROVIDERS=gemini`, then `groq`, …) and read them together. Keep only models whose Tamil and terms are right in `AI_PROVIDERS`.
2. **Report** any wrong question from the result page; fix or remove it in **வினா வங்கி**.
3. **Previous-year papers:** download Tamil-version papers and answer keys from tnpsc.gov.in, run `python scripts/pyq_to_json.py paper.pdf --key key.txt --exam G4 --year 2024 > out.json`, check `out.json`, paste it into **வினா வங்கி → முந்தைய ஆண்டு வினாக்களைச் சேர்**. Answers come from the official key, never from the AI.
4. **Blueprints:** unit question counts marked "(தோராயம்)" are estimates where TNPSC doesn't print a count. Once previous-year papers are imported, adjust `data/syllabus.ts`, run `npx tsx scripts/make_seed_sql.ts` and re-run the seed SQL.

## Local development
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
npm test                     # offline checks (aptitude answers, blueprint totals)
npm run ca                   # run the current affairs job once
npm run bank                 # add questions to the bank
```

## How it fits together
```
Phone / laptop (PWA, Tamil) ──► Next.js on Vercel ──► Supabase (Postgres, pgvector, auth)
                                     │
                                     └──► AI router: Gemini → Groq → OpenRouter
GitHub Actions: daily current affairs · nightly question bank · textbook loader (PDF → text/OCR → embeddings)
```
Questions are written from retrieved textbook passages (RAG), validated (4 distinct options, Tamil text), de-duplicated by hash and cached, so free AI limits go a long way. Aptitude questions are computed by code.

## Limits to know
- Free tiers change; Gemini's free quota is per project. If AI calls fail, the app says so and the nightly job stops early and continues the next night.
- Vercel Hobby is for personal, non-commercial use, which this is.
- Current affairs come from Google News Tamil search feeds and PIB; only headlines and short descriptions are used and every note links to the source. Paste a TN DIPR release or Government Order into "செய்தியை நீங்களே சேர்க்க" to add it.
