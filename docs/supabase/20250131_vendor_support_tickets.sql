-- ------------------------------------------------------------------
-- Vendor Support Tickets System (Update to existing messages table)
-- ------------------------------------------------------------------
-- Adds ticket status and priority to existing vendor_owner_messages table

-- Add ticket fields to existing vendor_owner_messages table
alter table public.vendor_owner_messages
  add column if not exists ticket_status text default 'open' check (ticket_status in ('open', 'in_progress', 'resolved', 'closed')),
  add column if not exists ticket_priority text default 'normal' check (ticket_priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists ticket_category text, -- e.g., 'product', 'order', 'payment', 'technical', 'other'
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id);

-- Create index for ticket status queries
create index if not exists idx_vendor_messages_ticket_status 
  on public.vendor_owner_messages (sender_id, ticket_status, created_at desc);

create index if not exists idx_vendor_messages_ticket_priority 
  on public.vendor_owner_messages (sender_id, ticket_priority, created_at desc);

-- Function to get ticket statistics for a vendor
create or replace function get_vendor_ticket_stats(p_vendor_id uuid)
returns jsonb as $$
begin
  return jsonb_build_object(
    'open', (
      select count(*)
      from public.vendor_owner_messages
      where sender_id = p_vendor_id
        and ticket_status = 'open'
    ),
    'in_progress', (
      select count(*)
      from public.vendor_owner_messages
      where sender_id = p_vendor_id
        and ticket_status = 'in_progress'
    ),
    'resolved', (
      select count(*)
      from public.vendor_owner_messages
      where sender_id = p_vendor_id
        and ticket_status = 'resolved'
    ),
    'closed', (
      select count(*)
      from public.vendor_owner_messages
      where sender_id = p_vendor_id
        and ticket_status = 'closed'
    ),
    'total', (
      select count(distinct conversation_id)
      from public.vendor_owner_messages
      where sender_id = p_vendor_id
    )
  );
end;
$$ language plpgsql security definer;

-- Update existing messages to have default ticket status
update public.vendor_owner_messages
set ticket_status = 'open'
where ticket_status is null;

