-- A player's personal selection message is separate from generic/internal notes.
alter table public.match_player_selections
  add column if not exists individual_attention_point text
  check (individual_attention_point is null or char_length(individual_attention_point) <= 1000);

-- Existing preparation notes were already shown in the personal-message position.
update public.match_player_selections
set individual_attention_point = note
where individual_attention_point is null and note is not null;

notify pgrst, 'reload schema';
