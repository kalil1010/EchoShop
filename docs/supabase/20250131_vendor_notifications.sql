-- ------------------------------------------------------------------
-- Vendor Notifications System
-- ------------------------------------------------------------------
-- In-app notifications for vendors (moderation, orders, payouts, messages)

-- Notifications table
create table if not exists public.vendor_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('moderation', 'order', 'payout', 'message', 'system')),
  title text not null,
  message text not null,
  link text, -- Optional link to related resource (e.g., /atlas/products/123)
  metadata jsonb, -- Additional data (order_id, product_id, etc.)
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz -- Optional expiration for time-sensitive notifications
);

-- Indexes for efficient queries
create index if not exists idx_vendor_notifications_user 
  on public.vendor_notifications (user_id, created_at desc);

create index if not exists idx_vendor_notifications_user_unread 
  on public.vendor_notifications (user_id, is_read, created_at desc) 
  where is_read = false;

create index if not exists idx_vendor_notifications_type 
  on public.vendor_notifications (user_id, type, created_at desc);

create index if not exists idx_vendor_notifications_expires 
  on public.vendor_notifications (expires_at) 
  where expires_at is not null;

-- RLS Policies
alter table public.vendor_notifications enable row level security;

-- Users can view their own notifications
drop policy if exists "Users can view their notifications" on public.vendor_notifications;
create policy "Users can view their notifications"
  on public.vendor_notifications
  for select
  using (auth.uid() = user_id);

-- System can insert notifications (via service role)
-- Note: In production, use service role for inserts from backend
drop policy if exists "Service can insert notifications" on public.vendor_notifications;
create policy "Service can insert notifications"
  on public.vendor_notifications
  for insert
  with check (true); -- Service role bypasses RLS

-- Users can update their own notifications (mark as read)
drop policy if exists "Users can update their notifications" on public.vendor_notifications;
create policy "Users can update their notifications"
  on public.vendor_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Function to get unread notification count
create or replace function get_unread_notification_count(p_user_id uuid)
returns integer as $$
begin
  return (
    select count(*)
    from public.vendor_notifications
    where user_id = p_user_id
      and is_read = false
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
end;
$$ language plpgsql security definer;

-- Function to mark all notifications as read
create or replace function mark_all_notifications_read(p_user_id uuid)
returns integer as $$
declare
  v_count integer;
begin
  update public.vendor_notifications
  set is_read = true,
      read_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = p_user_id
    and is_read = false;
  
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- Function to create notification (for use in triggers or backend)
create or replace function create_vendor_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null,
  p_metadata jsonb default null,
  p_expires_at timestamptz default null
) returns uuid as $$
declare
  v_notification_id uuid;
begin
  insert into public.vendor_notifications (
    user_id,
    type,
    title,
    message,
    link,
    metadata,
    expires_at
  ) values (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_link,
    p_metadata,
    p_expires_at
  ) returning id into v_notification_id;
  
  return v_notification_id;
end;
$$ language plpgsql security definer;

-- Trigger to create notification when product moderation status changes
create or replace function notify_product_moderation_change()
returns trigger as $$
begin
  -- Only notify on status changes to 'active', 'rejected', or 'pending_review'
  if (old.status is distinct from new.status) and 
     (new.status in ('active', 'rejected', 'pending_review')) then
    
    declare
      v_title text;
      v_message text;
      v_link text;
    begin
      case new.status
        when 'active' then
          v_title := 'Product Approved';
          v_message := format('Your product "%s" has been approved and is now live!', new.title);
          v_link := format('/atlas/products?highlight=%s', new.id);
        when 'rejected' then
          v_title := 'Product Rejected';
          v_message := format('Your product "%s" was rejected. %s', 
            new.title,
            coalesce(new.moderation_message, 'Please review and resubmit.'));
          v_link := format('/atlas/products?highlight=%s', new.id);
        when 'pending_review' then
          v_title := 'Product Under Review';
          v_message := format('Your product "%s" is now under review.', new.title);
          v_link := format('/atlas/products?highlight=%s', new.id);
      end case;
      
      perform create_vendor_notification(
        new.vendor_id,
        'moderation',
        v_title,
        v_message,
        v_link,
        jsonb_build_object('product_id', new.id, 'status', new.status),
        null
      );
    end;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger (only if it doesn't exist)
drop trigger if exists trigger_notify_product_moderation on public.vendor_products;
create trigger trigger_notify_product_moderation
  after update of status on public.vendor_products
  for each row
  when (old.status is distinct from new.status)
  execute function notify_product_moderation_change();

-- Cleanup expired notifications (run periodically via cron or scheduled job)
create or replace function cleanup_expired_notifications()
returns integer as $$
declare
  v_count integer;
begin
  delete from public.vendor_notifications
  where expires_at is not null
    and expires_at < timezone('utc', now());
  
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'vendor_notifications';

-- Verify indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'vendor_notifications';

-- Test notification creation:
-- SELECT create_vendor_notification(
--   'user-id-here'::uuid,
--   'system',
--   'Test Notification',
--   'This is a test notification',
--   '/atlas',
--   '{"test": true}'::jsonb
-- );

