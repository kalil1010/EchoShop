# AI Stylist - Personal Fashion Assistant

A complete, full-stack AI-powered fashion assistant web application built with Next.js, TypeScript, Tailwind CSS, Supabase, and Mistral AI.

## Features

- **Weather-Based Outfit Suggestions**: Get AI-powered outfit recommendations based on current weather conditions and your personal style preferences
- **Digital Closet Management**: Upload photos of your clothing items with automatic color analysis and organization
- **Multi-Garment Vision Pipeline**: Segment messy outfit photos into individual pieces with per-item moderation, color extraction, and AI descriptions
- **Interactive AI Stylist Chat**: Chat with your personal AI stylist for fashion advice and styling tips
- **AI Fashion Image Generator**: Create concept visuals securely via the Mistral image agent without exposing API credentials
- **User Authentication & Profiles**: Secure user accounts with personalized style preferences
- **Responsive Design**: Fully responsive design that works on desktop and mobile devices
- **Image Moderation**: Sightengine filters unsafe uploads while Mistral vision provides per-piece safety context before storage

## Technology Stack

### Frontend
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- ShadCN UI Components
- Lucide React Icons

### Backend & Services
- Supabase Auth
- Supabase Database
- Supabase Storage
- Mistral AI for text generation
- AccuWeather API
- IPinfo API for geolocation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Mistral AI API key
- Mistral image agent key & agent ID
- AccuWeather API key
- IPinfo API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-stylist
npm install
```

2. Copy `.env.example` to `.env.local` and fill in credentials.
3. Run `npm run dev` to start the development server.

### Vision Pipeline

The closet upload flow now runs a combined Sightengine + Mistral pipeline:

1. Detects and segments garments via Mistral's multimodal endpoint
2. Crops each bounding box locally with `sharp` using padded margins
3. Screens each crop with Sightengine before requesting Mistral descriptions and safety metadata
4. Verifies colours locally before saving to Supabase with a shared `outfit_group_id`

If segmentation or moderation fails, the system falls back to a single-piece crop and prompts the user for manual review. Ensure both `MISTRAL_API_KEY` (and optionally `MISTRAL_VISION_MODEL`) plus Sightengine credentials are configured in `.env.local`.

### Mistral Image Generation

Configure the following environment variables (managed in Railway for production):

- `MISTRAL_IMAGE_API_KEY` – dedicated key for the image-generation agent
- `MISTRAL_AGENT_ID` – agent identifier for the image workflow

These stay strictly on the server; the frontend never reads or exposes them.

## UX Revamp Notes

- Interactive onboarding, floating assistant, feedback reactions, and help section are now available.
- See `docs/ui-redesign-plan.md` and `docs/ui-redesign/changelog.md` for implementation details.

