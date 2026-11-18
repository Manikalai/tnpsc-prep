-- Detailed AI explanations for questions (written once on first request, then reused).
-- Paste into Supabase → SQL Editor → Run (once). Safe to run again.
create table if not exists question_explanations (
  question_id uuid primary key references questions(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now()
);
alter table question_explanations enable row level security;
drop policy if exists read_all on question_explanations;
create policy read_all on question_explanations for select to authenticated using (true);
