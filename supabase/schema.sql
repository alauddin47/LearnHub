-- LearnHub Supabase schema with Row Level Security. Run in Supabase SQL Editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz default now());
create table public.lesson_progress (
  user_id uuid references auth.users(id) on delete cascade, topic_id text, completed_at timestamptz default now(),
  primary key (user_id, topic_id));
create table public.submissions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  assignment_id text not null, body text not null, feedback text, created_at timestamptz default now(), unique(user_id, assignment_id));
create table public.cefr_results (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null, writing_text text, estimated_level text, human_level text, writing_feedback text, created_at timestamptz default now());
create table public.slots (id uuid primary key default gen_random_uuid(), starts_at timestamptz not null unique);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  slot_id uuid not null references public.slots(id), note text,
  status text not null default 'requested' check (status in ('requested','confirmed','declined')),
  result text, feedback text, created_at timestamptz default now());
create table public.resources (topic_id text primary key, video_url text, reading_url text, verified boolean default false);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as
$$ begin insert into profiles(id, full_name, email) values (new.id, new.raw_user_meta_data->>'full_name', new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security; alter table lesson_progress enable row level security;
alter table submissions enable row level security; alter table cefr_results enable row level security;
alter table slots enable row level security; alter table bookings enable row level security; alter table resources enable row level security;

-- Students: own rows only. Admins: all rows. Role column cannot be self-edited (no update policy for students on role).
create policy "own profile read" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin manage profiles" on profiles for update using (is_admin());
create policy "own progress" on lesson_progress for all using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid());
create policy "own submissions read" on submissions for select using (user_id = auth.uid() or is_admin());
create policy "own submissions write" on submissions for insert with check (user_id = auth.uid());
create policy "own submissions update" on submissions for update using (user_id = auth.uid() or is_admin());
create policy "own cefr read" on cefr_results for select using (user_id = auth.uid() or is_admin());
create policy "own cefr insert" on cefr_results for insert with check (user_id = auth.uid());
create policy "admin cefr update" on cefr_results for update using (is_admin());
create policy "slots read" on slots for select using (auth.role() = 'authenticated');
create policy "admin slots" on slots for all using (is_admin());
create policy "own bookings read" on bookings for select using (user_id = auth.uid() or is_admin());
create policy "own bookings insert" on bookings for insert with check (user_id = auth.uid() and status = 'requested');
create policy "admin bookings update" on bookings for update using (is_admin());
create policy "resources read" on resources for select using (true);
create policy "admin resources" on resources for all using (is_admin());
-- Make yourself admin once: update profiles set role='admin' where email='YOUR_EMAIL';
