-- ------------------------------------------------------------------
-- Social Platform Database Schema
-- ------------------------------------------------------------------
-- This migration creates all tables, functions, and triggers needed
-- for the social platform features: posts, follows, likes, comments,
-- notifications, hashtags, saves, collections, and messaging.
-- ------------------------------------------------------------------

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- For text similarity and full-text search

-- ------------------------------------------------------------------
-- Posts Table
-- ------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  images text[] default '{}'::text[],
  image_paths text[] default '{}'::text[],
  outfit_data jsonb,
  privacy_level text not null default 'public'
    check (privacy_level in ('public', 'followers', 'private')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

-- Indexes for posts
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_privacy_level_idx on public.posts (privacy_level);
create index if not exists posts_deleted_at_idx on public.posts (deleted_at) where deleted_at is null;
-- GIN index for array columns
create index if not exists posts_images_gin_idx on public.posts using gin (images);
-- Full-text search index on caption
create index if not exists posts_caption_fts_idx on public.posts using gin (to_tsvector('english', coalesce(caption, '')));

-- Add updated_at trigger
create or replace function public.touch_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.touch_posts_updated_at();

-- Enable RLS
alter table public.posts enable row level security;

-- RLS Policies for posts
drop policy if exists "Users can view public posts" on public.posts;
create policy "Users can view public posts"
  on public.posts
  for select
  using (
    deleted_at is null and (
      privacy_level = 'public' or
      (privacy_level = 'followers' and (
        auth.uid() = user_id or
        exists (
          select 1 from public.follows
          where follower_id = auth.uid() and following_id = posts.user_id
        )
      )) or
      (privacy_level = 'private' and auth.uid() = user_id)
    )
  );

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Follows Table
-- ------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id != following_id)
);

-- Indexes for follows (both directions for efficient queries)
create index if not exists follows_follower_id_idx on public.follows (follower_id);
create index if not exists follows_following_id_idx on public.follows (following_id);

-- Enable RLS
alter table public.follows enable row level security;

-- RLS Policies for follows
drop policy if exists "Users can view all follows" on public.follows;
create policy "Users can view all follows"
  on public.follows
  for select
  using (true);

drop policy if exists "Users can create their own follows" on public.follows;
create policy "Users can create their own follows"
  on public.follows
  for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows"
  on public.follows
  for delete
  using (auth.uid() = follower_id);

-- ------------------------------------------------------------------
-- Likes Table
-- ------------------------------------------------------------------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, post_id)
);

-- Indexes for likes
create index if not exists likes_user_id_idx on public.likes (user_id);
create index if not exists likes_post_id_idx on public.likes (post_id);
create index if not exists likes_created_at_idx on public.likes (created_at desc);

-- Enable RLS
alter table public.likes enable row level security;

-- RLS Policies for likes
drop policy if exists "Users can view all likes" on public.likes;
create policy "Users can view all likes"
  on public.likes
  for select
  using (true);

drop policy if exists "Users can create their own likes" on public.likes;
create policy "Users can create their own likes"
  on public.likes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own likes" on public.likes;
create policy "Users can delete their own likes"
  on public.likes
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Comments Table
-- ------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

-- Indexes for comments
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists comments_post_id_idx on public.comments (post_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists comments_created_at_idx on public.comments (created_at desc);
create index if not exists comments_deleted_at_idx on public.comments (deleted_at) where deleted_at is null;

-- Add updated_at trigger
create or replace function public.touch_comments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.touch_comments_updated_at();

-- Enable RLS
alter table public.comments enable row level security;

-- RLS Policies for comments
drop policy if exists "Users can view non-deleted comments" on public.comments;
create policy "Users can view non-deleted comments"
  on public.comments
  for select
  using (deleted_at is null);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Post Vendor Products Junction Table
-- ------------------------------------------------------------------
create table if not exists public.post_vendor_products (
  post_id uuid not null references public.posts(id) on delete cascade,
  vendor_product_id uuid not null references public.vendor_products(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, vendor_product_id)
);

-- Indexes
create index if not exists post_vendor_products_post_id_idx on public.post_vendor_products (post_id);
create index if not exists post_vendor_products_vendor_product_id_idx on public.post_vendor_products (vendor_product_id);

-- Enable RLS
alter table public.post_vendor_products enable row level security;

-- RLS Policies
drop policy if exists "Users can view post vendor products" on public.post_vendor_products;
create policy "Users can view post vendor products"
  on public.post_vendor_products
  for select
  using (true);

drop policy if exists "Users can link products to their posts" on public.post_vendor_products;
create policy "Users can link products to their posts"
  on public.post_vendor_products
  for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_vendor_products.post_id and posts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can unlink products from their posts" on public.post_vendor_products;
create policy "Users can unlink products from their posts"
  on public.post_vendor_products
  for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_vendor_products.post_id and posts.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- Hashtags Table
-- ------------------------------------------------------------------
create table if not exists public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  post_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists hashtags_name_idx on public.hashtags (name);
create index if not exists hashtags_post_count_idx on public.hashtags (post_count desc);
create index if not exists hashtags_created_at_idx on public.hashtags (created_at desc);

-- Enable RLS
alter table public.hashtags enable row level security;

-- RLS Policies - hashtags are public
drop policy if exists "Hashtags are viewable by everyone" on public.hashtags;
create policy "Hashtags are viewable by everyone"
  on public.hashtags
  for select
  using (true);

-- ------------------------------------------------------------------
-- Post Hashtags Junction Table
-- ------------------------------------------------------------------
create table if not exists public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, hashtag_id)
);

