-- ------------------------------------------------------------------
-- Drop problematic constraint if it exists to allow migration to run idempotently
alter table if exists public.two_factor_sessions drop constraint if exists two_factor_sessions_user_id_fkey;
-- Additional constraint drops for idempotency
do $$ declare r record; begin for r in select constraint_name from information_schema.table_constraints where table_name = 'two_factor_sessions' and constraint_type = 'FOREIGN KEY' loop execute 'alter table public.two_factor_sessions drop constraint if exists ' || r.constraint_name; end loop; end $$;
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

-- Drop existing constraint if it exists (for idempotency)
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'two_factor_sessions_user_id_fkey' 
    and table_name = 'two_factor_sessions'
  ) then
    alter table public.two_factor_sessions drop constraint if exists two_factor_sessions_user_id_fkey;
  end if;
end $$;

create table if not exists public.two_factor_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_token uuid not null unique default gen_random_uuid(),
  purpose text not null check (purpose in ('login', 'critical_action')),
  action_type text, -- e.g., 'delete_product', 'change_role', 'payout_request'
  action_context jsonb, -- Additional context about the action
  verified boolean not null default false,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '10 minutes'),
  created_at timestamptz not null default timezone('utc', now())
);

-- Add foreign key constraint after table creation (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'two_factor_sessions_user_id_fkey' 
    and table_name = 'two_factor_sessions'
  ) then
    alter table public.two_factor_sessions
    add constraint two_factor_sessions_user_id_fkey 
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

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
-- Admin/Owner Management Policies
-- ------------------------------------------------------------------
-- Allow admins and owners to manage other users' 2FA settings

drop policy if exists "Admins can manage all security settings" on public.user_security_settings;
create policy "Admins can manage all security settings"
  on public.user_security_settings
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------------
-- Security Audit Logging Table
-- ------------------------------------------------------------------
-- Dedicated table for security-related audit events

create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_category text not null check (event_category in ('2fa', 'login', 'security', 'admin_action')),
  description text,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_security_audit_log_user_id 
  on public.security_audit_log (user_id);
create index if not exists idx_security_audit_log_event_type 
  on public.security_audit_log (event_type);
create index if not exists idx_security_audit_log_category 
  on public.security_audit_log (event_category);
create index if not exists idx_security_audit_log_created_at 
  on public.security_audit_log (created_at desc);

alter table public.security_audit_log enable row level security;

-- Users can view their own security audit logs
drop policy if exists "Users can view their own security audit logs" on public.security_audit_log;
create policy "Users can view their own security audit logs"
  on public.security_audit_log
  for select
  using (auth.uid() = user_id);

-- Admins can view all security audit logs
drop policy if exists "Admins can view all security audit logs" on public.security_audit_log;
create policy "Admins can view all security audit logs"
  on public.security_audit_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- Service role can insert audit logs (for API routes)
drop policy if exists "Service role can insert audit logs" on public.security_audit_log;
create policy "Service role can insert audit logs"
  on public.security_audit_log
  for insert
  with check (true); -- API routes use service role, so this is safe

-- ------------------------------------------------------------------
-- Helper Functions for 2FA Operations
-- ------------------------------------------------------------------

-- Log security events to audit table
create or replace function public.log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_event_category text,
  p_description text default null,
  p_metadata jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_log_id uuid;
begin
  insert into public.security_audit_log (
    user_id,
    event_type,
    event_category,
    description,
    metadata,
    ip_address,
    user_agent
  )
  values (
    p_user_id,
    p_event_type,
    p_event_category,
    p_description,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- Check if account is locked due to failed 2FA attempts
create or replace function public.is_account_locked(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_locked_until timestamptz;
begin
  select locked_until into v_locked_until
  from public.user_security_settings
  where user_id = p_user_id;
  
  -- Return false if no record exists or locked_until is null
  if v_locked_until is null then
    return false;
  end if;
  
  -- Return true if lockout period hasn't expired yet
  return v_locked_until > timezone('utc', now());
end;
$$;

-- Increment failed 2FA attempts and lock account if threshold reached
create or replace function public.increment_failed_2fa_attempts(
  p_user_id uuid,
  p_lockout_threshold integer default 5,
  p_lockout_duration_minutes integer default 30
)
returns integer
language plpgsql
security definer
as $$
declare
  v_current_attempts integer;
  v_new_attempts integer;
begin
  -- Ensure user_security_settings record exists
  insert into public.user_security_settings (user_id, failed_2fa_attempts)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;
  
  -- Get current failed attempts
  select coalesce(failed_2fa_attempts, 0) into v_current_attempts
  from public.user_security_settings
  where user_id = p_user_id;
  
  v_new_attempts := v_current_attempts + 1;
  
  -- Update attempts and lock if threshold reached
  update public.user_security_settings
  set
    failed_2fa_attempts = v_new_attempts,
    locked_until = case
      when v_new_attempts >= p_lockout_threshold then
        timezone('utc', now()) + (p_lockout_duration_minutes || ' minutes')::interval
      else
        locked_until
    end
  where user_id = p_user_id;
  
  -- Log the failed attempt
  perform public.log_security_event(
    p_user_id,
    '2fa_verification_failed',
    '2fa',
    format('Failed 2FA attempt %s of %s', v_new_attempts, p_lockout_threshold),
    jsonb_build_object(
      'attempt_number', v_new_attempts,
      'lockout_threshold', p_lockout_threshold,
      'account_locked', v_new_attempts >= p_lockout_threshold
    )
  );
  
  return v_new_attempts;
end;
$$;

-- Reset 2FA attempts on successful authentication
create or replace function public.reset_2fa_attempts(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Ensure user_security_settings record exists and reset attempts
  insert into public.user_security_settings (user_id, failed_2fa_attempts, locked_until, two_factor_last_used)
  values (p_user_id, 0, null, timezone('utc', now()))
  on conflict (user_id) do update
  set
    failed_2fa_attempts = 0,
    locked_until = null,
    two_factor_last_used = timezone('utc', now());
  
  -- Log successful verification
  perform public.log_security_event(
    p_user_id,
    '2fa_verification_success',
    '2fa',
    '2FA verification successful',
    jsonb_build_object('reset_attempts', true)
  );
end;
$$;

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'user_security_settings';

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename = 'user_security_settings';

-- Verify functions exist:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name IN ('log_security_event', 'is_account_locked', 'increment_failed_2fa_attempts', 'reset_2fa_attempts');
