import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { eventsQuery, playersQuery, teamGoalsQuery } from "@/lib/queries";
import { attendanceRate, computePlayerStats } from "@/lib/stats";
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

type Key = "number" | "goals" | "assists" | "points" | "plusMinus" | "attendance";
const cols: { k: Key; l: string }[] = [
  { k: "goals", l: "M" },
  { k: "assists", l: "A" },
  { k: "points", l: "P" },
  { k: "plusMinus", l: "+/−" },
  { k: "attendance", l: "Närv." },
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
    const att = events.flatMap((e) => e.attendance.filter((a) => a.player_id === p.id).map((a) => a.status));
    return { p, ...s, attendance: attendanceRate(att), number: p.number ?? 999 };
  });
  rows.sort((a, b) => (sort === "number" ? a.number - b.number : b[sort] - a[sort]));

  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-left">
        <thead className="border-b text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="p-4"><button onClick={() => setSort("number")}>Nr</button></th>
            <th className="p-4">Spelare</th>
            {cols.map((c) => (
              <th key={c.k} className="p-4 text-right">
                <button onClick={() => setSort(c.k)} className={cn(sort === c.k && "text-foreground underline")}>{c.l}</button>
              </th>
            ))}
            <th className="p-4 text-right">+ / −</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.p.id}>
              <td className="stat-num p-4 text-xl text-muted-foreground">{r.p.number ?? "–"}</td>
              <td className="p-4 font-medium">{r.p.name}</td>
              <td className="stat-num p-4 text-right text-xl">{r.goals}</td>
              <td className="stat-num p-4 text-right text-xl">{r.assists}</td>
              <td className="stat-num p-4 text-right text-2xl">{r.points}</td>
              <td className={cn("stat-num p-4 text-right text-2xl", r.plusMinus > 0 && "text-success", r.plusMinus < 0 && "text-destructive")}>
                {r.plusMinus > 0 ? `+${r.plusMinus}` : r.plusMinus}
              </td>
              <td className="stat-num p-4 text-right text-xl">{r.attendance}%</td>
              <td className="p-4 text-right text-sm text-muted-foreground">{r.plus} / {r.minus}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="p-4 text-sm text-muted-foreground">Inga spelare än.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
