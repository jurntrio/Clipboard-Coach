update public.clubs
set rbfa_registration_number = '822',
    updated_at = timezone('utc'::text, now())
where name = 'KM Torhout';

update public.club_trainers ct
set phone_number = '+32494443514'
from public.profiles p
where ct.profile_id = p.id
  and lower(p.email) = 'jurntrio@gmail.com'
  and ct.club_id = (select id from public.clubs where name = 'KM Torhout');

notify pgrst, 'reload schema';
