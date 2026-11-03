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

export type AttendanceEntry = { kind: string; status: string };
export type AttendanceSummary = {
  trainings: { present: number; called: number };
  matches: { present: number; called: number };
  rate: number;
};

/**
 * A player is "called" for an event when they have any status except
 * not_called. Rate = present / called over trainings + matches.
 */
export function attendanceSummary(entries: AttendanceEntry[]): AttendanceSummary {
  const trainings = { present: 0, called: 0 };
  const matches = { present: 0, called: 0 };
  for (const e of entries) {
    if (e.status === "not_called") continue;
    const bucket = e.kind === "match" ? matches : trainings;
    bucket.called++;
    if (e.status === "present") bucket.present++;
  }
  const called = trainings.called + matches.called;
  const present = trainings.present + matches.present;
  return { trainings, matches, rate: called ? Math.round((present / called) * 100) : 0 };
}

/** How many of our on-court goal events (for or against) each teammate shared with the player. */
export function teammateCounts(playerId: string, goals: GoalRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of goals) {
    const court = new Set(g.on_court);
    if (!court.has(playerId)) continue;
    for (const id of court) if (id !== playerId) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
