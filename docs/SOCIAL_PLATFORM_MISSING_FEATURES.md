# Missing Features from Social Platform Roadmap

After comparing the detailed roadmap with the current plan, here are the missing features that should be added:

## Database Enhancements

### Missing Database Functions
- `get_user_feed(user_id)` - Returns posts from followed users
- `get_post_likes_count(post_id)` - Returns like count for post
- `get_post_comments_count(post_id)` - Returns comment count for post
- `get_post_engagement(post_id)` - Returns combined likes and comments
- `extract_hashtags(text)` - Extracts hashtags from text
- `get_trending_hashtags(days)` - Returns trending hashtags
- `get_trending_posts(days)` - Returns trending posts
- `get_user_collections(user_id)` - Returns user's collections
- `get_conversation_messages(conversation_id)` - Returns messages in conversation

### Missing Database Triggers
- Auto-create notification on like
- Auto-create notification on comment
- Auto-create notification on follow
- Update post likes_count on like/unlike (or use computed views)
- Update post comments_count on comment (or use computed views)
- Auto-create hashtags when post is created
- Update hashtag post_count when posts are added/removed

### Missing Profile Updates
- Add `posts_count` column (or use computed view)
- Add `followers_count` column (or use computed view)
- Add `following_count` column (or use computed view)

### Missing Tables
- `collections` table (mentioned but not detailed)
- `collection_posts` junction table
- `messages` table for DMs
- `conversations` table (optional, for grouping messages)
- `communities` table
- `community_members` table
- `challenges` table
- `challenge_submissions` table
- `user_analytics` table (or use materialized views)

### Missing Indexes
- GIN indexes on array columns (hashtags, images)
- Composite indexes for common query patterns
- Materialized views for search optimization (optional)

## API Endpoints Missing

### Follow System
- `/api/follow/status/route.ts` - GET follow status check endpoint

### Search System
- `/api/search/suggestions/route.ts` - GET search suggestions/autocomplete endpoint

### Hashtags
- `/api/hashtags/[tag]/route.ts` should also GET hashtag info (post count, trending status)

### Analytics
- `/api/analytics/user/route.ts` - GET user analytics
- `/api/analytics/post/[id]/route.ts` - GET post analytics (views, engagement)

### Moderation
- `/api/report/post/route.ts` - POST report post
- `/api/report/user/route.ts` - POST report user

### Communities (Phase 5)
- `/api/communities/route.ts` - GET, POST
- `/api/communities/[id]/route.ts` - GET, PATCH, DELETE
- `/api/communities/[id]/join/route.ts` - POST join, DELETE leave
- `/api/communities/[id]/posts/route.ts` - GET community posts
- `/api/communities/[id]/members/route.ts` - GET members list

### Challenges (Phase 5)
- `/api/challenges/route.ts` - GET, POST
- `/api/challenges/[id]/route.ts` - GET, PATCH, DELETE
- `/api/challenges/[id]/submit/route.ts` - POST submission
- `/api/challenges/[id]/submissions/route.ts` - GET submissions

## Frontend Components Missing

### Post Components
- `PostGrid.tsx` - Grid layout for profile posts (masonry layout)
- `PostDetailPage` - `/app/post/[id]/page.tsx` - Individual post view page

### Hashtag Components
- `HashtagPage.tsx` - Hashtag detail page component (separate from page)

### Analytics Components
- `AnalyticsDashboard.tsx` - User analytics view
- `PostAnalytics.tsx` - Post analytics modal

### Moderation Components
- `ReportModal.tsx` - Report content modal
- `AdminModerationDashboard.tsx` - Admin moderation dashboard (if admin role exists)

### Community Components (Phase 5)
- `CommunityCard.tsx` - Community preview
- `CommunityHeader.tsx` - Community page header
- `JoinCommunityButton.tsx`
- `ChallengeCard.tsx` - Challenge preview
- `ChallengeSubmission.tsx` - Submit to challenge

## Frontend Pages Missing

- `/app/post/[id]/page.tsx` - Post detail page
- `/app/analytics/page.tsx` - User analytics dashboard
- `/app/communities/page.tsx` - Communities directory
- `/app/communities/[id]/page.tsx` - Community page
- `/app/challenges/page.tsx` - Challenges page
- `/app/challenges/[id]/page.tsx` - Challenge detail page

## Hooks Missing

- `useTrending.ts` - Trending content
- `useAnalytics.ts` - Fetch analytics data
- `useCommunities.ts` - Manage communities
- `useChallenges.ts` - Fetch and submit to challenges

## Features Missing

### Comment System Enhancements
- Comment moderation (flag inappropriate comments)
- Load more comments button with pagination

### Search System Enhancements
- Search suggestions/autocomplete endpoint
- Sort options (relevance, date, popularity)
- Materialized views for search optimization (optional)

### Hashtag System Enhancements
- Hashtag header with post count
- Related hashtags display
- Hashtag validation (alphanumeric, max length)

### Analytics & Tracking
- Track post views (analytics tracking middleware)
- User analytics: posts_count, likes_received, comments_received, followers_gained
- Post analytics: views, engagement rate, reach
- Analytics dashboard for users (own profile analytics)
- Post analytics modal (for post creators)
- Time-based analytics (daily, weekly, monthly)

### Moderation Features
- Report post functionality
- Report user functionality
- Admin moderation dashboard
- Auto-moderation for comments (spam detection)
- Content flagging system
- Moderation queue for admin review

### Testing Requirements
- Unit tests for critical functions
- Integration tests for API endpoints
- End-to-end testing of user flows
- Load testing (simulate high traffic)
- Security testing (SQL injection, XSS, CSRF)
- Test on multiple devices and browsers
- Accessibility testing (WCAG compliance)
- Test RLS policies
- Test notification generation
- Test real-time updates

### Empty States Missing
- No collections
- No notifications
- No messages

## Additional Considerations

### Post Schema Details
- Add `deleted_at` field for soft deletes
- Ensure proper unique constraints on junction tables

### Enhanced Feed Algorithm
- Feed preferences endpoint (user can choose feed type)
- Algorithm modes: chronological, algorithmic, trending

### Profile Enhancements
- Profile tabs: Posts, Saved, Tagged, About
- Followers/following lists (clickable counts)

### Direct Messaging (Phase 4)
- Full DM system with conversations
- Real-time messaging
- Message moderation

### Community Features (Phase 5)
- Style communities/groups
- Style challenges
- Challenge submissions

## Priority Additions

### High Priority (Should be in initial plan)
1. Database functions and triggers for counts and notifications
2. Post detail page (`/app/post/[id]/page.tsx`)
3. PostGrid component for profile posts
4. Follow status check endpoint
5. Search suggestions endpoint
6. Comment moderation
7. Analytics tracking middleware
8. Report functionality

### Medium Priority (Can be added in later phases)
1. Analytics dashboard
2. Moderation dashboard
3. Communities and challenges
4. Enhanced testing requirements

### Low Priority (Nice to have)
1. Materialized views for optimization
2. Advanced analytics features
3. Community features (can be Phase 5+)

