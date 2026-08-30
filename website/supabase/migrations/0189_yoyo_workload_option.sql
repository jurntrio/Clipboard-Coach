insert into public.club_workload_modalities (category_id, code, name, description, color)
select category.id, 'YOYO_TEST', 'YOYO Test', 'Extra test naast de gewone opwarming.', category.color
from public.club_workload_categories category
join public.club_workload_systems system on system.id=category.system_id
where category.code='WARMUP' and system.name='KM Torhout-basis'
on conflict (category_id, code) do nothing;

notify pgrst, 'reload schema';
