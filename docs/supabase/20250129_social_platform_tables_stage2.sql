-- ------------------------------------------------------------------
-- Social Platform Database Schema - Stage 2: RLS Policies
-- ------------------------------------------------------------------
-- This is Stage 2 of a two-stage migration.
-- Stage 1: Creates all tables, indexes, functions, and triggers
-- Stage 2: Creates all RLS policies (run after Stage 1)
-- ------------------------------------------------------------------
-- IMPORTANT: Run 20250129_social_platform_tables_stage1.sql FIRST
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- RLS Policies for Posts
-- ------------------------------------------------------------------
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
-- RLS Policies for Follows
-- ------------------------------------------------------------------
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
-- RLS Policies for Likes
-- ------------------------------------------------------------------
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
-- RLS Policies for Comments
-- ------------------------------------------------------------------
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
-- RLS Policies for Post Vendor Products
-- ------------------------------------------------------------------
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
-- RLS Policies for Hashtags
-- ------------------------------------------------------------------
drop policy if exists "Hashtags are viewable by everyone" on public.hashtags;
create policy "Hashtags are viewable by everyone"
  on public.hashtags
  for select
  using (true);

-- ------------------------------------------------------------------
-- RLS Policies for Post Hashtags
-- ------------------------------------------------------------------
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
-- RLS Policies for Collections
-- ------------------------------------------------------------------
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
-- RLS Policies for Saves
-- ------------------------------------------------------------------
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
-- RLS Policies for Notifications
-- ------------------------------------------------------------------
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
-- RLS Policies for Messages
-- ------------------------------------------------------------------
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
-- RLS Policies for Reports
-- ------------------------------------------------------------------
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
-- RLS Policies for Communities
-- ------------------------------------------------------------------
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
-- RLS Policies for Community Members
-- ------------------------------------------------------------------
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

-- ------------------------------------------------------------------
-- RLS Policies for Challenges
-- ------------------------------------------------------------------
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
-- RLS Policies for Challenge Submissions
-- ------------------------------------------------------------------
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