-- Indexes
create index if not exists post_hashtags_post_id_idx on public.post_hashtags (post_id);
create index if not exists post_hashtags_hashtag_id_idx on public.post_hashtags (hashtag_id);

-- Enable RLS
alter table public.post_hashtags enable row level security;

-- RLS Policies
drop policy if exists "Users can view post hashtags" on public.post_hashtags;
create policy "Users can view post hashtags"
  on public.post_hashtags
  for select
  using (true);

drop policy if exists "Users can add hashtags to their posts" on public.post_hashtags;
create policy "Users can add hashtags to their posts"
  on public.post_hashtags
  for insert
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_hashtags.post_id and posts.user_id = auth.uid()
    )
  );

drop policy if exists "Users can remove hashtags from their posts" on public.post_hashtags;
create policy "Users can remove hashtags from their posts"
  on public.post_hashtags
  for delete
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_hashtags.post_id and posts.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- Collections Table
-- ------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  cover_image text,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists collections_user_id_idx on public.collections (user_id);
create index if not exists collections_is_public_idx on public.collections (is_public);
create index if not exists collections_created_at_idx on public.collections (created_at desc);

-- Add updated_at trigger
create or replace function public.touch_collections_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_collections_updated_at on public.collections;
create trigger trg_collections_updated_at
before update on public.collections
for each row execute function public.touch_collections_updated_at();

-- Enable RLS
alter table public.collections enable row level security;

-- RLS Policies
drop policy if exists "Users can view public or own collections" on public.collections;
create policy "Users can view public or own collections"
  on public.collections
  for select
  using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can create their own collections" on public.collections;
create policy "Users can create their own collections"
  on public.collections
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own collections" on public.collections;
create policy "Users can update their own collections"
  on public.collections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own collections" on public.collections;
create policy "Users can delete their own collections"
  on public.collections
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Saves Table
-- ------------------------------------------------------------------
create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  collection_name text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, post_id, collection_id)
);

-- Indexes
create index if not exists saves_user_id_idx on public.saves (user_id);
create index if not exists saves_post_id_idx on public.saves (post_id);
create index if not exists saves_collection_id_idx on public.saves (collection_id);

-- Enable RLS
alter table public.saves enable row level security;

-- RLS Policies
drop policy if exists "Users can view their own saves" on public.saves;
create policy "Users can view their own saves"
  on public.saves
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own saves" on public.saves;
create policy "Users can create their own saves"
  on public.saves
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saves" on public.saves;
create policy "Users can delete their own saves"
  on public.saves
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Notifications Table
-- ------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null
    check (type in ('follow', 'like', 'comment', 'reply', 'vendor_featured', 'challenge_invitation')),
  related_user_id uuid references auth.users(id) on delete set null,
  related_post_id uuid references public.posts(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_read_idx on public.notifications (read);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read, created_at desc);

-- Enable RLS
alter table public.notifications enable row level security;

-- RLS Policies
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "System can create notifications" on public.notifications;
create policy "System can create notifications"
  on public.notifications
  for insert
  with check (true); -- Notifications created by triggers/functions

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications
  for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Messages Table (Direct Messaging)
-- ------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint messages_no_self_message check (sender_id != recipient_id)
);

