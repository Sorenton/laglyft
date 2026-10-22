ALTER TABLE public.goals ADD COLUMN game_situation text NOT NULL DEFAULT 'full_strength' CHECK (game_situation IN ('full_strength','powerplay','boxplay','penalty_shot','empty_net'));
ALTER TABLE public.goals ADD COLUMN external_id bigint;
CREATE UNIQUE INDEX goals_event_external_uidx ON public.goals(event_id, external_id) WHERE external_id IS NOT NULL;
ALTER TABLE public.events ADD COLUMN external_match_id bigint;

CREATE TABLE public.penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  for_us boolean NOT NULL,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  player_name text,
  shirt_no integer,
  period integer,
  game_time text,
  minutes integer NOT NULL DEFAULT 2,
  code text,
  reason text,
  external_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX penalties_event_idx ON public.penalties(event_id);
CREATE UNIQUE INDEX penalties_event_external_uidx ON public.penalties(event_id, external_id) WHERE external_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalties TO authenticated;
GRANT ALL ON public.penalties TO service_role;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members penalties" ON public.penalties FOR ALL TO authenticated
  USING (public.is_team_member(public.event_team(event_id)))
  WITH CHECK (public.is_team_member(public.event_team(event_id)));