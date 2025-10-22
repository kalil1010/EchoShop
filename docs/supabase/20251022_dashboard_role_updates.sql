-- ------------------------------------------------------------------
-- Dashboard role enhancements & admin invitations
-- ------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- Extend profiles with admin/vendor metadata (safe to run multiple times)
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists vendor_business_name text,
  add column if not exists vendor_business_description text,
  add column if not exists vendor_business_address text,
  add column if not exists vendor_contact_email text,
  add column if not exists vendor_phone text,
  add column if not exists vendor_website text,
  add column if not exists vendor_approved_at timestamptz,
  add column if not exists vendor_approved_by uuid references auth.users(id);

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_super_admin
  on public.profiles (id)
  where is_super_admin = true;

-- Refresh vendor request status constraint to the canonical set
alter table public.vendor_requests
  drop constraint if exists vendor_requests_status_check;

alter table public.vendor_requests
  add constraint vendor_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.vendor_requests
  add column if not exists business_name text,
  add column if not exists business_description text,
  add column if not exists business_address text,
  add column if not exists product_categories text[],
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists tax_id text,
  add column if not exists submitted_at timestamptz not null default timezone('utc', now()),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists rejection_reason text;

create index if not exists idx_vendor_requests_user_id on public.vendor_requests (user_id);
create index if not exists idx_vendor_requests_status on public.vendor_requests (status);

-- ------------------------------------------------------------------
-- Admin invitation management
-- ------------------------------------------------------------------
create table if not exists public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null unique,
  invited_by uuid not null references auth.users(id),
  invitation_token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  accepted_at timestamptz
);

create index if not exists idx_admin_invitations_email on public.admin_invitations (invited_email);
create index if not exists idx_admin_invitations_token on public.admin_invitations (invitation_token);
create index if not exists idx_admin_invitations_status on public.admin_invitations (status);

alter table public.admin_invitations enable row level security;

drop policy if exists "Admins can view all invitations" on public.admin_invitations;
create policy "Admins can view all invitations"
  on public.admin_invitations
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can create invitations" on public.admin_invitations;
create policy "Admins can create invitations"
  on public.admin_invitations
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update invitations" on public.admin_invitations;
create policy "Admins can update invitations"
  on public.admin_invitations
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- OPTIONAL: designate a super admin by email (update before running)
-- update public.profiles
-- set is_super_admin = true
-- where email = 'owner@example.com'
--   and role = 'admin';
