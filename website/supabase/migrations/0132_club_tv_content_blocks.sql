-- Split Club TV into a persistent match header and independently timed content blocks.
alter table public.club_tv_blocks drop constraint if exists club_tv_blocks_block_type_check;
alter table public.club_tv_blocks add constraint club_tv_blocks_block_type_check check (
  block_type in ('match','match_header','main_sponsors','sponsors','match_sponsors','ball_donors','players','image')
);
notify pgrst, 'reload schema';
