-- ------------------------------------------------------------------
-- Dispute Resolution System
-- ------------------------------------------------------------------
-- Handles order disputes, chargebacks, and refund requests

create extension if not exists "pgcrypto";

-- Disputes table
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  
  -- Related entities
  order_id uuid references public.orders(id) on delete restrict,
  vendor_id uuid not null references auth.users(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  
  -- Dispute details
  dispute_type text not null check (dispute_type in ('chargeback', 'refund_request', 'payment_dispute', 'product_issue', 'delivery_issue', 'other')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed', 'escalated')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  
  -- Description
  title text not null,
  description text not null,
  customer_claim text,
  vendor_response text,
  
  -- Resolution
  resolution text,
  resolution_type text check (resolution_type in ('refund_full', 'refund_partial', 'replacement', 'credit', 'denied', 'other')),
  resolved_amount numeric(10, 2),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  
  -- Escalation
  escalated_at timestamptz,
  escalated_by uuid references auth.users(id),
  escalation_reason text,
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Dispute evidence table
create table if not exists public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  
  -- Evidence details
  evidence_type text not null, -- 'image', 'document', 'message', 'screenshot', 'other'
  file_url text,
  file_path text,
  description text,
  
  -- Who submitted
  submitted_by uuid not null references auth.users(id),
  submitted_by_type text not null check (submitted_by_type in ('customer', 'vendor', 'admin')),
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now())
);

-- Dispute timeline (audit trail)
create table if not exists public.dispute_timeline (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  
  -- Event details
  event_type text not null, -- 'created', 'status_change', 'evidence_added', 'response', 'resolution'
  description text not null,
  actor_id uuid references auth.users(id),
  actor_type text, -- 'customer', 'vendor', 'admin'
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_disputes_order on public.disputes(order_id);
create index if not exists idx_disputes_vendor on public.disputes(vendor_id, created_at desc);
create index if not exists idx_disputes_customer on public.disputes(customer_id, created_at desc);
create index if not exists idx_disputes_status on public.disputes(status, priority, created_at desc);
create index if not exists idx_disputes_type on public.disputes(dispute_type, status);

create index if not exists idx_dispute_evidence_dispute on public.dispute_evidence(dispute_id);
create index if not exists idx_dispute_timeline_dispute on public.dispute_timeline(dispute_id, created_at desc);

-- Triggers
create or replace function public.update_disputes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_disputes_updated_at on public.disputes;
create trigger trigger_update_disputes_updated_at
  before update on public.disputes
  for each row
  execute function public.update_disputes_updated_at();

-- Function to add timeline event
create or replace function public.add_dispute_timeline_event(
  p_dispute_id uuid,
  p_event_type text,
  p_description text,
  p_actor_id uuid,
  p_actor_type text,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  insert into public.dispute_timeline (
    dispute_id,
    event_type,
    description,
    actor_id,
    actor_type,
    metadata
  ) values (
    p_dispute_id,
    p_event_type,
    p_description,
    p_actor_id,
    p_actor_type,
    p_metadata
  )
  returning id into v_event_id;
  
  return v_event_id;
end;
$$;

-- Enable RLS
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;
alter table public.dispute_timeline enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all disputes" on public.disputes;
create policy "Admins can view all disputes"
  on public.disputes
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Customers can view their disputes" on public.disputes;
create policy "Customers can view their disputes"
  on public.disputes
  for select
  using (auth.uid() = customer_id);

drop policy if exists "Vendors can view their disputes" on public.disputes;
create policy "Vendors can view their disputes"
  on public.disputes
  for select
  using (auth.uid() = vendor_id);

drop policy if exists "Service can manage disputes" on public.disputes;
create policy "Service can manage disputes"
  on public.disputes
  for all
  with check (true);

drop policy if exists "Service can manage evidence" on public.dispute_evidence;
create policy "Service can manage evidence"
  on public.dispute_evidence
  for all
  with check (true);

drop policy if exists "Service can manage timeline" on public.dispute_timeline;
create policy "Service can manage timeline"
  on public.dispute_timeline
  for all
  with check (true);

