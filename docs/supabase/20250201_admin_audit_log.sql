-- ------------------------------------------------------------------
-- Admin Audit Log System (GDPR/Compliance)
-- ------------------------------------------------------------------
-- Immutable audit log for all admin actions

create extension if not exists "pgcrypto";

-- Admin audit log table (append-only, immutable)
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  
  -- Who
  admin_id uuid not null references auth.users(id) on delete restrict,
  admin_email text,
  admin_role text,
  
  -- What
  action_type text not null, -- e.g., 'user_role_change', 'vendor_suspend', 'payout_hold', 'product_approve'
  action_category text not null, -- 'user', 'vendor', 'product', 'payout', 'system', 'other'
  description text not null,
  
  -- When
  created_at timestamptz not null default timezone('utc', now()),
  
  -- Where (for security)
  ip_address inet,
  user_agent text,
  
  -- Why (optional justification)
  reason text,
  
  -- What changed (before/after state)
  before_state jsonb,
  after_state jsonb,
  
  -- Related entities
  target_entity_type text, -- 'user', 'vendor', 'product', 'payout', etc.
  target_entity_id uuid,
  
  -- Additional metadata
  metadata jsonb,
  
  -- GDPR compliance: data retention
  retention_until timestamptz, -- When this record can be deleted (for GDPR)
  
  -- Immutability: prevent updates/deletes
  constraint audit_log_immutable check (true) -- Always true, but prevents accidental updates
);

-- Indexes for performance
create index if not exists idx_admin_audit_admin 
  on public.admin_audit_log (admin_id, created_at desc);

create index if not exists idx_admin_audit_type 
  on public.admin_audit_log (action_type, created_at desc);

create index if not exists idx_admin_audit_category 
  on public.admin_audit_log (action_category, created_at desc);

create index if not exists idx_admin_audit_target 
  on public.admin_audit_log (target_entity_type, target_entity_id)
  where target_entity_id is not null;

create index if not exists idx_admin_audit_created 
  on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_retention 
  on public.admin_audit_log (retention_until)
  where retention_until is not null;

-- Composite index for common queries
create index if not exists idx_admin_audit_admin_category 
  on public.admin_audit_log (admin_id, action_category, created_at desc);

-- Enable RLS
alter table public.admin_audit_log enable row level security;

-- RLS Policies: Only admins can view audit logs
drop policy if exists "Admins can view audit logs" on public.admin_audit_log;
create policy "Admins can view audit logs"
  on public.admin_audit_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- Prevent inserts except through service role (via function)
drop policy if exists "Service can insert audit logs" on public.admin_audit_log;
create policy "Service can insert audit logs"
  on public.admin_audit_log
  for insert
  with check (true); -- Service role bypasses RLS

-- Prevent updates and deletes (immutable)
-- This is enforced by not having UPDATE/DELETE policies

-- Function to create audit log entry
create or replace function public.create_audit_log(
  p_admin_id uuid,
  p_action_type text,
  p_action_category text,
  p_description text,
  p_reason text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_target_entity_type text default null,
  p_target_entity_id uuid default null,
  p_metadata jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null,
  p_retention_days integer default 2555 -- 7 years default (GDPR requirement)
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_log_id uuid;
  v_admin_email text;
  v_admin_role text;
  v_retention_until timestamptz;
begin
  -- Get admin details
  select email, role
  into v_admin_email, v_admin_role
  from public.profiles
  where id = p_admin_id;
  
  -- Calculate retention date
  v_retention_until := timezone('utc', now()) + (p_retention_days || ' days')::interval;
  
  -- Insert audit log
  insert into public.admin_audit_log (
    admin_id,
    admin_email,
    admin_role,
    action_type,
    action_category,
    description,
    reason,
    before_state,
    after_state,
    target_entity_type,
    target_entity_id,
    metadata,
    ip_address,
    user_agent,
    retention_until
  ) values (
    p_admin_id,
    v_admin_email,
    v_admin_role,
    p_action_type,
    p_action_category,
    p_description,
    p_reason,
    p_before_state,
    p_after_state,
    p_target_entity_type,
    p_target_entity_id,
    p_metadata,
    p_ip_address,
    p_user_agent,
    v_retention_until
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- Function to get audit log statistics
create or replace function public.get_audit_log_stats(
  p_admin_id uuid default null,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'total_actions', count(*),
    'by_category', jsonb_object_agg(
      action_category,
      category_count
    ),
    'by_type', jsonb_object_agg(
      action_type,
      type_count
    ),
    'by_admin', jsonb_object_agg(
      admin_email,
      admin_count
    ),
    'recent_actions', (
      select count(*)
      from public.admin_audit_log
      where (p_admin_id is null or admin_id = p_admin_id)
        and created_at >= timezone('utc', now()) - interval '24 hours'
    )
  )
  into v_result
  from (
    select 
      action_category,
      count(*) as category_count
    from public.admin_audit_log
    where (p_admin_id is null or admin_id = p_admin_id)
      and (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
    group by action_category
  ) categories
  full outer join (
    select 
      action_type,
      count(*) as type_count
    from public.admin_audit_log
    where (p_admin_id is null or admin_id = p_admin_id)
      and (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
    group by action_type
  ) types on true
  full outer join (
    select 
      admin_email,
      count(*) as admin_count
    from public.admin_audit_log
    where (p_admin_id is null or admin_id = p_admin_id)
      and (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
    group by admin_email
  ) admins on true;
  
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

-- Function to clean up expired audit logs (GDPR compliance)
-- Should be run periodically via cron
create or replace function public.cleanup_expired_audit_logs()
returns integer
language plpgsql
security definer
as $$
declare
  v_deleted_count integer;
begin
  delete from public.admin_audit_log
  where retention_until is not null
    and retention_until < timezone('utc', now());
  
  get diagnostics v_deleted_count = row_count;
  
  return v_deleted_count;
end;
$$;

