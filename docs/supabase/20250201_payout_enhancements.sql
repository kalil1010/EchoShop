-- ------------------------------------------------------------------
-- Payout System Enhancements
-- ------------------------------------------------------------------
-- Adds hold/release functionality, dispute tracking, and compliance status

create extension if not exists "pgcrypto";

-- Add hold/release fields to vendor_payouts
alter table public.vendor_payouts
  add column if not exists is_held boolean not null default false,
  add column if not exists hold_reason text,
  add column if not exists held_at timestamptz,
  add column if not exists held_by uuid references auth.users(id),
  add column if not exists released_at timestamptz,
  add column if not exists released_by uuid references auth.users(id);

-- Add dispute tracking fields
alter table public.vendor_payouts
  add column if not exists dispute_count integer default 0 not null,
  add column if not exists chargeback_count integer default 0 not null,
  add column if not exists refund_amount numeric(10, 2) default 0 not null;

-- Add compliance status fields
alter table public.vendor_payouts
  add column if not exists kyc_verified boolean default false,
  add column if not exists tax_docs_verified boolean default false,
  add column if not exists compliance_status text default 'pending' 
    check (compliance_status in ('pending', 'verified', 'rejected', 'expired')),
  add column if not exists compliance_notes text;

-- Create index for held payouts
create index if not exists idx_vendor_payouts_held 
  on public.vendor_payouts (vendor_id, is_held, payout_date desc)
  where is_held = true;

-- Create index for compliance status
create index if not exists idx_vendor_payouts_compliance 
  on public.vendor_payouts (vendor_id, compliance_status);

-- Function to hold a payout
create or replace function public.hold_vendor_payout(
  p_payout_id uuid,
  p_reason text,
  p_held_by uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.vendor_payouts
  set 
    is_held = true,
    hold_reason = p_reason,
    held_at = timezone('utc', now()),
    held_by = p_held_by,
    updated_at = timezone('utc', now())
  where id = p_payout_id
    and status in ('pending', 'processing');
  
  if not found then
    raise exception 'Payout not found or cannot be held';
  end if;
end;
$$;

-- Function to release a payout
create or replace function public.release_vendor_payout(
  p_payout_id uuid,
  p_released_by uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update public.vendor_payouts
  set 
    is_held = false,
    hold_reason = null,
    released_at = timezone('utc', now()),
    released_by = p_released_by,
    updated_at = timezone('utc', now())
  where id = p_payout_id
    and is_held = true;
  
  if not found then
    raise exception 'Payout not found or is not held';
  end if;
end;
$$;

-- Function to update compliance status
create or replace function public.update_payout_compliance(
  p_payout_id uuid,
  p_kyc_verified boolean,
  p_tax_docs_verified boolean,
  p_compliance_status text,
  p_compliance_notes text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.vendor_payouts
  set 
    kyc_verified = p_kyc_verified,
    tax_docs_verified = p_tax_docs_verified,
    compliance_status = p_compliance_status,
    compliance_notes = p_compliance_notes,
    updated_at = timezone('utc', now())
  where id = p_payout_id;
  
  if not found then
    raise exception 'Payout not found';
  end if;
end;
$$;

