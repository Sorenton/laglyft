import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – LAGLYFT" },
      { name: "description", content: "Logga in på LAGLYFT, lagkontoret för innebandy." },
      { property: "og:title", content: "Logga in – LAGLYFT" },
      { property: "og:description", content: "Logga in på LAGLYFT, lagkontoret för innebandy." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error("Fel e-post eller lösenord"); return; }
      navigate({ to: "/lag" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/lag" },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Kolla din e-post och bekräfta kontot.");
    }
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { toast.error("Inloggning med Google misslyckades"); return; }
    if (res.redirected) return;
    navigate({ to: "/lag" });
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="court-bg hidden flex-col justify-between p-10 md:flex">
        <Link to="/" className="font-display text-3xl">LAGLYFT</Link>
        <h1 className="text-7xl">Hela laget.<br />Ett kontor.</h1>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <h2 className="text-5xl">{mode === "in" ? "Logga in" : "Skapa konto"}</h2>
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Fortsätt med Google
          </Button>
          <div className="text-center text-xs uppercase tracking-widest text-muted-foreground">eller</div>
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Lösenord</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "Logga in" : "Skapa konto"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Inget konto? Skapa ett" : "Har du konto? Logga in"}
          </button>
        </form>
      </div>
    </div>
  );
}
