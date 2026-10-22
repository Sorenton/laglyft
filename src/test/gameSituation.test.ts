import { describe, expect, it } from "vitest";
import { classifyGoals, penaltyMinutes } from "@/lib/gameSituation";

describe("classifyGoals", () => {
  const pen = { team: "away" as const, period: 1, minute: 7, second: 17, minutes: 2 };

  it("mål av motståndaren under utvisning är powerplay", () => {
    expect(classifyGoals([{ team: "home", period: 1, minute: 7, second: 43 }], [pen])).toEqual(["powerplay"]);
  });

  it("mål av det utvisade laget är boxplay", () => {
    expect(classifyGoals([{ team: "away", period: 1, minute: 8, second: 0 }], [pen])).toEqual(["boxplay"]);
  });

  it("2-minutersutvisning upphör vid PP-mål", () => {
    const r = classifyGoals(
      [{ team: "home", period: 1, minute: 7, second: 43 }, { team: "home", period: 1, minute: 8, second: 57 }],
      [pen],
    );
    expect(r).toEqual(["powerplay", "full_strength"]);
  });

  it("mål efter att utvisningen gått ut är fulltaliga", () => {
    expect(classifyGoals([{ team: "home", period: 1, minute: 9, second: 18 }], [pen])).toEqual(["full_strength"]);
  });

  it("personliga 10 min ger inget powerplay", () => {
    expect(classifyGoals([{ team: "home", period: 1, minute: 8, second: 0 }], [{ ...pen, minutes: 10 }])).toEqual(["full_strength"]);
  });
});

describe("penaltyMinutes", () => {
  it("läser längd ur texten", () => {
    expect(penaltyMinutes("Slag, 2 min")).toBe(2);
    expect(penaltyMinutes("Matchstraff")).toBe(5);
  });
});