-- Indexes
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_recipient_id_idx on public.messages (recipient_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_conversation_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

-- Enable RLS
alter table public.messages enable row level security;

-- RLS Policies
drop policy if exists "Users can view their own messages" on public.messages;
create policy "Users can view their own messages"
  on public.messages
  for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages
  for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Users can update their received messages" on public.messages;
create policy "Users can update their received messages"
  on public.messages
  for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ------------------------------------------------------------------
-- Update Profiles Table with Social Counts
-- ------------------------------------------------------------------
-- Add columns for cached counts (optional, can use computed views instead)
alter table public.profiles
  add column if not exists posts_count integer not null default 0,
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0;

-- ------------------------------------------------------------------
-- Database Functions
-- ------------------------------------------------------------------

-- Function to extract hashtags from text
create or replace function public.extract_hashtags(text_content text)
returns text[] as $$
declare
  hashtags text[];
begin
  select array_agg(distinct lower(substring(match[1] from 2)))
  into hashtags
  from regexp_matches(text_content, '#(\w+)', 'g') as match;
  return coalesce(hashtags, '{}'::text[]);
end;
$$ language plpgsql immutable;

-- Function to get user feed (posts from followed users)
create or replace function public.get_user_feed(feed_user_id uuid, limit_count integer default 20, offset_count integer default 0)
returns table (
  post_id uuid,
  user_id uuid,
  caption text,
  images text[],
  outfit_data jsonb,
  privacy_level text,
  created_at timestamptz,
  likes_count bigint,
  comments_count bigint,
  user_liked boolean
) as $$
begin
  return query
  select
    p.id as post_id,
    p.user_id,
    p.caption,
    p.images,
    p.outfit_data,
    p.privacy_level,
    p.created_at,
    count(distinct l.id) as likes_count,
    count(distinct c.id) filter (where c.deleted_at is null) as comments_count,
    exists(
      select 1 from public.likes
      where likes.post_id = p.id and likes.user_id = feed_user_id
    ) as user_liked
  from public.posts p
  left join public.likes l on l.post_id = p.id
  left join public.comments c on c.post_id = p.id
  where
    p.deleted_at is null
    and (
      p.privacy_level = 'public'
      or (p.privacy_level = 'followers' and exists (
        select 1 from public.follows
        where follower_id = feed_user_id and following_id = p.user_id
      ))
      or p.user_id = feed_user_id
    )
    and (
      p.user_id = feed_user_id
      or exists (
        select 1 from public.follows
        where follower_id = feed_user_id and following_id = p.user_id
      )
    )
  group by p.id, p.user_id, p.caption, p.images, p.outfit_data, p.privacy_level, p.created_at
  order by p.created_at desc
  limit limit_count
  offset offset_count;
end;
$$ language plpgsql stable;

-- Function to get post likes count
create or replace function public.get_post_likes_count(post_uuid uuid)
returns bigint as $$
begin
  return (
    select count(*)::bigint
    from public.likes
    where post_id = post_uuid
  );
end;
$$ language plpgsql stable;

-- Function to get post comments count
create or replace function public.get_post_comments_count(post_uuid uuid)
returns bigint as $$
begin
  return (
    select count(*)::bigint
    from public.comments
    where post_id = post_uuid and deleted_at is null
  );
end;
$$ language plpgsql stable;

-- Function to get post engagement
create or replace function public.get_post_engagement(post_uuid uuid)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'likes_count', count(distinct l.id),
    'comments_count', count(distinct c.id) filter (where c.deleted_at is null)
  )
  into result
  from public.posts p
  left join public.likes l on l.post_id = p.id
  left join public.comments c on c.post_id = p.id
  where p.id = post_uuid;
  return result;
end;
$$ language plpgsql stable;

-- Function to get trending hashtags
create or replace function public.get_trending_hashtags(days_count integer default 7, limit_count integer default 10)
returns table (
  hashtag_id uuid,
  name text,
  post_count bigint
) as $$
begin
  return query
  select
    h.id as hashtag_id,
    h.name,
    count(distinct ph.post_id)::bigint as post_count
  from public.hashtags h
  join public.post_hashtags ph on ph.hashtag_id = h.id
  join public.posts p on p.id = ph.post_id
  where
    p.deleted_at is null
    and p.created_at >= timezone('utc', now()) - (days_count || ' days')::interval
  group by h.id, h.name
  order by post_count desc, h.created_at desc
  limit limit_count;
end;
$$ language plpgsql stable;

