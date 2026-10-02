-- Turning invites into access.
--
-- There is no public sign-up. An admin creates an invite (email, role, scope);
-- the server action then creates the auth user, and the trigger below turns the
-- invite into a profile + scope rows. An auth user without a profile has no access.
-- Safe to re-run.

-- Applies an invite to a user: upserts the profile and replaces their scopes.
create or replace function public.apply_invite(p_invite_id uuid, p_user_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  inv record;
  sc jsonb;
begin
  select * into inv from public.invites where id = p_invite_id;
  if not found then
    raise exception 'invite % not found', p_invite_id;
  end if;

  insert into public.profiles (id, client_id, name, email, role, disabled_at)
  values (p_user_id, inv.client_id, inv.name, lower(inv.email), inv.role, null)
  on conflict (id) do update
    set client_id = excluded.client_id,
        name = coalesce(excluded.name, public.profiles.name),
        email = excluded.email,
        role = excluded.role,
        disabled_at = null;

  delete from public.user_scopes where user_id = p_user_id;

  if inv.role = 'client' then
    for sc in select * from jsonb_array_elements(inv.scope) loop
      insert into public.user_scopes (user_id, client_id, region_id, estate_id)
      values (
        p_user_id,
        inv.client_id,
        nullif(sc ->> 'region_id', '')::uuid,
        nullif(sc ->> 'estate_id', '')::uuid
      );
    end loop;
  end if;

  update public.invites set user_id = p_user_id where id = p_invite_id;
end;
$$;

revoke execute on function public.apply_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_invite(uuid, uuid) to service_role;

-- New auth user: apply their most recent open invite, if any.
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  inv_id uuid;
begin
  select i.id into inv_id
  from public.invites i
  where lower(i.email) = lower(new.email)
    and i.accepted_at is null
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc
  limit 1;

  if inv_id is not null then
    perform public.apply_invite(inv_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- First sign-in marks the invite accepted; every sign-in is mirrored for the Users page.
create or replace function public.handle_auth_sign_in() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  update public.invites set accepted_at = now()
  where user_id = new.id and accepted_at is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is distinct from old.last_sign_in_at)
  execute function public.handle_auth_sign_in();

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_sign_in() from public, anon, authenticated;
