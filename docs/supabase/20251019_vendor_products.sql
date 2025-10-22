-- Enable pgcrypto for uuid generation (safe to run multiple times)
create extension if not exists "pgcrypto";

-- Add a role column to profiles so that we can distinguish vendors
alter table public.profiles
  add column if not exists role text not null default 'user';

update public.profiles
set role = 'user'
where role is null or trim(role) = '';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'vendor', 'admin'));

-- Main vendor_products table stores listings supplied by vendors
create table if not exists public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  price numeric(10, 2) not null default 0,
  currency text not null default 'EGP',
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'active', 'rejected', 'archived')),
  primary_image_path text,
  primary_image_url text,
  gallery_paths text[] default '{}'::text[],
  gallery_urls text[] default '{}'::text[],
  moderation_status text,
  moderation_message text,
  moderation_category text,
  moderation_reasons text[],
  ai_description text,
  ai_colors jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vendor_products_vendor_id_idx on public.vendor_products (vendor_id);
create index if not exists vendor_products_status_idx on public.vendor_products (status);

alter table public.vendor_products enable row level security;

-- Vendors can manage their own inventory
drop policy if exists "Vendors manage their products" on public.vendor_products;
create policy "Vendors manage their products"
  on public.vendor_products
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Marketplace visitors can browse active products
drop policy if exists "Public can view active products" on public.vendor_products;
create policy "Public can view active products"
  on public.vendor_products
  for select
  using (status = 'active');

-- ------------------------------------------------------------------
-- Vendor onboarding requests
-- ------------------------------------------------------------------
create table if not exists public.vendor_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  message text,
  admin_notes text,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists vendor_requests_user_id_idx on public.vendor_requests (user_id);
create index if not exists vendor_requests_status_idx on public.vendor_requests (status);

create or replace function public.touch_vendor_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_vendor_requests_updated_at on public.vendor_requests;
create trigger trg_vendor_requests_updated_at
before update on public.vendor_requests
for each row execute function public.touch_vendor_requests_updated_at();

alter table public.vendor_requests enable row level security;

drop policy if exists "Vendor requests select by owner" on public.vendor_requests;
create policy "Vendor requests select by owner"
  on public.vendor_requests
  for select using (auth.uid() = user_id);

drop policy if exists "Vendor requests insert by owner" on public.vendor_requests;
create policy "Vendor requests insert by owner"
  on public.vendor_requests
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Vendor requests update by owner" on public.vendor_requests;
create policy "Vendor requests update by owner"
  on public.vendor_requests
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
