create or replace function public.array_has_unique_smallints(values smallint[])
returns boolean
language sql
immutable
as $$
  select count(*) = count(distinct item)
  from unnest(values) as item;
$$;

alter table public.schedule_cycles
add column cleared_week_numbers smallint[] not null default '{}',
add constraint schedule_cycles_cleared_week_numbers_valid
check (
  cleared_week_numbers <@ array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::smallint[]
  and public.array_has_unique_smallints(cleared_week_numbers)
);
