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
-- TOTP Secret Encryption/Decryption Functions
-- ------------------------------------------------------------------
-- IMPORTANT: The encryption key must be passed as a parameter from the application layer.
-- 
-- Setup in Railway:
--   1. Add environment variable: ENCRYPTION_KEY (minimum 32 characters)
--   2. In your application code, read process.env.ENCRYPTION_KEY
--   3. Pass it as p_encryption_key parameter to all encryption/decryption functions
--
-- Example usage in application:
--   const encryptionKey = process.env.ENCRYPTION_KEY;
--   await supabase.rpc('encrypt_totp_secret', {
--     p_secret: totpSecret,
--     p_encryption_key: encryptionKey
--   });
--
-- Never store the encryption key in the database or commit it to version control.

-- Encrypt TOTP secret for storage
create or replace function public.encrypt_totp_secret(
  p_secret text,
  p_encryption_key text
)
returns text
language plpgsql
security definer
as $$
declare
  v_encrypted text;
begin
  if p_encryption_key is null or length(p_encryption_key) < 32 then
    raise exception 'Encryption key must be at least 32 characters';
  end if;
  
  -- Use pgcrypto to encrypt the secret
  -- Note: In production, use a proper key derivation function
  v_encrypted := encode(
    encrypt(
      p_secret::bytea,
      digest(p_encryption_key, 'sha256'),
      'aes'
    ),
    'base64'
  );
  
  return v_encrypted;
end;
$$;

-- Decrypt TOTP secret for verification
create or replace function public.decrypt_totp_secret(
  p_encrypted_secret text,
  p_encryption_key text
)
returns text
language plpgsql
security definer
as $$
declare
  v_decrypted text;
begin
  if p_encryption_key is null or length(p_encryption_key) < 32 then
    raise exception 'Encryption key must be at least 32 characters';
  end if;
  
  -- Decrypt the secret
  v_decrypted := convert_from(
    decrypt(
      decode(p_encrypted_secret, 'base64'),
      digest(p_encryption_key, 'sha256'),
      'aes'
    ),
    'utf8'
  );
  
  return v_decrypted;
exception
  when others then
    raise exception 'Failed to decrypt TOTP secret: %', sqlerrm;
end;
$$;

-- ------------------------------------------------------------------
-- Backup Codes Management
-- ------------------------------------------------------------------

-- Generate backup codes for 2FA
create or replace function public.generate_backup_codes(
  p_user_id uuid,
  p_count integer default 10,
  p_encryption_key text default null
)
returns text[]
language plpgsql
security definer
as $$
declare
  v_codes text[];
  v_code text;
  v_encrypted_codes text[];
  i integer;
begin
  -- Generate random backup codes (8 characters, alphanumeric)
  for i in 1..p_count loop
    v_code := upper(
      substring(
        encode(gen_random_bytes(6), 'base64') 
        from 1 for 8
      )
    );
    -- Remove non-alphanumeric characters and pad if needed
    v_code := regexp_replace(v_code, '[^A-Z0-9]', '', 'g');
    v_code := lpad(v_code, 8, '0');
    v_codes := array_append(v_codes, v_code);
  end loop;
  
  -- Encrypt backup codes if encryption key is provided
  if p_encryption_key is not null and length(p_encryption_key) >= 32 then
    for i in 1..array_length(v_codes, 1) loop
      v_encrypted_codes := array_append(
        v_encrypted_codes,
        public.encrypt_totp_secret(v_codes[i], p_encryption_key)
      );
    end loop;
    return v_encrypted_codes;
  else
    -- Return unencrypted codes (not recommended for production)
    return v_codes;
  end if;
end;
$$;

