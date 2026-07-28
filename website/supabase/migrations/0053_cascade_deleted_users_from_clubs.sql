-- A platform-admin account deletion must also remove the user's club trainer
-- record. That record owns the team assignments, so its cascade removes the
-- user from every assigned club team as well.
--
-- Keep genuine placeholders and pending invitations: only old "linked" rows
-- with no remaining profile were produced by the previous ON DELETE SET NULL
-- behaviour.
delete from public.club_trainers
where profile_id is null
  and invitation_status = 'linked';

alter table public.club_trainers
  drop constraint if exists club_trainers_profile_id_fkey;

alter table public.club_trainers
  add constraint club_trainers_profile_id_fkey
  foreign key (profile_id)
  references public.profiles(id)
  on delete cascade;
