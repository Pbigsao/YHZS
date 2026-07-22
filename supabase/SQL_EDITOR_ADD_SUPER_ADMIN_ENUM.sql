-- Run this file first in the Supabase SQL Editor.
-- PostgreSQL requires the new enum value to be committed before any later
-- statement can reference it, so run the promotion file in a second query.

alter type public.app_role add value if not exists 'super_admin';
