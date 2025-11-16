-- ------------------------------------------------------------------
-- Vendor Assistants & Team Management
-- ------------------------------------------------------------------
-- This table allows vendors to invite assistants with different roles
-- to help manage their store

create extension if not exists "pgcrypto";

-- Vendor assistant invitations table
create table if not exists public.vendor_assistant_invitations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  assistant_role text not null default 'viewer'
    check (assistant_role in ('viewer', 'editor', 'manager')),
  invitation_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  permissions jsonb default '{}'::jsonb, -- Additional permissions (e.g., can_manage_orders, can_manage_products)
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint vendor_assistant_invitations_vendor_email_unique unique (vendor_id, invited_email)
);

-- Vendor assistants table (active team members)
create table if not exists public.vendor_assistants (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  assistant_id uuid not null references auth.users(id) on delete cascade,
  assistant_role text not null default 'viewer'
    check (assistant_role in ('viewer', 'editor', 'manager')),
  permissions jsonb default '{}'::jsonb,
  invited_by uuid not null references auth.users(id) on delete set null,
  invitation_id uuid references public.vendor_assistant_invitations(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  constraint vendor_assistants_vendor_assistant_unique unique (vendor_id, assistant_id)
);

-- Create indexes
create index if not exists idx_vendor_assistant_invitations_vendor_id 
  on public.vendor_assistant_invitations (vendor_id);
create index if not exists idx_vendor_assistant_invitations_email 
  on public.vendor_assistant_invitations (invited_email);
create index if not exists idx_vendor_assistant_invitations_token 
  on public.vendor_assistant_invitations (invitation_token);
create index if not exists idx_vendor_assistant_invitations_status 
  on public.vendor_assistant_invitations (status);

create index if not exists idx_vendor_assistants_vendor_id 
  on public.vendor_assistants (vendor_id);
create index if not exists idx_vendor_assistants_assistant_id 
  on public.vendor_assistants (assistant_id);
create index if not exists idx_vendor_assistants_role 
  on public.vendor_assistants (vendor_id, assistant_role);

-- Update trigger for updated_at
create or replace function public.touch_vendor_assistants_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_vendor_assistants_updated_at on public.vendor_assistants;
create trigger trg_vendor_assistants_updated_at
before update on public.vendor_assistants
for each row execute function public.touch_vendor_assistants_updated_at();

-- Enable RLS
alter table public.vendor_assistant_invitations enable row level security;
alter table public.vendor_assistants enable row level security;

-- RLS Policies for Invitations

-- Vendors can view their own invitations
drop policy if exists "Vendors can view their own invitations" on public.vendor_assistant_invitations;
create policy "Vendors can view their own invitations"
  on public.vendor_assistant_invitations
  for select
  using (auth.uid() = vendor_id);

-- Vendors can create invitations
drop policy if exists "Vendors can create invitations" on public.vendor_assistant_invitations;
create policy "Vendors can create invitations"
  on public.vendor_assistant_invitations
  for insert
  with check (auth.uid() = vendor_id);

-- Vendors can update their own invitations (e.g., revoke)
drop policy if exists "Vendors can update their own invitations" on public.vendor_assistant_invitations;
create policy "Vendors can update their own invitations"
  on public.vendor_assistant_invitations
  for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Invited users can view their own pending invitations (by token)
drop policy if exists "Users can view their own invitations" on public.vendor_assistant_invitations;
create policy "Users can view their own invitations"
  on public.vendor_assistant_invitations
  for select
  using (
    invited_email = (select email from auth.users where id = auth.uid())
    or auth.uid() = vendor_id
  );

-- RLS Policies for Assistants

-- Vendors can view their assistants
drop policy if exists "Vendors can view their assistants" on public.vendor_assistants;
create policy "Vendors can view their assistants"
  on public.vendor_assistants
  for select
  using (auth.uid() = vendor_id);

-- Assistants can view their own assignments
drop policy if exists "Assistants can view their assignments" on public.vendor_assistants;
create policy "Assistants can view their assignments"
  on public.vendor_assistants
  for select
  using (auth.uid() = assistant_id);

-- Vendors can manage their assistants
drop policy if exists "Vendors can manage their assistants" on public.vendor_assistants;
create policy "Vendors can manage their assistants"
  on public.vendor_assistants
  for all
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Service role can insert assistants (for invitation acceptance)
drop policy if exists "Service role can insert assistants" on public.vendor_assistants;
create policy "Service role can insert assistants"
  on public.vendor_assistants
  for insert
  with check (true); -- API routes use service role

-- Function to check if user is assistant for a vendor
create or replace function public.is_vendor_assistant(
  p_vendor_id uuid,
  p_assistant_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.vendor_assistants
    where vendor_id = p_vendor_id
      and assistant_id = p_assistant_id
      and removed_at is null
  );
end;
$$;

-- Function to get assistant role for a vendor
create or replace function public.get_vendor_assistant_role(
  p_vendor_id uuid,
  p_assistant_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  select assistant_role into v_role
  from public.vendor_assistants
  where vendor_id = p_vendor_id
    and assistant_id = p_assistant_id
    and removed_at is null;
  
  return v_role;
end;
$$;

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('vendor_assistant_invitations', 'vendor_assistants');

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('vendor_assistant_invitations', 'vendor_assistants');

