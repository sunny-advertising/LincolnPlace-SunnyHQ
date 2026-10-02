-- RLS tests: one user of each role, plus the scope variants that matter.
-- Run with scripts/test-rls.sh (local Postgres) — everything happens in a
-- transaction that is rolled back.
\set ON_ERROR_STOP 1
begin;

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.login(p_email text) returns void language plpgsql security definer as $$
declare uid uuid := (select id from auth.users where email = p_email);
begin
  -- Newer auth.uid() reads request.jwt.claims, older images read request.jwt.claim.sub; set both.
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
end $$;

create function tests.eq(label text, got bigint, expected bigint) returns text language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL: % (got %, expected %)', label, got, expected;
  end if;
  return 'ok  ' || label;
end $$;

-- Rows affected by a statement; -1 if it raised a permission/RLS error.
create function tests.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when insufficient_privilege or check_violation then
  return -1;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ------------------------------------------------------------------ fixtures (as owner)

insert into public.clients (name, slug) values ('OfficeHQ', 'officehq');
insert into public.regions (client_id, code, name)
  select id, 'QLD', 'Queensland' from public.clients where slug = 'officehq';
insert into public.estates (client_id, region_id, code, name)
  select c.id, r.id, 'OHQ1', 'Office One'
  from public.clients c join public.regions r on r.client_id = c.id where c.slug = 'officehq';
insert into public.channels (client_id, name) select id, 'Radio' from public.clients where slug = 'officehq';

create temp table ids as
select
  (select id from public.clients where slug = 'lincoln-place') lp,
  (select id from public.clients where slug = 'officehq') ohq,
  (select id from public.regions r where code = 'QLD' and client_id = (select id from public.clients where slug = 'lincoln-place')) qld,
  (select id from public.regions r where code = 'NSW' and client_id = (select id from public.clients where slug = 'lincoln-place')) nsw,
  (select id from public.estates where code = 'LLY') lly,
  (select id from public.estates where code = 'LLMa') llma,
  (select id from public.estates where code = 'LLH') llh,
  (select id from public.estates where code = 'OHQ1') ohq1,
  (select id from public.channels where name = 'Radio' and client_id = (select id from public.clients where slug = 'lincoln-place')) radio,
  (select id from public.channels where name = 'Radio' and client_id = (select id from public.clients where slug = 'officehq')) ohq_radio;
grant select on ids to authenticated;

-- Invites first; creating the auth users fires the trigger that applies them.
insert into public.invites (email, role, client_id, scope)
select 'staff@sunny.test', 'staff'::public.app_role, null::uuid, '[]'::jsonb union all
select 'all@client.test', 'client', lp, '[{"region_id":null,"estate_id":null}]'::jsonb from ids union all
select 'qld@client.test', 'client', lp, json_build_array(json_build_object('region_id', qld))::jsonb from ids union all
select 'yeppoon@client.test', 'client', lp, json_build_array(json_build_object('estate_id', lly))::jsonb from ids union all
select 'disabled@client.test', 'client', lp, '[{"region_id":null,"estate_id":null}]'::jsonb from ids union all
select 'ohq@client.test', 'client', ohq, '[{"region_id":null,"estate_id":null}]'::jsonb from ids;

insert into auth.users (id, email) select gen_random_uuid(), e from (values
  ('lily@sunnyadvertising.com.au'), ('staff@sunny.test'), ('all@client.test'),
  ('qld@client.test'), ('yeppoon@client.test'), ('disabled@client.test'),
  ('ohq@client.test'), ('stranger@nowhere.test')) as v(e);

update public.profiles set disabled_at = now() where email = 'disabled@client.test';

select tests.eq('trigger created profiles for invited users only', (select count(*) from public.profiles), 7);
select tests.eq('lily is admin', (select count(*) from public.profiles where email = 'lily@sunnyadvertising.com.au' and role = 'admin'), 1);
select tests.eq('qld user has one region scope', (select count(*) from public.user_scopes s join public.profiles p on p.id = s.user_id where p.email = 'qld@client.test' and s.region_id is not null), 1);

-- sign-in trigger marks invite accepted
update auth.users set last_sign_in_at = now() where email = 'qld@client.test';
select tests.eq('first sign-in accepts invite', (select count(*) from public.invites where email = 'qld@client.test' and accepted_at is not null), 1);