-- Function to get trending posts
create or replace function public.get_trending_posts(days_count integer default 2, limit_count integer default 20)
returns table (
  post_id uuid,
  user_id uuid,
  caption text,
  images text[],
  created_at timestamptz,
  engagement_score numeric
) as $$
begin
  return query
  select
    p.id as post_id,
    p.user_id,
    p.caption,
    p.images,
    p.created_at,
    (
      count(distinct l.id) * 1.0 +
      count(distinct c.id) filter (where c.deleted_at is null) * 2.0 +
      extract(epoch from (timezone('utc', now()) - p.created_at)) / 3600.0
    ) as engagement_score
  from public.posts p
  left join public.likes l on l.post_id = p.id
  left join public.comments c on c.post_id = p.id
  where
    p.deleted_at is null
    and p.privacy_level = 'public'
    and p.created_at >= timezone('utc', now()) - (days_count || ' days')::interval
  group by p.id, p.user_id, p.caption, p.images, p.created_at
  order by engagement_score desc
  limit limit_count;
end;
$$ language plpgsql stable;

-- Function to get user collections
create or replace function public.get_user_collections(user_uuid uuid)
returns table (
  collection_id uuid,
  name text,
  description text,
  cover_image text,
  is_public boolean,
  posts_count bigint,
  created_at timestamptz
) as $$
begin
  return query
  select
    c.id as collection_id,
    c.name,
    c.description,
    c.cover_image,
    c.is_public,
    count(distinct s.post_id)::bigint as posts_count,
    c.created_at
  from public.collections c
  left join public.saves s on s.collection_id = c.id
  where c.user_id = user_uuid
  group by c.id, c.name, c.description, c.cover_image, c.is_public, c.created_at
  order by c.created_at desc;
end;
$$ language plpgsql stable;

-- Function to get conversation messages (between two users)
-- Since there's no conversations table, this gets messages between two specific users
create or replace function public.get_conversation_messages(
  user1_id uuid,
  user2_id uuid,
  limit_count integer default 50,
  offset_count integer default 0
)
returns table (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  content text,
  read boolean,
  created_at timestamptz
) as $$
begin
  return query
  select
    m.id,
    m.sender_id,
    m.recipient_id,
    m.content,
    m.read,
    m.created_at
  from public.messages m
  where
    (m.sender_id = user1_id and m.recipient_id = user2_id)
    or (m.sender_id = user2_id and m.recipient_id = user1_id)
  order by m.created_at desc
  limit limit_count
  offset offset_count;
end;
$$ language plpgsql stable;

-- ------------------------------------------------------------------
-- Database Triggers
-- ------------------------------------------------------------------

-- Trigger to auto-create notification on like
create or replace function public.notify_on_like()
returns trigger as $$
begin
  -- Don't notify if user liked their own post
  if new.user_id != (select user_id from public.posts where id = new.post_id) then
    insert into public.notifications (user_id, type, related_user_id, related_post_id)
    select
      p.user_id,
      'like',
      new.user_id,
      new.post_id
    from public.posts p
    where p.id = new.post_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_like on public.likes;
create trigger trg_notify_on_like
after insert on public.likes
for each row execute function public.notify_on_like();

-- Trigger to auto-create notification on comment
create or replace function public.notify_on_comment()
returns trigger as $$
begin
  -- Notify post owner (if not the commenter)
  if new.user_id != (select user_id from public.posts where id = new.post_id) then
    insert into public.notifications (user_id, type, related_user_id, related_post_id)
    select
      p.user_id,
      'comment',
      new.user_id,
      new.post_id
    from public.posts p
    where p.id = new.post_id;
  end if;
  
  -- Notify parent comment owner (if replying to a comment)
  if new.parent_id is not null and new.user_id != (select user_id from public.comments where id = new.parent_id) then
    insert into public.notifications (user_id, type, related_user_id, related_post_id)
    select
      c.user_id,
      'reply',
      new.user_id,
      new.post_id
    from public.comments c
    where c.id = new.parent_id;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment
after insert on public.comments
for each row execute function public.notify_on_comment();

