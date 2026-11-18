-- Chapters (பாடங்கள்) of each textbook, and per-chapter study material.
-- Paste into Supabase → SQL Editor → Run (once). Safe to run again.

create table if not exists chapters (
  id bigserial primary key,
  book text not null,                 -- e.g. "10ஆம் வகுப்பு சமூக அறிவியல்"
  std int not null,
  term text,                          -- 1/2/3 for Std 6–7 term books, null otherwise
  subject text not null,              -- tamil | social | science
  chapter_no int not null,
  title_ta text not null,
  page_from int,
  page_to int,
  source_url text,                    -- PDF link, opened at page_from for reading
  created_at timestamptz not null default now(),
  unique (book, subject, chapter_no)
);
create index if not exists chapters_std_idx on chapters (std, term, subject);

alter table textbook_chunks add column if not exists chapter_id bigint references chapters(id) on delete cascade;
create index if not exists textbook_chunks_chapter_idx on textbook_chunks (chapter_id, page_from);

alter table questions add column if not exists chapter_id bigint references chapters(id) on delete set null;
create index if not exists questions_chapter_idx on questions (chapter_id) where chapter_id is not null;

-- summary | facts | revision  (generated once, shared by both of you)
create table if not exists chapter_notes (
  chapter_id bigint not null references chapters(id) on delete cascade,
  kind text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key (chapter_id, kind)
);

alter table chapters enable row level security;
alter table chapter_notes enable row level security;
drop policy if exists read_all on chapters;
create policy read_all on chapters for select to authenticated using (true);
drop policy if exists read_all on chapter_notes;
create policy read_all on chapter_notes for select to authenticated using (true);
