import { describe, it, expect } from "vitest";
import { computePlayerStats, attendanceRate, attendanceSummary } from "@/lib/stats";

describe("plus/minus", () => {
  it("gives +1 to everyone on court when we score", () => {
    const s = computePlayerStats([{ id: "g", for_us: true, scorer_id: "a", assist_id: "b", on_court: ["a", "b", "c"] }]);
    expect(s["c"]!.plusMinus).toBe(1);
    expect(s["a"]!.goals).toBe(1);
    expect(s["b"]!.assists).toBe(1);
  });
  it("gives -1 to everyone on court when we concede, no goal credit", () => {
    const s = computePlayerStats([{ id: "g", for_us: false, scorer_id: null, assist_id: null, on_court: ["a", "c"] }]);
    expect(s["a"]!.plusMinus).toBe(-1);
    expect(s["a"]!.goals).toBe(0);
  });
});

describe("attendance", () => {
  it("is share of present", () => {
    expect(attendanceRate(["present", "absent", "present", "sick"])).toBe(50);
  });
});

describe("attendanceRate not_called", () => {
  it("ignores Ej kallad", () => {
    expect(attendanceRate(["present", "absent", "not_called", "not_called"])).toBe(50);
  });
});

describe("attendanceSummary", () => {
  const s = attendanceSummary([
    { kind: "training", status: "present" },
    { kind: "training", status: "absent" },
    { kind: "training", status: "not_called" },
    { kind: "match", status: "present" },
    { kind: "match", status: "not_called" },
  ]);
  it("counts trainings present/called, excluding Ej kallad", () => {
    expect(s.trainings).toEqual({ present: 1, called: 2 });
  });
  it("counts matches present/called, excluding Ej kallad", () => {
    expect(s.matches).toEqual({ present: 1, called: 1 });
  });
  it("rate only over called events", () => {
    expect(s.rate).toBe(67);
  });
});

import { teammateCounts } from "@/lib/stats";
describe("teammateCounts", () => {
  it("counts shared on-court goals, excluding the player", () => {
    const g = (on: string[]) => ({ id: "x", for_us: true, scorer_id: null, assist_id: null, on_court: on });
    const c = teammateCounts("a", [g(["a", "b"]), g(["a", "b", "c"]), g(["b", "c"])]);
    expect(c).toEqual({ b: 2, c: 1 });
  });
});
