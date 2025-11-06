-- ------------------------------------------------------------------
-- Row Level Security policies for profiles table
-- ------------------------------------------------------------------

-- Enable RLS on profiles table if not already enabled
alter table public.profiles enable row level security;

-- Drop existing policies if they exist (to allow re-running this migration)
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

-- Policy: Users can view their own profile
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Policy: Users can insert their own profile
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policy: Allow public read access to profiles (for marketplace, etc.)
-- This allows viewing profiles without authentication
create policy "Public profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

