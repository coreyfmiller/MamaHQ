-- ensure_family(): atomically give the calling user a family + owner membership,
-- returning the family id. SECURITY DEFINER so it runs past the families_insert
-- RLS policy (raw client inserts of `families` were being rejected by RLS in
-- practice). Idempotent — repeat calls return the existing family.
-- Applied live via the Management API on 2026-09-18; recorded here for version control.

create or replace function public.ensure_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Already a member? return that family.
  select m.family_id into fid from public.family_members m where m.user_id = uid limit 1;
  if fid is not null then return fid; end if;

  -- Owns a family but missing membership? adopt it.
  select f.id into fid from public.families f where f.owner_id = uid limit 1;

  -- Otherwise create one.
  if fid is null then
    insert into public.families (owner_id) values (uid) returning id into fid;
  end if;

  -- Ensure owner membership exists.
  insert into public.family_members (family_id, user_id, role)
  values (fid, uid, 'owner')
  on conflict (family_id, user_id) do nothing;

  return fid;
end $$;

grant execute on function public.ensure_family() to authenticated;
