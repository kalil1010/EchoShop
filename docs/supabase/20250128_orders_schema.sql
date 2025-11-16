-- ------------------------------------------------------------------
-- Orders Table Schema for Vendor Marketplace
-- ------------------------------------------------------------------
-- This table stores customer orders for vendor products

create extension if not exists "pgcrypto";

-- Orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique, -- Human-readable order number (e.g., ORD-2025-001234)
  customer_id uuid not null references auth.users(id) on delete restrict,
  vendor_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
  
  -- Order totals
  subtotal numeric(10, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  shipping_cost numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  currency text not null default 'EGP',
  
  -- Customer information
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb, -- Full shipping address as JSON
  billing_address jsonb, -- Billing address (if different)
  
  -- Shipping information
  shipping_method text,
  tracking_number text,
  estimated_delivery_date timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  
  -- Payment information
  payment_method text, -- e.g., 'credit_card', 'paypal', 'cash_on_delivery'
  payment_transaction_id text,
  paid_at timestamptz,
  
  -- Notes and metadata
  customer_notes text,
  vendor_notes text,
  internal_notes text, -- For admin/internal use only
  metadata jsonb, -- Additional flexible data
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  cancelled_at timestamptz,
  cancelled_reason text
);

-- Order items table (many-to-many relationship)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.vendor_products(id) on delete restrict,
  vendor_id uuid not null references auth.users(id) on delete restrict,
  
  -- Product snapshot at time of order (in case product changes later)
  product_title text not null,
  product_description text,
  product_image_url text,
  product_sku text,
  
  -- Pricing
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  discount_amount numeric(10, 2) not null default 0,
  line_total numeric(10, 2) not null, -- (unit_price * quantity) - discount_amount
  currency text not null default 'EGP',
  
  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  
  -- Timestamps
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Create indexes for performance
create index if not exists idx_orders_order_number on public.orders (order_number);
create index if not exists idx_orders_customer_id on public.orders (customer_id);
create index if not exists idx_orders_vendor_id on public.orders (vendor_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
create index if not exists idx_orders_fulfillment_status on public.orders (fulfillment_status);
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_vendor_status on public.orders (vendor_id, status);

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);
create index if not exists idx_order_items_vendor_id on public.order_items (vendor_id);
create index if not exists idx_order_items_status on public.order_items (status);

-- Update triggers for updated_at
create or replace function public.touch_orders_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.touch_orders_updated_at();

create or replace function public.touch_order_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_order_items_updated_at on public.order_items;
create trigger trg_order_items_updated_at
before update on public.order_items
for each row execute function public.touch_order_items_updated_at();

-- Function to generate order number
create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  v_year text;
  v_sequence integer;
  v_order_number text;
begin
  v_year := to_char(timezone('utc', now()), 'YYYY');
  
  -- Get the next sequence number for this year
  select coalesce(max(
    (regexp_match(order_number, '(\d+)$'))[1]::integer
  ), 0) + 1
  into v_sequence
  from public.orders
  where order_number like 'ORD-' || v_year || '-%';
  
  -- Format: ORD-YYYY-XXXXXX (6 digits)
  v_order_number := 'ORD-' || v_year || '-' || lpad(v_sequence::text, 6, '0');
  
  return v_order_number;
end;
$$;

-- Enable RLS
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- RLS Policies for Orders

-- Customers can view their own orders
drop policy if exists "Customers can view their own orders" on public.orders;
create policy "Customers can view their own orders"
  on public.orders
  for select
  using (auth.uid() = customer_id);

-- Vendors can view orders for their products
drop policy if exists "Vendors can view their orders" on public.orders;
create policy "Vendors can view their orders"
  on public.orders
  for select
  using (auth.uid() = vendor_id);

-- Customers can create orders
drop policy if exists "Customers can create orders" on public.orders;
create policy "Customers can create orders"
  on public.orders
  for insert
  with check (auth.uid() = customer_id);

-- Vendors can update their orders (status, fulfillment, notes)
drop policy if exists "Vendors can update their orders" on public.orders;
create policy "Vendors can update their orders"
  on public.orders
  for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Customers can update their own orders (limited fields like shipping address)
drop policy if exists "Customers can update their own orders" on public.orders;
create policy "Customers can update their own orders"
  on public.orders
  for update
  using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and -- Only allow updating specific fields
    (old.status = new.status or new.status = 'cancelled') -- Can only cancel, not change other statuses
  );

-- Admins can view all orders
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- Admins can update all orders
drop policy if exists "Admins can update all orders" on public.orders;
create policy "Admins can update all orders"
  on public.orders
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- RLS Policies for Order Items

-- Customers can view items in their orders
drop policy if exists "Customers can view their order items" on public.order_items;
create policy "Customers can view their order items"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
    )
  );

-- Vendors can view items in their orders
drop policy if exists "Vendors can view their order items" on public.order_items;
create policy "Vendors can view their order items"
  on public.order_items
  for select
  using (auth.uid() = vendor_id);

-- Service role can insert order items (for checkout process)
drop policy if exists "Service role can insert order items" on public.order_items;
create policy "Service role can insert order items"
  on public.order_items
  for insert
  with check (true); -- API routes use service role

-- Vendors can update their order items
drop policy if exists "Vendors can update their order items" on public.order_items;
create policy "Vendors can update their order items"
  on public.order_items
  for update
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- Admins can view all order items
drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items"
  on public.order_items
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items');

-- Verify RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items');

-- Verify indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items');

