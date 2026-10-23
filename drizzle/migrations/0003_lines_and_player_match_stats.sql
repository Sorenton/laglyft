CREATE TABLE public.match_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Femma',
  player_ids uuid[] NOT NULL DEFAULT '{}',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_lines TO authenticated;
GRANT ALL ON public.match_lines TO service_role;
ALTER TABLE public.match_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members match_lines" ON public.match_lines FOR ALL TO authenticated
  USING (public.is_team_member(public.event_team(event_id)))
  WITH CHECK (public.is_team_member(public.event_team(event_id)));

CREATE TABLE public.player_match_stats (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  shots integer NOT NULL DEFAULT 0,
  shots_blocked integer NOT NULL DEFAULT 0,
  blocks integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_match_stats TO authenticated;
GRANT ALL ON public.player_match_stats TO service_role;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members player_match_stats" ON public.player_match_stats FOR ALL TO authenticated
  USING (public.is_team_member(public.event_team(event_id)))
  WITH CHECK (public.is_team_member(public.event_team(event_id)));