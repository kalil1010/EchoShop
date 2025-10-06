# AI Stylist - Personal Fashion Assistant

A complete, full-stack AI-powered fashion assistant web application built with Next.js, TypeScript, Tailwind CSS, Supabase, and Mistral AI.

## Features

- **Weather-Based Outfit Suggestions**: Get AI-powered outfit recommendations based on current weather conditions and your personal style preferences
- **Digital Closet Management**: Upload photos of your clothing items with automatic color analysis and organization
- **Interactive AI Stylist Chat**: Chat with your personal AI stylist for fashion advice and styling tips
- **User Authentication & Profiles**: Secure user accounts with personalized style preferences
- **Responsive Design**: Fully responsive design that works on desktop and mobile devices
- **Image Moderation**: All clothing uploads are screened by Sightengine to block unsafe or NSFW imagery before storage

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
- OpenWeatherMap API
- IPinfo API for geolocation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Mistral AI API key
- OpenWeatherMap API key
- IPinfo API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-stylist

### Sightengine Moderation

Set `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` in your environment (.env) so the `/api/moderate-image` endpoint can vet uploads before they reach Supabase. The development template includes default credentials provided for this exercise.
