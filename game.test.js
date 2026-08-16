import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  ISSUES,
  aiTurn,
  applyAction,
  createGame,
  finalVotes,
  pollFor,
  proposalEffect,
  resolveWeek,
} from "./game.js";

describe("里長選舉規則", () => {
  it("starts a four-week campaign with four action points", () => {
    const game = createGame({ seed: 42 });
    expect(game.week).toBe(1);
    expect(game.maxWeeks).toBe(4);
    expect(game.actionPoints).toBe(4);
    expect(game.candidates).toHaveLength(3);
    expect(game.neighborhoods).toHaveLength(6);
  });

  it("spends action points and rejects actions after they run out", () => {
    let game = createGame({ seed: 2 });
    for (let index = 0; index < 4; index += 1) {
      game = applyAction(game, { type: "visit", neighborhoodId: "market" });
    }
    expect(game.actionPoints).toBe(0);
    expect(() =>
      applyAction(game, { type: "visit", neighborhoodId: "market" }),
    ).toThrow(/行動點/);
  });

  it("rewards proposals that match neighborhood concerns", () => {
    const matching = proposalEffect(
      { issues: ["traffic", "security"] },
      "traffic",
      6,
      0,
    );
    const mismatch = proposalEffect(
      { issues: ["traffic", "security"] },
      "environment",
      6,
      0,
    );
    expect(matching.support).toBeGreaterThan(mismatch.support);
    expect(ISSUES.traffic).toBe("交通");
  });

  it("keeps trust within zero and ten", () => {
    let game = createGame({ seed: 3 });
    game.candidates[0].trust = 10;
    game = applyAction(game, {
      type: "petition",
      neighborhoodId: "station",
    });
    expect(game.candidates[0].trust).toBeLessThanOrEqual(10);

    game.candidates[0].trust = 0;
    game.pendingEvent = { type: "controversy", severity: 3 };
    game = applyAction(game, { type: "clarify", neighborhoodId: "station" });
    expect(game.candidates[0].trust).toBeGreaterThanOrEqual(0);
  });

  it("uses seeded poll error and reports ranges rather than exact support", () => {
    const game = createGame({ seed: 55 });
    const first = pollFor(game, "market");
    const same = pollFor(game, "market");
    const other = pollFor(createGame({ seed: 56 }), "market");
    expect(first).toEqual(same);
    expect(first.candidates[0]).toHaveProperty("low");
    expect(first.candidates[0]).toHaveProperty("high");
    expect(first.candidates[0]).not.toHaveProperty("votes");
    expect(first).not.toEqual(other);
  });

  it("only lets AI choose legal actions and resources", () => {
    const game = createGame({ seed: 77 });
    for (const ai of game.candidates.slice(1)) {
      const result = aiTurn(game, ai.id);
      expect(result.actions).toHaveLength(4);
      expect(result.actions.every((action) => ACTIONS[action.type])).toBe(true);
      expect(result.candidate.budget).toBeGreaterThanOrEqual(0);
      expect(result.candidate.volunteers).toBeGreaterThanOrEqual(0);
      expect(result.candidate.trust).toBeGreaterThanOrEqual(0);
      expect(result.candidate.trust).toBeLessThanOrEqual(10);
    }
  });

  it("penalizes repeated overpromising with credibility risk", () => {
    let game = createGame({ seed: 9 });
    for (let index = 0; index < 3; index += 1) {
      game = applyAction(game, {
        type: "proposal",
        neighborhoodId: "riverside",
        issue: "eldercare",
      });
    }
    expect(game.candidates[0].trust).toBeLessThan(6);
    expect(game.candidates[0].promises).toBe(3);
  });

  it("advances four weeks and unlocks get-out-the-vote only in final week", () => {
    let game = createGame({ seed: 12 });
    expect(() =>
      applyAction(game, { type: "gotv", neighborhoodId: "oldtown" }),
    ).toThrow(/最後一週/);

    for (let week = 1; week < 4; week += 1) {
      game = resolveWeek(game);
    }
    expect(game.week).toBe(4);
    expect(game.actionPoints).toBe(4);

    game.candidates[0].trust = 0;
    const before = game.neighborhoods.find((n) => n.id === "oldtown").support.player;
    game = applyAction(game, { type: "gotv", neighborhoodId: "oldtown" });
    const after = game.neighborhoods.find((n) => n.id === "oldtown").support.player;
    expect(after - before).toBeLessThanOrEqual(1);
  });

  it("counts every ballot and resolves exact ties as shared places", () => {
    const game = createGame({ seed: 21 });
    for (const neighborhood of game.neighborhoods) {
      neighborhood.population = 90;
      neighborhood.support = { player: 10, "ai-care": 10, "ai-build": 10 };
      neighborhood.turnout = { player: 0, "ai-care": 0, "ai-build": 0 };
    }
    const result = finalVotes(game);
    expect(result.totalVotes).toBe(540);
    expect(result.ranking[0].votes).toBe(180);
    expect(result.ranking.every((entry) => entry.place === 1)).toBe(true);
    expect(result.winners).toHaveLength(3);
  });
});
