create extension if not exists pgcrypto;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  active boolean not null default true,
  rotation_position integer not null check (rotation_position between 0 and 9),
  role_ids text[] not null default '{}',
  unique (rotation_position)
);

create table public.schedule_templates (
  id text primary key,
  name text not null,
  version integer not null check (version > 0),
  patterns jsonb not null,
  active boolean not null default true,
  unique (name, version)
);

create table public.schedule_cycles (
  id uuid primary key,
  template_id text not null references public.schedule_templates(id),
  starts_on date not null check (extract(isodow from starts_on) = 1),
  status text not null check (status in ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED')),
  rotation_order text[] not null check (cardinality(rotation_order) = 10),
  pattern_ids text[] not null check (cardinality(pattern_ids) = 10),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.cycle_assignments (
  cycle_id uuid not null references public.schedule_cycles(id) on delete cascade,
  pattern_id text not null,
  employee_id text not null,
  primary key (cycle_id, pattern_id),
  unique (cycle_id, employee_id)
);

create table public.schedule_exceptions (
  id uuid primary key,
  cycle_id uuid not null references public.schedule_cycles(id) on delete cascade,
  date date not null,
  employee_id text not null,
  original jsonb not null,
  replacement jsonb not null,
  reason text not null check (char_length(trim(reason)) >= 3),
  created_by text not null,
  created_at timestamptz not null
);

create table public.published_schedule_snapshots (
  id uuid primary key,
  cycle_id uuid not null references public.schedule_cycles(id),
  version integer not null check (version > 0),
  payload jsonb not null,
  published_at timestamptz not null,
  unique (cycle_id, version)
);

create or replace function public.prevent_snapshot_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Published schedule snapshots are immutable';
end;
$$;

create trigger published_snapshots_are_immutable
before update or delete on public.published_schedule_snapshots
for each row execute function public.prevent_snapshot_mutation();

alter table public.employees enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_cycles enable row level security;
alter table public.cycle_assignments enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.published_schedule_snapshots enable row level security;

create policy "authenticated administrators manage employees"
on public.employees for all to authenticated using (true) with check (true);
create policy "authenticated administrators manage templates"
on public.schedule_templates for all to authenticated using (true) with check (true);
create policy "authenticated administrators manage cycles"
on public.schedule_cycles for all to authenticated using (true) with check (true);
create policy "authenticated administrators manage assignments"
on public.cycle_assignments for all to authenticated using (true) with check (true);
create policy "authenticated administrators manage exceptions"
on public.schedule_exceptions for all to authenticated using (true) with check (true);
create policy "authenticated administrators create snapshots"
on public.published_schedule_snapshots for select to authenticated using (true);
create policy "authenticated administrators publish snapshots"
on public.published_schedule_snapshots for insert to authenticated with check (true);
