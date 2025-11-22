# Priority 2 Batch - Ready to Execute

## Batch Overview: Social Platform Tables (7 files)

**Status**: ✅ Ready to run  
**Estimated Time**: ~15 minutes + testing  
**Risk Level**: Medium (social platform features)

---

## Files in This Batch

### 1. Posts Table (File #8)
**File**: `20250201_update_rls_posts.sql`
- **Policies Updated**: 4 policies
- **Complexity**: Medium (has nested auth.uid() in EXISTS subquery)
- **Key Features**: Privacy levels (public/followers/private), nested follow checks

### 2. Comments Table (File #9)
**File**: `20250201_update_rls_comments.sql`
- **Policies Updated**: 4 policies
- **Complexity**: Low
- **Key Features**: Comment CRUD operations

### 3. Likes Table (File #10)
**File**: `20250201_update_rls_likes.sql`
- **Policies Updated**: 3 policies
- **Complexity**: Low
- **Key Features**: Like/unlike functionality

### 4. Follows Table (File #11)
**File**: `20250201_update_rls_follows.sql`
- **Policies Updated**: 3 policies
- **Complexity**: Low
- **Key Features**: Follow/unfollow functionality

### 5. Collections Table (File #12)
**File**: `20250201_update_rls_collections.sql`
- **Policies Updated**: 4 policies
- **Complexity**: Low
- **Key Features**: Public/private collections

### 6. Saves Table (File #13)
**File**: `20250201_update_rls_saves.sql`
- **Policies Updated**: 3 policies
- **Complexity**: Low
- **Key Features**: Save/unsave posts

### 7. Messages Table (File #14)
**File**: `20250201_update_rls_messages.sql`
- **Policies Updated**: 3 policies
- **Complexity**: Medium (checks both sender_id and recipient_id)
- **Key Features**: Direct messaging between users

---

## Execution Order

Run files in sequence (8 → 14):

1. Posts
2. Comments
3. Likes
4. Follows
5. Collections
6. Saves
7. Messages

---

## Testing Checklist (After All 7 Files)

### Posts Functionality
- [ ] User feed displays correctly
- [ ] Can create new posts
- [ ] Can edit own posts
- [ ] Can delete own posts
- [ ] Cannot edit/delete other users' posts
- [ ] Public posts visible to all
- [ ] Private posts only visible to owner
- [ ] Follower-only posts work correctly

### Comments Functionality
- [ ] Can comment on posts
- [ ] Can edit own comments
- [ ] Can delete own comments
- [ ] Cannot edit/delete other users' comments
- [ ] Comments display correctly

### Likes Functionality
- [ ] Can like posts
- [ ] Can unlike posts
- [ ] Like counts update correctly
- [ ] Cannot like as another user

### Follows Functionality
- [ ] Can follow other users
- [ ] Can unfollow users
- [ ] Follower counts update
- [ ] Feed shows followed users' posts

### Collections Functionality
- [ ] Can create collections (public/private)
- [ ] Can view own collections
- [ ] Can view public collections
- [ ] Cannot view others' private collections
- [ ] Can update/delete own collections

### Saves Functionality
- [ ] Can save posts to collections
- [ ] Can unsave posts
- [ ] Saved posts appear in collections
- [ ] Cannot save as another user

### Messages Functionality
- [ ] Can send messages to other users
- [ ] Can view received messages
- [ ] Can view sent messages
- [ ] Can mark messages as read
- [ ] Cannot view others' conversations

---

## Expected Results

After executing all 7 files:
- ✅ All social platform RLS policies optimized
- ✅ Performance improvement on feed queries
- ✅ All auth.uid() calls replaced with cached functions
- ✅ Privacy settings work correctly
- ✅ Social interactions (like, follow, comment) work smoothly

---

## Quick Execution Guide

For each file:
1. Open file in GitHub/editor
2. Copy all SQL content
3. Go to Supabase Dashboard → SQL Editor
4. Paste SQL
5. Click "Run"
6. Confirm if prompted
7. Review verification query results

**Tip**: Run all 7 files in sequence, then test once after the batch.

---

## Notes

- **Posts table** is the most complex (nested subqueries) - test thoroughly
- **Messages table** checks both sender/recipient - ensure both work
- All other tables are straightforward
- Each file includes verification queries at the end

---

## After This Batch

**Progress will be**: 14/24 files (58% complete)  
**Next Batch**: Priority 3 - Vendor & Admin Tables (8 files)  
**Estimated Time Remaining**: ~25 minutes + testing

