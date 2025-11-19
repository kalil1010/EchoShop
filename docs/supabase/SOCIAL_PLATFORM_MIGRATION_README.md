# Social Platform Migration Guide

## Overview

The social platform migration has been split into **two stages** to resolve circular dependency issues with RLS policies.

## Migration Files

1. **Stage 1**: `20250129_social_platform_tables_stage1.sql`
   - Creates all tables, indexes, functions, and triggers
   - Enables RLS on all tables (but does NOT create policies)
   - Must be run first

2. **Stage 2**: `20250129_social_platform_tables_stage2.sql`
   - Creates all RLS policies
   - Must be run after Stage 1

## Why Two Stages?

The original migration failed because the `posts` table RLS policy references the `follows` table before it was created. By splitting into two stages:

- **Stage 1**: All tables exist before any RLS policies reference them
- **Stage 2**: All RLS policies can safely reference any table

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. **Run Stage 1**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `20250129_social_platform_tables_stage1.sql`
   - Execute the migration
   - Verify it completes successfully

2. **Run Stage 2**:
   - In the same SQL Editor
   - Copy and paste the contents of `20250129_social_platform_tables_stage2.sql`
   - Execute the migration
   - Verify it completes successfully

### Option 2: Supabase CLI

```bash
# Run Stage 1
supabase db push docs/supabase/20250129_social_platform_tables_stage1.sql

# Run Stage 2
supabase db push docs/supabase/20250129_social_platform_tables_stage2.sql
```

## What Gets Created

### Tables (Stage 1)
- `posts` - User posts with images, captions, privacy settings
- `follows` - User follow relationships
- `likes` - Post likes
- `comments` - Post comments with threading
- `post_vendor_products` - Junction table for shoppable posts
- `hashtags` - Hashtag catalog
- `post_hashtags` - Post-hashtag relationships
- `collections` - User collections for saved posts
- `saves` - Saved posts
- `notifications` - User notifications
- `messages` - Direct messages
- `reports` - Content moderation reports
- `communities` - Style communities (Phase 5)
- `community_members` - Community membership
- `challenges` - Style challenges (Phase 5)
- `challenge_submissions` - Challenge submissions

### Functions (Stage 1)
- `extract_hashtags()` - Extract hashtags from text
- `get_user_feed()` - Get user's feed
- `get_post_likes_count()` - Get post likes count
- `get_post_comments_count()` - Get post comments count
- `get_post_engagement()` - Get post engagement metrics
- `get_trending_hashtags()` - Get trending hashtags
- `get_trending_posts()` - Get trending posts
- `get_user_collections()` - Get user collections
- `get_conversation_messages()` - Get conversation messages

### Triggers (Stage 1)
- Auto-create notifications on like/comment/follow
- Auto-extract hashtags from posts
- Update profile counts (posts, followers, following)
- Update hashtag post counts
- Update community member counts
- Update challenge submission counts

### RLS Policies (Stage 2)
- All row-level security policies for data access control
- Policies for posts, follows, likes, comments, etc.
- Admin policies for reports

## Verification

After running both stages, verify the migration:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('posts', 'follows', 'likes', 'comments', 'hashtags', 'communities', 'challenges')
ORDER BY table_name;

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_%' OR routine_name LIKE 'extract_%'
ORDER BY routine_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('posts', 'follows', 'likes', 'comments')
ORDER BY tablename;
```

## Troubleshooting

### Error: "relation does not exist"
- Make sure Stage 1 completed successfully before running Stage 2
- Check that all tables were created in Stage 1

### Error: "policy already exists"
- This is safe to ignore - the migration uses `DROP POLICY IF EXISTS` before creating policies
- The migration is idempotent and can be run multiple times

### Error: "function already exists"
- This is safe to ignore - functions use `CREATE OR REPLACE`
- The migration is idempotent

## Notes

- The original migration file (`20250129_social_platform_tables.sql`) is kept for reference but should not be run directly
- Both stage files are idempotent and can be safely re-run
- All RLS policies are created in Stage 2, so tables will be accessible only after Stage 2 completes

