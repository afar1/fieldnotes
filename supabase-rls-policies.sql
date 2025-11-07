-- Row Level Security Policies for Field Alpha
-- Run these in your Supabase SQL Editor

-- Enable RLS on all tables
alter table public.boards enable row level security;
alter table public.board_columns enable row level security;
alter table public.todos enable row level security;

-- Drop existing policies if they exist (idempotent)
drop policy if exists "boards_owner_read" on public.boards;
drop policy if exists "boards_owner_write" on public.boards;
drop policy if exists "columns_owner_read" on public.board_columns;
drop policy if exists "columns_owner_write" on public.board_columns;
drop policy if exists "todos_owner_read" on public.todos;
drop policy if exists "todos_owner_write" on public.todos;

-- Boards policies
-- Users can only read their own boards
create policy "boards_owner_read" on public.boards
  for select using (owner_id = auth.uid());

-- Users can only create/update/delete their own boards
create policy "boards_owner_write" on public.boards
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Board columns policies
-- Users can only read columns for their own boards
create policy "columns_owner_read" on public.board_columns
  for select using (owner_id = auth.uid());

-- Users can only create/update/delete columns for their own boards
create policy "columns_owner_write" on public.board_columns
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Todos policies
-- Users can only read todos for their own boards
create policy "todos_owner_read" on public.todos
  for select using (owner_id = auth.uid());

-- Users can only create/update/delete todos for their own boards
create policy "todos_owner_write" on public.todos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

