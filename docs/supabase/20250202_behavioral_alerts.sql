-- ------------------------------------------------------------------
-- Behavioral Alerts System
-- ------------------------------------------------------------------
-- Custom alert rules and automated monitoring

create extension if not exists "pgcrypto";

-- Alert rules table
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  
  -- Rule details
  rule_name text not null,
  description text,
  rule_type text not null, -- 'vendor_health', 'activity_pattern', 'financial', 'compliance', 'custom'
  
  -- Conditions (stored as JSONB for flexibility)
  conditions jsonb not null, -- e.g., {"metric": "health_score", "operator": "<", "value": 50}
  
  -- Actions
  auto_action text, -- 'suspend', 'hold_payout', 'notify', 'escalate', null for manual
  notification_recipients text[], -- Email addresses or user IDs
  
  -- Status
  is_active boolean not null default true,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

-- Alerts table (triggered alerts)
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.alert_rules(id) on delete cascade,
  
  -- Alert details
  alert_type text not null, -- Same as rule_type
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  
  -- Related entities
  vendor_id uuid references auth.users(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  
  -- Status
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_notes text,
  
  -- Metadata
  metadata jsonb, -- Context data, metrics, etc.
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Alert actions (track auto-actions taken)
create table if not exists public.alert_actions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  
  -- Action details
  action_type text not null, -- 'suspend', 'hold_payout', 'notify', 'escalate'
  action_status text not null default 'pending' check (action_status in ('pending', 'completed', 'failed')),
  action_result text,
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

-- Indexes
create index if not exists idx_alert_rules_active on public.alert_rules(is_active, rule_type);
create index if not exists idx_alert_rules_type on public.alert_rules(rule_type);

create index if not exists idx_alerts_status on public.alerts(status, created_at desc);
create index if not exists idx_alerts_vendor on public.alerts(vendor_id, created_at desc);
create index if not exists idx_alerts_rule on public.alerts(rule_id, created_at desc);
create index if not exists idx_alerts_severity on public.alerts(severity, status, created_at desc);
create index if not exists idx_alerts_type on public.alerts(alert_type, status);

create index if not exists idx_alert_actions_alert on public.alert_actions(alert_id);
create index if not exists idx_alert_actions_status on public.alert_actions(action_status);

-- Triggers
create or replace function public.update_alert_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_alert_rules_updated_at on public.alert_rules;
create trigger trigger_update_alert_rules_updated_at
  before update on public.alert_rules
  for each row
  execute function public.update_alert_rules_updated_at();

create or replace function public.update_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_alerts_updated_at on public.alerts;
create trigger trigger_update_alerts_updated_at
  before update on public.alerts
  for each row
  execute function public.update_alerts_updated_at();

-- Function to create an alert
create or replace function public.create_alert(
  p_rule_id uuid,
  p_alert_type text,
  p_severity text,
  p_title text,
  p_description text,
  p_vendor_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_alert_id uuid;
  v_rule record;
begin
  -- Get rule details
  select * into v_rule
  from public.alert_rules
  where id = p_rule_id
    and is_active = true;
  
  if not found then
    raise exception 'Alert rule not found or inactive';
  end if;
  
  -- Create alert
  insert into public.alerts (
    rule_id,
    alert_type,
    severity,
    title,
    description,
    vendor_id,
    related_entity_type,
    related_entity_id,
    metadata
  ) values (
    p_rule_id,
    p_alert_type,
    p_severity,
    p_title,
    p_description,
    p_vendor_id,
    p_related_entity_type,
    p_related_entity_id,
    p_metadata
  )
  returning id into v_alert_id;
  
  -- Execute auto-action if configured
  if v_rule.auto_action is not null then
    insert into public.alert_actions (
      alert_id,
      action_type,
      action_status
    ) values (
      v_alert_id,
      v_rule.auto_action,
      'pending'
    );
  end if;
  
  return v_alert_id;
end;
$$;

-- Enable RLS
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_actions enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all alert rules" on public.alert_rules;
create policy "Admins can view all alert rules"
  on public.alert_rules
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Service can manage alert rules" on public.alert_rules;
create policy "Service can manage alert rules"
  on public.alert_rules
  for all
  with check (true);

drop policy if exists "Admins can view all alerts" on public.alerts;
create policy "Admins can view all alerts"
  on public.alerts
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Service can manage alerts" on public.alerts;
create policy "Service can manage alerts"
  on public.alerts
  for all
  with check (true);

drop policy if exists "Service can manage alert actions" on public.alert_actions;
create policy "Service can manage alert actions"
  on public.alert_actions
  for all
  with check (true);

