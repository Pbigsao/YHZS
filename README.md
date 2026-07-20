# Community

A moderated community and event-voting platform built with Next.js, TypeScript, Netlify, and Supabase.

## Structure

- `apps/web`: the only web application, built with the Next.js App Router.
- `packages/core`: shared types and upload validation constants.
- `supabase/migrations`: database schema, RLS policies, Storage policies, and RPCs.

## Local setup

1. Create a Supabase project and add its URL and Publishable Key to `apps/web/.env.local`.
2. In Supabase Dashboard, open SQL Editor, create a new query, and run the complete contents of `supabase/SQL_EDITOR_CATCH_UP.sql` to apply the later database upgrades to an existing installation.
3. In Supabase Auth, enable email OTP/Magic Link and add both local and production callback URLs.
4. Promote the first operator after their first login:

```sql
update public.profiles set role = 'super_admin' where id = 'USER_UUID';
```

5. Run `pnpm dev:web`.

## Netlify

Create one Netlify site from this repository. The root `netlify.toml` builds the Next.js application. Configure the public Supabase environment variables in the site's Netlify settings.

Do not expose a Supabase service-role key in the browser application.
