-- Fact-check of AI questions against their textbook passage (done by the nightly job).
-- verified: null = not checked yet, 'ok' = passage supports the marked answer, 'fail' = retired.
-- Paste into Supabase → SQL Editor → Run (once). Safe to run again.
alter table questions add column if not exists verified text;
alter table questions add column if not exists verified_at timestamptz;
alter table questions add column if not exists verify_note text;
create index if not exists questions_verify_idx on questions (verified) where origin = 'ai';
