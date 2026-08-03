export type TrainingSessionSummary = {
  id: string; club_team_id: string | null; player_group_id: string | null; training_date: string; start_time: string;
  field_option_id: string | null; locker_room_option_id: string | null;
  personal_training_id: string | null; club_training_id: string | null;
  attendance_confirmed_at: string | null; attendance_total: number; attendance_absent: number;
  new_contact_updates: number;
  club_teams: { name: string } | null;
  player_groups: { name: string; icon: string | null } | null;
};
