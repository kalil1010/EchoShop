-- ------------------------------------------------------------------
-- Vendor-Owner Internal Messaging System
-- ------------------------------------------------------------------
-- Allows vendors and owners to send/receive messages internally

-- Messages table for vendor-owner communication
create table if not exists public.vendor_owner_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null, -- Groups messages in a conversation thread
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  message text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for efficient queries
create index if not exists idx_vendor_owner_messages_conversation 
  on public.vendor_owner_messages (conversation_id, created_at desc);

create index if not exists idx_vendor_owner_messages_sender 
  on public.vendor_owner_messages (sender_id, created_at desc);

create index if not exists idx_vendor_owner_messages_recipient 
  on public.vendor_owner_messages (recipient_id, is_read, created_at desc);

create index if not exists idx_vendor_owner_messages_recipient_unread 
  on public.vendor_owner_messages (recipient_id, is_read) 
  where is_read = false;

-- RLS Policies
alter table public.vendor_owner_messages enable row level security;

-- Users can view messages where they are sender or recipient
drop policy if exists "Users can view their messages" on public.vendor_owner_messages;
create policy "Users can view their messages"
  on public.vendor_owner_messages
  for select
  using (
    auth.uid() = sender_id or 
    auth.uid() = recipient_id
  );

-- Users can insert messages where they are the sender
drop policy if exists "Users can send messages" on public.vendor_owner_messages;
create policy "Users can send messages"
  on public.vendor_owner_messages
  for insert
  with check (auth.uid() = sender_id);

-- Users can update messages they received (mark as read)
drop policy if exists "Users can update received messages" on public.vendor_owner_messages;
create policy "Users can update received messages"
  on public.vendor_owner_messages
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Function to get or create conversation ID between two users
create or replace function get_or_create_conversation(
  p_user1_id uuid,
  p_user2_id uuid
) returns uuid as $$
declare
  v_conversation_id uuid;
begin
  -- Try to find existing conversation
  select conversation_id into v_conversation_id
  from public.vendor_owner_messages
  where (sender_id = p_user1_id and recipient_id = p_user2_id)
     or (sender_id = p_user2_id and recipient_id = p_user1_id)
  limit 1;
  
  -- If no conversation exists, create a new one
  if v_conversation_id is null then
    v_conversation_id := gen_random_uuid();
  end if;
  
  return v_conversation_id;
end;
$$ language plpgsql security definer;

-- Function to get unread message count for a user
create or replace function get_unread_message_count(p_user_id uuid)
returns integer as $$
begin
  return (
    select count(*)
    from public.vendor_owner_messages
    where recipient_id = p_user_id
      and is_read = false
  );
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'vendor_owner_messages';

-- Verify indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'vendor_owner_messages';

