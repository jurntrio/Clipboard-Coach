-- Canonicalize historical absence rows that already used the reason "Gekwetst".
update public.team_training_attendance attendance
set attendance_status = 'injured'
from public.club_match_options reason
where attendance.absence_reason_id = reason.id
  and attendance.attendance_status = 'absent'
  and lower(trim(reason.label)) = 'gekwetst';

notify pgrst, 'reload schema';


