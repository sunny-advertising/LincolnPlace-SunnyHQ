-- Lincoln Place structure: client, states, estates, channels, plus the first admin invite.
-- No budget, flight or material figures are seeded; admins enter the real ones.
-- Safe to re-run.

insert into public.clients (name, slug, timezone)
values ('Lincoln Place', 'lincoln-place', 'Australia/Brisbane')
on conflict (slug) do nothing;

with c as (select id from public.clients where slug = 'lincoln-place')
insert into public.regions (client_id, code, name, sort_order)
select c.id, r.code, r.name, r.sort_order
from c, (values
  ('QLD', 'Queensland', 1),
  ('NSW', 'New South Wales', 2),
  ('VIC', 'Victoria', 3)
) as r (code, name, sort_order)
on conflict (client_id, code) do nothing;

-- Bundaberg (LLBU) and Tamworth (LLT) codes are provisional: no project code exists yet.
with c as (select id from public.clients where slug = 'lincoln-place')
insert into public.estates (client_id, region_id, code, name, subtitle, sort_order)
select c.id, r.id, e.code, e.name, e.subtitle, e.sort_order
from c
join (values
  ('QLD', 'LLY',  'Yeppoon',          null,          10),
  ('QLD', 'LLMa', 'Mackay',           null,          20),
  ('QLD', 'LLNB', 'Northern Beaches', 'Townsville',  30),
  ('QLD', 'LLBU', 'Bundaberg',        'Coral Cove',  40),
  ('NSW', 'LLNR', 'Northern Rivers',  'Gulmarrad',   50),
  ('NSW', 'LLM',  'Moama',            null,          60),
  ('NSW', 'LLMS', 'Mudgee Spring',    null,          70),
  ('NSW', 'LLGH', 'Griffith Hill',    null,          80),
  ('NSW', 'LLT',  'Tamworth',         null,          90),
  ('VIC', 'LLH',  'Huntly',           null,         100),
  ('VIC', 'LLKF', 'Kangaroo Flat',    null,         110),
  ('VIC', 'LLEG', 'Eden Gardens',     null,         120),
  ('VIC', 'LLB',  'Baranduda',        null,         130),
  ('VIC', 'LLW',  'Wangaratta',       null,         140)
) as e (region_code, code, name, subtitle, sort_order) on true
join public.regions r on r.client_id = c.id and r.code = e.region_code
on conflict (client_id, code) do nothing;

with c as (select id from public.clients where slug = 'lincoln-place')
insert into public.channels (client_id, name, sort_order)
select c.id, ch.name, ch.sort_order
from c, (values
  ('Programmatic', 1), ('Radio', 2), ('TV', 3), ('Press', 4), ('REA', 5),
  ('Meta', 6), ('OOH', 7), ('Cinema', 8), ('Letterbox', 9)
) as ch (name, sort_order)
on conflict (client_id, name) do nothing;

-- First admin. Applied automatically when this email's auth user is created
-- (scripts/bootstrap-admin.mjs, or Supabase dashboard → Authentication → Add user).
insert into public.invites (email, name, role, client_id, scope)
select 'lily@sunnyadvertising.com.au', 'Lily Hunter', 'admin', null, '[]'::jsonb
where not exists (
  select 1 from public.invites where lower(email) = 'lily@sunnyadvertising.com.au'
);
