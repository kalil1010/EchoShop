# Priority 2 - Final 3 Files Ready

## Status: 4/7 Complete → 3 Remaining

All 3 remaining files are straightforward and ready to execute.

---

## File #13: Collections Table

**File**: `20250201_update_rls_collections.sql`

**Policies**: 4 policies
- ✅ "Users can view public or own collections" (SELECT) - checks `is_public` OR owner
- ✅ "Users can create their own collections" (INSERT)
- ✅ "Users can update their own collections" (UPDATE)
- ✅ "Users can delete their own collections" (DELETE)

**Complexity**: Low - Simple owner checks plus public visibility

**Note**: The SELECT policy uses `is_public = true OR public._get_current_user_id() = user_id` - tests both conditions

---

## File #14: Saves Table

**File**: `20250201_update_rls_saves.sql`

**Policies**: 3 policies
- ✅ "Users can view their own saves" (SELECT)
- ✅ "Users can create their own saves" (INSERT)
- ✅ "Users can delete their own saves" (DELETE)

**Complexity**: Low - Simple owner checks only

**Note**: No UPDATE policy (saves are immutable - create/delete only)

---

## File #15: Messages Table

**File**: `20250201_update_rls_messages.sql`

**Policies**: 3 policies
- ✅ "Users can view their own messages" (SELECT) - checks BOTH sender_id AND recipient_id
- ✅ "Users can send messages" (INSERT) - checks sender_id
- ✅ "Users can update their received messages" (UPDATE) - checks recipient_id (mark as read)

**Complexity**: Medium - Dual user checks

**Important**: 
- SELECT policy checks: `sender_id OR recipient_id` (users see messages where they're involved)
- UPDATE policy only checks `recipient_id` (only recipient can mark as read)

---

## Execution Order

Run in sequence:
1. Collections (#13) - Already in clipboard
2. Saves (#14)
3. Messages (#15)

---

## Quick Testing Checklist (After All 3)

### Collections
- [ ] Can create collection (public/private)
- [ ] Can view own collections
- [ ] Can view public collections
- [ ] Cannot view others' private collections
- [ ] Can update/delete own collections

### Saves
- [ ] Can save posts to collections
- [ ] Can see saved posts
- [ ] Can unsave posts
- [ ] Cannot see others' saves

### Messages
- [ ] Can send messages
- [ ] Can view sent messages (as sender)
- [ ] Can view received messages (as recipient)
- [ ] Can mark received messages as read
- [ ] Cannot view messages not involving you

---

## After Completion

**Progress**: 14/24 files (58% complete)
- ✅ Priority 1: Complete (7 files)
- ✅ Priority 2: Complete (7 files)
- ⏳ Priority 3: Next (8 files)

**Next**: Priority 3 batch - Vendor & Admin tables (8 files, ~20 minutes)

---

## Notes

- All 3 files are straightforward
- Messages file is the most complex (dual checks) but still simple
- Collections file checks both public visibility AND ownership
- Each file includes verification queries at the end

Ready to complete Priority 2! 🚀

