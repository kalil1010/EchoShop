#!/bin/bash

echo "Setting up AI Stylist application..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    cp .env.example .env.local
    echo "Please update .env.local with your actual API keys"
fi

# Build the application
echo "Building application..."
npm run build

echo "Setup complete! Please:"
echo "1. Update .env.local with your API keys"
echo "2. Set up your Supabase project"
echo "3. Configure your external APIs (OpenWeatherMap, IPinfo, Mistral AI)"
echo "4. Run 'npm run dev' to start development server"
