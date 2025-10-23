# Authentication and Roles

This document provides an overview of the role-based authentication and authorization system in the ZMODA AI application.

## Overview

The application supports three distinct user roles: `admin` (owner), `vendor`, and `user`. Each role has a specific login page and is granted access to different parts of the application.

## Roles

- **`admin`**: The `admin` role (also referred to as `owner`) has full access to the application, including the admin dashboard at `/downtown`.
- **`vendor`**: The `vendor` role is for users who have been approved to sell products on the marketplace. They have access to the vendor dashboard at `/atlas`.
- **`user`**: The `user` role is for regular users of the application.

## Login Flow

Each role has an exclusive login page:

- **Admins**: `/downtown`
- **Vendors**: `/atlas`
- **Users**: `/auth`

If a user attempts to log in through the wrong portal (e.g., a vendor at `/downtown`), they will be shown an error message and will not be able to proceed.

## Route Protection

Route protection is implemented at both the frontend (middleware) and backend (API route guards).

### Middleware

The `src/middleware.ts` file contains logic to protect the following routes:

- `/downtown`: Only accessible to users with the `admin` role.
- `/atlas`: Only accessible to users with the `vendor` role.
- `/api/admin`: Only accessible to users with the `admin` role.
- `/api/vendor`: Only accessible to users with the `vendor` role.

If an unauthenticated user tries to access a protected route, they are redirected to the `/auth` page. If an authenticated user with the wrong role tries to access a protected route, they are shown a `403 Forbidden` error (for API routes) or redirected to their dashboard (for frontend routes).

### API Route Guards

In addition to the middleware, each API route handler uses the `requireRole` function from `src/lib/security.ts` to ensure that the user has the required role for the requested operation. This provides a second layer of defense and ensures that the API is secure even if the middleware is bypassed.

## Supabase Configuration

User roles are stored in the `role` column of the `public.profiles` table in the Supabase database. This column should be of type `text` and can have one of the following values: `admin`, `vendor`, or `user`.

To assign a role to a user, you can update the `role` column for the corresponding user in the `profiles` table.

## Seeding Test Users

The `docs/supabase/20251023_seed_test_users.sql` script can be used to seed the database with test users for each role. This script creates the following users:

- `owner@zmoda.ai` (admin)
- `vendor@zmoda.ai` (vendor)
- `user@zmoda.ai` (user)

The password for all test users is `password123`.
