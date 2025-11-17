-- ------------------------------------------------------------------
-- Communication Templates & Broadcast Messaging
-- ------------------------------------------------------------------
-- Message templates and broadcast messaging system

create extension if not exists "pgcrypto";

-- Message templates table
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  
  -- Template details
  template_name text not null,
  subject text not null,
  body text not null,
  template_type text not null check (template_type in ('email', 'sms', 'in_app', 'push')),
  
  -- Variables (for personalization)
  variables text[], -- e.g., ['vendor_name', 'order_number', 'amount']
  
  -- Usage
  usage_count integer default 0,
  last_used_at timestamptz,
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

-- Broadcast messages table
create table if not exists public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  
  -- Message details
  subject text not null,
  body text not null,
  message_type text not null check (message_type in ('email', 'sms', 'in_app', 'push')),
  
  -- Targeting
  target_segment text, -- 'all', 'vendors', 'customers', 'specific'
  target_vendor_ids uuid[],
  target_criteria jsonb, -- e.g., {"health_score": {"<": 50}, "status": "active"}
  
  -- Status
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  
  -- Statistics
  total_recipients integer default 0,
  sent_count integer default 0,
  failed_count integer default 0,
  opened_count integer default 0,
  clicked_count integer default 0,
  
  -- Metadata
  metadata jsonb,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

-- Vendor segments table (for targeted messaging)
create table if not exists public.vendor_segments (
  id uuid primary key default gen_random_uuid(),
  
  -- Segment details
  segment_name text not null unique,
  description text,
  
  -- Criteria (stored as JSONB for flexibility)
  criteria jsonb not null, -- e.g., {"health_score": {"<": 50}, "status": "active", "total_orders": {">": 100}}
  
  -- Statistics
  vendor_count integer default 0,
  last_calculated timestamptz,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id)
);

-- Broadcast recipients (track individual message delivery)
create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcast_messages(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  
  -- Delivery status
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_message_templates_type on public.message_templates(template_type);
create index if not exists idx_broadcast_messages_status on public.broadcast_messages(status, scheduled_at);
create index if not exists idx_broadcast_messages_created on public.broadcast_messages(created_at desc);
create index if not exists idx_vendor_segments_name on public.vendor_segments(segment_name);
create index if not exists idx_broadcast_recipients_broadcast on public.broadcast_recipients(broadcast_id);
create index if not exists idx_broadcast_recipients_recipient on public.broadcast_recipients(recipient_id);

-- Triggers
create or replace function public.update_message_templates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_message_templates_updated_at on public.message_templates;
create trigger trigger_update_message_templates_updated_at
  before update on public.message_templates
  for each row
  execute function public.update_message_templates_updated_at();

create or replace function public.update_broadcast_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trigger_update_broadcast_messages_updated_at on public.broadcast_messages;
create trigger trigger_update_broadcast_messages_updated_at
  before update on public.broadcast_messages
  for each row
  execute function public.update_broadcast_messages_updated_at();

-- Enable RLS
alter table public.message_templates enable row level security;
alter table public.broadcast_messages enable row level security;
alter table public.vendor_segments enable row level security;
alter table public.broadcast_recipients enable row level security;

-- RLS Policies
drop policy if exists "Admins can view all templates" on public.message_templates;
create policy "Admins can view all templates"
  on public.message_templates
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Service can manage templates" on public.message_templates;
create policy "Service can manage templates"
  on public.message_templates
  for all
  with check (true);

drop policy if exists "Admins can view all broadcasts" on public.broadcast_messages;
create policy "Admins can view all broadcasts"
  on public.broadcast_messages
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

drop policy if exists "Service can manage broadcasts" on public.broadcast_messages;
create policy "Service can manage broadcasts"
  on public.broadcast_messages
  for all
  with check (true);

drop policy if exists "Service can manage segments" on public.vendor_segments;
create policy "Service can manage segments"
  on public.vendor_segments
  for all
  with check (true);

drop policy if exists "Service can manage recipients" on public.broadcast_recipients;
create policy "Service can manage recipients"
  on public.broadcast_recipients
  for all
  with check (true);

