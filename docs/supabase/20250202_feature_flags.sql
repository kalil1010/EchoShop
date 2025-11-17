-- ------------------------------------------------------------------
-- Feature Flags System
-- ------------------------------------------------------------------
-- Control features without code changes

create extension if not exists "pgcrypto";

-- Feature flags table
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  
  -- Flag details
  flag_key text not null unique, -- e.g., 'bulk_upload', 'ai_suggestions', 'advanced_analytics'
  flag_name text not null, -- Human-readable name
  description text,
  
  -- Status
  is_enabled boolean not null default false,
  is_global boolean not null default true, -- If false, only applies to specific vendors
  
  -- Rollout configuration
  rollout_percentage integer default 100 check (rollout_percentage >= 0 and rollout_percentage <= 100),
  
  -- Scheduling
  scheduled_enable_at timestamptz,
  scheduled_disable_at timestamptz,
  
  -- Metadata
  metadata jsonb, -- Additional configuration
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- Feature flag assignments (for per-vendor flags)
create table if not exists public.feature_flag_assignments (
  id uuid primary key default gen_random_uuid(),
  flag_id uuid not null references public.feature_flags(id) on delete cascade,
  vendor_id uuid not null references auth.users(id) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  
  unique(flag_id, vendor_id)
);

-- Indexes
create index if not exists idx_feature_flags_key on public.feature_flags(flag_key);
create index if not exists idx_feature_flags_enabled on public.feature_flags(is_enabled);
create index if not exists idx_feature_flags_global on public.feature_flags(is_global);
create index if not exists idx_feature_flags_scheduled on public.feature_flags(scheduled_enable_at, scheduled_disable_at)
  where scheduled_enable_at is not null or scheduled_disable_at is not null;

create index if not exists idx_feature_flag_assignments_flag on public.feature_flag_assignments(flag_id);
create index if not exists idx_feature_flag_assignments_vendor on public.feature_flag_assignments(vendor_id);
create index if not exists idx_feature_flag_assignments_vendor_flag on public.feature_flag_assignments(vendor_id, flag_id);

-- Trigger to update updated_at
create or replace function public.update_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_feature_flags_updated_at on public.feature_flags;
create trigger trigger_update_feature_flags_updated_at
  before update on public.feature_flags
  for each row
  execute function public.update_feature_flags_updated_at();

drop trigger if exists trigger_update_feature_flag_assignments_updated_at on public.feature_flag_assignments;
create trigger trigger_update_feature_flag_assignments_updated_at
  before update on public.feature_flag_assignments
  for each row
  execute function public.update_feature_flags_updated_at();

-- Function to check if a feature is enabled for a vendor
create or replace function public.is_feature_enabled(
  p_flag_key text,
  p_vendor_id uuid default null
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_flag record;
  v_assignment record;
  v_enabled boolean;
  v_random integer;
begin
  -- Get the feature flag
  select * into v_flag
  from public.feature_flags
  where flag_key = p_flag_key;
  
  if not found then
    return false; -- Flag doesn't exist, feature is disabled
  end if;
  
  -- Check if scheduled enable/disable
  if v_flag.scheduled_enable_at is not null and timezone('utc', now()) < v_flag.scheduled_enable_at then
    return false;
  end if;
  
  if v_flag.scheduled_disable_at is not null and timezone('utc', now()) >= v_flag.scheduled_disable_at then
    return false;
  end if;
  
  -- If flag is not enabled, return false
  if not v_flag.is_enabled then
    return false;
  end if;
  
  -- If global flag, check rollout percentage
  if v_flag.is_global then
    if v_flag.rollout_percentage < 100 then
      -- A/B testing: use vendor_id hash for consistent assignment
      if p_vendor_id is not null then
        v_random := abs(hashtext(p_vendor_id::text || p_flag_key)) % 100;
      else
        v_random := abs(hashtext(p_flag_key || timezone('utc', now())::text)) % 100;
      end if;
      
      return v_random < v_flag.rollout_percentage;
    end if;
    
    return true;
  end if;
  
  -- Per-vendor flag: check assignment
  if p_vendor_id is null then
    return false; -- Per-vendor flag requires vendor_id
  end if;
  
  select * into v_assignment
  from public.feature_flag_assignments
  where flag_id = v_flag.id
    and vendor_id = p_vendor_id;
  
  if not found then
    return false; -- No assignment, feature is disabled
  end if;
  
  return v_assignment.is_enabled;
end;
$$;

-- Function to get all enabled features for a vendor
create or replace function public.get_enabled_features(p_vendor_id uuid default null)
returns text[]
language plpgsql
security definer
stable
as $$
declare
  v_features text[];
begin
  select array_agg(flag_key)
  into v_features
  from public.feature_flags
  where is_enabled = true
    and (scheduled_enable_at is null or scheduled_enable_at <= timezone('utc', now()))
    and (scheduled_disable_at is null or scheduled_disable_at > timezone('utc', now()))
    and (
      is_global = true
      or (
        is_global = false
        and p_vendor_id is not null
        and exists (
          select 1 from public.feature_flag_assignments
          where flag_id = feature_flags.id
            and vendor_id = p_vendor_id
            and is_enabled = true
        )
      )
    );
  
  return coalesce(v_features, '{}'::text[]);
end;
$$;

-- Enable RLS
alter table public.feature_flags enable row level security;
alter table public.feature_flag_assignments enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all feature flags" on public.feature_flags;
create policy "Admins can view all feature flags"
  on public.feature_flags
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Service can manage feature flags" on public.feature_flags;
create policy "Service can manage feature flags"
  on public.feature_flags
  for all
  with check (true); -- Service role bypasses RLS

-- Vendors can check their own feature flags (read-only)
drop policy if exists "Vendors can check feature flags" on public.feature_flags;
create policy "Vendors can check feature flags"
  on public.feature_flags
  for select
  using (true); -- Public read access for checking flags

drop policy if exists "Service can manage assignments" on public.feature_flag_assignments;
create policy "Service can manage assignments"
  on public.feature_flag_assignments
  for all
  with check (true); -- Service role bypasses RLS

-- Vendors can view their own assignments
drop policy if exists "Vendors can view their assignments" on public.feature_flag_assignments;
create policy "Vendors can view their assignments"
  on public.feature_flag_assignments
  for select
  using (auth.uid() = vendor_id);

