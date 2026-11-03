import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GoalRow } from "./stats";

export const teamsQuery = () =>
  queryOptions({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const teamQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").eq("id", teamId).single();
      if (error) throw error;
      return data;
    },
  });

export const playersQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["players", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .order("number", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

export const eventsQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["events", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, attendance(player_id, status), goals(id, for_us), player_match_stats(player_id, shots, shots_blocked, blocks, saves)")
        .eq("team_id", teamId)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const eventQuery = (eventId: string) =>
  queryOptions({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, attendance(player_id, status), goals(*, goal_on_court(player_id)), penalties(*), match_lines(*), player_match_stats(*)")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

export const teamGoalsQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["teamGoals", teamId],
    queryFn: async (): Promise<GoalRow[]> => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, for_us, scorer_id, assist_id, goal_on_court(player_id), events!inner(team_id)")
        .eq("events.team_id", teamId);
      if (error) throw error;
      return data.map((g) => ({
        id: g.id,
        for_us: g.for_us,
        scorer_id: g.scorer_id,
        assist_id: g.assist_id,
        on_court: g.goal_on_court.map((x) => x.player_id),
      }));
    },
  });

export const STATUS_LABEL: Record<string, string> = {
  present: "Närvarande",
  absent: "Frånvarande",
  sick: "Sjuk",
  injured: "Skadad",
  not_called: "Ej kallad",
};

export const teamEventGoalsQuery = (teamId: string) =>
  queryOptions({
    queryKey: ["teamEventGoals", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, starts_at, opponent, title, kind, goals(id, for_us, scorer_id, assist_id, game_situation, goal_on_court(player_id)), match_lines(name, player_ids)")
        .eq("team_id", teamId)
        .eq("kind", "match")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