-- content
insert into public.budgets (client_id, estate_id, fy, channel_id, approved, booked)
select lp, lly, 2027, radio, 10000, 5000 from ids union all
select lp, llma, 2027, radio, 20000, 1000 from ids union all
select lp, llh, 2027, radio, 30000, 3000 from ids union all
select ohq, ohq1, 2027, ohq_radio, 99999, 0 from ids;

insert into public.material_due (client_id, estate_id, channel_id, placement, due_date, status)
select lp, lly, radio, 'Overdue spot', current_date - 3, 'due'::public.material_status from ids union all
select lp, lly, radio, 'Supplied late', current_date - 3, 'supplied' from ids union all
select lp, llh, radio, 'Soon', current_date + 5, 'due' from ids union all
select lp, llh, radio, 'Later', current_date + 40, 'due' from ids;

insert into public.reports (client_id, region_id, estate_id, title, url)
select lp, null::uuid, null::uuid, 'Account dashboard', 'https://example.com/a' from ids union all
select lp, qld, null, 'QLD dashboard', 'https://example.com/q' from ids union all
select lp, null, lly, 'Yeppoon dashboard', 'https://example.com/y' from ids;

insert into public.sheet_links (client_id, region_id, title, url, staff_only)
select lp, null::uuid, 'Client sheet', 'https://example.com/s1', false from ids union all
select lp, null, 'Internal tracker', 'https://example.com/s2', true from ids;

insert into public.key_dates (client_id, date, title) select lp, current_date, 'Media freeze' from ids;
insert into public.contacts (client_id, role_title, name) select lp, 'Account lead', 'Someone' from ids;
insert into public.internal_docs (client_id, section, title, body_md) select lp, 'notes', 'Account notes', '# Secret' from ids;

-- ------------------------------------------------------------------ admin
set local role authenticated;
select tests.login('lily@sunnyadvertising.com.au');
select tests.eq('admin: sees both clients', (select count(*) from public.clients), 2);
select tests.eq('admin: sees all 15 estates', (select count(*) from public.estates), 15);
select tests.eq('admin: sees internal docs', (select count(*) from public.internal_docs), 1);
select tests.eq('admin: sees invites', ((select count(*) from public.invites) > 0)::int, 1);
select tests.eq('admin: can insert budget', tests.affected(format(
  'insert into public.budgets (client_id, estate_id, fy, channel_id, approved) values (%L, %L, 2028, %L, 1)',
  (select lp from ids), (select lly from ids), (select radio from ids))), 1);
select tests.eq('admin: can update estate', tests.affected('update public.estates set subtitle = subtitle where code = ''LLY'''), 1);
select tests.eq('admin: updated_by stamped', (select count(*) from public.estates e join public.profiles p on p.id = e.updated_by where e.code = 'LLY' and p.role = 'admin'), 1);
select tests.eq('admin: can edit internal doc', tests.affected('update public.internal_docs set title = title'), 1);
select tests.eq('derived: overdue = past due and not supplied', (select count(*) from public.material_due_v where state = 'overdue'), 1);
select tests.eq('derived: due soon within 14 days', (select count(*) from public.material_due_v where state = 'due_soon'), 1);
reset role;

-- ------------------------------------------------------------------ staff
set local role authenticated;
select tests.login('staff@sunny.test');
select tests.eq('staff: sees all 15 estates', (select count(*) from public.estates), 15);
select tests.eq('staff: sees internal docs', (select count(*) from public.internal_docs), 1);
select tests.eq('staff: sees staff-only sheet links', (select count(*) from public.sheet_links), 2);
select tests.eq('staff: cannot read invites', (select count(*) from public.invites), 0);
select tests.eq('staff: cannot insert budget', tests.affected(format(
  'insert into public.budgets (client_id, estate_id, fy, channel_id, approved) values (%L, %L, 2029, %L, 1)',
  (select lp from ids), (select lly from ids), (select radio from ids))), -1);
select tests.eq('staff: cannot update budgets', tests.affected('update public.budgets set booked = 0'), 0);
select tests.eq('staff: cannot delete estates', tests.affected('delete from public.estates'), 0);
select tests.eq('staff: cannot edit internal docs', tests.affected('update public.internal_docs set title = ''x'''), 0);
select tests.eq('staff: cannot promote self', tests.affected('update public.profiles set role = ''admin'' where id = auth.uid()'), 0);
reset role;

