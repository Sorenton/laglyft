import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { teamsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/lag/")({
  head: () => ({
    meta: [
      { title: "Mina lag – LAGLYFT" },
      { name: "description", content: "Välj eller skapa ett lag i LAGLYFT." },
      { property: "og:title", content: "Mina lag – LAGLYFT" },
      { property: "og:description", content: "Välj eller skapa ett lag i LAGLYFT." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { data: teams } = useSuspenseQuery(teamsQuery());
  const qc = useQueryClient();
  const [name, setName] = useState("IBK Göteborg HJ18");
  const [club, setClub] = useState("IBK Göteborg");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("teams").insert({ name, club });
    if (error) return toast.error("Kunde inte skapa laget");
    toast.success("Laget är skapat");
    qc.invalidateQueries({ queryKey: ["teams"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <span className="font-display text-3xl">LAGLYFT</span>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Logga ut</Button>
      </div>
      <h1 className="mt-10 text-6xl">Mina lag</h1>
      <div className="mt-6 grid gap-3">
        {teams.map((t) => (
          <Link key={t.id} to="/lag/$teamId" params={{ teamId: t.id }} className="flex items-center justify-between rounded-md border bg-card p-5 transition hover:border-foreground">
            <div>
              <div className="font-display text-3xl">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.club}</div>
            </div>
            <span aria-hidden>→</span>
          </Link>
        ))}
        {teams.length === 0 && <p className="text-muted-foreground">Du har inga lag än. Skapa ditt första nedan.</p>}
      </div>
      <form onSubmit={create} className="mt-10 space-y-4 rounded-md border bg-card p-6">
        <h2 className="text-3xl">Nytt lag</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Lagnamn</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Förening</Label><Input value={club} onChange={(e) => setClub(e.target.value)} /></div>
        </div>
        <Button type="submit">Skapa lag</Button>
      </form>
    </div>
  );
}
