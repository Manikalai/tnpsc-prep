-- Section inside a subject (History / Geography / Civics / Economics, Physics / Chemistry / Biology …)
-- used by the quiz builder. Paste into Supabase → SQL Editor → Run (once). Safe to run again.
alter table chapters add column if not exists section text;
create index if not exists chapters_section_idx on chapters (std, subject, section);
