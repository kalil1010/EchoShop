-- ------------------------------------------------------------------
-- Vendor Health Scoring System
-- ------------------------------------------------------------------
-- Tracks vendor health metrics and calculates trustworthiness scores

create extension if not exists "pgcrypto";

-- Vendor health scores table
create table if not exists public.vendor_health_scores (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references auth.users(id) on delete cascade,
  
  -- Score breakdown (each 0-100)
  overall_score integer default 100 not null,
  dispute_score decimal(5,2) default 100.0 not null,
  quality_score decimal(5,2) default 100.0 not null,
  compliance_score decimal(5,2) default 100.0 not null,
  response_score decimal(5,2) default 100.0 not null,
  payment_score decimal(5,2) default 100.0 not null,
  
  -- Raw metrics
  total_orders integer default 0 not null,
  dispute_count integer default 0 not null,
  return_count integer default 0 not null,
  avg_customer_rating decimal(3,2) default 5.0,
  avg_response_time_hours integer default 24,
  moderation_violations integer default 0 not null,
  payment_failures integer default 0 not null,
  
  -- Status
  days_since_last_violation integer,
  last_violation_date timestamptz,
  status text default 'good' not null check (status in ('excellent', 'good', 'warning', 'critical')),
  
  -- Timestamps
  last_calculated timestamptz default timezone('utc', now()) not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null,
  
  constraint score_range check (overall_score >= 0 and overall_score <= 100),
  constraint dispute_score_range check (dispute_score >= 0 and dispute_score <= 100),
  constraint quality_score_range check (quality_score >= 0 and quality_score <= 100),
  constraint compliance_score_range check (compliance_score >= 0 and compliance_score <= 100),
  constraint response_score_range check (response_score >= 0 and response_score <= 100),
  constraint payment_score_range check (payment_score >= 0 and payment_score <= 100)
);

-- Indexes for performance
create index if not exists idx_vendor_health_score on public.vendor_health_scores(overall_score);
create index if not exists idx_vendor_health_status on public.vendor_health_scores(status);
create index if not exists idx_vendor_health_updated on public.vendor_health_scores(updated_at desc);
create index if not exists idx_vendor_health_vendor on public.vendor_health_scores(vendor_id);

-- Materialized view for fast queries (refresh via cron)
create materialized view if not exists public.vendor_health_summary as
select 
  vhs.vendor_id,
  vhs.overall_score,
  vhs.status,
  vhs.dispute_count,
  vhs.return_count,
  vhs.moderation_violations,
  vhs.avg_customer_rating,
  vhs.last_calculated,
  p.email,
  p.vendor_business_name,
  p.role
from public.vendor_health_scores vhs
left join public.profiles p on p.id = vhs.vendor_id
where p.role = 'vendor';

create unique index if not exists idx_vendor_health_summary_vendor 
  on public.vendor_health_summary(vendor_id);

