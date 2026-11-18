-- TNPSC Prep: full schema. Paste into Supabase → SQL Editor → Run (once).
create extension if not exists vector;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ───────────────────────── people ─────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  target_exam text not null default 'G4',
  exam_date date,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name) values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────── syllabus & blueprint ─────────────────────────
create table if not exists exams (
  code text primary key,                -- G1, G2, G4
  name_ta text not null,
  stage text not null default 'prelims',
  total_questions int not null,
  total_marks numeric not null,
  mark_per_q numeric not null default 1.5,
  duration_min int not null default 180,
  exam_date date,
  notes_ta text
);

create table if not exists parts (
  id text primary key,                  -- G4-TAMIL, G4-GS ...
  exam_code text not null references exams(code) on delete cascade,
  sort int not null,
  name_ta text not null,
  questions int not null,
  gate_min_marks numeric                -- G4 Tamil part: 60 of 150
);

create table if not exists units (
  id text primary key,                  -- G4-GS-4
  part_id text not null references parts(id) on delete cascade,
  exam_code text not null references exams(code) on delete cascade,
  sort int not null,
  name_ta text not null,
  questions int not null,
  approx boolean not null default false, -- true = count not printed in the official syllabus
  standard text not null,               -- SSLC / Degree
  subject text not null,                -- science, geography, history, polity, economy, tn, tamil, aptitude, reasoning, current
  source_subjects text[] not null default '{}' -- textbook subjects used for retrieval
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references units(id) on delete cascade,
  sort int not null,
  name_ta text not null,
  unique (unit_id, sort)
);

