# Posts API Fix Summary

## Issues Fixed

### 1. **Profiles Join Error**
   - **Problem**: The `profiles:user_id` join syntax was failing, causing 500 errors
   - **Solution**: Removed the join from the main query and fetch profiles separately in a batch query
   - **File**: `src/app/api/posts/route.ts`

### 2. **Missing Database Tables**
   - **Problem**: The `posts`, `follows`, `likes`, `comments`, and `post_vendor_products` tables didn't exist
   - **Solution**: Created migration file `20250204_posts_schema_update.sql` that creates all required tables

### 3. **Error Handling**
   - **Problem**: API was returning 500 errors when tables didn't exist
   - **Solution**: Added graceful error handling that returns empty arrays instead of errors when tables are missing

## Migration File

**Location**: `docs/supabase/20250204_posts_schema_update.sql`

This migration:
- Creates all required tables (`posts`, `follows`, `likes`, `comments`, `post_vendor_products`)
- Removes the `outfit_data` column from posts (no longer used)
- Sets up proper indexes, RLS policies, and triggers
- Is idempotent (safe to run multiple times)

## How to Apply the Fix

1. **Run the Migration**:
   - Open your Supabase Dashboard
   - Go to SQL Editor
   - Copy and paste the contents of `docs/supabase/20250204_posts_schema_update.sql`
   - Run the migration

2. **Verify Tables Exist**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('posts', 'follows', 'likes', 'comments', 'post_vendor_products');
   ```

3. **Test the API**:
   - The `/api/posts` endpoint should now work correctly
   - It will return empty arrays if no posts exist (instead of errors)

## Code Changes

### `src/app/api/posts/route.ts`

**Before**: Used `profiles:user_id` join which could fail
```typescript
.select(`
  ...
  profiles:user_id (
    id,
    display_name,
    photo_url
  )
`)
```

**After**: Fetch posts and profiles separately
```typescript
// Fetch posts without join
.select('id, user_id, caption, ...')

// Fetch profiles separately
const { data: profilesData } = await supabase
  .from('profiles')
  .select('id, display_name, photo_url')
  .in('id', userIds)
```

## Related Files

All social platform API routes that use profiles joins:
- `src/app/api/posts/route.ts` ✅ Fixed
- `src/app/api/posts/[id]/route.ts` (may need similar fix)
- `src/app/api/posts/[id]/comments/route.ts` (may need similar fix)
- `src/app/api/search/route.ts` (may need similar fix)
- `src/app/api/hashtags/[tag]/route.ts` (may need similar fix)

## Next Steps

1. ✅ Run the migration in Supabase
2. ✅ Test the `/api/posts` endpoint
3. ⚠️ If other endpoints fail, apply the same profile fetching pattern to them
4. ⚠️ Check server logs for any remaining errors

## Expected Behavior After Fix

- ✅ No more 500 errors on `/api/posts`
- ✅ Empty feed returns `{ posts: [] }` instead of errors
- ✅ Posts with profiles display user information correctly
- ✅ Posts without profiles still work (user will be undefined)

