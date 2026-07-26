-- Contactpersonen-infoblad: laat de coach per uitnodiging vastleggen voor wie
-- (naam + gsm) hij bedoeld is, en laat de eerste ouder die zijn link invult het adres
-- van het kind aanvullen zonder al ingevulde clubadmin-gegevens te overschrijven.
alter table public.player_invites
  add column if not exists contact_label text,
  add column if not exists contact_phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
  invite public.player_invites;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags
    (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
  values
    (new.id, 'Start', true, 0, 0),
    (new.id, 'Goal', true, -10, 3),
    (new.id, 'Kans', false, -10, 3),
    (new.id, 'Opbouw', false, -5, 10),
    (new.id, 'Positiespel', false, -10, 5),
    (new.id, 'Hoekschop', false, -3, 10),
    (new.id, 'Vrije trap', false, -3, 10);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin
      accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamp with time zone;
    exception when others then
      accepted_at_value := timezone('utc'::text, now());
    end;
    insert into public.legal_acceptances
      (user_id, terms_version, privacy_version, statement_version, locale, accepted_at)
    values
      (new.id, new.raw_user_meta_data->>'terms_version',
       new.raw_user_meta_data->>'privacy_version',
       new.raw_user_meta_data->>'legal_statement_version',
       case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end,
       accepted_at_value);
  end if;

  if new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(
      new.id, new.email, new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->'club_onboarding'
    );
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into invite from public.player_invites
    where token = nullif(new.raw_user_meta_data->>'player_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now());
    if invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians (club_player_id, player_id, profile_id, access_scope, valid_from)
    values (invite.club_player_id, invite.player_id, new.id, 'from_acceptance', timezone('utc'::text, now()));
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id where id = invite.id;

    -- Niet-destructief: een clubadmin-ingevulde waarde telt altijd, een leeg veld mag de
    -- eerste ouder die zich registreert invullen (zelfde regel als de PSD-importconflicten
    -- in club-player-identity-and-seasons-plan.md, Fase 2).
    if invite.club_player_id is not null then
      update public.club_players set
        address = coalesce(nullif(address, ''), new.raw_user_meta_data->>'child_address'),
        postal_code = coalesce(nullif(postal_code, ''), new.raw_user_meta_data->>'child_postal_code'),
        city = coalesce(nullif(city, ''), new.raw_user_meta_data->>'child_city'),
        email = coalesce(nullif(email, ''), new.raw_user_meta_data->>'child_email'),
        phone = coalesce(nullif(phone, ''), new.raw_user_meta_data->>'child_phone')
      where id = invite.club_player_id;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
