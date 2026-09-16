-- Keep training statistics accurate when "Gekwetst" was selected as an
-- absence reason by older clients that still stored the row as absent.
update public.team_training_attendance attendance
set attendance_status = 'injured',
    updated_at = now()
from public.club_match_options reason
where attendance.absence_reason_id = reason.id
  and attendance.attendance_status = 'absent'
  and lower(trim(reason.label)) in ('gekwetst', 'geblesseerd');

notify pgrst, 'reload schema';