-- Trigger to auto-create notification on follow
create or replace function public.notify_on_follow()
returns trigger as $$
begin
  insert into public.notifications (user_id, type, related_user_id)
  values (new.following_id, 'follow', new.follower_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
after insert on public.follows
for each row execute function public.notify_on_follow();

-- Trigger to update hashtag post_count
create or replace function public.update_hashtag_post_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.hashtags
    set post_count = post_count + 1
    where id = new.hashtag_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.hashtags
    set post_count = greatest(0, post_count - 1)
    where id = old.hashtag_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_hashtag_post_count on public.post_hashtags;
create trigger trg_update_hashtag_post_count
after insert or delete on public.post_hashtags
for each row execute function public.update_hashtag_post_count();

-- Trigger to auto-extract and create hashtags when post is created/updated
create or replace function public.extract_and_create_hashtags()
returns trigger as $$
declare
  extracted_hashtags text[];
  hashtag_name text;
  hashtag_id_val uuid;
begin
  if new.caption is not null then
    extracted_hashtags := public.extract_hashtags(new.caption);
    
    foreach hashtag_name in array extracted_hashtags
    loop
      -- Insert or get hashtag
      insert into public.hashtags (name)
      values (hashtag_name)
      on conflict (name) do nothing;
      
      -- Get hashtag id
      select id into hashtag_id_val
      from public.hashtags
      where name = hashtag_name;
      
      -- Link to post (if not already linked)
      insert into public.post_hashtags (post_id, hashtag_id)
      values (new.id, hashtag_id_val)
      on conflict (post_id, hashtag_id) do nothing;
    end loop;
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_extract_hashtags on public.posts;
create trigger trg_extract_hashtags
after insert or update of caption on public.posts
for each row execute function public.extract_and_create_hashtags();

-- Trigger to update profile counts (posts_count)
create or replace function public.update_profile_posts_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles
    set posts_count = posts_count + 1
    where id = new.user_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.profiles
    set posts_count = greatest(0, posts_count - 1)
    where id = old.user_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_profile_posts_count on public.posts;
create trigger trg_update_profile_posts_count
after insert or delete on public.posts
for each row
when (old.deleted_at is null or new.deleted_at is not null)
execute function public.update_profile_posts_count();

-- Trigger to update profile counts (followers_count, following_count)
create or replace function public.update_profile_follow_counts()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    -- Increment following_count for follower
    update public.profiles
    set following_count = following_count + 1
    where id = new.follower_id;
    
    -- Increment followers_count for following
    update public.profiles
    set followers_count = followers_count + 1
    where id = new.following_id;
    
    return new;
  elsif TG_OP = 'DELETE' then
    -- Decrement following_count for follower
    update public.profiles
    set following_count = greatest(0, following_count - 1)
    where id = old.follower_id;
    
    -- Decrement followers_count for following
    update public.profiles
    set followers_count = greatest(0, followers_count - 1)
    where id = old.following_id;
    
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_profile_follow_counts on public.follows;
create trigger trg_update_profile_follow_counts
after insert or delete on public.follows
for each row execute function public.update_profile_follow_counts();

-- ------------------------------------------------------------------
-- Reports Table (Content Moderation)
-- ------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  reported_post_id uuid references public.posts(id) on delete cascade,
  type text not null check (type in ('post', 'user', 'comment')),
  reason text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reports_target_check check (
    (type = 'post' and reported_post_id is not null) or
    (type = 'user' and reported_user_id is not null) or
    (type = 'comment' and reported_post_id is not null)
  )
);

-- Indexes
create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists reports_reported_user_id_idx on public.reports (reported_user_id);
create index if not exists reports_reported_post_id_idx on public.reports (reported_post_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_type_idx on public.reports (type);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- Enable RLS
alter table public.reports enable row level security;

-- RLS Policies
drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
  on public.reports
  for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports
  for select
  using (auth.uid() = reporter_id);

-- Admins can view all reports
drop policy if exists "Admins can view all reports" on public.reports;
create policy "Admins can view all reports"
  on public.reports
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'owner')
    )
  );

-- Admins can update reports
drop policy if exists "Admins can update reports" on public.reports;
create policy "Admins can update reports"
  on public.reports
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('admin', 'owner')
    )
  );

-- ------------------------------------------------------------------
-- Communities Table (Phase 5)
-- ------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cover_image text,
  created_by uuid not null references auth.users(id) on delete cascade,
  is_public boolean not null default true,
  member_count integer not null default 0,
  post_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists communities_created_by_idx on public.communities (created_by);
create index if not exists communities_is_public_idx on public.communities (is_public);
create index if not exists communities_created_at_idx on public.communities (created_at desc);

-- Add updated_at trigger
create or replace function public.touch_communities_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_communities_updated_at on public.communities;
create trigger trg_communities_updated_at
before update on public.communities
for each row execute function public.touch_communities_updated_at();

