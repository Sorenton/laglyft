import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { eventsQuery, playersQuery, teamGoalsQuery } from "@/lib/queries";
import { attendanceRate, computePlayerStats } from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/lag/$teamId/")({
  head: () => ({
    meta: [
      { title: "Översikt – LAGLYFT" },
      { name: "description", content: "Lagets översikt: närvaro, mål och kommande aktiviteter." },
      { property: "og:title", content: "Översikt – LAGLYFT" },
      { property: "og:description", content: "Lagets översikt i LAGLYFT." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { teamId } = Route.useParams();
  const { data: events } = useSuspenseQuery(eventsQuery(teamId));
  const { data: players } = useSuspenseQuery(playersQuery(teamId));
  const { data: goals } = useSuspenseQuery(teamGoalsQuery(teamId));
  const stats = computePlayerStats(goals);
  const gf = goals.filter((g) => g.for_us).length;
  const ga = goals.length - gf;
  const rate = attendanceRate(events.flatMap((e) => e.attendance.map((a) => a.status)));
  const top = [...players]
    .flatMap((p) => { const s = stats[p.id]; return s ? [{ p, s }] : []; })
    .sort((a, b) => b.s.points - a.s.points)
    .slice(0, 5);
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now).reverse().slice(0, 4);

  const kpis = [
    { l: "Spelare", v: players.length },
    { l: "Aktiviteter", v: events.length },
    { l: "Närvaro", v: `${rate}%` },
    { l: "Mål +/−", v: `${gf}–${ga}` },
  ];

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{k.l}</div>
            <div className="stat-num mt-2 text-5xl">{k.v}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-3xl">Kommande</h2>
          <div className="mt-4 divide-y rounded-md border bg-card">
            {upcoming.map((e) => (
              <Link key={e.id} to="/lag/$teamId/aktiviteter/$eventId" params={{ teamId, eventId: e.id }} className="flex justify-between p-4 hover:bg-muted">
                <span className="font-medium">{e.kind === "match" ? `Match vs ${e.opponent ?? "?"}` : e.title || "Träning"}</span>
                <span className="text-sm text-muted-foreground">{new Date(e.starts_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
              </Link>
            ))}
            {upcoming.length === 0 && <p className="p-4 text-sm text-muted-foreground">Inget planerat.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-3xl">Poängliga</h2>
          <div className="mt-4 divide-y rounded-md border bg-card">
            {top.map(({ p, s }) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <span><span className="stat-num mr-3 text-muted-foreground">{p.number ?? "–"}</span>{p.name}</span>
                <span className="stat-num text-2xl">{s.points}p</span>
              </div>
            ))}
            {top.length === 0 && <p className="p-4 text-sm text-muted-foreground">Inga mål registrerade än.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