-- Function to calculate vendor health score
create or replace function public.calculate_vendor_health_score(p_vendor_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total_orders integer;
  v_dispute_count integer;
  v_return_count integer;
  v_avg_rating decimal;
  v_avg_response_time integer;
  v_violations integer;
  v_payment_failures integer;
  v_days_since_violation integer;
  v_last_violation timestamptz;
  
  v_dispute_score decimal(5,2);
  v_return_score decimal(5,2);
  v_quality_score decimal(5,2);
  v_response_score decimal(5,2);
  v_compliance_score decimal(5,2);
  v_payment_score decimal(5,2);
  v_overall_score integer;
  v_status text;
begin
  -- Get raw metrics from orders
  select 
    count(*)::integer,
    count(*) filter (where o.status = 'refunded' or o.payment_status = 'refunded')::integer,
    count(*) filter (where o.fulfillment_status = 'cancelled')::integer
  into v_total_orders, v_dispute_count, v_return_count
  from public.orders o
  where o.vendor_id = p_vendor_id;
  
  -- Get average rating (placeholder - would need reviews table)
  v_avg_rating := 5.0;
  
  -- Get average response time (placeholder - would need support tickets)
  v_avg_response_time := 24;
  
  -- Get moderation violations
  select count(*)::integer
  into v_violations
  from public.vendor_products vp
  where vp.vendor_id = p_vendor_id
    and vp.status = 'rejected'
    and vp.moderation_reasons is not null
    and array_length(vp.moderation_reasons, 1) > 0;
  
  -- Get payment failures
  select count(*)::integer
  into v_payment_failures
  from public.vendor_payouts vp
  where vp.vendor_id = p_vendor_id
    and vp.status = 'failed';
  
  -- Get last violation date
  select max(vp.updated_at)
  into v_last_violation
  from public.vendor_products vp
  where vp.vendor_id = p_vendor_id
    and vp.status = 'rejected'
    and vp.moderation_reasons is not null;
  
  if v_last_violation is not null then
    v_days_since_violation := extract(day from (timezone('utc', now()) - v_last_violation));
  else
    v_days_since_violation := null;
  end if;
  
  -- Calculate sub-scores
  
  -- Dispute score (25% weight) - target: <5% of orders have disputes
  if v_total_orders > 0 then
    v_dispute_score := greatest(0, 100 - ((v_dispute_count::decimal / v_total_orders::decimal * 100) * 20));
  else
    v_dispute_score := 100;
  end if;
  
  -- Return score (20% weight) - target: <10% return rate
  if v_total_orders > 0 then
    v_return_score := greatest(0, 100 - ((v_return_count::decimal / v_total_orders::decimal * 100) * 10));
  else
    v_return_score := 100;
  end if;
  
  -- Quality score (25% weight) - based on customer rating
  v_quality_score := (v_avg_rating / 5.0) * 100;
  
  -- Response time score (10% weight) - target: <24 hours
  v_response_score := greatest(0, 100 - least(50, (v_avg_response_time / 24.0) * 50));
  
  -- Compliance score (15% weight) - deduct for violations
  v_compliance_score := greatest(0, 100 - (v_violations * 20));
  
  -- Payment failures (5% weight)
  if v_payment_failures > 0 then
    v_payment_score := 50;
  else
    v_payment_score := 100;
  end if;
  
  -- Calculate overall score (weighted average)
  v_overall_score := (
    (v_dispute_score * 0.25) +
    (v_return_score * 0.20) +
    (v_quality_score * 0.25) +
    (v_response_score * 0.10) +
    (v_compliance_score * 0.15) +
    (v_payment_score * 0.05)
  )::integer;
  
  -- Determine status
  if v_overall_score >= 90 then
    v_status := 'excellent';
  elsif v_overall_score >= 75 then
    v_status := 'good';
  elsif v_overall_score >= 50 then
    v_status := 'warning';
  else
    v_status := 'critical';
  end if;
  
  -- Insert or update health score
  insert into public.vendor_health_scores (
    vendor_id,
    overall_score,
    dispute_score,
    quality_score,
    compliance_score,
    response_score,
    payment_score,
    total_orders,
    dispute_count,
    return_count,
    avg_customer_rating,
    avg_response_time_hours,
    moderation_violations,
    payment_failures,
    days_since_last_violation,
    last_violation_date,
    status,
    last_calculated,
    updated_at
  ) values (
    p_vendor_id,
    v_overall_score,
    v_dispute_score,
    v_quality_score,
    v_compliance_score,
    v_response_score,
    v_payment_score,
    v_total_orders,
    v_dispute_count,
    v_return_count,
    v_avg_rating,
    v_avg_response_time,
    v_violations,
    v_payment_failures,
    v_days_since_violation,
    v_last_violation,
    v_status,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (vendor_id) do update set
    overall_score = excluded.overall_score,
    dispute_score = excluded.dispute_score,
    quality_score = excluded.quality_score,
    compliance_score = excluded.compliance_score,
    response_score = excluded.response_score,
    payment_score = excluded.payment_score,
    total_orders = excluded.total_orders,
    dispute_count = excluded.dispute_count,
    return_count = excluded.return_count,
    avg_customer_rating = excluded.avg_customer_rating,
    avg_response_time_hours = excluded.avg_response_time_hours,
    moderation_violations = excluded.moderation_violations,
    payment_failures = excluded.payment_failures,
    days_since_last_violation = excluded.days_since_last_violation,
    last_violation_date = excluded.last_violation_date,
    status = excluded.status,
    last_calculated = excluded.last_calculated,
    updated_at = excluded.updated_at;
end;
$$;

-- Trigger to update updated_at
create or replace function public.update_vendor_health_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_vendor_health_scores_updated_at on public.vendor_health_scores;
create trigger trigger_update_vendor_health_scores_updated_at
  before update on public.vendor_health_scores
  for each row
  execute function public.update_vendor_health_scores_updated_at();

-- Enable RLS
alter table public.vendor_health_scores enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all health scores" on public.vendor_health_scores;
create policy "Admins can view all health scores"
  on public.vendor_health_scores
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Vendors can view their own health score" on public.vendor_health_scores;
create policy "Vendors can view their own health score"
  on public.vendor_health_scores
  for select
  using (auth.uid() = vendor_id);

drop policy if exists "Service can manage health scores" on public.vendor_health_scores;
create policy "Service can manage health scores"
  on public.vendor_health_scores
  for all
  with check (true); -- Service role bypasses RLS

-- Function to refresh materialized view
create or replace function public.refresh_vendor_health_summary()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.vendor_health_summary;
end;
$$;

