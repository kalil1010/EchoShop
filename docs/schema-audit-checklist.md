## Supabase Schema Audit Checklist

Run the following statements from the Supabase SQL editor to verify keys, relationships, and data integrity. Replace `public` with your schema if needed.

### 1. Primary Keys and Foreign Keys

```sql
-- Confirm every table exposes a primary key
select
  tc.table_name,
  kc.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kc
  on kc.constraint_name = tc.constraint_name
where tc.constraint_type = 'PRIMARY KEY'
order by tc.table_name;

-- List foreign keys and referenced targets
select
  tc.table_name,
  kc.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kc
  on kc.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, kc.column_name;
```

### 2. Nullable Foreign Keys

Ensure required references are non-null:

```sql
select column_name, is_nullable
from information_schema.columns
where table_name = 'profiles' and column_name in ('id', 'user_id');
```

Repeat for other relationships (`clothing_items.user_id`, `avatar_renders.user_id`, etc.) to confirm `is_nullable = 'NO'`.

### 3. Orphaned Records

Check for rows whose foreign keys do not match a user:

```sql
-- Profiles without an auth user
select p.*
from profiles p
left join auth.users u on u.id = p.id
where u.id is null;

-- Clothing items without profiles
select c.*
from clothing_items c
left join profiles p on p.id = c.user_id
where p.id is null;

-- Avatar renders without profiles
select a.*
from avatar_renders a
left join profiles p on p.id = a.user_id
where p.id is null;
```

### 4. Column Type Consistency

Confirm UUID wiring between tables:

```sql
select column_name, data_type
from information_schema.columns
where table_name in ('profiles', 'clothing_items', 'avatar_renders')
  and column_name in ('id', 'user_id')
order by table_name, column_name;
```

### 5. Cleanup Queries (Optional)

Remove any orphaned rows discovered above:

```sql
delete from clothing_items
where user_id not in (select id from profiles);

delete from avatar_renders
where user_id not in (select id from profiles);
```

Document findings and re-run until the reports show no missing keys or orphaned rows.
