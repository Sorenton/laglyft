import { describe, it, expect } from "vitest";
import { computePlayerStats, attendanceRate } from "@/lib/stats";

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