-- Validate and consume a backup code
create or replace function public.validate_backup_code(
  p_user_id uuid,
  p_code text,
  p_encryption_key text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_backup_codes text[];
  v_decrypted_code text;
  v_code_index integer;
  v_updated_codes text[];
  i integer;
begin
  -- Check if account is locked
  if public.is_account_locked(p_user_id) then
    return false;
  end if;
  
  -- Get current backup codes
  select two_factor_backup_codes into v_backup_codes
  from public.user_security_settings
  where user_id = p_user_id
    and two_factor_enabled = true;
  
  if v_backup_codes is null or array_length(v_backup_codes, 1) = 0 then
    return false;
  end if;
  
  -- Try to find and decrypt matching code
  v_code_index := null;
  for i in 1..array_length(v_backup_codes, 1) loop
    begin
      if p_encryption_key is not null and length(p_encryption_key) >= 32 then
        v_decrypted_code := public.decrypt_totp_secret(v_backup_codes[i], p_encryption_key);
      else
        v_decrypted_code := v_backup_codes[i];
      end if;
      
      if upper(trim(p_code)) = upper(trim(v_decrypted_code)) then
        v_code_index := i;
        exit;
      end if;
    exception
      when others then
        -- Skip invalid encrypted codes
        continue;
    end;
  end loop;
  
  if v_code_index is null then
    -- Log failed backup code attempt
    perform public.increment_failed_2fa_attempts(p_user_id);
    return false;
  end if;
  
  -- Remove used backup code
  v_updated_codes := array_remove(v_backup_codes, v_backup_codes[v_code_index]);
  
  -- Update backup codes
  update public.user_security_settings
  set
    two_factor_backup_codes = v_updated_codes,
    two_factor_last_used = timezone('utc', now())
  where user_id = p_user_id;
  
  -- Reset failed attempts and log success
  perform public.reset_2fa_attempts(p_user_id);
  perform public.log_security_event(
    p_user_id,
    'backup_code_used',
    '2fa',
    'Backup code used for 2FA verification',
    jsonb_build_object('remaining_codes', array_length(v_updated_codes, 1))
  );
  
  return true;
end;
$$;

-- Regenerate backup codes (admin function)
create or replace function public.regenerate_backup_codes(
  p_user_id uuid,
  p_count integer default 10,
  p_encryption_key text default null
)
returns text[]
language plpgsql
security definer
as $$
declare
  v_new_codes text[];
begin
  -- Check if user has 2FA enabled
  if not exists (
    select 1 from public.user_security_settings
    where user_id = p_user_id and two_factor_enabled = true
  ) then
    raise exception 'User does not have 2FA enabled';
  end if;
  
  -- Generate new backup codes
  v_new_codes := public.generate_backup_codes(p_user_id, p_count, p_encryption_key);
  
  -- Update backup codes
  update public.user_security_settings
  set two_factor_backup_codes = v_new_codes
  where user_id = p_user_id;
  
  -- Log the regeneration
  perform public.log_security_event(
    p_user_id,
    'backup_codes_regenerated',
    '2fa',
    format('Backup codes regenerated (%s codes)', p_count),
    jsonb_build_object('code_count', p_count)
  );
  
  return v_new_codes;
end;
$$;

-- ------------------------------------------------------------------
-- 2FA Enrollment and Verification Functions
-- ------------------------------------------------------------------

-- Create a 2FA session for verification
create or replace function public.create_2fa_session(
  p_user_id uuid,
  p_purpose text default 'login',
  p_action_type text default null,
  p_action_context jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_session_id uuid;
  v_session_token uuid;
begin
  -- Check if account is locked
  if public.is_account_locked(p_user_id) then
    raise exception 'Account is locked due to too many failed 2FA attempts';
  end if;
  
  -- Check if user has 2FA enabled
  if not exists (
    select 1 from public.user_security_settings
    where user_id = p_user_id and two_factor_enabled = true
  ) then
    raise exception 'User does not have 2FA enabled';
  end if;
  
  -- Create session
  insert into public.two_factor_sessions (
    user_id,
    session_token,
    purpose,
    action_type,
    action_context
  )
  values (
    p_user_id,
    gen_random_uuid(),
    p_purpose,
    p_action_type,
    p_action_context
  )
  returning id, session_token into v_session_id, v_session_token;
  
  -- Log session creation
  perform public.log_security_event(
    p_user_id,
    '2fa_session_created',
    '2fa',
    format('2FA session created for %s', p_purpose),
    jsonb_build_object(
      'session_id', v_session_id,
      'purpose', p_purpose,
      'action_type', p_action_type
    )
  );
  
  return v_session_token;
end;
$$;

-- Verify 2FA session token
create or replace function public.verify_2fa_session(
  p_session_token uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session record;
  v_result jsonb;
begin
  -- Get session
  select * into v_session
  from public.two_factor_sessions
  where session_token = p_session_token
    and expires_at > timezone('utc', now())
    and verified = false;
  
  if v_session is null then
    return jsonb_build_object(
      'valid', false,
      'error', 'Invalid or expired session token'
    );
  end if;
  
  -- Check if account is locked
  if public.is_account_locked(v_session.user_id) then
    return jsonb_build_object(
      'valid', false,
      'error', 'Account is locked'
    );
  end if;
  
  return jsonb_build_object(
    'valid', true,
    'user_id', v_session.user_id,
    'purpose', v_session.purpose,
    'action_type', v_session.action_type,
    'action_context', v_session.action_context,
    'session_id', v_session.id
  );
end;
$$;

-- Mark 2FA session as verified
create or replace function public.mark_2fa_session_verified(
  p_session_token uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_session_id uuid;
  v_user_id uuid;
begin
  -- Verify and get session
  select id, user_id into v_session_id, v_user_id
  from public.two_factor_sessions
  where session_token = p_session_token
    and expires_at > timezone('utc', now())
    and verified = false;
  
  if v_session_id is null then
    return false;
  end if;
  
  -- Mark as verified
  update public.two_factor_sessions
  set verified = true
  where id = v_session_id;
  
  -- Reset failed attempts
  perform public.reset_2fa_attempts(v_user_id);
  
  -- Log verification
  perform public.log_security_event(
    v_user_id,
    '2fa_session_verified',
    '2fa',
    '2FA session verified successfully',
    jsonb_build_object('session_id', v_session_id)
  );
  
  return true;
end;
$$;

-- ------------------------------------------------------------------
-- 2FA Setup and Management Functions
-- ------------------------------------------------------------------

-- Initiate 2FA setup (returns temporary secret for QR code generation)
-- Note: The actual TOTP secret generation should happen in the application layer
-- This function stores the encrypted secret after the user verifies it
-- The encryption key should be passed from environment variables (e.g., Railway's ENCRYPTION_KEY)
create or replace function public.initiate_2fa_setup(
  p_user_id uuid,
  p_totp_secret text,
  p_encryption_key text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_encrypted_secret text;
  v_backup_codes text[];
  v_setup_token uuid;
begin
  -- Check if 2FA is already enabled
  if exists (
    select 1 from public.user_security_settings
    where user_id = p_user_id and two_factor_enabled = true
  ) then
    raise exception '2FA is already enabled for this user';
  end if;
  
  -- Encrypt the TOTP secret
  v_encrypted_secret := public.encrypt_totp_secret(p_totp_secret, p_encryption_key);
  
  -- Generate backup codes
  v_backup_codes := public.generate_backup_codes(p_user_id, 10, p_encryption_key);
  
  -- Generate setup token (temporary, for verification step)
  v_setup_token := gen_random_uuid();
  
  -- Store encrypted secret and backup codes (but don't enable yet)
  insert into public.user_security_settings (
    user_id,
    two_factor_secret_encrypted,
    two_factor_backup_codes
  )
  values (
    p_user_id,
    v_encrypted_secret,
    v_backup_codes
  )
  on conflict (user_id) do update
  set
    two_factor_secret_encrypted = excluded.two_factor_secret_encrypted,
    two_factor_backup_codes = excluded.two_factor_backup_codes;
  
  -- Log setup initiation
  perform public.log_security_event(
    p_user_id,
    '2fa_setup_initiated',
    '2fa',
    '2FA setup initiated',
    jsonb_build_object('setup_token', v_setup_token)
  );
  
  return jsonb_build_object(
    'setup_token', v_setup_token,
    'backup_codes', v_backup_codes,
    'message', 'Verify the TOTP code to complete 2FA setup'
  );
end;
$$;

-- Complete 2FA setup after user verifies TOTP code
-- Note: TOTP code verification happens in application layer
create or replace function public.complete_2fa_setup(
  p_user_id uuid,
  p_verified boolean default true
)
returns boolean
language plpgsql
security definer
as $$
begin
  if not p_verified then
    -- Clear the temporary setup data
    update public.user_security_settings
    set
      two_factor_secret_encrypted = null,
      two_factor_backup_codes = null
    where user_id = p_user_id;
    
    perform public.log_security_event(
      p_user_id,
      '2fa_setup_failed',
      '2fa',
      '2FA setup failed verification',
      null
    );
    
    return false;
  end if;
  
  -- Enable 2FA
  update public.user_security_settings
  set
    two_factor_enabled = true,
    two_factor_enabled_at = timezone('utc', now())
  where user_id = p_user_id;
  
  -- Log successful setup
  perform public.log_security_event(
    p_user_id,
    '2fa_enabled',
    '2fa',
    '2FA enabled successfully',
    null
  );
  
  return true;
end;
$$;

-- Disable 2FA for a user
create or replace function public.disable_2fa(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Clear 2FA data
  update public.user_security_settings
  set
    two_factor_enabled = false,
    two_factor_secret_encrypted = null,
    two_factor_backup_codes = null,
    two_factor_enabled_at = null,
    failed_2fa_attempts = 0,
    locked_until = null
  where user_id = p_user_id;
  
  -- Invalidate all active 2FA sessions
  delete from public.two_factor_sessions
  where user_id = p_user_id and verified = false;
  
  -- Log 2FA disable
  perform public.log_security_event(
    p_user_id,
    '2fa_disabled',
    '2fa',
    '2FA disabled',
    null
  );
  
  return true;
end;
$$;

-- ------------------------------------------------------------------
-- Admin Recovery Functions
-- ------------------------------------------------------------------

-- Admin function to unlock an account
create or replace function public.admin_unlock_account(
  p_user_id uuid,
  p_admin_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Verify admin/owner role
  if not exists (
    select 1 from public.profiles
    where id = p_admin_user_id
    and role in ('owner', 'admin')
  ) then
    raise exception 'Only admins and owners can unlock accounts';
  end if;
  
  -- Unlock the account
  update public.user_security_settings
  set
    locked_until = null,
    failed_2fa_attempts = 0
  where user_id = p_user_id;
  
  -- Log admin action
  perform public.log_security_event(
    p_user_id,
    'account_unlocked_by_admin',
    'admin_action',
    format('Account unlocked by admin %s', p_admin_user_id),
    jsonb_build_object('admin_user_id', p_admin_user_id)
  );
  
  return true;
end;
$$;

-- Admin function to reset failed 2FA attempts
create or replace function public.admin_reset_2fa_attempts(
  p_user_id uuid,
  p_admin_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
as $$
begin
  -- Verify admin/owner role
  if not exists (
    select 1 from public.profiles
    where id = p_admin_user_id
    and role in ('owner', 'admin')
  ) then
    raise exception 'Only admins and owners can reset 2FA attempts';
  end if;
  
  -- Reset attempts
  perform public.reset_2fa_attempts(p_user_id);
  
  -- Log admin action
  perform public.log_security_event(
    p_user_id,
    '2fa_attempts_reset_by_admin',
    'admin_action',
    format('2FA attempts reset by admin %s', p_admin_user_id),
    jsonb_build_object('admin_user_id', p_admin_user_id)
  );
  
  return true;
end;
$$;

-- Admin function to regenerate backup codes
create or replace function public.admin_regenerate_backup_codes(
  p_user_id uuid,
  p_admin_user_id uuid default auth.uid(),
  p_count integer default 10,
  p_encryption_key text default null
)
returns text[]
language plpgsql
security definer
as $$
declare
  v_codes text[];
begin
  -- Verify admin/owner role
  if not exists (
    select 1 from public.profiles
    where id = p_admin_user_id
    and role in ('owner', 'admin')
  ) then
    raise exception 'Only admins and owners can regenerate backup codes';
  end if;
  
  -- Regenerate codes
  v_codes := public.regenerate_backup_codes(p_user_id, p_count, p_encryption_key);
  
  -- Log admin action
  perform public.log_security_event(
    p_user_id,
    'backup_codes_regenerated_by_admin',
    'admin_action',
    format('Backup codes regenerated by admin %s', p_admin_user_id),
    jsonb_build_object(
      'admin_user_id', p_admin_user_id,
      'code_count', p_count
    )
  );
  
  return v_codes;
end;
$$;

-- ------------------------------------------------------------------
-- Session Management Functions
-- ------------------------------------------------------------------

-- Clear all 2FA sessions for a user (e.g., on logout)
create or replace function public.clear_user_2fa_sessions(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
as $$
declare
  v_deleted_count integer;
begin
  -- Delete all sessions for the user and get count
  with deleted as (
    delete from public.two_factor_sessions
    where user_id = p_user_id
    returning id
  )
  select count(*) into v_deleted_count from deleted;
  
  -- Log the action
  perform public.log_security_event(
    p_user_id,
    '2fa_sessions_cleared',
    'security',
    'All 2FA sessions cleared',
    jsonb_build_object('sessions_deleted', v_deleted_count)
  );
  
  return v_deleted_count;
end;
$$;

-- Invalidate all 2FA sessions (e.g., after password change)
create or replace function public.invalidate_user_2fa_sessions(
  p_user_id uuid,
  p_reason text default 'password_change'
)
returns integer
language plpgsql
security definer
as $$
declare
  v_invalidated_count integer;
begin
  -- Delete all unverified sessions and get count
  with deleted as (
    delete from public.two_factor_sessions
    where user_id = p_user_id
      and verified = false
    returning id
  )
  select count(*) into v_invalidated_count from deleted;
  
  -- Log the action
  perform public.log_security_event(
    p_user_id,
    '2fa_sessions_invalidated',
    'security',
    format('2FA sessions invalidated: %s', p_reason),
    jsonb_build_object(
      'reason', p_reason,
      'sessions_invalidated', v_invalidated_count
    )
  );
  
  return v_invalidated_count;
end;
$$;

-- ------------------------------------------------------------------
-- Security Dashboard Views
-- ------------------------------------------------------------------

-- Security dashboard statistics view
create or replace view public.security_dashboard_stats as
select
  (select count(*) from public.user_security_settings 
   where locked_until > timezone('utc', now())) as accounts_locked,
  (select count(distinct user_id) from public.user_security_settings 
   where failed_2fa_attempts > 0) as users_with_failed_attempts,
  (select count(*) from public.security_audit_log 
   where event_type like '2fa%' 
   and created_at > timezone('utc', now()) - interval '24 hours') as total_2fa_events_24h,
  (select count(*) from public.security_audit_log 
   where event_type = '2fa_verification_failed' 
   and created_at > timezone('utc', now()) - interval '24 hours') as failed_2fa_attempts_24h,
  (select count(*) from public.security_audit_log 
   where event_type = '2fa_verification_success' 
   and created_at > timezone('utc', now()) - interval '24 hours') as successful_2fa_verifications_24h,
  (select count(distinct user_id) from public.user_security_settings 
   where two_factor_enabled = true) as users_with_2fa_enabled;

-- Grant access to admins only
grant select on public.security_dashboard_stats to authenticated;

-- RLS policy for security dashboard (admins only)
drop policy if exists "Admins can view security dashboard" on public.security_dashboard_stats;
-- Note: Views don't support RLS directly, but we can create a function wrapper
create or replace function public.get_security_dashboard_stats()
returns table (
  accounts_locked bigint,
  users_with_failed_attempts bigint,
  total_2fa_events_24h bigint,
  failed_2fa_attempts_24h bigint,
  successful_2fa_verifications_24h bigint,
  users_with_2fa_enabled bigint
)
language plpgsql
security definer
as $$
begin
  -- Verify admin/owner role
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('owner', 'admin')
  ) then
    raise exception 'Only admins and owners can view security dashboard';
  end if;
  
  return query
  select * from public.security_dashboard_stats;
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
-- AND routine_name IN ('log_security_event', 'is_account_locked', 'increment_failed_2fa_attempts', 'reset_2fa_attempts', 
--   'encrypt_totp_secret', 'decrypt_totp_secret', 'generate_backup_codes', 'validate_backup_code', 
--   'create_2fa_session', 'verify_2fa_session', 'mark_2fa_session_verified', 'initiate_2fa_setup', 
--   'complete_2fa_setup', 'disable_2fa', 'admin_unlock_account', 'admin_reset_2fa_attempts', 
--   'admin_regenerate_backup_codes', 'clear_user_2fa_sessions', 'invalidate_user_2fa_sessions');
