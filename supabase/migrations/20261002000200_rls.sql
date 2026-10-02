-- Access control. The UI hides things too, but these policies are what actually protect data.
--
--   admin  : Sunny. Reads and writes everything, manages users.
--   staff  : Sunny. Reads everything, including staff-only content. No writes.
--   client : Reads only their client, limited to the regions/estates in user_scopes.
--            Never reads staff-only content.
--
-- Helpers are SECURITY DEFINER so policies can consult profiles/user_scopes
-- without recursing through those tables' own policies.

create function public.my_role() returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.disabled_at is null
$$;

create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.is_staff() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.my_role() in ('admin', 'staff'), false)
$$;

-- Scope rows that apply to the current (active, client-role) user for a client.
create function public.my_scopes(p_client_id uuid)
returns table (region_id uuid, estate_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select s.region_id, s.estate_id
  from public.user_scopes s
  join public.profiles p on p.id = s.user_id
  where s.user_id = (select auth.uid())
    and s.client_id = p_client_id
    and p.client_id = p_client_id
    and p.role = 'client'
    and p.disabled_at is null
$$;

-- Any access at all to the client (needed for client-wide things like contacts).
create function public.can_see_client(p_client_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() or exists (select 1 from public.my_scopes(p_client_id))
$$;

-- Access to every estate in the client.
create function public.can_see_whole_client(p_client_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1 from public.my_scopes(p_client_id) s
    where s.region_id is null and s.estate_id is null
  )
$$;

-- Access to at least one estate in the region (enough to open the state page).
create function public.can_see_region(p_region_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.regions r
    cross join lateral public.my_scopes(r.client_id) s
    left join public.estates e on e.id = s.estate_id
    where r.id = p_region_id
      and (
        (s.region_id is null and s.estate_id is null)
        or s.region_id = r.id
        or e.region_id = r.id
      )
  )
$$;

-- Access to every estate in the region (needed for state-wide reports, which show all estates' numbers).
create function public.can_see_whole_region(p_region_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.regions r
    cross join lateral public.my_scopes(r.client_id) s
    where r.id = p_region_id
      and ((s.region_id is null and s.estate_id is null) or s.region_id = r.id)
  )
$$;

create function public.can_see_estate(p_estate_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() or exists (
    select 1
    from public.estates e
    cross join lateral public.my_scopes(e.client_id) s
    where e.id = p_estate_id
      and (
        (s.region_id is null and s.estate_id is null)
        or s.region_id = e.region_id
        or s.estate_id = e.id
      )
  )
$$;

-- Strict check for client-level rows narrowed by optional region/estate:
-- a whole-client row needs whole-client access, a region row needs the whole region.
create function public.can_see_scoped(p_client_id uuid, p_region_id uuid, p_estate_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_estate_id is not null then public.can_see_estate(p_estate_id)
    when p_region_id is not null then public.can_see_whole_region(p_region_id)
    else public.can_see_whole_client(p_client_id)
  end
$$;

-- ---------------------------------------------------------------- enable RLS everywhere

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'regions', 'estates', 'channels', 'profiles', 'user_scopes', 'invites',
    'budgets', 'flights', 'live_placements', 'material_due',
    'reports', 'key_dates', 'contacts', 'sheet_links', 'internal_docs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Admin writes on every content table (staff and clients never write).
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'regions', 'estates', 'channels', 'profiles', 'user_scopes', 'invites',
    'budgets', 'flights', 'live_placements', 'material_due',
    'reports', 'key_dates', 'contacts', 'sheet_links', 'internal_docs'
  ] loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- reads

create policy read on public.clients for select to authenticated
  using (public.can_see_client(id));

create policy read on public.regions for select to authenticated
  using (public.can_see_region(id));

create policy read on public.estates for select to authenticated
  using (public.can_see_estate(id));

create policy read on public.channels for select to authenticated
  using (public.can_see_client(client_id));

-- Everyone sees their own profile. Staff see all. Clients also see Sunny people
-- (so "updated by Lily" can render) but never other client users.
create policy read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_staff())
    or (role in ('admin', 'staff') and (select public.my_role()) is not null)
  );

create policy read on public.user_scopes for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy read on public.invites for select to authenticated
  using ((select public.is_admin()));

create policy read on public.budgets for select to authenticated
  using (public.can_see_estate(estate_id));
create policy read on public.flights for select to authenticated
  using (public.can_see_estate(estate_id));
create policy read on public.live_placements for select to authenticated
  using (public.can_see_estate(estate_id));
create policy read on public.material_due for select to authenticated
  using (public.can_see_estate(estate_id));

create policy read on public.reports for select to authenticated
  using (public.can_see_scoped(client_id, region_id, estate_id));

create policy read on public.sheet_links for select to authenticated
  using (
    (not staff_only or (select public.is_staff()))
    and public.can_see_scoped(client_id, region_id, estate_id)
  );

-- Key dates are lenient: a client-wide date (e.g. "Christmas media freeze") is
-- useful to everyone at the client and carries no other estate's numbers.
create policy read on public.key_dates for select to authenticated
  using (
    case
      when estate_id is not null then public.can_see_estate(estate_id)
      when region_id is not null then public.can_see_region(region_id)
      else public.can_see_client(client_id)
    end
  );

create policy read on public.contacts for select to authenticated
  using (public.can_see_client(client_id));

create policy read on public.internal_docs for select to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------- grants
-- Nothing is readable without signing in.

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
