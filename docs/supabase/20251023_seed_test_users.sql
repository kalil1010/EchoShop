-- ------------------------------------------------------------------
-- Seeding script for test users
-- ------------------------------------------------------------------

-- Function to create a user and their profile
create or replace function private.create_user(
  email text,
  password text,
  role text,
  full_name text
) returns uuid as $$
  declare
    user_id uuid;
  begin
    -- Create the user in auth.users
    user_id := auth.uid() from auth.users where auth.users.email = create_user.email;
    if user_id is null then
      insert into auth.users (email, encrypted_password, role, raw_user_meta_data)
      values (create_user.email, crypt(create_user.password, gen_salt('bf')), 'authenticated', json_build_object('full_name', create_user.full_name));
      user_id := auth.uid() from auth.users where auth.users.email = create_user.email;
    end if;

    -- Create the profile
    insert into public.profiles (id, full_name, role)
    values (user_id, create_user.full_name, create_user.role)
    on conflict (id) do nothing;

    return user_id;
  end;
$$ language plpgsql security definer;

-- Seed the users
do $$
begin
  -- Admin (owner)
  perform private.create_user('owner@zmoda.ai', 'password123', 'admin', 'ZMODA Owner');

  -- Vendor
  perform private.create_user('vendor@zmoda.ai', 'password123', 'vendor', 'ZMODA Vendor');

  -- User
  perform private.create_user('user@zmoda.ai', 'password123', 'user', 'ZMODA User');
end;
$$;
