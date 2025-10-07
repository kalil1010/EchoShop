# UI Revamp Changelog

## 2025-10-07

### Step 1 – Onboarding Foundation
- Added `OnboardingProvider`, shared context, and `TourOverlay` with `/api/user-tour` integrations.
- Tagged homepage feature cards with tour selectors for spotlight guidance.

### Step 2 – Homepage Redesign
- Rebuilt the hero using the new `FeatureCard` grid and `HowItWorksSection` walkthrough.
- Segmented Nearby New Arrivals and secondary features into dedicated sections with refreshed CTAs.

### Step 3 – Persistent Assistant Widget
- Implemented floating assistant widget backed by `/api/stylist-chat` assistant mode, with quick prompts and message history.
- Extended API client types to support the new `mode`, `reply`, and `meta` fields.

### Step 4 – Feedback & Guided Interactions
- Added reusable `ReactionBar` component for instant reactions and confetti moments.
- Introduced guided tip sidebars on Closet and Analyzer pages, plus celebratory confetti on closet uploads.

### Step 5 – Help & Documentation
- Added `HelpSection` on the homepage, pulling FAQ/help articles from `/api/help`.
- Documented rollout in `docs/ui-redesign-plan.md` and this changelog.

## Installation Note
Run `npm install` to install the new `canvas-confetti` dependency before building.

