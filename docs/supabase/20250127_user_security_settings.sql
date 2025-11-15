-- ------------------------------------------------------------------
-- User Security Settings Table for 2FA
-- ------------------------------------------------------------------
-- This table stores encrypted 2FA secrets and security settings
-- for all users (owners, vendors, and regular users)

create extension if not exists "pgcrypto";

-- Create user_security_settings table
create table if not exists public.user_security_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  two_factor_enabled boolean not null default false,
  two_factor_secret_encrypted text, -- Encrypted TOTP secret
  two_factor_backup_codes text[], -- Encrypted backup codes
  two_factor_enabled_at timestamptz,
  two_factor_last_used timestamptz,
  failed_2fa_attempts integer not null default 0,
  locked_until timestamptz, -- Account lockout after too many failed attempts
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_security_settings_user_id_unique unique (user_id)
);

-- Create indexes
create index if not exists idx_user_security_settings_user_id 
  on public.user_security_settings (user_id);
create index if not exists idx_user_security_settings_2fa_enabled 
  on public.user_security_settings (user_id) 
  where two_factor_enabled = true;

-- Update trigger for updated_at
create or replace function public.touch_user_security_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_user_security_settings_updated_at on public.user_security_settings;
create trigger trg_user_security_settings_updated_at
before update on public.user_security_settings
for each row execute function public.touch_user_security_settings_updated_at();

-- Enable RLS
alter table public.user_security_settings enable row level security;

-- RLS Policies
-- Users can view their own security settings
drop policy if exists "Users can view their own security settings" on public.user_security_settings;
create policy "Users can view their own security settings"
  on public.user_security_settings
  for select
  using (auth.uid() = user_id);

-- Users can insert their own security settings
drop policy if exists "Users can insert their own security settings" on public.user_security_settings;
create policy "Users can insert their own security settings"
  on public.user_security_settings
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own security settings
drop policy if exists "Users can update their own security settings" on public.user_security_settings;
create policy "Users can update their own security settings"
  on public.user_security_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 2FA Verification Sessions Table
-- ------------------------------------------------------------------
-- Temporary table to track 2FA verification sessions for logins and critical actions
create table if not exists public.two_factor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token uuid not null unique default gen_random_uuid(),
  purpose text not null check (purpose in ('login', 'critical_action')),
  action_type text, -- e.g., 'delete_product', 'change_role', 'payout_request'
  action_context jsonb, -- Additional context about the action
  verified boolean not null default false,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '10 minutes'),
  created_at timestamptz not null default timezone('utc', now()),
  constraint two_factor_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create indexes
create index if not exists idx_two_factor_sessions_token 
  on public.two_factor_sessions (session_token);
create index if not exists idx_two_factor_sessions_user_id 
  on public.two_factor_sessions (user_id);
create index if not exists idx_two_factor_sessions_expires 
  on public.two_factor_sessions (expires_at);

-- Cleanup expired sessions (run periodically)
create or replace function public.cleanup_expired_2fa_sessions()
returns void language plpgsql as $$
begin
  delete from public.two_factor_sessions
  where expires_at < timezone('utc', now());
end;
$$;

-- Enable RLS
alter table public.two_factor_sessions enable row level security;

-- RLS Policies for 2FA sessions
drop policy if exists "Users can view their own 2FA sessions" on public.two_factor_sessions;
create policy "Users can view their own 2FA sessions"
  on public.two_factor_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own 2FA sessions" on public.two_factor_sessions;
create policy "Users can create their own 2FA sessions"
  on public.two_factor_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own 2FA sessions" on public.two_factor_sessions;
create policy "Users can update their own 2FA sessions"
  on public.two_factor_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'user_security_settings';

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'user_security_settings';

