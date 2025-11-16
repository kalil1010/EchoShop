-- ------------------------------------------------------------------
-- Vendor Payouts & Financials System
-- ------------------------------------------------------------------
-- Tracks vendor payouts, transactions, and financial statements

-- Payouts table
create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references auth.users(id) on delete cascade,
  payout_number text not null unique, -- Human-readable payout number (e.g., PAY-2025-001)
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EGP',
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  payout_date date not null, -- Scheduled payout date
  paid_at timestamptz, -- When payout was actually processed
  payment_method text, -- e.g., 'bank_transfer', 'paypal', 'stripe'
  payment_reference text, -- Transaction reference from payment processor
  notes text, -- Internal notes
  metadata jsonb, -- Additional data (order_ids, fees, etc.)
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Payout transactions (links orders to payouts)
create table if not exists public.vendor_payout_transactions (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.vendor_payouts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_item_id uuid, -- Specific order item if needed
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EGP',
  description text, -- e.g., "Order #12345 - Product Name"
  transaction_type text not null default 'sale' check (transaction_type in ('sale', 'refund', 'fee', 'adjustment')),
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_vendor_payouts_vendor 
  on public.vendor_payouts (vendor_id, payout_date desc);

create index if not exists idx_vendor_payouts_status 
  on public.vendor_payouts (vendor_id, status, payout_date desc);

create index if not exists idx_vendor_payouts_number 
  on public.vendor_payouts (payout_number);

create index if not exists idx_vendor_payout_transactions_payout 
  on public.vendor_payout_transactions (payout_id);

create index if not exists idx_vendor_payout_transactions_order 
  on public.vendor_payout_transactions (order_id);

-- RLS Policies
alter table public.vendor_payouts enable row level security;
alter table public.vendor_payout_transactions enable row level security;

-- Vendors can view their own payouts
drop policy if exists "Vendors can view their payouts" on public.vendor_payouts;
create policy "Vendors can view their payouts"
  on public.vendor_payouts
  for select
  using (auth.uid() = vendor_id);

-- Service can insert/update payouts (for admin/owner use)
drop policy if exists "Service can manage payouts" on public.vendor_payouts;
create policy "Service can manage payouts"
  on public.vendor_payouts
  for all
  with check (true); -- Service role bypasses RLS

-- Vendors can view their payout transactions
drop policy if exists "Vendors can view their transactions" on public.vendor_payout_transactions;
create policy "Vendors can view their transactions"
  on public.vendor_payout_transactions
  for select
  using (
    exists (
      select 1 from public.vendor_payouts
      where vendor_payouts.id = vendor_payout_transactions.payout_id
        and vendor_payouts.vendor_id = auth.uid()
    )
  );

-- Service can manage transactions
drop policy if exists "Service can manage transactions" on public.vendor_payout_transactions;
create policy "Service can manage transactions"
  on public.vendor_payout_transactions
  for all
  with check (true); -- Service role bypasses RLS

-- Function to generate payout number
create or replace function generate_payout_number()
returns text as $$
declare
  v_year text;
  v_sequence integer;
  v_number text;
begin
  v_year := extract(year from timezone('utc', now()))::text;
  
  -- Get next sequence number for this year
  select coalesce(max(
    (regexp_match(payout_number, '^PAY-' || v_year || '-(\d+)$'))[1]::integer
  ), 0) + 1
  into v_sequence
  from public.vendor_payouts
  where payout_number like 'PAY-' || v_year || '-%';
  
  v_number := 'PAY-' || v_year || '-' || lpad(v_sequence::text, 3, '0');
  return v_number;
end;
$$ language plpgsql;

-- Function to calculate pending payout amount for a vendor
create or replace function calculate_pending_payout(p_vendor_id uuid)
returns numeric as $$
declare
  v_total numeric;
begin
  -- Calculate total from orders that haven't been paid out yet
  select coalesce(sum(oi.price * oi.quantity), 0)
  into v_total
  from public.orders o
  join public.order_items oi on o.id = oi.order_id
  join public.vendor_products vp on oi.product_id = vp.id
  where vp.vendor_id = p_vendor_id
    and o.payment_status = 'paid'
    and o.status in ('completed', 'delivered')
    and not exists (
      select 1 from public.vendor_payout_transactions vpt
      where vpt.order_id = o.id
    );
  
  return coalesce(v_total, 0);
end;
$$ language plpgsql security definer;

-- Function to get payout summary for a vendor
create or replace function get_vendor_payout_summary(p_vendor_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'pending_amount', calculate_pending_payout(p_vendor_id),
    'total_paid', coalesce((
      select sum(amount)
      from public.vendor_payouts
      where vendor_id = p_vendor_id
        and status = 'paid'
    ), 0),
    'pending_count', (
      select count(*)
      from public.vendor_payouts
      where vendor_id = p_vendor_id
        and status in ('pending', 'processing')
    ),
    'paid_count', (
      select count(*)
      from public.vendor_payouts
      where vendor_id = p_vendor_id
        and status = 'paid'
    )
  ) into v_result;
  
  return v_result;
end;
$$ language plpgsql security definer;

-- Trigger to update updated_at timestamp
create or replace function update_vendor_payouts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_vendor_payouts_updated_at on public.vendor_payouts;
create trigger trigger_update_vendor_payouts_updated_at
  before update on public.vendor_payouts
  for each row
  execute function update_vendor_payouts_updated_at();

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('vendor_payouts', 'vendor_payout_transactions');

-- Test payout number generation:
-- SELECT generate_payout_number();

-- Test pending payout calculation:
-- SELECT calculate_pending_payout('vendor-id-here'::uuid);

-- Test payout summary:
-- SELECT get_vendor_payout_summary('vendor-id-here'::uuid);

