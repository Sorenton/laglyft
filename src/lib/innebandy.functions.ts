import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyGoals, penaltyMinutes, type GameSituation } from "./gameSituation";

const API = "https://api.innebandy.se";

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function apiSession() {
  const sk = await fetch(`${API}/v2/api/auth/startkit`);
  if (!sk.ok) throw new Error(`Förbundets tjänst svarar inte (${sk.status})`);
  const { accessToken } = (await sk.json()) as { accessToken: string };
  const hs = await fetch(`${API}/v2/api/auth/handshake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Length": "0" },
  });
  if (!hs.ok) throw new Error(`Kunde inte ansluta till förbundet (${hs.status})`);
  const { ss, st } = (await hs.json()) as { ss: string; st: number };
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(ss), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bodyHash = toHex(await crypto.subtle.digest("SHA-256", new Uint8Array()));
  return async function get<T>(path: string): Promise<T> {
    const ts = String(st);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const sig = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`GET\n${path}\n${ts}\n${nonce}\n${bodyHash}`)));
    const r = await fetch(API + path, {
      headers: { Authorization: `Bearer ${accessToken}`, "X-Signature": sig, "X-Timestamp": ts, "X-Nonce": nonce },
    });
    if (!r.ok) throw new Error(`Hämtning misslyckades (${r.status}): ${(await r.text()).slice(0, 200)}`);
    return (await r.json()) as T;
  };
}

type ApiEvent = {
  MatchEventID: number; MatchEventTypeID: number; MatchTeamID: number; Period: number; Minute: number; Second: number;
  PlayerShirtNo: number | null; PlayerName: string; PlayerAssistShirtNo: number | null; PlayerAssistName: string;
  PenaltyCode: string; PenaltyName: string;
};
type ApiMatch = {
  MatchID: number; MatchDateTime: string; HomeTeam: string; AwayTeam: string; HomeMatchTeamID: number; AwayMatchTeamID: number;
  GoalsHomeTeam: number; GoalsAwayTeam: number; Venue: string | null; Events: ApiEvent[];
};
type ApiPlayer = { Name: string; ShirtNo: number | null; Position: string | null };
type ApiLineups = { HomeTeamPlayers: ApiPlayer[]; AwayTeamPlayers: ApiPlayer[] };

export type ProtocolGoal = {
  externalId: number; team: "home" | "away"; period: number; time: string;
  scorer: { name: string; no: number | null } | null; assist: { name: string; no: number | null } | null;
  situation: GameSituation;
};
export type ProtocolPenalty = {
  externalId: number; team: "home" | "away"; period: number; time: string; name: string; no: number | null;
  minutes: number; code: string; reason: string;
};
export type Protocol = {
  matchId: number; date: string; venue: string | null; home: string; away: string; score: [number, number];
  homePlayers: ApiPlayer[]; awayPlayers: ApiPlayer[]; goals: ProtocolGoal[]; penalties: ProtocolPenalty[];
};

const mmss = (m: number, s: number) => `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

export const fetchProtocol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }): Promise<Protocol> => {
    const id = data.url.match(/match\/(\d+)/)?.[1] ?? data.url.match(/^\s*(\d+)\s*$/)?.[1];
    if (!id) throw new Error("Hittade inget match-ID i länken");
    const get = await apiSession();
    const [m, l] = await Promise.all([get<ApiMatch>(`/v2/api/public/matches/${id}`), get<ApiLineups>(`/v2/api/public/matches/${id}/lineups`)]);
    const side = (tid: number): "home" | "away" => (tid === m.HomeMatchTeamID ? "home" : "away");
    const goalEv = m.Events.filter((e) => e.MatchEventTypeID === 1);
    const penEv = m.Events.filter((e) => e.MatchEventTypeID === 2);
    const penalties: ProtocolPenalty[] = penEv.map((e) => ({
      externalId: e.MatchEventID, team: side(e.MatchTeamID), period: e.Period, time: mmss(e.Minute, e.Second),
      name: e.PlayerName, no: e.PlayerShirtNo || null, minutes: penaltyMinutes(e.PenaltyName), code: e.PenaltyCode,
      reason: e.PenaltyName.replace(/,?\s*\d+\s*(\+\s*\d+\s*)?min/i, "").trim() || e.PenaltyName,
    }));
    const situations = classifyGoals(
      goalEv.map((e) => ({ team: side(e.MatchTeamID), period: e.Period, minute: e.Minute, second: e.Second })),
      penEv.map((e, i) => ({ team: side(e.MatchTeamID), period: e.Period, minute: e.Minute, second: e.Second, minutes: penalties[i]!.minutes })),
    );
    const goals: ProtocolGoal[] = goalEv.map((e, i) => ({
      externalId: e.MatchEventID, team: side(e.MatchTeamID), period: e.Period, time: mmss(e.Minute, e.Second),
      scorer: e.PlayerName ? { name: e.PlayerName, no: e.PlayerShirtNo || null } : null,
      assist: e.PlayerAssistName ? { name: e.PlayerAssistName, no: e.PlayerAssistShirtNo || null } : null,
      situation: situations[i]!,
    }));
    return {
      matchId: m.MatchID, date: m.MatchDateTime, venue: m.Venue, home: m.HomeTeam, away: m.AwayTeam,
      score: [m.GoalsHomeTeam, m.GoalsAwayTeam], homePlayers: l.HomeTeamPlayers ?? [], awayPlayers: l.AwayTeamPlayers ?? [],
      goals, penalties,
    };
  });
