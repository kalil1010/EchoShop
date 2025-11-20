-- ------------------------------------------------------------------
-- Posts Schema Update - Remove outfit_data and ensure tables exist
-- ------------------------------------------------------------------
-- This migration updates the posts table to remove outfit_data column
-- and ensures all social platform tables exist with correct schema
-- ------------------------------------------------------------------

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- Posts Table - Update to remove outfit_data
-- ------------------------------------------------------------------
-- Remove outfit_data column if it exists (no longer used in code)
alter table public.posts
  drop column if exists outfit_data;

-- Ensure posts table exists with correct schema
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  images text[] default '{}'::text[],
  image_paths text[] default '{}'::text[],
  privacy_level text not null default 'public'
    check (privacy_level in ('public', 'followers', 'private')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

-- Add columns if they don't exist (for existing tables)
do $$
begin
  if not exists (select 1 from information_schema.columns 
                 where table_schema = 'public' 
                 and table_name = 'posts' 
                 and column_name = 'image_paths') then
    alter table public.posts add column image_paths text[] default '{}'::text[];
  end if;
end $$;

-- Indexes for posts (create if not exists)
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_privacy_level_idx on public.posts (privacy_level);
create index if not exists posts_deleted_at_idx on public.posts (deleted_at) where deleted_at is null;
create index if not exists posts_images_gin_idx on public.posts using gin (images);

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

-- RLS Policies for posts (drop and recreate to ensure they're correct)
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
-- Follows Table - Ensure it exists
-- ------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id != following_id)
);

-- Indexes for follows
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
-- Likes Table - Ensure it exists
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
-- Comments Table - Ensure it exists
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
-- Post Vendor Products Junction Table - Ensure it exists
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