-- Enable RLS
alter table public.communities enable row level security;

-- RLS Policies
drop policy if exists "Users can view public communities" on public.communities;
create policy "Users can view public communities"
  on public.communities
  for select
  using (is_public = true);

drop policy if exists "Users can create communities" on public.communities;
create policy "Users can create communities"
  on public.communities
  for insert
  with check (auth.uid() = created_by);

drop policy if exists "Users can update their communities" on public.communities;
create policy "Users can update their communities"
  on public.communities
  for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ------------------------------------------------------------------
-- Community Members Table (Phase 5)
-- ------------------------------------------------------------------
create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('member', 'moderator', 'admin')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (community_id, user_id)
);

-- Indexes
create index if not exists community_members_community_id_idx on public.community_members (community_id);
create index if not exists community_members_user_id_idx on public.community_members (user_id);

-- Enable RLS
alter table public.community_members enable row level security;

-- RLS Policies
drop policy if exists "Users can view community members" on public.community_members;
create policy "Users can view community members"
  on public.community_members
  for select
  using (true);

drop policy if exists "Users can join communities" on public.community_members;
create policy "Users can join communities"
  on public.community_members
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can leave communities" on public.community_members;
create policy "Users can leave communities"
  on public.community_members
  for delete
  using (auth.uid() = user_id);

-- Trigger to update community member_count
create or replace function public.update_community_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.communities
    set member_count = member_count + 1
    where id = new.community_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.communities
    set member_count = greatest(0, member_count - 1)
    where id = old.community_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_community_member_count on public.community_members;
create trigger trg_update_community_member_count
after insert or delete on public.community_members
for each row execute function public.update_community_member_count();

-- ------------------------------------------------------------------
-- Challenges Table (Phase 5)
-- ------------------------------------------------------------------
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image text,
  community_id uuid references public.communities(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default true,
  submission_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists challenges_community_id_idx on public.challenges (community_id);
create index if not exists challenges_created_by_idx on public.challenges (created_by);
create index if not exists challenges_is_active_idx on public.challenges (is_active);
create index if not exists challenges_start_date_idx on public.challenges (start_date);
create index if not exists challenges_end_date_idx on public.challenges (end_date);

-- Add updated_at trigger
create or replace function public.touch_challenges_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
before update on public.challenges
for each row execute function public.touch_challenges_updated_at();

-- Enable RLS
alter table public.challenges enable row level security;

-- RLS Policies
drop policy if exists "Users can view active challenges" on public.challenges;
create policy "Users can view active challenges"
  on public.challenges
  for select
  using (is_active = true);

drop policy if exists "Users can create challenges" on public.challenges;
create policy "Users can create challenges"
  on public.challenges
  for insert
  with check (auth.uid() = created_by);

drop policy if exists "Users can update their challenges" on public.challenges;
create policy "Users can update their challenges"
  on public.challenges
  for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ------------------------------------------------------------------
-- Challenge Submissions Table (Phase 5)
-- ------------------------------------------------------------------
create table if not exists public.challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default timezone('utc', now()),
  unique (challenge_id, post_id),
  unique (challenge_id, user_id) -- One submission per user per challenge
);

-- Indexes
create index if not exists challenge_submissions_challenge_id_idx on public.challenge_submissions (challenge_id);
create index if not exists challenge_submissions_post_id_idx on public.challenge_submissions (post_id);
create index if not exists challenge_submissions_user_id_idx on public.challenge_submissions (user_id);

-- Enable RLS
alter table public.challenge_submissions enable row level security;

-- RLS Policies
drop policy if exists "Users can view challenge submissions" on public.challenge_submissions;
create policy "Users can view challenge submissions"
  on public.challenge_submissions
  for select
  using (true);

drop policy if exists "Users can submit to challenges" on public.challenge_submissions;
create policy "Users can submit to challenges"
  on public.challenge_submissions
  for insert
  with check (auth.uid() = user_id);

-- Trigger to update challenge submission_count
create or replace function public.update_challenge_submission_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.challenges
    set submission_count = submission_count + 1
    where id = new.challenge_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.challenges
    set submission_count = greatest(0, submission_count - 1)
    where id = old.challenge_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_update_challenge_submission_count on public.challenge_submissions;
create trigger trg_update_challenge_submission_count
after insert or delete on public.challenge_submissions
for each row execute function public.update_challenge_submission_count();

