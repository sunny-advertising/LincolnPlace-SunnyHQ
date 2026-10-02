@AGENTS.md

# Project notes

- Design source of truth: `design/prototype.html`. Component classes in `src/app/globals.css` mirror it.
- Access is enforced by RLS in `supabase/migrations`. Any new table needs RLS enabled, an admin-write policy and a read policy using the `can_see_*` helpers, plus cases in `supabase/tests/rls_test.sql`. Run `npm run test:rls`.
- All page data is read with the user's session (`src/lib/supabase/server.ts`). The service-role client (`src/lib/supabase/admin.ts`) is only for auth admin calls after `requireAdmin()`.
- Editable content types are defined once in `src/lib/content.ts`.
- Never commit `.env.local` or real keys.
