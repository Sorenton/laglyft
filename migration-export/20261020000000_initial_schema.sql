-- LAGLYFT initial schema
-- Mirrors the live structure (verified 2026-10-20): 7 tables, 19 constraints,
-- 4 functions, 1 trigger, 10 RLS policies. Intended for an EMPTY project.
-- Contains no data and no auth users.
-- Move this file to supabase/migrations/ in your own repo/project before `supabase db push`.

-- 1. Tables (dependency order)
CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    club text DEFAULT ''::text NOT NULL,
    created_by uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teams_pkey PRIMARY KEY (id)
);

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'coach'::text NOT NULL,
    CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id),
    CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE
);

CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    name text NOT NULL,
    number integer,
    "position" text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT players_pkey PRIMARY KEY (id),
    CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE
);

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    kind text DEFAULT 'training'::text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    opponent text,
    location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT events_pkey PRIMARY KEY (id),
    CONSTRAINT events_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT events_kind_check CHECK (kind = ANY (ARRAY['training'::text, 'match'::text]))
);

CREATE TABLE public.attendance (
    event_id uuid NOT NULL,
    player_id uuid NOT NULL,
    status text NOT NULL,
    CONSTRAINT attendance_pkey PRIMARY KEY (event_id, player_id),
    CONSTRAINT attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT attendance_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE,
    CONSTRAINT attendance_status_check CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'sick'::text, 'injured'::text, 'not_called'::text]))
);

CREATE TABLE public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    for_us boolean NOT NULL,
    scorer_id uuid,
    assist_id uuid,
    period integer,
    game_time text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goals_pkey PRIMARY KEY (id),
    CONSTRAINT goals_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT goals_scorer_id_fkey FOREIGN KEY (scorer_id) REFERENCES public.players(id) ON DELETE SET NULL,
    CONSTRAINT goals_assist_id_fkey FOREIGN KEY (assist_id) REFERENCES public.players(id) ON DELETE SET NULL
);

CREATE TABLE public.goal_on_court (
    goal_id uuid NOT NULL,
    player_id uuid NOT NULL,
    CONSTRAINT goal_on_court_pkey PRIMARY KEY (goal_id, player_id),
    CONSTRAINT goal_on_court_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE,
    CONSTRAINT goal_on_court_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE
);

-- 2. Grants (only what the app needs; no anon access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams         TO authenticated;
GRANT SELECT                         ON public.team_members  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_on_court TO authenticated;
GRANT ALL ON public.teams, public.team_members, public.players, public.events,
             public.attendance, public.goals, public.goal_on_court TO service_role;

-- 3. Functions (SECURITY DEFINER, fixed search_path)
CREATE FUNCTION public.add_team_creator() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
    AS $$
begin
  insert into public.team_members (team_id, user_id, role) values (new.id, new.created_by, 'coach');
  return new;
end $$;

CREATE FUNCTION public.is_team_member(_team uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.team_members where team_id = _team and user_id = auth.uid())
$$;

CREATE FUNCTION public.event_team(_event uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $$
  select team_id from public.events where id = _event
$$;

CREATE FUNCTION public.goal_team(_goal uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
    AS $$
  select e.team_id from public.goals g join public.events e on e.id = g.event_id where g.id = _goal
$$;

REVOKE EXECUTE ON FUNCTION public.add_team_creator()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.event_team(uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.goal_team(uuid)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.event_team(uuid)     TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.goal_team(uuid)      TO authenticated, service_role;

-- 4. Trigger
CREATE TRIGGER teams_add_creator
    AFTER INSERT ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.add_team_creator();

-- 5. Row Level Security + 10 policies
ALTER TABLE public.teams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_on_court ENABLE ROW LEVEL SECURITY;

CREATE POLICY "create team" ON public.teams FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());
CREATE POLICY "members read team" ON public.teams FOR SELECT TO authenticated
    USING (public.is_team_member(id) OR created_by = auth.uid());
CREATE POLICY "members update team" ON public.teams FOR UPDATE TO authenticated
    USING (public.is_team_member(id));
CREATE POLICY "members delete team" ON public.teams FOR DELETE TO authenticated
    USING (public.is_team_member(id));
CREATE POLICY "read own memberships" ON public.team_members FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_team_member(team_id));
CREATE POLICY "members players" ON public.players FOR ALL TO authenticated
    USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));
CREATE POLICY "members events" ON public.events FOR ALL TO authenticated
    USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));
CREATE POLICY "members attendance" ON public.attendance FOR ALL TO authenticated
    USING (public.is_team_member(public.event_team(event_id)))
    WITH CHECK (public.is_team_member(public.event_team(event_id)));
CREATE POLICY "members goals" ON public.goals FOR ALL TO authenticated
    USING (public.is_team_member(public.event_team(event_id)))
    WITH CHECK (public.is_team_member(public.event_team(event_id)));
CREATE POLICY "members goal_on_court" ON public.goal_on_court FOR ALL TO authenticated
    USING (public.is_team_member(public.goal_team(goal_id)))
    WITH CHECK (public.is_team_member(public.goal_team(goal_id)));
