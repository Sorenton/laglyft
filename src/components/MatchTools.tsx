import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SITUATION_LABEL, type GameSituation } from "@/lib/gameSituation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type P = { id: string; name: string; number: number | null };
type Line = { id: string; name: string; player_ids: string[] };
type Goal = {
  id: string; for_us: boolean; scorer_id: string | null; assist_id: string | null;
  period: number | null; game_time: string | null; game_situation: string;
  goal_on_court: { player_id: string }[];
};
const select = "h-9 rounded-md border border-input bg-background px-3 text-sm";

function PlayerToggles({ roster, selected, onToggle }: { roster: P[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {roster.map((p) => (
        <Button key={p.id} type="button" size="sm" variant={selected.includes(p.id) ? "default" : "outline"} onClick={() => onToggle(p.id)}>
          {p.number ?? ""} {p.name}
        </Button>
      ))}
    </div>
  );
}

export function GoalEditor({ goal, roster, lines, onDone }: { goal: Goal; roster: P[]; lines: Line[]; onDone: () => void }) {
  const [scorer, setScorer] = useState(goal.scorer_id ?? "");
  const [assist, setAssist] = useState(goal.assist_id ?? "");
  const [period, setPeriod] = useState(String(goal.period ?? 1));
  const [time, setTime] = useState(goal.game_time ?? "");
  const [situation, setSituation] = useState(goal.game_situation as GameSituation);
  const [court, setCourt] = useState<string[]>(goal.goal_on_court.map((x) => x.player_id));
  const [saving, setSaving] = useState(false);
  const toggle = (id: string) => setCourt((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function save() {
    setSaving(true);
    const set = new Set(court);
    if (goal.for_us && scorer) set.add(scorer);
    if (goal.for_us && assist) set.add(assist);
    const { error } = await supabase.from("goals").update({
      scorer_id: goal.for_us && scorer ? scorer : null,
      assist_id: goal.for_us && assist ? assist : null,
      period: Number(period), game_time: time || null, game_situation: situation,
    }).eq("id", goal.id);
    const { error: e2 } = await supabase.from("goal_on_court").delete().eq("goal_id", goal.id);
    const { error: e3 } = set.size
      ? await supabase.from("goal_on_court").insert([...set].map((player_id) => ({ goal_id: goal.id, player_id })))
      : { error: null };
    setSaving(false);
    if (error || e2 || e3) { toast.error("Kunde inte spara ändringen"); return; }
    toast.success("Målet uppdaterat");
    onDone();
  }

  return (
    <div className="w-full space-y-3 rounded-md border bg-background p-4">
      <div className="flex flex-wrap gap-3">
        {goal.for_us && (
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
        <select className={select} value={situation} onChange={(e) => setSituation(e.target.value as GameSituation)} aria-label="Spelform">
          {(Object.keys(SITUATION_LABEL) as GameSituation[]).map((k) => <option key={k} value={k}>{SITUATION_LABEL[k]}</option>)}
        </select>
        <Input className="w-28" placeholder="Tid 12:34" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        På plan ({court.length}) – {goal.for_us ? "får +1" : "får −1"}
      </div>
      {lines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lines.map((l) => (
            <Button key={l.id} type="button" size="sm" variant="secondary" onClick={() => setCourt(l.player_ids)}>Välj {l.name}</Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setCourt([])}>Rensa</Button>
        </div>
      )}
      <PlayerToggles roster={roster} selected={court} onToggle={toggle} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>Spara</Button>
        <Button variant="ghost" onClick={onDone}>Avbryt</Button>
      </div>
    </div>
  );
}

export function LinesSection({ eventId, roster, lines, onChange }: { eventId: string; roster: P[]; lines: Line[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const nameOf = (id: string) => roster.find((p) => p.id === id);

  async function add() {
    const { error } = await supabase.from("match_lines").insert({ event_id: eventId, name: `Femma ${lines.length + 1}`, sort: lines.length });
    if (error) toast.error("Kunde inte skapa femma"); else onChange();
  }
  async function save(id: string) {
    const { error } = await supabase.from("match_lines").update({ player_ids: picked }).eq("id", id);
    if (error) { toast.error("Kunde inte spara femma"); return; }
    setEditing(null); onChange();
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-3xl">Femmor</h3>
        <Button size="sm" variant="outline" onClick={add}>+ Ny femma</Button>
      </div>
      <div className="mt-4 divide-y rounded-md border bg-card">
        {lines.map((l) => (
          <div key={l.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-24 font-semibold">{l.name}</span>
              <span className="flex-1 text-sm">
                {l.player_ids.map((id) => { const p = nameOf(id); return p ? `${p.number ?? ""} ${p.name}` : null; }).filter(Boolean).join(", ") || <span className="text-muted-foreground">Inga spelare</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(l.id); setPicked(l.player_ids); }}>Ändra</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("match_lines").delete().eq("id", l.id); onChange(); }}>Ta bort</Button>
            </div>
            {editing === l.id && (
              <div className="space-y-3">
                <PlayerToggles roster={roster} selected={picked} onToggle={(id) => setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => save(l.id)}>Spara ({picked.length})</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Avbryt</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {lines.length === 0 && <p className="p-4 text-sm text-muted-foreground">Inga femmor ännu. Skapa en för att snabbt välja vilka som var på plan vid mål.</p>}
      </div>
    </section>
  );
}

type StatRow = { player_id: string; shots: number; shots_blocked: number; blocks: number; saves: number };
type StatKey = "shots" | "shots_blocked" | "blocks" | "saves";
const STAT_COLS: { k: StatKey; l: string }[] = [
  { k: "shots", l: "Skott" },
  { k: "shots_blocked", l: "Skott i täck" },
  { k: "blocks", l: "Täckta skott" },
  { k: "saves", l: "Räddningar" },
];

export function MatchCoach({ eventId, roster, stats, onChange }: { eventId: string; roster: P[]; stats: StatRow[]; onChange: () => void }) {
  const [local, setLocal] = useState<Record<string, StatRow>>(() => Object.fromEntries(stats.map((s) => [s.player_id, s])));
  const get = (pid: string): StatRow => local[pid] ?? { player_id: pid, shots: 0, shots_blocked: 0, blocks: 0, saves: 0 };

  async function bump(pid: string, k: StatKey, d: number) {
    const cur = get(pid);
    const next = { ...cur, [k]: Math.max(0, cur[k] + d) };
    setLocal((l) => ({ ...l, [pid]: next }));
    const { error } = await supabase.from("player_match_stats").upsert({ event_id: eventId, ...next });
    if (error) { toast.error("Kunde inte spara"); setLocal((l) => ({ ...l, [pid]: cur })); return; }
    onChange();
  }

  return (
    <section>
      <h3 className="text-3xl">Matchcoach</h3>
      <p className="text-sm text-muted-foreground">Fyll i per spelare under matchen – sparas direkt.</p>
      <div className="mt-4 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-widest text-muted-foreground">
            <tr><th className="p-3">Spelare</th>{STAT_COLS.map((c) => <th key={c.k} className="p-3 text-center">{c.l}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {roster.map((p) => {
              const s = get(p.id);
              return (
                <tr key={p.id}>
                  <td className="p-3 font-medium">{p.number ?? ""} {p.name}</td>
                  {STAT_COLS.map((c) => (
                    <td key={c.k} className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" aria-label={`Minska ${c.l}`} onClick={() => bump(p.id, c.k, -1)}>−</Button>
                        <span className={cn("stat-num w-8 text-center text-xl")}>{s[c.k]}</span>
                        <Button size="sm" variant="outline" aria-label={`Öka ${c.l} för ${p.name}`}
                          onClick={async () => { await bump(p.id, c.k, 1); }}>+</Button>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
