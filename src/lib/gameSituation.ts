// Ren logik för att avgöra powerplay/boxplay ur ett matchprotokoll.

export type GameSituation = "full_strength" | "powerplay" | "boxplay" | "penalty_shot" | "empty_net";

export const SITUATION_LABEL: Record<GameSituation, string> = {
  full_strength: "Fulltaliga",
  powerplay: "PP",
  boxplay: "BP",
  penalty_shot: "Straff",
  empty_net: "Tom bur",
};

export type ProtoPenalty = { team: "home" | "away"; period: number; minute: number; second: number; minutes: number };
export type ProtoGoal = { team: "home" | "away"; period: number; minute: number; second: number };

const PERIOD_SECONDS = 20 * 60;

export function absSeconds(period: number, minute: number, second: number) {
  return (Math.max(period, 1) - 1) * PERIOD_SECONDS + minute * 60 + second;
}

/** Läser ut utvisningslängd i minuter ur t.ex. "Slag, 2 min" eller "Matchstraff". */
export function penaltyMinutes(name: string): number {
  const m = name.match(/(\d+)\s*\+\s*(\d+)\s*min/i);
  if (m) return Number(m[1]) + Number(m[2]);
  const n = name.match(/(\d+)\s*min/i);
  if (n) return Number(n[1]);
  if (/match/i.test(name)) return 5;
  return 2;
}

/** Tid laget sitter med en man mindre. Personliga 10 min ger inget numerärt underläge. */
function shortHandedSeconds(minutes: number) {
  if (minutes === 10) return 0;
  if (minutes === 12) return 120; // 2 + 10
  if (minutes === 4) return 240; // 2+2
  return minutes * 60;
}

/**
 * Klassar varje mål (i ordning) som fulltaliga, PP eller BP sett ur målgörande lags perspektiv.
 * En 2-minuters utvisning upphör om motståndaren gör mål. 5 min/matchstraff avtjänas fullt.
 */
export function classifyGoals(goals: ProtoGoal[], penalties: ProtoPenalty[]): GameSituation[] {
  const active = penalties
    .map((p) => {
      const start = absSeconds(p.period, p.minute, p.second);
      const len = shortHandedSeconds(p.minutes);
      return { team: p.team, start, end: start + len, minor: p.minutes === 2 || p.minutes === 4 || p.minutes === 12, len };
    })
    .filter((p) => p.len > 0);

  const ordered = goals.map((g, i) => ({ ...g, i, t: absSeconds(g.period, g.minute, g.second) })).sort((a, b) => a.t - b.t);
  const result: GameSituation[] = goals.map(() => "full_strength");

  for (const g of ordered) {
    const running = active.filter((p) => p.start <= g.t && g.t < p.end);
    const home = running.filter((p) => p.team === "home").length;
    const away = running.filter((p) => p.team === "away").length;
    const own = g.team === "home" ? home : away;
    const opp = g.team === "home" ? away : home;
    if (opp > own) {
      result[g.i] = "powerplay";
      // Första (äldsta) mindre utvisningen hos motståndaren avbryts av målet.
      const minor = running.filter((p) => p.team !== g.team && p.minor).sort((a, b) => a.start - b.start)[0];
      if (minor) minor.end = g.t;
    } else if (own > opp) {
      result[g.i] = "boxplay";
    }
  }
  return result;
}
