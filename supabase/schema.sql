-- =====================================================================
-- Gym Workout Tracker — Supabase / PostgreSQL schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- Profiles (one row per user, linked to Supabase Auth) ----------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  sex               text check (sex in ('male','female')),
  height_cm         numeric(5,1),
  current_weight_kg numeric(5,1),
  created_at        timestamptz not null default now()
);

-- ---------- Body measurements (weight history) ----------
create table if not exists public.body_measurements (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   numeric(5,1) not null check (weight_kg > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- ---------- Muscle groups (fixed list) ----------
create table if not exists public.muscle_groups (
  id         smallint primary key,
  name       text not null unique,
  sort_order smallint not null
);

-- ---------- Exercises (default = user_id null, custom = owned by a user) ----------
create table if not exists public.exercises (
  id              bigint generated always as identity primary key,
  name            text not null,
  muscle_group_id smallint not null references public.muscle_groups(id),
  user_id         uuid references auth.users(id) on delete cascade,
  is_custom       boolean generated always as (user_id is not null) stored,
  created_at      timestamptz not null default now()
);
create unique index if not exists exercises_default_name_uq
  on public.exercises (lower(name)) where user_id is null;
create unique index if not exists exercises_custom_name_uq
  on public.exercises (user_id, lower(name)) where user_id is not null;

-- ---------- Workout sessions ----------
create table if not exists public.workout_sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);
-- Entered by the user when finishing a workout
alter table public.workout_sessions
  add column if not exists duration_minutes integer check (duration_minutes >= 0 and duration_minutes <= 1440),
  add column if not exists calories integer check (calories >= 0 and calories <= 20000);

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, workout_date desc);

-- Muscle groups chosen for a session
create table if not exists public.session_muscle_groups (
  session_id      bigint not null references public.workout_sessions(id) on delete cascade,
  muscle_group_id smallint not null references public.muscle_groups(id),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (session_id, muscle_group_id)
);

-- ---------- Exercises performed in a session ----------
create table if not exists public.workout_exercises (
  id             bigint generated always as identity primary key,
  session_id     bigint not null references public.workout_sessions(id) on delete cascade,
  exercise_id    bigint not null references public.exercises(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_order smallint not null default 1,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists workout_exercises_user_ex_idx
  on public.workout_exercises (user_id, exercise_id);

-- ---------- Individual sets ----------
create table if not exists public.exercise_sets (
  id                  bigint generated always as identity primary key,
  workout_exercise_id bigint not null references public.workout_exercises(id) on delete cascade,
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  set_number          smallint not null,
  weight_kg           numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps                smallint not null check (reps >= 0),
  created_at          timestamptz not null default now()
);
create index if not exists exercise_sets_we_idx on public.exercise_sets (workout_exercise_id);

-- ---------- Personal records (view, always up to date) ----------
-- Per user + exercise: heaviest weight, best single-set reps, best session volume,
-- best estimated 1RM (Epley: weight × (1 + reps/30)).
create or replace view public.personal_records
with (security_invoker = true) as
with s as (
  select we.user_id, we.exercise_id, ws.workout_date, we.id as we_id,
         es.weight_kg, es.reps,
         case when es.reps = 0 then 0
              when es.reps = 1 then es.weight_kg
              else es.weight_kg * (1 + es.reps / 30.0) end as est_1rm
  from public.exercise_sets es
  join public.workout_exercises we on we.id = es.workout_exercise_id
  join public.workout_sessions ws on ws.id = we.session_id
), vol as (
  select user_id, exercise_id, we_id, sum(weight_kg * reps) as volume
  from s group by user_id, exercise_id, we_id
)
select s.user_id, s.exercise_id,
       max(s.weight_kg)                                as max_weight_kg,
       max(s.reps)                                     as max_reps,
       round(max(s.est_1rm)::numeric, 1)               as best_est_1rm_kg,
       (select max(v.volume) from vol v
         where v.user_id = s.user_id and v.exercise_id = s.exercise_id) as best_volume_kg
from s
group by s.user_id, s.exercise_id;

-- =====================================================================
-- Row Level Security: every user sees and edits only their own data
-- =====================================================================
alter table public.profiles              enable row level security;
alter table public.body_measurements     enable row level security;
alter table public.muscle_groups         enable row level security;
alter table public.exercises             enable row level security;
alter table public.workout_sessions      enable row level security;
alter table public.session_muscle_groups enable row level security;
alter table public.workout_exercises     enable row level security;
alter table public.exercise_sets         enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read muscle groups" on public.muscle_groups;
create policy "read muscle groups" on public.muscle_groups
  for select to authenticated using (true);

drop policy if exists "read default or own exercises" on public.exercises;
create policy "read default or own exercises" on public.exercises
  for select to authenticated using (user_id is null or user_id = auth.uid());
drop policy if exists "manage own custom exercises" on public.exercises;
create policy "manage own custom exercises" on public.exercises
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['body_measurements','workout_sessions']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Child rows: must be yours AND point at a parent that is yours
drop policy if exists "own rows" on public.session_muscle_groups;
create policy "own rows" on public.session_muscle_groups for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

drop policy if exists "own rows" on public.workout_exercises;
create policy "own rows" on public.workout_exercises for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid())));

drop policy if exists "own rows" on public.exercise_sets;
create policy "own rows" on public.exercise_sets for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.workout_exercises w where w.id = workout_exercise_id and w.user_id = auth.uid()));

-- =====================================================================
-- Create a profile automatically when someone signs up
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare w numeric;
begin
  w := nullif(new.raw_user_meta_data->>'current_weight_kg','')::numeric;
  insert into public.profiles (id, email, full_name, sex, height_cm, current_weight_kg)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'sex',''),
    nullif(new.raw_user_meta_data->>'height_cm','')::numeric,
    w
  );
  if w is not null then
    insert into public.body_measurements (user_id, measured_on, weight_kg)
    values (new.id, current_date, w);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Seed data
-- =====================================================================
insert into public.muscle_groups (id, name, sort_order) values
  (1,'Chest',1),(2,'Back',2),(3,'Shoulders',3),(4,'Arms',4),(5,'Legs',5)
on conflict (id) do nothing;

insert into public.exercises (name, muscle_group_id)
select v.name, v.mg from (values
  ('Flat Barbell Bench Press',1),('Incline Dumbbell Press',1),('Decline Bench Press',1),
  ('Chest Fly',1),('Cable Crossover',1),('Chest Press Machine',1),
  ('Lat Pulldown',2),('Seated Cable Row',2),('Barbell Row',2),('Deadlift',2),('Pull-Ups',2),
  ('Shoulder Press',3),('Lateral Raise',3),('Front Raise',3),('Rear Delt Fly',3),('Shrugs',3),
  ('Barbell Biceps Curl',4),('Dumbbell Curl',4),('Hammer Curl',4),('Triceps Pushdown',4),
  ('Skull Crushers',4),('Overhead Triceps Extension',4),
  ('Squats',5),('Leg Press',5),('Leg Extension',5),('Leg Curl',5),('Calf Raises',5),('Lunges',5)
) as v(name, mg)
where not exists (
  select 1 from public.exercises e where e.user_id is null and lower(e.name) = lower(v.name)
);
