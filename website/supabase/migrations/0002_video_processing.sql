-- Adds background-processing tracking to videos.
-- Run this in the Supabase SQL Editor after 0001_init.sql.

alter table videos
  add column processing_status text default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_error text;

-- Existing rows (uploaded before this migration) already play fine from the
-- raw file, so mark them as ready rather than leaving them stuck "pending".
update videos set processing_status = 'ready' where processing_status = 'pending';
