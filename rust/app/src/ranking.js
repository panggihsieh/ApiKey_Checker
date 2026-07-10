const defaultTopK = 3;
const defaultEloMin = 1000;
const defaultEloMax = 2200;
const modelScoreWeights = {
  elo: 0.6,
  benchmark: 0.4,
};

export function expectedWinRate(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function updateElo(ratingA, ratingB, actualScore, k = 32) {
  return ratingA + k * (actualScore - expectedWinRate(ratingA, ratingB));
}

export function geometricMean(values) {
  const normalized = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (normalized.length === 0) {
    return 0;
  }

  return normalized.reduce((product, value) => product * value, 1) ** (1 / normalized.length);
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeElo(elo, min = defaultEloMin, max = defaultEloMax) {
  if (!Number.isFinite(elo) || max <= min) {
    return 0;
  }

  return clamp((elo - min) / (max - min));
}

export function modelScore(model, options = {}) {
  const eloNormalized = normalizeElo(
    Number(model.elo),
    options.eloMin ?? defaultEloMin,
    options.eloMax ?? defaultEloMax,
  );
  const benchmarkGeom = clamp(geometricMean(model.benchmarks || []));

  return modelScoreWeights.elo * eloNormalized + modelScoreWeights.benchmark * benchmarkGeom;
}

function fallbackModelsForProvider(provider, providerCount) {
  const rank = Number(provider.rank) || providerCount;
  const denominator = Math.max(1, providerCount - 1);
  const rankStrength = 1 - (rank - 1) / denominator;
  const benchmark = clamp(0.45 + rankStrength * 0.5);

  return [
    {
      id: `${provider.id}-rank-fallback`,
      elo: defaultEloMin + rankStrength * (defaultEloMax - defaultEloMin),
      benchmarks: [benchmark, Math.max(0.01, benchmark - 0.03), Math.min(1, benchmark + 0.02)],
    },
  ];
}

export function providerScore(provider, options = {}) {
  const models =
    Array.isArray(provider.rankingModels) && provider.rankingModels.length > 0
      ? provider.rankingModels
      : fallbackModelsForProvider(provider, options.providerCount || 1);

  const scores = models
    .map((model) => modelScore(model, options))
    .filter((score) => Number.isFinite(score))
    .sort((a, b) => b - a);

  if (scores.length === 0) {
    return 0;
  }

  const topK = scores.slice(0, options.topK || defaultTopK);
  return topK.reduce((sum, score) => sum + score, 0) / topK.length;
}

export function rankProviders(providers, options = {}) {
  const providerCount = providers.length;

  return providers
    .map((provider) => ({
      ...provider,
      providerScore: providerScore(provider, { ...options, providerCount }),
    }))
    .sort((a, b) => {
      if (b.providerScore !== a.providerScore) {
        return b.providerScore - a.providerScore;
      }

      return (a.rank || Number.MAX_SAFE_INTEGER) - (b.rank || Number.MAX_SAFE_INTEGER);
    });
}
