create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  club text not null default '',
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'coach',
  primary key (team_id, user_id)
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  number int,
  position text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null default 'training' check (kind in ('training','match')),
  starts_at timestamptz not null,
  title text not null default '',
  opponent text,
  location text,
  created_at timestamptz not null default now()
);
create table public.attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('present','absent','sick','injured')),
  primary key (event_id, player_id)
);
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  for_us boolean not null,
  scorer_id uuid references public.players(id) on delete set null,
  assist_id uuid references public.players(id) on delete set null,
  period int,
  game_time text,
  created_at timestamptz not null default now()
);
create table public.goal_on_court (
  goal_id uuid not null references public.goals(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (goal_id, player_id)
);

grant select, insert, update, delete on public.teams, public.team_members, public.players, public.events, public.attendance, public.goals, public.goal_on_court to authenticated;
grant all on public.teams, public.team_members, public.players, public.events, public.attendance, public.goals, public.goal_on_court to service_role;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.players enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.goals enable row level security;
alter table public.goal_on_court enable row level security;

create or replace function public.is_team_member(_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members where team_id = _team and user_id = auth.uid())
$$;
create or replace function public.event_team(_event uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.events where id = _event
$$;
create or replace function public.goal_team(_goal uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.team_id from public.goals g join public.events e on e.id = g.event_id where g.id = _goal
$$;

create or replace function public.add_team_creator()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.created_by, 'coach');
  return new;
end $$;
create trigger teams_add_creator after insert on public.teams for each row execute function public.add_team_creator();

create policy "members read team" on public.teams for select to authenticated using (public.is_team_member(id) or created_by = auth.uid());
create policy "create team" on public.teams for insert to authenticated with check (created_by = auth.uid());
create policy "members update team" on public.teams for update to authenticated using (public.is_team_member(id));
create policy "members delete team" on public.teams for delete to authenticated using (public.is_team_member(id));

create policy "read own memberships" on public.team_members for select to authenticated using (user_id = auth.uid() or public.is_team_member(team_id));

create policy "members players" on public.players for all to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "members events" on public.events for all to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "members attendance" on public.attendance for all to authenticated using (public.is_team_member(public.event_team(event_id))) with check (public.is_team_member(public.event_team(event_id)));
create policy "members goals" on public.goals for all to authenticated using (public.is_team_member(public.event_team(event_id))) with check (public.is_team_member(public.event_team(event_id)));
create policy "members goal_on_court" on public.goal_on_court for all to authenticated using (public.is_team_member(public.goal_team(goal_id))) with check (public.is_team_member(public.goal_team(goal_id)));