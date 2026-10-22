import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProtocol, type Protocol } from "@/lib/innebandy.functions";
import { SITUATION_LABEL } from "@/lib/gameSituation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Player = { id: string; name: string; number: number | null };
type Props = {
  eventId: string;
  teamId: string;
  teamName: string;
  club: string;
  players: Player[];
  existingGoalIds: number[];
  existingPenaltyIds: number[];
  existingAttendance: string[];
  onDone: () => void;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

export function ProtocolImport(p: Props) {
  const fetchFn = useServerFn(fetchProtocol);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [proto, setProto] = useState<Protocol | null>(null);
  const [side, setSide] = useState<"home" | "away">("home");
  const [createMissing, setCreateMissing] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetchFn({ data: { url } });
      setProto(r);
      const key = norm(p.club || p.teamName);
      setSide(key && norm(r.away).includes(key) && !norm(r.home).includes(key) ? "away" : "home");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte hämta matchen");
    } finally {
      setLoading(false);
    }
  }

  const ours = proto ? (side === "home" ? proto.homePlayers : proto.awayPlayers) : [];
  const match = (name: string, no: number | null, list: Player[]) =>
    list.find((x) => norm(x.name) === norm(name)) ?? (no != null ? list.find((x) => x.number === no) : undefined);
  const missing = ours.filter((op) => !match(op.Name, op.ShirtNo, p.players));

  async function importAll() {
    if (!proto) return;
    setLoading(true);
    try {
      let roster = [...p.players];
      if (createMissing && missing.length) {
        const { data, error } = await supabase
          .from("players")
          .insert(missing.map((m) => ({ team_id: p.teamId, name: m.Name, number: m.ShirtNo, position: m.Position })))
          .select("id, name, number");
        if (error) throw error;
        roster = [...roster, ...data];
      }
      const find = (name?: string, no?: number | null) => (name ? match(name, no ?? null, roster)?.id ?? null : null);

      const lineupIds = new Set(ours.map((o) => find(o.Name, o.ShirtNo)).filter((x): x is string => !!x));
      const att = [
        ...[...lineupIds].map((player_id) => ({ event_id: p.eventId, player_id, status: "present" })),
        ...roster
          .filter((r) => !lineupIds.has(r.id) && !p.existingAttendance.includes(r.id))
          .map((r) => ({ event_id: p.eventId, player_id: r.id, status: "not_called" })),
      ];
      if (att.length) {
        const { error } = await supabase.from("attendance").upsert(att);
        if (error) throw error;
      }

      const newGoals = proto.goals.filter((g) => !p.existingGoalIds.includes(g.externalId));
      for (const g of newGoals) {
        const forUs = g.team === side;
        const scorer = forUs ? find(g.scorer?.name, g.scorer?.no) : null;
        const assist = forUs ? find(g.assist?.name, g.assist?.no) : null;
        const { data, error } = await supabase
          .from("goals")
          .insert({
            event_id: p.eventId, for_us: forUs, scorer_id: scorer, assist_id: assist, period: g.period,
            game_time: g.time, game_situation: g.situation, external_id: g.externalId,
          })
          .select("id")
          .single();
        if (error) throw error;
        const court = [scorer, assist].filter((x): x is string => !!x);
        if (court.length) await supabase.from("goal_on_court").insert(court.map((player_id) => ({ goal_id: data.id, player_id })));
      }

      const newPens = proto.penalties.filter((x) => !p.existingPenaltyIds.includes(x.externalId));
      if (newPens.length) {
        const { error } = await supabase.from("penalties").insert(
          newPens.map((x) => {
            const forUs = x.team === side;
            return {
              event_id: p.eventId, for_us: forUs, player_id: forUs ? find(x.name, x.no) : null, player_name: x.name || null,
              shirt_no: x.no, period: x.period, game_time: x.time, minutes: x.minutes, code: x.code, reason: x.reason,
              external_id: x.externalId,
            };
          }),
        );
        if (error) throw error;
      }
      await supabase
        .from("events")
        .update({ external_match_id: proto.matchId, opponent: side === "home" ? proto.away : proto.home })
        .eq("id", p.eventId);

      toast.success(`Importerade ${newGoals.length} mål och ${newPens.length} utvisningar`);
      setOpen(false);
      setProto(null);
      p.onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Importen misslyckades");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Hämta från matchprotokoll</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hämta från stats.innebandy.se</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="https://stats.innebandy.se/sasong/…/match/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={load} disabled={loading || !url}>{loading && !proto ? "Hämtar…" : "Hämta"}</Button>
        </div>

        {proto && (
          <div className="space-y-5">
            <div>
              <div className="stat-num text-3xl">{proto.home} {proto.score[0]}–{proto.score[1]} {proto.away}</div>
              <p className="text-sm text-muted-foreground">Vilket lag är ert?</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant={side === "home" ? "default" : "outline"} onClick={() => setSide("home")}>{proto.home}</Button>
                <Button size="sm" variant={side === "away" ? "default" : "outline"} onClick={() => setSide("away")}>{proto.away}</Button>
              </div>
            </div>

            <div className="text-sm">
              <b>{ours.length}</b> spelare i matchtruppen markeras som Närvarande.
              {missing.length > 0 && (
                <label className="mt-2 flex items-start gap-2">
                  <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="mt-1" />
                  <span>Lägg till {missing.length} saknade spelare i truppen: <span className="text-muted-foreground">{missing.map((m) => m.Name).join(", ")}</span></span>
                </label>
              )}
            </div>

            <div>
              <h4 className="text-xl">Mål</h4>
              <ul className="mt-1 divide-y rounded-md border text-sm">
                {proto.goals.map((g) => (
                  <li key={g.externalId} className="flex items-center gap-2 p-2">
                    <span className={g.team === side ? "font-semibold" : "text-muted-foreground"}>{g.team === side ? "Gjort" : "Insläppt"}</span>
                    <span className="text-muted-foreground">P{g.period} {g.time}</span>
                    <span className="flex-1">{g.scorer?.name}{g.assist && <span className="text-muted-foreground"> (ass. {g.assist.name})</span>}</span>
                    {g.situation !== "full_strength" && <span className="rounded border px-1.5 text-xs font-bold">{SITUATION_LABEL[g.situation]}</span>}
                  </li>
                ))}
              </ul>
            </div>

            {proto.penalties.length > 0 && (
              <div>
                <h4 className="text-xl">Utvisningar</h4>
                <ul className="mt-1 divide-y rounded-md border text-sm">
                  {proto.penalties.map((x) => (
                    <li key={x.externalId} className="flex gap-2 p-2">
                      <span className="text-muted-foreground">P{x.period} {x.time}</span>
                      <span className="flex-1">{x.name} ({x.team === side ? "vi" : "mot."})</span>
                      <span>{x.minutes} min · {x.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Redan importerade mål och utvisningar hoppas över. Plus/minus (vilka som var på plan) fyller ni i själva efteråt.</p>
            <Button onClick={importAll} disabled={loading} className="w-full">{loading ? "Importerar…" : "Importera matchdata"}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
