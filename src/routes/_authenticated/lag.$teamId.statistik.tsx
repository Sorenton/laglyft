import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { eventsQuery, playersQuery, teamGoalsQuery } from "@/lib/queries";
import { attendanceSummary, computePlayerStats } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lag/$teamId/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik – LAGLYFT" },
      { name: "description", content: "Mål, assist, poäng, plus/minus och närvaro per spelare." },
      { property: "og:title", content: "Statistik – LAGLYFT" },
      { property: "og:description", content: "Spelarstatistik för laget." },
    ],
  }),
  component: Stats,
});

type Key = "number" | "goals" | "assists" | "points" | "plusMinus" | "shots" | "blocks" | "saves" | "trainings" | "matches" | "attendance";
const cols: { k: Key; l: string; t: string }[] = [
  { k: "goals", l: "M", t: "Mål" },
  { k: "assists", l: "A", t: "Assist" },
  { k: "points", l: "P", t: "Poäng" },
  { k: "plusMinus", l: "+/−", t: "Plus/minus" },
  { k: "shots", l: "Sk", t: "Skott (varav i täck)" },
  { k: "blocks", l: "Tä", t: "Täckta skott" },
  { k: "saves", l: "Rä", t: "Räddningar" },
  { k: "trainings", l: "Tr", t: "Träningar närvarande / kallad" },
  { k: "matches", l: "Ma", t: "Matcher närvarande / kallad" },
  { k: "attendance", l: "Närv.", t: "Närvaro av kallade" },
];

function Stats() {
  const { teamId } = Route.useParams();
  const { data: players } = useSuspenseQuery(playersQuery(teamId));
  const { data: goals } = useSuspenseQuery(teamGoalsQuery(teamId));
  const { data: events } = useSuspenseQuery(eventsQuery(teamId));
  const [sort, setSort] = useState<Key>("points");
  const stats = computePlayerStats(goals);

  const rows = players.map((p) => {
    const s = stats[p.id] ?? { goals: 0, assists: 0, points: 0, plus: 0, minus: 0, plusMinus: 0 };
    const att = events.flatMap((e) => e.attendance.filter((a) => a.player_id === p.id).map((a) => ({ kind: e.kind, status: a.status })));
    const sum = attendanceSummary(att);
    const ms = events.flatMap((e) => e.player_match_stats.filter((x) => x.player_id === p.id));
    const tot = (k: "shots" | "shots_blocked" | "blocks" | "saves") => ms.reduce((n, x) => n + x[k], 0);
    return {
      p, ...s, sum,
      shots: tot("shots"), shotsBlocked: tot("shots_blocked"), blocks: tot("blocks"), saves: tot("saves"),
      trainings: sum.trainings.present, matches: sum.matches.present,
      attendance: sum.rate, number: p.number ?? 999,
    };
  });
  rows.sort((a, b) => (sort === "number" ? a.number - b.number : b[sort] - a[sort]));

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-left">
        <thead className="border-b text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="p-3"><button onClick={() => setSort("number")}>Nr</button></th>
            <th className="p-3">Spelare</th>
            {cols.map((c) => (
              <th key={c.k} className="p-3 text-right" title={c.t}>
                <button onClick={() => setSort(c.k)} className={cn(sort === c.k && "text-foreground underline")}>{c.l}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.p.id}>
              <td className="stat-num p-3 text-xl text-muted-foreground">{r.p.number ?? "–"}</td>
              <td className="p-3 font-medium"><Link to="/lag/$teamId/spelare/$playerId" params={{ teamId, playerId: r.p.id }} className="hover:underline">{r.p.name}</Link></td>
              <td className="stat-num p-3 text-right text-xl">{r.goals}</td>
              <td className="stat-num p-3 text-right text-xl">{r.assists}</td>
              <td className="stat-num p-3 text-right text-2xl">{r.points}</td>
              <td className={cn("stat-num p-3 text-right text-2xl", r.plusMinus > 0 && "text-success", r.plusMinus < 0 && "text-destructive")}>
                {r.plusMinus > 0 ? `+${r.plusMinus}` : r.plusMinus}
                <span className="block text-xs text-muted-foreground">{r.plus}/{r.minus}</span>
              </td>
              <td className="stat-num p-3 text-right text-xl">{r.shots}<span className="block text-xs text-muted-foreground">täck {r.shotsBlocked}</span></td>
              <td className="stat-num p-3 text-right text-xl">{r.blocks}</td>
              <td className="stat-num p-3 text-right text-xl">{r.saves}</td>
              <td className="stat-num p-3 text-right text-xl">{r.sum.trainings.present}/{r.sum.trainings.called}</td>
              <td className="stat-num p-3 text-right text-xl">{r.sum.matches.present}/{r.sum.matches.called}</td>
              <td className="stat-num p-3 text-right text-xl">{r.attendance}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={12} className="p-4 text-sm text-muted-foreground">Inga spelare än.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
