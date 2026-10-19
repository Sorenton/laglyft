import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/lag/$teamId/aktiviteter/")({
  head: () => ({
    meta: [
      { title: "Aktiviteter – LAGLYFT" },
      { name: "description", content: "Träningar och matcher." },
      { property: "og:title", content: "Aktiviteter – LAGLYFT" },
      { property: "og:description", content: "Träningar och matcher." },
    ],
  }),
  component: Events,
});

function Events() {
  const { teamId } = Route.useParams();
  const { data: events } = useSuspenseQuery(eventsQuery(teamId));
  const qc = useQueryClient();
  const [kind, setKind] = useState<"training" | "match">("training");
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("events").insert({
      team_id: teamId,
      kind,
      starts_at: new Date(when).toISOString(),
      title: kind === "training" ? text : "",
      opponent: kind === "match" ? text : null,
      location: location || null,
    });
    if (error) { toast.error("Kunde inte skapa aktiviteten"); return; }
    setText(""); setLocation("");
    qc.invalidateQueries({ queryKey: ["events", teamId] });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={add} className="space-y-3 rounded-md border bg-card p-5">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={kind === "training" ? "default" : "outline"} onClick={() => setKind("training")}>Träning</Button>
          <Button type="button" size="sm" variant={kind === "match" ? "default" : "outline"} onClick={() => setKind("match")}>Match</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr_1fr_auto]">
          <Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
          <Input placeholder={kind === "match" ? "Motståndare" : "Rubrik (valfri)"} required={kind === "match"} value={text} onChange={(e) => setText(e.target.value)} />
          <Input placeholder="Plats" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Button type="submit">Lägg till</Button>
        </div>
      </form>
      <div className="divide-y rounded-md border bg-card">
        {events.map((e) => {
          const present = e.attendance.filter((a) => a.status === "present").length;
          const gf = e.goals.filter((g) => g.for_us).length;
          const ga = e.goals.length - gf;
          return (
            <Link key={e.id} to="/lag/$teamId/aktiviteter/$eventId" params={{ teamId, eventId: e.id }} className="flex items-center gap-4 p-4 hover:bg-muted">
              <Badge variant={e.kind === "match" ? "default" : "secondary"}>{e.kind === "match" ? "Match" : "Träning"}</Badge>
              <span className="flex-1 font-medium">{e.kind === "match" ? `vs ${e.opponent}` : e.title || "Träning"}</span>
              {e.kind === "match" && e.goals.length > 0 && <span className="stat-num text-2xl">{gf}–{ga}</span>}
              <span className="text-sm text-muted-foreground">{present} närv.</span>
              <span className="w-32 text-right text-sm text-muted-foreground">{new Date(e.starts_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
            </Link>
          );
        })}
        {events.length === 0 && <p className="p-4 text-sm text-muted-foreground">Inga aktiviteter än.</p>}
      </div>
    </div>
  );
}
