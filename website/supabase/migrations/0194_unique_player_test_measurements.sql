-- A measurement cell represents one player, test type and date. Creating the
-- index is deliberately non-destructive: deployment stops if unexpected legacy
-- duplicates exist, so no measurements are ever removed automatically.
create unique index player_tests_unique_measurement_idx
  on public.player_tests(club_id, player_id, test_type, tested_on);

notify pgrst, 'reload schema';
