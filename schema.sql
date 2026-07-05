-- ============================================================================
-- XiangQi — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor (as a single query).
-- ============================================================================
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ IMPORTANT: After running this SQL, do BOTH of these in Supabase:       ║
-- ║                                                                      ║
-- ║  1. Authentication → URL Configuration                                 ║
-- ║     Site URL  : http://localhost:8000                                  ║
-- ║     Redirects : http://localhost:8000 (and any production URL)        ║
-- ║                                                                      ║
-- ║  2. Authentication → Providers → Email                                 ║
-- ║     • If you want INSTANT sign-up (no email confirmation):             ║
-- ║         turn OFF "Confirm email"                                       ║
-- ║     • If you want email confirmation (more secure):                   ║
-- ║         keep it ON, and configure a custom SMTP (optional but          ║
-- ║         recommended — Supabase's default sender is rate-limited)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Game history: one row per completed game for the current user.
create table if not exists public.game_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  mode        text not null check (mode in ('pvp', 'pve')),
  winner      text check (winner in ('red', 'black')),
  result      text not null check (result in ('win', 'loss', 'draw', 'resign')),
  moves       jsonb not null default '[]'::jsonb,
  move_count  integer not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz not null default now()
);
create index if not exists game_history_user_idx
  on public.game_history (user_id, ended_at desc);

-- Current in-progress game: one row per user, upserted after every move.
-- This is what enables cross-device sync: log in on another device, your
-- in-progress game resumes.
create table if not exists public.current_games (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Per-user settings: UI preferences that follow the account.
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  mode           text not null default 'pvp' check (mode in ('pvp', 'pve')),
  sound_enabled  boolean not null default true,
  show_legal     boolean not null default true,
  updated_at     timestamptz not null default now()
);

-- Row-level security: each user can only see/modify their own rows.
alter table public.game_history    enable row level security;
alter table public.current_games   enable row level security;
alter table public.user_settings   enable row level security;

drop policy if exists "Users manage own game history"  on public.game_history;
drop policy if exists "Users manage own current game"  on public.current_games;
drop policy if exists "Users manage own settings"     on public.user_settings;

create policy "Users manage own game history"
  on public.game_history for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own current game"
  on public.current_games for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own settings"
  on public.user_settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
