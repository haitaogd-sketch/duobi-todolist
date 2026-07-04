-- Todo Workspace database schema for Supabase.
-- Run this SQL in the Supabase SQL editor before using the app.

create extension if not exists pgcrypto;

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 500),
  is_complete boolean not null default false,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_image_path_owner check (
    image_path is null or image_path like (user_id::text || '/%')
  )
);

create index if not exists todos_user_created_at_idx
  on public.todos (user_id, created_at desc);

alter table public.todos enable row level security;

drop policy if exists "Users can read their own todos" on public.todos;
create policy "Users can read their own todos"
  on public.todos for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own todos" on public.todos;
create policy "Users can insert their own todos"
  on public.todos for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own todos" on public.todos;
create policy "Users can update their own todos"
  on public.todos for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own todos" on public.todos;
create policy "Users can delete their own todos"
  on public.todos for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
  before update on public.todos
  for each row
  execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'todo-attachments',
  'todo-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own todo attachments" on storage.objects;
create policy "Users can read their own todo attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'todo-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own todo attachments" on storage.objects;
create policy "Users can upload their own todo attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'todo-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own todo attachments" on storage.objects;
create policy "Users can update their own todo attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'todo-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'todo-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own todo attachments" on storage.objects;
create policy "Users can delete their own todo attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'todo-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
