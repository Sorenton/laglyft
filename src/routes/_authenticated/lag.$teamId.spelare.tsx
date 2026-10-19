import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playersQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/lag/$teamId/spelare")({
  head: () => ({
    meta: [
      { title: "Spelare – LAGLYFT" },
      { name: "description", content: "Lagets spelartrupp." },
      { property: "og:title", content: "Spelare – LAGLYFT" },
      { property: "og:description", content: "Lagets spelartrupp." },
    ],
  }),
  component: Players,
});

function Players() {
  const { teamId } = Route.useParams();
  const { data: players } = useSuspenseQuery(playersQuery(teamId));
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["players", teamId] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("players").insert({
      team_id: teamId,
      name,
      number: number ? Number(number) : null,
      position: position || null,
    });
    if (error) return toast.error("Kunde inte lägga till spelaren");
    setName(""); setNumber(""); setPosition("");
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Ta bort spelaren? All statistik för spelaren försvinner.")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return toast.error("Kunde inte ta bort");
    refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={add} className="grid gap-3 rounded-md border bg-card p-5 sm:grid-cols-[90px_1fr_180px_auto]">
        <Input placeholder="Nr" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
        <Input placeholder="Namn" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Position (t.ex. Back)" value={position} onChange={(e) => setPosition(e.target.value)} />
        <Button type="submit">Lägg till</Button>
      </form>
      <div className="divide-y rounded-md border bg-card">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-4">
            <span className="stat-num w-12 text-3xl text-muted-foreground">{p.number ?? "–"}</span>
            <span className="flex-1 font-medium">{p.name}</span>
            <span className="text-sm text-muted-foreground">{p.position}</span>
            <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>Ta bort</Button>
          </div>
        ))}
        {players.length === 0 && <p className="p-4 text-sm text-muted-foreground">Lägg till lagets spelare ovan.</p>}
      </div>
    </div>
  );
}