-- ───────────────────────── textbooks (RAG) ─────────────────────────
create table if not exists textbook_chunks (
  id bigserial primary key,
  book text not null,                   -- e.g. "10ஆம் வகுப்பு சமூக அறிவியல்"
  std int not null,
  subject text not null,                -- science, social, tamil, maths
  term text,
  page_from int,
  page_to int,
  content text not null,
  quality text not null default 'text', -- text | ocr
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index if not exists textbook_chunks_subject_idx on textbook_chunks (subject, std);
create index if not exists textbook_chunks_trgm on textbook_chunks using gin (content gin_trgm_ops);
create index if not exists textbook_chunks_vec on textbook_chunks using hnsw (embedding vector_cosine_ops);

create or replace function match_chunks(
  query_embedding vector(768), match_count int default 6, subjects text[] default null,
  max_std int default 12
) returns table (id bigint, book text, std int, subject text, page_from int, content text, similarity float)
language sql stable as $$
  select c.id, c.book, c.std, c.subject, c.page_from, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from textbook_chunks c
  where c.embedding is not null
    and (subjects is null or c.subject = any(subjects))
    and c.std <= max_std
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ───────────────────────── questions ─────────────────────────
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  exam_code text references exams(code),
  unit_id text references units(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  stem text not null,
  options jsonb not null,               -- ["அ","ஆ","இ","ஈ"] four strings
  answer_index int not null check (answer_index between 0 and 3),
  explanation text,
  source_ref text,                      -- "10ஆம் வகுப்பு சமூக அறிவியல், பக். 45"
  chunk_id bigint references textbook_chunks(id) on delete set null,
  origin text not null default 'ai',    -- ai | pyq | ca | manual | aptitude
  pyq_year int,
  ca_date date,
  difficulty text default 'medium',
  style text,                           -- direct, match, assertion, odd, statement
  status text not null default 'active',-- active | flagged | retired
  hash text unique,
  created_at timestamptz not null default now()
);
create index if not exists questions_unit_idx on questions (unit_id, status);
create index if not exists questions_ca_idx on questions (ca_date) where origin = 'ca';

create table if not exists question_reports (
  id bigserial primary key,
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── attempts ─────────────────────────
create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null,                   -- mock | quiz | ca | revision | aptitude
  exam_code text,
  unit_id text,
  title text not null,
  question_ids uuid[] not null,
  duration_sec int,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  result jsonb
);
create index if not exists tests_user_idx on tests (user_id, started_at desc);

create table if not exists answers (
  test_id uuid not null references tests(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  chosen int,
  correct boolean,
  time_ms int,
  primary key (test_id, question_id)
);
create index if not exists answers_user_idx on answers (user_id, question_id);

create table if not exists review_queue (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id uuid not null references questions(id) on delete cascade,
  due_date date not null default current_date,
  interval_days int not null default 1,
  streak int not null default 0,
  lapses int not null default 0,
  primary key (user_id, question_id)
);

create table if not exists progress (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id uuid not null references topics(id) on delete cascade,
  status text not null default 'todo',  -- todo | studying | done | revised
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- ───────────────────────── notes & flashcards ─────────────────────────
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  unit_id text references units(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  kind text not null,                   -- mnemonic | summary | table | timeline | facts
  title text not null,
  content text not null,                -- markdown
  source_ref text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  unit_id text references units(id) on delete set null,
  front text not null,
  back text not null,
  due_date date not null default current_date,
  interval_days int not null default 1,
  created_at timestamptz not null default now()
);

-- ───────────────────────── current affairs ─────────────────────────
create table if not exists current_affairs (
  id uuid primary key default gen_random_uuid(),
  ca_date date not null,
  region text not null,                 -- tn | india
  category text not null,
  title_ta text not null,
  note_ta text not null,
  exam_point_ta text,
  source_name text,
  source_url text,
  hash text unique,
  created_at timestamptz not null default now()
);
create index if not exists ca_date_idx on current_affairs (ca_date desc, region);

create table if not exists job_runs (
  id bigserial primary key,
  job text not null,
  ok boolean not null,
  detail jsonb,
  ran_at timestamptz not null default now()
);

-- ───────────────────────── glossary ─────────────────────────
create table if not exists glossary (
  en text primary key,
  ta text not null,
  category text
);

-- ───────────────────────── security ─────────────────────────
alter table profiles enable row level security;
alter table exams enable row level security;
alter table parts enable row level security;
alter table units enable row level security;
alter table topics enable row level security;
alter table textbook_chunks enable row level security;
alter table questions enable row level security;
alter table question_reports enable row level security;
alter table tests enable row level security;
alter table answers enable row level security;
alter table review_queue enable row level security;
alter table progress enable row level security;
alter table notes enable row level security;
alter table flashcards enable row level security;
alter table current_affairs enable row level security;
alter table job_runs enable row level security;
alter table glossary enable row level security;

-- shared read-only content for signed-in users (writes happen on the server with the service key)
do $$ declare t text; begin
  foreach t in array array['exams','parts','units','topics','textbook_chunks','questions','current_affairs','glossary','job_runs'] loop
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- profiles: both can see each other (for the couple leaderboard), each edits own
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select to authenticated using (true);
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for update to authenticated using (id = auth.uid());

-- own rows only
do $$ declare t text; begin
  foreach t in array array['tests','answers','review_queue','progress','flashcards','question_reports'] loop
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- tests: partner can read scores for the leaderboard
drop policy if exists tests_read_all on tests;
create policy tests_read_all on tests for select to authenticated using (true);

-- notes: shared library (anyone signed in reads), owner edits
drop policy if exists notes_read on notes;
create policy notes_read on notes for select to authenticated using (true);
drop policy if exists notes_write on notes;
create policy notes_write on notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── views for analysis ─────────────────────────
create or replace view unit_accuracy with (security_invoker = true) as
  select a.user_id, q.unit_id, count(*)::int as attempted,
         sum(case when a.correct then 1 else 0 end)::int as correct
  from answers a join questions q on q.id = a.question_id
  where a.chosen is not null
  group by a.user_id, q.unit_id;

create or replace view bank_counts with (security_invoker = true) as
  select unit_id, origin, count(*)::int as n
  from questions where status = 'active'
  group by unit_id, origin;
