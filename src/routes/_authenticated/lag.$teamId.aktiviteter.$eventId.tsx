import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventQuery, playersQuery, STATUS_LABEL } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/lag/$teamId/aktiviteter/$eventId")({
  head: () => ({
    meta: [
      { title: "Aktivitet – LAGLYFT" },
      { name: "description", content: "Närvaro och målregistrering." },
      { property: "og:title", content: "Aktivitet – LAGLYFT" },
      { property: "og:description", content: "Närvaro och målregistrering." },
    ],
  }),
  component: EventPage,
});

const STATUSES = ["present", "absent", "sick", "injured", "not_called"] as const;

function EventPage() {
  const { teamId, eventId } = Route.useParams();
  const { data: ev } = useSuspenseQuery(eventQuery(eventId));
  const { data: players } = useSuspenseQuery(playersQuery(teamId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["event", eventId] });
    qc.invalidateQueries({ queryKey: ["events", teamId] });
    qc.invalidateQueries({ queryKey: ["teamGoals", teamId] });
  };
  const statusOf = (pid: string) => ev.attendance.find((a) => a.player_id === pid)?.status;
  const nameOf = (pid: string | null) => players.find((p) => p.id === pid)?.name ?? "–";

  async function setStatus(pid: string, status: string) {
    const { error } = await supabase.from("attendance").upsert({ event_id: eventId, player_id: pid, status });
    if (error) { toast.error("Kunde inte spara närvaro"); return; }
    refresh();
  }

  async function removeEvent() {
    if (!confirm("Ta bort aktiviteten?")) return;
    await supabase.from("events").delete().eq("id", eventId);
    refresh();
    navigate({ to: "/lag/$teamId/aktiviteter", params: { teamId } });
  }

  const gf = ev.goals.filter((g) => g.for_us).length;
  const ga = ev.goals.length - gf;
  const isMatch = ev.kind === "match";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/lag/$teamId/aktiviteter" params={{ teamId }} className="text-sm text-muted-foreground">← Aktiviteter</Link>
          <h2 className="mt-2 text-5xl">{isMatch ? `vs ${ev.opponent}` : ev.title || "Träning"}</h2>
          <p className="text-muted-foreground">
            {new Date(ev.starts_at).toLocaleString("sv-SE", { dateStyle: "full", timeStyle: "short" })}
            {ev.location ? ` · ${ev.location}` : ""}
          </p>
        </div>
        {isMatch && <div className="stat-num text-7xl">{gf}–{ga}</div>}
      </div>

      <section>
        <h3 className="text-3xl">Närvaro</h3>
        <div className="mt-4 divide-y rounded-md border bg-card">
          {players.map((p) => {
            const cur = statusOf(p.id);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="stat-num w-10 text-2xl text-muted-foreground">{p.number ?? "–"}</span>
                <span className="min-w-32 flex-1 font-medium">{p.name}</span>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((s) => (
                    <Button key={s} size="sm" variant={cur === s ? "default" : "outline"} onClick={() => setStatus(p.id, s)}>
                      {STATUS_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
          {players.length === 0 && <p className="p-4 text-sm text-muted-foreground">Lägg till spelare först.</p>}
        </div>
      </section>

      {isMatch && (
        <section>
          <h3 className="text-3xl">Mål</h3>
          <GoalForm eventId={eventId} players={players} presentIds={ev.attendance.filter((a) => a.status === "present").map((a) => a.player_id)} onSaved={refresh} />
          <div className="mt-4 divide-y rounded-md border bg-card">
            {ev.goals.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className={cn("stat-num w-20 text-xl", g.for_us ? "text-success" : "text-destructive")}>{g.for_us ? "Gjort" : "Insläppt"}</span>
                <span className="text-sm text-muted-foreground">P{g.period ?? "?"} {g.game_time}</span>
                <span className="flex-1">
                  {g.for_us ? <>{nameOf(g.scorer_id)}{g.assist_id && <span className="text-muted-foreground"> (ass. {nameOf(g.assist_id)})</span>}</> : null}
                  <span className="block text-xs text-muted-foreground">På plan: {g.goal_on_court.map((x) => nameOf(x.player_id)).join(", ") || "–"}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("goals").delete().eq("id", g.id); refresh(); }}>Ta bort</Button>
              </div>
            ))}
            {ev.goals.length === 0 && <p className="p-4 text-sm text-muted-foreground">Inga mål registrerade.</p>}
          </div>
        </section>
      )}

      <Button variant="outline" onClick={removeEvent}>Ta bort aktivitet</Button>
    </div>
  );
}

type P = { id: string; name: string; number: number | null };

function GoalForm({ eventId, players, presentIds, onSaved }: { eventId: string; players: P[]; presentIds: string[]; onSaved: () => void }) {
  const [forUs, setForUs] = useState(true);
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const [period, setPeriod] = useState("1");
  const [time, setTime] = useState("");
  const [onCourt, setOnCourt] = useState<string[]>([]);
  const roster = presentIds.length ? players.filter((p) => presentIds.includes(p.id)) : players;

  const toggle = (id: string) => setOnCourt((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const court = new Set(onCourt);
    if (forUs && scorer) court.add(scorer);
    if (forUs && assist) court.add(assist);
    const { data, error } = await supabase
      .from("goals")
      .insert({
        event_id: eventId,
        for_us: forUs,
        scorer_id: forUs && scorer ? scorer : null,
        assist_id: forUs && assist ? assist : null,
        period: Number(period),
        game_time: time || null,
      })
      .select("id")
      .single();
    if (error || !data) { toast.error("Kunde inte spara målet"); return; }
    if (court.size) {
      const { error: e2 } = await supabase.from("goal_on_court").insert([...court].map((player_id) => ({ goal_id: data.id, player_id })));
      if (e2) toast.error("Kunde inte spara vilka som var på plan");
    }
    setScorer(""); setAssist(""); setTime(""); setOnCourt([]);
    toast.success("Mål registrerat");
    onSaved();
  }

  const select = "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <form onSubmit={save} className="mt-4 space-y-4 rounded-md border bg-card p-5">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={forUs ? "default" : "outline"} onClick={() => setForUs(true)}>Gjort mål</Button>
        <Button type="button" size="sm" variant={!forUs ? "default" : "outline"} onClick={() => setForUs(false)}>Insläppt mål</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {forUs && (
          <>
            <select className={select} value={scorer} onChange={(e) => setScorer(e.target.value)} aria-label="Målskytt">
              <option value="">Målskytt</option>
              {roster.map((p) => <option key={p.id} value={p.id}>{p.number ?? ""} {p.name}</option>)}
            </select>
            <select className={select} value={assist} onChange={(e) => setAssist(e.target.value)} aria-label="Assist">
              <option value="">Assist</option>
              {roster.map((p) => <option key={p.id} value={p.id}>{p.number ?? ""} {p.name}</option>)}
            </select>
          </>
        )}
        <select className={select} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
          <option value="1">Period 1</option><option value="2">Period 2</option><option value="3">Period 3</option><option value="4">Förlängning</option>
        </select>
        <Input className="w-28" placeholder="Tid 12:34" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">På plan (för plus/minus)</div>
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => (
            <Button key={p.id} type="button" size="sm" variant={onCourt.includes(p.id) ? "default" : "outline"} onClick={() => toggle(p.id)}>
              {p.number ?? ""} {p.name}
            </Button>
          ))}
        </div>
      </div>
      <Button type="submit">Spara mål</Button>
    </form>
  );
}
