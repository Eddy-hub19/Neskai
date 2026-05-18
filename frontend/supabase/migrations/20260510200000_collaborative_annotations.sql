-- Collaborative annotations + threads + reactions (Neon/Postgres)
-- Run in Supabase SQL editor or Neon migration pipeline.

-- 1) Annotation base: keep existing table, add created_at for ordering/audit.
alter table if exists public.annotations
  add column if not exists created_at timestamptz not null default now();

-- 2) Thread container for one annotation cfi.
create table if not exists public.annotation_threads (
  id uuid primary key default gen_random_uuid(),
  annotation_id bigint,
  annotation_cfi text not null,
  book_id bigint,
  creator_id uuid not null,
  created_at timestamptz not null default now()
);

-- 3) Messages inside thread.
create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  annotation_thread_id uuid not null references public.annotation_threads(id) on delete cascade,
  user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- 4) Reactions can belong either to annotation or to message.
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  annotation_id bigint,
  message_id uuid,
  user_id uuid not null,
  type text not null check (type in ('sparkles', 'feather', 'heart')),
  created_at timestamptz not null default now(),
  constraint reactions_exactly_one_target check (
    (annotation_id is not null and message_id is null)
    or
    (annotation_id is null and message_id is not null)
  )
);

create index if not exists idx_annotations_book_id_cfi on public.annotations(book_id, cfi_range);
create index if not exists idx_annotation_threads_cfi on public.annotation_threads(annotation_cfi);
create index if not exists idx_thread_messages_thread_created on public.thread_messages(annotation_thread_id, created_at desc);
create index if not exists idx_reactions_annotation on public.reactions(annotation_id) where annotation_id is not null;
create index if not exists idx_reactions_message on public.reactions(message_id) where message_id is not null;

create unique index if not exists uq_annotation_reaction_per_user
  on public.reactions(annotation_id, user_id, type)
  where annotation_id is not null;

create unique index if not exists uq_message_reaction_per_user
  on public.reactions(message_id, user_id, type)
  where message_id is not null;

-- Baseline RLS policy templates (adjust per room ownership model).
alter table public.annotation_threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "threads_select_auth" on public.annotation_threads;
create policy "threads_select_auth" on public.annotation_threads
  for select
  to authenticated
  using (true);

drop policy if exists "threads_insert_auth" on public.annotation_threads;
create policy "threads_insert_auth" on public.annotation_threads
  for insert
  to authenticated
  with check (auth.uid() = creator_id);

drop policy if exists "threads_delete_owner" on public.annotation_threads;
create policy "threads_delete_owner" on public.annotation_threads
  for delete
  to authenticated
  using (auth.uid() = creator_id);

drop policy if exists "messages_select_auth" on public.thread_messages;
create policy "messages_select_auth" on public.thread_messages
  for select
  to authenticated
  using (true);

drop policy if exists "messages_insert_owner" on public.thread_messages;
create policy "messages_insert_owner" on public.thread_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "messages_delete_owner" on public.thread_messages;
create policy "messages_delete_owner" on public.thread_messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reactions_select_auth" on public.reactions;
create policy "reactions_select_auth" on public.reactions
  for select
  to authenticated
  using (true);

drop policy if exists "reactions_insert_owner" on public.reactions;
create policy "reactions_insert_owner" on public.reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_owner" on public.reactions;
create policy "reactions_delete_owner" on public.reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);
