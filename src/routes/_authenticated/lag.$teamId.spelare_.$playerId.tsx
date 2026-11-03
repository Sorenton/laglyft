import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { eventsQuery, playersQuery, teamEventGoalsQuery, teamGoalsQuery, STATUS_LABEL } from "@/lib/queries";
import { attendanceSummary, computePlayerStats, teammateCounts } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lag/$teamId/spelare_/$playerId")({
  head: () => ({
    meta: [
      { title: "Spelarprofil – LAGLYFT" },
      { name: "description", content: "Statistik, närvaro, matcher och medspelare för spelaren." },
      { property: "og:title", content: "Spelarprofil – LAGLYFT" },
      { property: "og:description", content: "Spelarens statistik och närvaro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

const PIE_COLORS: Record<string, string> = {
  present: "var(--foreground)",
  absent: "var(--destructive)",
  sick: "var(--muted-foreground)",
  injured: "var(--border)",
};

function Box({ l, v, sub }: { l: string; v: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{l}</div>
      <div className="stat-num text-4xl">{v}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Profile() {
  const { teamId, playerId } = Route.useParams();
  const { data: players } = useSuspenseQuery(playersQuery(teamId));
  const { data: events } = useSuspenseQuery(eventsQuery(teamId));
  const { data: goals } = useSuspenseQuery(teamGoalsQuery(teamId));
  const { data: matches } = useSuspenseQuery(teamEventGoalsQuery(teamId));
  const p = players.find((x) => x.id === playerId);
  if (!p) return <p className="text-muted-foreground">Spelaren hittades inte.</p>;
  const name = (id: string) => players.find((x) => x.id === id)?.name ?? "Okänd";

  const s = computePlayerStats(goals)[p.id] ?? { goals: 0, assists: 0, points: 0, plus: 0, minus: 0, plusMinus: 0 };
  const att = events.flatMap((e) => e.attendance.filter((a) => a.player_id === p.id).map((a) => ({ kind: e.kind, status: a.status })));
  const sum = attendanceSummary(att);
  const counts: Record<string, number> = {};
  for (const a of att) if (a.status !== "not_called") counts[a.status] = (counts[a.status] ?? 0) + 1;
  const pie = Object.entries(counts).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v, key: k }));

  const ms = events.flatMap((e) => e.player_match_stats.filter((x) => x.player_id === p.id));
  const tot = (k: "shots" | "shots_blocked" | "blocks" | "saves") => ms.reduce((n, x) => n + x[k], 0);

  const mates = Object.entries(teammateCounts(p.id, goals)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lineMates: Record<string, number> = {};
  for (const m of matches) for (const l of m.match_lines) if (l.player_ids.includes(p.id))
    for (const id of l.player_ids) if (id !== p.id) lineMates[id] = (lineMates[id] ?? 0) + 1;

  const played = matches.filter((m) => {
    const ev = events.find((e) => e.id === m.id);
    return ev?.attendance.some((a) => a.player_id === p.id && a.status === "present")
      || m.goals.some((g) => g.goal_on_court.some((x) => x.player_id === p.id));
  }).map((m) => {
    const our = m.goals.filter((g) => g.for_us).length;
    const their = m.goals.length - our;
    const g = m.goals.filter((x) => x.for_us && x.scorer_id === p.id).length;
    const a = m.goals.filter((x) => x.for_us && x.assist_id === p.id).length;
    let pm = 0;
    for (const x of m.goals) if (x.goal_on_court.some((c) => c.player_id === p.id)) pm += x.for_us ? 1 : -1;
    const st = ms.find((x) => events.find((e) => e.id === m.id)?.player_match_stats.includes(x));
    return { m, our, their, g, a, pm, shots: st?.shots ?? 0 };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link to="/lag/$teamId/statistik" params={{ teamId }} className="text-sm text-muted-foreground hover:underline">← Statistik</Link>
          <h1 className="text-4xl font-bold">
            <span className="stat-num mr-3 text-muted-foreground">{p.number ?? "–"}</span>{p.name}
          </h1>
          {p.position && <p className="text-muted-foreground">{p.position}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Box l="Matcher" v={played.length} />
        <Box l="Mål" v={s.goals} />
        <Box l="Assist" v={s.assists} />
        <Box l="Poäng" v={s.points} sub={played.length ? `${(s.points / played.length).toFixed(1)} / match` : undefined} />
        <Box l="+/−" v={s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus} sub={`${s.plus} plus / ${s.minus} minus`} />
        <Box l="Skott" v={tot("shots")} sub={`${tot("shots_blocked")} i täck`} />
        <Box l="Täckta" v={tot("blocks")} />
        <Box l="Räddningar" v={tot("saves")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border bg-card p-5">
          <h2 className="mb-1 text-lg font-semibold">Närvaro</h2>
          <p className="text-sm text-muted-foreground">
            {sum.rate}% av kallade · Träningar {sum.trainings.present}/{sum.trainings.called} · Matcher {sum.matches.present}/{sum.matches.called}
          </p>
          {pie.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Ingen närvaro registrerad än.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} stroke="var(--card)">
                    {pie.map((d) => <Cell key={d.key} fill={PIE_COLORS[d.key] ?? "var(--muted)"} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-md border bg-card p-5">
          <h2 className="mb-3 text-lg font-semibold">Spelat mest med</h2>
          {mates.length === 0 && Object.keys(lineMates).length === 0 && (
            <p className="text-sm text-muted-foreground">Fyll i spelare på plan vid mål eller femmor för att se detta.</p>
          )}
          {mates.length > 0 && (
            <>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">På plan samtidigt vid mål</p>
              <ul className="mb-4 space-y-1">
                {mates.map(([id, n]) => (
                  <li key={id} className="flex justify-between">
                    <Link to="/lag/$teamId/spelare/$playerId" params={{ teamId, playerId: id }} className="hover:underline">{name(id)}</Link>
                    <span className="stat-num">{n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {Object.keys(lineMates).length > 0 && (
            <>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Samma femma (antal matcher)</p>
              <ul className="space-y-1">
                {Object.entries(lineMates).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                  <li key={id} className="flex justify-between">
                    <Link to="/lag/$teamId/spelare/$playerId" params={{ teamId, playerId: id }} className="hover:underline">{name(id)}</Link>
                    <span className="stat-num">{n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-md border bg-card">
        <h2 className="p-5 pb-2 text-lg font-semibold">Matcher</h2>
        <table className="w-full text-left">
          <thead className="border-b text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">Datum</th><th className="p-3">Motstånd</th><th className="p-3 text-right">Res.</th>
              <th className="p-3 text-right">M</th><th className="p-3 text-right">A</th><th className="p-3 text-right">P</th>
              <th className="p-3 text-right">+/−</th><th className="p-3 text-right">Sk</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {played.map((r) => (
              <tr key={r.m.id}>
                <td className="p-3 text-sm">{new Date(r.m.starts_at).toLocaleDateString("sv-SE")}</td>
                <td className="p-3">
                  <Link to="/lag/$teamId/aktiviteter/$eventId" params={{ teamId, eventId: r.m.id }} className="font-medium hover:underline">
                    {r.m.opponent || r.m.title || "Match"}
                  </Link>
                </td>
                <td className="stat-num p-3 text-right">{r.our}–{r.their}</td>
                <td className="stat-num p-3 text-right">{r.g}</td>
                <td className="stat-num p-3 text-right">{r.a}</td>
                <td className="stat-num p-3 text-right">{r.g + r.a}</td>
                <td className={cn("stat-num p-3 text-right", r.pm > 0 && "text-success", r.pm < 0 && "text-destructive")}>{r.pm > 0 ? `+${r.pm}` : r.pm}</td>
                <td className="stat-num p-3 text-right">{r.shots}</td>
              </tr>
            ))}
            {played.length === 0 && <tr><td colSpan={8} className="p-4 text-sm text-muted-foreground">Inga matcher spelade än.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
