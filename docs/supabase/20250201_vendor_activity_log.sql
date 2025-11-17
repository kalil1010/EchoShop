-- ------------------------------------------------------------------
-- Vendor Activity Log System
-- ------------------------------------------------------------------
-- Tracks all vendor activities for monitoring and auditing

create extension if not exists "pgcrypto";

-- Vendor activity log table
-- Note: For high-volume scenarios, consider partitioning by date
create table if not exists public.vendor_activity_log (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  
  -- Activity details
  action_type text not null, -- e.g., 'product_upload', 'product_update', 'order_update', 'price_change', 'bulk_delete'
  action_category text not null, -- 'product', 'order', 'profile', 'payment', 'other'
  description text not null,
  
  -- Related entities
  related_entity_type text, -- 'product', 'order', 'payout', etc.
  related_entity_id uuid,
  
  -- Metadata
  metadata jsonb, -- Additional context (old values, new values, etc.)
  ip_address inet,
  user_agent text,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes for performance
create index if not exists idx_vendor_activity_vendor 
  on public.vendor_activity_log (vendor_id, created_at desc);

create index if not exists idx_vendor_activity_type 
  on public.vendor_activity_log (action_type, created_at desc);

create index if not exists idx_vendor_activity_category 
  on public.vendor_activity_log (action_category, created_at desc);

create index if not exists idx_vendor_activity_entity 
  on public.vendor_activity_log (related_entity_type, related_entity_id)
  where related_entity_id is not null;

create index if not exists idx_vendor_activity_created 
  on public.vendor_activity_log (created_at desc);

-- Composite index for common queries
create index if not exists idx_vendor_activity_vendor_category 
  on public.vendor_activity_log (vendor_id, action_category, created_at desc);

-- Enable RLS
alter table public.vendor_activity_log enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all activity logs" on public.vendor_activity_log;
create policy "Admins can view all activity logs"
  on public.vendor_activity_log
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Vendors can view their own activity" on public.vendor_activity_log;
create policy "Vendors can view their own activity"
  on public.vendor_activity_log
  for select
  using (auth.uid() = vendor_id);

drop policy if exists "Service can insert activity logs" on public.vendor_activity_log;
create policy "Service can insert activity logs"
  on public.vendor_activity_log
  for insert
  with check (true); -- Service role bypasses RLS

-- Function to log vendor activity
create or replace function public.log_vendor_activity(
  p_vendor_id uuid,
  p_action_type text,
  p_action_category text,
  p_description text,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
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
  insert into public.vendor_activity_log (
    vendor_id,
    action_type,
    action_category,
    description,
    related_entity_type,
    related_entity_id,
    metadata,
    ip_address,
    user_agent
  ) values (
    p_vendor_id,
    p_action_type,
    p_action_category,
    p_description,
    p_related_entity_type,
    p_related_entity_id,
    p_metadata,
    p_ip_address,
    p_user_agent
  )
  returning id into v_log_id;
  
  return v_log_id;
end;
$$;

-- Function to get activity statistics
create or replace function public.get_vendor_activity_stats(
  p_vendor_id uuid default null,
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
    'total_activities', count(*),
    'by_category', jsonb_object_agg(
      action_category,
      category_count
    ),
    'by_type', jsonb_object_agg(
      action_type,
      type_count
    ),
    'recent_activity_count', (
      select count(*)
      from public.vendor_activity_log
      where (p_vendor_id is null or vendor_id = p_vendor_id)
        and created_at >= timezone('utc', now()) - interval '24 hours'
    )
  )
  into v_result
  from (
    select 
      action_category,
      count(*) as category_count
    from public.vendor_activity_log
    where (p_vendor_id is null or vendor_id = p_vendor_id)
      and (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
    group by action_category
  ) categories
  full outer join (
    select 
      action_type,
      count(*) as type_count
    from public.vendor_activity_log
    where (p_vendor_id is null or vendor_id = p_vendor_id)
      and (p_start_date is null or created_at >= p_start_date)
      and (p_end_date is null or created_at <= p_end_date)
    group by action_type
  ) types on true;
  
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

