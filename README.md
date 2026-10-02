# Sunny Client Portal

A signed-in portal where Sunny Advertising shares media information with clients
(budgets, flighting, live material, material due, reporting links, key dates) and
keeps internal account processes for Sunny staff. First client: **Lincoln Place**.

The approved design is [`design/prototype.html`](design/prototype.html).

- Next.js 16 (App Router, TypeScript), Tailwind 4, Poppins
- Supabase: Postgres, Auth (magic links), Row Level Security
- Hosted on Vercel

## How access works

| Role | Who | Sees | Edits |
|---|---|---|---|
| `admin` | Sunny | Everything, every client | All content, users |
| `staff` | Sunny | Everything, including Sunny team pages and internal notes | Nothing |
| `client` | Client users | Only their client, limited to their scope (whole client, chosen states, or chosen estates) | Nothing |

Access is enforced in the database with RLS (`supabase/migrations/*_rls.sql`), not
just hidden in the UI. Helpers: `is_admin()`, `is_staff()`, `can_see_client()`,
`can_see_region()`, `can_see_estate()`, plus `can_see_whole_region()` and
`can_see_scoped()` for state-wide items. A client scoped to one estate can open its
state page but never sees a state-wide report (which would show other estates).

There is no public sign-up. An admin invites someone from **Users & access**;
the portal creates their account and shows a one-time sign-in link to copy and send.
After that they sign in at `/login` with an emailed magic link. Unknown emails get
the same "if you have access…" message and no account.

Sign-in links open `/auth/confirm`, which needs a button press. That stops email
link scanners (e.g. Outlook Safe Links) from using up the single-use link.

## Content model

Everything is scoped by `client_id`, so adding OfficeHQ is rows, not schema changes.

- `clients` → `regions` (states) → `estates`; `channels` per client
- `budgets`, `flights`, `live_placements`, `material_due` per estate
- `reports` (Whatagraph share links and PCRs), `key_dates`, `contacts`, `sheet_links` per client, optionally narrowed to a state or estate
- `internal_docs` (Markdown, staff only; `client_id` null = agency-wide)
- `profiles`, `user_scopes`, `invites`

Derived, never stored: material **overdue** (due date before today and not supplied)
and **due soon** (within 14 days) in `material_due_v`; placement **live / scheduled /
ended** in `live_placements_v`. "Today" uses the client's timezone (`clients.timezone`).

Whatagraph dashboards are shown as link cards, not embeds. Their share links are public:
anyone with the URL can view them, whatever the portal's login says.

Google Sheets are added as cards on **Sheets & links** (optionally staff only).

## Editing

Admins get **Edit page** on every page. It adds Edit/Delete to each row and an Add
button. Forms are generated from `src/lib/content.ts`; add a field there and it appears
in the form and is accepted by the save action. **Estates & channels** manages structure.

## Setup

### 1. Supabase project

Create a project (Sydney region), then apply the schema and seed. Either use the
Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push          # applies supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql
```

…or paste each file in `supabase/migrations/` (in order), then `supabase/seed.sql`, into the SQL editor.

In the dashboard, **Authentication**:

- **Sign In / Providers → Email:** turn off *Allow new users to sign up*. Keep Email enabled.
- **URL Configuration:** Site URL = the production URL; add `https://<prod-domain>/**` and
  `http://localhost:3000/**` to Redirect URLs.
- **Emails → Magic Link template:** paste `supabase/templates/magic_link.html`
  (the link must point at `/auth/confirm?token_hash=…`).
- **Emails → SMTP:** set up custom SMTP (e.g. Resend, Postmark). The built-in sender only
  delivers to your own team's addresses and is heavily rate limited, so client magic
  links won't arrive without it.
- **Email OTP expiry** (default 1 hour, max 24 hours) controls how long copied invite links last.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in the project URL, the anon/publishable key,
the service role key (server only) and `NEXT_PUBLIC_SITE_URL`. Never commit `.env.local`.

### 3. First admin

The seed adds an admin invite for lily@sunnyadvertising.com.au. Then:

```bash
npm run bootstrap-admin            # prints a one-time sign-in link
```

### 4. Run

```bash
npm install
npm run dev
```

### 5. Deploy (Vercel)

Import the repo in Vercel and set the four variables from `.env.example`
(`SUPABASE_SERVICE_ROLE_KEY` as a sensitive, server-only variable). Set
`NEXT_PUBLIC_SITE_URL` to the production URL and add it to Supabase's Redirect URLs.

## Tests

```bash
npm run lint && npm run typecheck
npm test            # date/money/FY helpers
npm run test:rls    # RLS suite on a throwaway local Postgres
```

`test:rls` applies the migrations and seed to a temporary Postgres (needs the
`postgres` binaries) and checks, for admin, staff, a whole-client client, a
one-state client, a one-estate client, a disabled user, another client's user, a user
with no profile and an anonymous request, exactly which rows are visible and which
writes are refused.

## Phase 2

- Sync from Google Sheets (master specs, budgets, live tracker), once sheet structures are confirmed
- Native performance charts if Whatagraph links aren't enough
