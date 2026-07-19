# YH Community

A moderated forum and event-voting platform built with Next.js, Vue, TypeScript, Netlify, and Supabase.

## Applications

- `apps/web`: public Next.js community site.
- `apps/admin`: Vue/Vite moderation and operations console.
- `packages/core`: shared types and upload validation constants.
- `supabase/migrations`: database schema, RLS policies, Storage policies, and vote transaction.

## Local setup

1. Create a Supabase project and copy `.env.example` to `.env.local` for the public site. Set equivalent `VITE_` variables in `apps/admin/.env.local`.
2. Apply `supabase/migrations/202607190001_initial_schema.sql` through the Supabase CLI or SQL editor.
3. In Supabase Auth, enable email OTP/Magic Link and add both local and production callback URLs.
4. Promote the first operator after their first login:

```sql
update public.profiles set role = 'admin' where id = 'USER_UUID';
```

5. Run `pnpm dev:web` and `pnpm dev:admin` in separate terminals.

## Netlify

Create two Netlify sites from this repository. Use `apps/web/netlify.toml` for the public site and `apps/admin/netlify.toml` for the admin site. Configure the corresponding public environment variables in each site's Netlify settings.

Do not expose a Supabase service-role key in either application.
