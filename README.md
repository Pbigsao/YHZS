# YH Community

A moderated forum and event-voting platform built with Next.js, Vue, TypeScript, Netlify, and Supabase.

## Applications

- `apps/web`: public Next.js community site.
- `apps/admin`: Vue/Vite moderation and operations console.
- `packages/core`: shared types and upload validation constants.
- `supabase/migrations`: database schema, RLS policies, Storage policies, and vote transaction.

## Local setup

1. Create a Supabase project and add its URL and Publishable Key to `apps/web/.env.local`. Set equivalent `VITE_` variables in `apps/admin/.env.local`.
2. Apply all files in `supabase/migrations/` in filename order through the Supabase CLI or SQL editor. Existing projects that already ran the initial schema must also run `202607190002_add_super_admin_role.sql` and `202607190003_update_role_permissions.sql`.
3. In Supabase Auth, enable email OTP/Magic Link and add both local and production callback URLs.
4. Promote the first operator after their first login:

```sql
update public.profiles set role = 'super_admin' where id = 'USER_UUID';
```

5. Run `pnpm dev:web` and `pnpm dev:admin` in separate terminals.

## Netlify

Create two Netlify sites from this repository. Use `apps/web/netlify.toml` for the public site and `apps/admin/netlify.toml` for the admin site. Configure the corresponding public environment variables in each site's Netlify settings.

Do not expose a Supabase service-role key in either application.
