export type GoalRow = {
  id: string;
  for_us: boolean;
  scorer_id: string | null;
  assist_id: string | null;
  on_court: string[];
};

export type PlayerStat = {
  goals: number;
  assists: number;
  points: number;
  plus: number;
  minus: number;
  plusMinus: number;
};

const empty = (): PlayerStat => ({ goals: 0, assists: 0, points: 0, plus: 0, minus: 0, plusMinus: 0 });

/**
 * Goals/assists count only for our goals. Plus/minus: every player on court
 * gets +1 when we score and -1 when we concede.
 */
export function computePlayerStats(goals: GoalRow[]): Record<string, PlayerStat> {
  const out: Record<string, PlayerStat> = {};
  const get = (id: string) => (out[id] ??= empty());
  for (const g of goals) {
    if (g.for_us) {
      if (g.scorer_id) get(g.scorer_id).goals++;
      if (g.assist_id) get(g.assist_id).assists++;
    }
    for (const pid of new Set(g.on_court)) {
      if (g.for_us) get(pid).plus++;
      else get(pid).minus++;
    }
  }
  for (const s of Object.values(out)) {
    s.points = s.goals + s.assists;
    s.plusMinus = s.plus - s.minus;
  }
  return out;
}

/** "not_called" (Ej kallad) does not count toward attendance at all. */
export function attendanceRate(all: string[]): number {
  const statuses = all.filter((s) => s !== "not_called");
  if (statuses.length === 0) return 0;
  return Math.round((statuses.filter((s) => s === "present").length / statuses.length) * 100);
}
