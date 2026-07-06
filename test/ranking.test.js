const assert = require("node:assert/strict");
const test = require("node:test");

test("ranking formulas calculate expected win rate and Elo updates", async () => {
  const { expectedWinRate, updateElo } = await import("../src/ranking.js");

  assert.equal(expectedWinRate(1500, 1500), 0.5);
  assert.equal(updateElo(1500, 1500, 1, 32), 1516);
  assert.equal(updateElo(1500, 1500, 0, 32), 1484);
});

test("geometric mean combines benchmark dimensions", async () => {
  const { geometricMean } = await import("../src/ranking.js");

  assert.equal(geometricMean([1, 1, 1]), 1);
  assert.equal(Number(geometricMean([0.8, 0.8, 0.8]).toFixed(4)), 0.8);
  assert.equal(geometricMean([]), 0);
});

test("provider score averages top model scores", async () => {
  const { providerScore, rankProviders } = await import("../src/ranking.js");
  const strongProvider = {
    id: "strong",
    rank: 2,
    rankingModels: [
      { elo: 2200, benchmarks: [1, 1, 1] },
      { elo: 2000, benchmarks: [0.9, 0.9, 0.9] },
      { elo: 1800, benchmarks: [0.8, 0.8, 0.8] },
      { elo: 1000, benchmarks: [0.2, 0.2, 0.2] },
    ],
  };
  const weakProvider = {
    id: "weak",
    rank: 1,
    rankingModels: [{ elo: 1100, benchmarks: [0.3, 0.3, 0.3] }],
  };

  assert.ok(providerScore(strongProvider, { topK: 3 }) > providerScore(weakProvider));
  assert.deepEqual(
    rankProviders([weakProvider, strongProvider], { topK: 3 }).map((provider) => provider.id),
    ["strong", "weak"],
  );
});
