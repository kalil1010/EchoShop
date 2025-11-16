-- ------------------------------------------------------------------
-- Vendor Branding Fields (Logo & Banner)
-- ------------------------------------------------------------------
-- Add logo and banner fields to profiles table for vendor branding

-- Add logo and banner fields to profiles
alter table public.profiles
  add column if not exists vendor_logo_url text,
  add column if not exists vendor_banner_url text,
  add column if not exists vendor_logo_path text, -- Storage path for logo
  add column if not exists vendor_banner_path text; -- Storage path for banner

-- Add indexes for vendor branding queries
create index if not exists idx_profiles_vendor_logo 
  on public.profiles (id) 
  where vendor_logo_url is not null;

create index if not exists idx_profiles_vendor_banner 
  on public.profiles (id) 
  where vendor_banner_url is not null;

-- ------------------------------------------------------------------
-- Verification Queries
-- ------------------------------------------------------------------

-- Verify columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'profiles' 
-- AND column_name IN ('vendor_logo_url', 'vendor_banner_url', 'vendor_logo_path', 'vendor_banner_path');

