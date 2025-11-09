# Echo Shop UX/UI Revamp Plan

## Goals
- Make first-time experience welcoming and self-explanatory.
- Surface the four hero capabilities with compelling visuals and clear CTAs.
- Encourage exploration via context-aware tips, social-style reactions, and immediate feedback after every action.
- Refresh the visual system with consistent typography, iconography, and spacing tokens.
- Keep interactions delightful and fully responsive across desktop, tablet, and mobile.

## Audience Snapshots
| Persona | Needs | Pain Today |
| --- | --- | --- |
| New Visitor | Understand what Echo Shop does in 30 seconds. | Hero copy dense, no guided path. |
| Returning Stylist | Jump straight to outfit building or closet upload. | Navigation labels long, actions buried. |
| Fashion Enthusiast | Ongoing inspiration, wants quick tips. | Lacks persistent assistant or bite-sized guidance. |

## Visual Direction
- **Typography**: Adopt "Inter" (already loaded) with defined scale: 32/24/20/16/14.
- **Palette**: Keep purple primary (#7C3AED), add accent gradient (#EC4899 ? #7C3AED) for callouts, warm neutrals (#F1F5F9 background, #0F172A text).
- **Elevation**: Use 12/24dp drop shadows only on hero cards & floating widgets.
- **Illustrations**: Add soft, rounded line-art icons for each feature (Outfit, Closet, Analyzer, Chat).

## Page-Level Concepts
### 1. Interactive Onboarding Flow
```
Step 1 Overlay
+------------------------------------------+
¦  ?? Welcome to Echo Shop!                 ¦
¦  [Start tour] (primary CTA)             ¦
+------------------------------------------+
```
- Use `OnboardingProvider` context mounted in `_app`.
- Steps target data attributes (`data-tour='hero-card-outfit'`).
- Each step uses a translucent scrim with spotlight highlight.
- Include animated GIF/MP4 for outfit recommendation in step 3.
- Provide "Skip" and "Replay" actions stored in localStorage (`echo-shop-tour-completed`).

### 2. Homepage Layout (Desktop Wireframe)
```
+---------------------------------------------------------------+
¦ NAV: Logo | Explore | Closet | Analyzer | Help | Profile | ? ¦
+---------------------------------------------------------------¦
¦ HERO: "Style smarter" copy + 4 clickable feature cards        ¦
¦  [Outfit Builder] [Digital Closet] [Color Analyzer] [AI Chat] ¦
¦  Each card: icon, 2-line copy, CTA chip (Try now ?)           ¦
+---------------------------------------------------------------¦
¦ How Echo Shop    ¦ Nearby New Arrivals (carousel)                 ¦
¦ Works (3     ¦                                                ¦
¦ illustrated  ¦                                                ¦
¦ steps)       ¦                                                ¦
+---------------------------------------------------------------¦
¦ Weather Snapshot | Trending Fits | FAQ/How-to + video         ¦
+---------------------------------------------------------------+
```
- Mobile collapses feature cards into horizontal scroll, steps stack vertically.

### 3. Persistent Assistant Widget
- Floating button bottom-right: gradient pill "Need help with Echo Shop?".
- On click, expands to mini chat (latest messages + quick prompts).
- Powered by existing `/api/stylist-chat` with context set to onboarding hints.

### 4. Feedback & Reactions
- Add `ReactionBar` component under each major card (`ThumbsUp`, `Meh`, `MoreLikeThis`).
- Persist anonymously via Supabase table `feature_feedback` (columns: `feature_slug`, `reaction`, `user_id?`, `created_at`).

### 5. Feature Page Enhancements
| Page | Additions |
| --- | --- |
| My Closet | Left sidebar checklist (“1. Upload item ? 2. Add notes ? 3. Save palette”). Confetti animation on successful upload. |
| Color Analyzer | Tip callouts on right panel, quick color theory explainer. |
| Outfit | Stepper progress UI (Occasion ? Colors ? Result) with progress map. |

## Component Breakdown
- `components/onboarding/OnboardingProvider.tsx`
- `components/onboarding/TourOverlay.tsx`
- `components/ui/FeatureCard.tsx`
- `components/ui/ReactionBar.tsx`
- `components/chat/FloatingAssistant.tsx`
- `components/home/HowItWorks.tsx` illustrations.
- `contexts/OnboardingContext.tsx`
- `lib/feedback.ts` for Supabase writes.

## Implementation Phases
1. **Scaffolding (Week 1)**
   - Create FeatureCard, ReactionBar, FloatingAssistant shell.
   - Add FAQ section with embedded Loom/Vidyard placeholder.
2. **Onboarding (Week 2)**
   - Build OnboardingProvider with step config JSON.
   - Instrument hero cards and navigation with `data-tour` attributes.
3. **Visual Refresh (Week 2-3)**
   - Update global spacing tokens (`space-6`, `space-10`).
   - Replace old hero layout with new grid.
4. **Guided Feedback (Week 3)**
   - Hook ReactionBar to Supabase.
   - Add confetti animation (use `canvas-confetti` or lightweight custom).  
5. **QA & Responsive polish (Week 4)**
   - Test across Chrome/Safari/Firefox/iOS/Android.
   - Accessibility audit (focus traps, aria labels).

## Mockup References
- See `/docs/mockups/homepage-wireframe.png` (to be exported from Figma).
- See `/docs/onboarding-flow.pdf` for storyline.

## Documentation To Deliver
- `docs/ui-redesign/changelog.md`
- Updated `README` section for onboarding & assistant widgets.
- Loom walkthrough demonstrating tour + CTA flow.

## Open Questions
- Confirm Supabase table availability for feedback storage.
- Decide on animation library (Framer Motion vs CSS).  
- Is video asset budget available for “How it works” clips?

---
Prepared by: Codex (GPT-5)  
Date: $(Get-Date -Format 'yyyy-MM-dd')