-- ------------------------------------------------------------------ client, whole client
set local role authenticated;
select tests.login('all@client.test');
select tests.eq('client(all): sees only own client', (select count(*) from public.clients), 1);
select tests.eq('client(all): sees 14 estates', (select count(*) from public.estates), 14);
select tests.eq('client(all): no OfficeHQ budgets', (select count(*) from public.budgets where approved = 99999), 0);
select tests.eq('client(all): sees all 3 reports', (select count(*) from public.reports), 3);
select tests.eq('client(all): no internal docs', (select count(*) from public.internal_docs), 0);
select tests.eq('client(all): no staff-only sheet links', (select count(*) from public.sheet_links), 1);
select tests.eq('client(all): no invites', (select count(*) from public.invites), 0);
select tests.eq('client(all): sees only own scopes', (select count(*) from public.user_scopes), 1);
select tests.eq('client(all): sees self + Sunny profiles, not other clients', (select count(*) from public.profiles where role = 'client'), 1);
select tests.eq('client(all): cannot insert', tests.affected(format(
  'insert into public.key_dates (client_id, date, title) values (%L, current_date, ''x'')', (select lp from ids))), -1);
select tests.eq('client(all): cannot update', tests.affected('update public.budgets set booked = 0'), 0);
select tests.eq('client(all): cannot grant self scopes', tests.affected(format(
  'insert into public.user_scopes (user_id, client_id) values (auth.uid(), %L)', (select ohq from ids))), -1);
select tests.eq('client(all): cannot change own role', tests.affected('update public.profiles set role = ''admin'' where id = auth.uid()'), 0);
select tests.eq('client(all): is_staff() false', (select public.is_staff())::int, 0);
reset role;

-- ------------------------------------------------------------------ client, one state
set local role authenticated;
select tests.login('qld@client.test');
select tests.eq('client(QLD): sees 4 QLD estates', (select count(*) from public.estates), 4);
select tests.eq('client(QLD): sees only QLD region', (select count(*) from public.regions), 1);
select tests.eq('client(QLD): budgets for QLD only (incl. admin FY28 row)', (select count(*) from public.budgets), 3);
select tests.eq('client(QLD): QLD + Yeppoon reports, not account-wide', (select count(*) from public.reports), 2);
select tests.eq('client(QLD): no client-wide sheet links', (select count(*) from public.sheet_links), 0);
select tests.eq('client(QLD): sees client-wide key dates', (select count(*) from public.key_dates), 1);
select tests.eq('client(QLD): sees contacts', (select count(*) from public.contacts), 1);
select tests.eq('client(QLD): material only QLD', (select count(*) from public.material_due), 2);
select tests.eq('client(QLD): can_see_region(NSW) false', (select public.can_see_region((select nsw from ids)))::int, 0);
reset role;

-- ------------------------------------------------------------------ client, one estate
set local role authenticated;
select tests.login('yeppoon@client.test');
select tests.eq('client(LLY): sees 1 estate', (select count(*) from public.estates), 1);
select tests.eq('client(LLY): can open QLD state page', (select count(*) from public.regions), 1);
select tests.eq('client(LLY): budgets for Yeppoon only', (select count(*) from public.budgets), 2);
select tests.eq('client(LLY): only Yeppoon report, not state-wide', (select count(*) from public.reports), 1);
select tests.eq('client(LLY): no internal docs', (select count(*) from public.internal_docs), 0);
reset role;

-- ------------------------------------------------------------------ disabled, other client, stranger, anon
set local role authenticated;
select tests.login('disabled@client.test');
select tests.eq('disabled: sees nothing', (select count(*) from public.estates), 0);
select tests.login('ohq@client.test');
select tests.eq('other client: sees only OfficeHQ estate', (select count(*) from public.estates), 1);
select tests.eq('other client: no Lincoln budgets', (select count(*) from public.budgets), 1);
select tests.login('stranger@nowhere.test');
select tests.eq('no profile: sees no clients', (select count(*) from public.clients), 0);
select tests.eq('no profile: sees no estates', (select count(*) from public.estates), 0);
reset role;

set local role anon;
select tests.eq('anon: cannot read estates', tests.affected('select * from public.estates'), -1);
reset role;

select 'ALL RLS TESTS PASSED' as result;
rollback;
