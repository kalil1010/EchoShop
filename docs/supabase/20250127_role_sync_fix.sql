-- ------------------------------------------------------------------
-- Role Sync Fix: Ensure role constraint includes all roles
-- and sync existing users' roles from auth metadata
-- ------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- 1. Update role constraint to include 'owner' role (if not already)
-- This ensures the constraint matches the codebase which uses both 'admin' and 'owner'
-- ------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'vendor', 'admin', 'owner'));

-- ------------------------------------------------------------------
-- 2. One-time sync: Update profiles.role from auth.users metadata
-- This fixes existing users who have roles in auth metadata but not in profiles
-- Only upgrades roles (never downgrades) for security
-- ------------------------------------------------------------------

-- Function to determine role hierarchy level
-- Returns: 1=user, 2=vendor, 3=owner/admin
create or replace function private.get_role_level(role_text text)
returns integer as $$
begin
  case lower(trim(role_text))
    when 'user' then return 1;
    when 'vendor' then return 2;
    when 'owner', 'admin' then return 3;
    else return 0;
  end case;
end;
$$ language plpgsql immutable;

-- Sync roles from auth metadata to profiles (one-time migration)
-- Only upgrades, never downgrades
do $$
declare
  user_record record;
  auth_role text;
  profile_role text;
  auth_level integer;
  profile_level integer;
  updated_count integer := 0;
begin
  for user_record in
    select 
      au.id,
      au.raw_user_meta_data->>'role' as auth_role,
      p.role as profile_role
    from auth.users au
    left join public.profiles p on p.id = au.id
    where au.raw_user_meta_data->>'role' is not null
      and p.id is not null
  loop
    auth_role := lower(trim(user_record.auth_role));
    profile_role := lower(trim(user_record.profile_role));
    
    -- Normalize 'admin' to 'owner' to match codebase
    if auth_role = 'admin' then
      auth_role := 'owner';
    end if;
    
    -- Skip if role is not valid
    if auth_role not in ('user', 'vendor', 'owner', 'admin') then
      continue;
    end if;
    
    -- Get role levels
    auth_level := private.get_role_level(auth_role);
    profile_level := private.get_role_level(profile_role);
    
    -- Only upgrade if auth role is higher than profile role
    if auth_level > profile_level then
      update public.profiles
      set 
        role = auth_role,
        updated_at = timezone('utc', now())
      where id = user_record.id;
      
      updated_count := updated_count + 1;
      
      raise notice 'Upgraded user % from % to %', 
        user_record.id, profile_role, auth_role;
    end if;
  end loop;
  
  raise notice 'Role sync completed: % users updated', updated_count;
end;
$$;

-- ------------------------------------------------------------------
-- 3. Create index on role column if it doesn't exist (for performance)
-- ------------------------------------------------------------------

create index if not exists idx_profiles_role on public.profiles (role);

-- ------------------------------------------------------------------
-- Verification queries (run these to check results)
-- ------------------------------------------------------------------

-- Check role distribution
-- select role, count(*) as count
-- from public.profiles
-- group by role
-- order by count desc;

-- Check for any remaining mismatches (auth metadata has role but profile doesn't match)
-- select 
--   au.id,
--   au.email,
--   au.raw_user_meta_data->>'role' as auth_role,
--   p.role as profile_role,
--   case 
--     when private.get_role_level(au.raw_user_meta_data->>'role') > private.get_role_level(p.role)
--     then 'NEEDS_UPGRADE'
--     else 'OK'
--   end as status
-- from auth.users au
-- join public.profiles p on p.id = au.id
-- where au.raw_user_meta_data->>'role' is not null
--   and au.raw_user_meta_data->>'role' != p.role
-- order by status desc;

