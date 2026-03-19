// Centralized scoring logic for all tasks.
// Keep formulas simple and editable for future calibration.

export const SCORE_MAX = 10;

export function clampScore(value) {
  return Math.max(0, Math.min(SCORE_MAX, Math.round(value)));
}

function normalizeDistance(actual, target, tolerance) {
  return Math.max(0, 1 - Math.abs(actual - target) / tolerance);
}

export function scoreImageGeneration(values) {
  const blankBlack = values.brightness <= 6;
  const blankWhite = values.brightness >= 194 && values.contrast <= 16;
  if (blankBlack || blankWhite) {
    return 0;
  }

  const target = {
    hue: 8,
    saturation: 112,
    brightness: 102,
    contrast: 110,
    texture: 58,
  };

  const hue = normalizeDistance(values.hue, target.hue, 45);
  const sat = normalizeDistance(values.saturation, target.saturation, 95);
  const bright = normalizeDistance(values.brightness, target.brightness, 70);
  const contrast = normalizeDistance(values.contrast, target.contrast, 70);
  const texture = normalizeDistance(values.texture, target.texture, 80);

  const weighted = hue * 0.2 + sat * 0.25 + bright * 0.2 + contrast * 0.2 + texture * 0.15;
  return clampScore(weighted * 10);
}

export function scoreImageGenerationAuditory(volume, clarity) {
  return clampScore((Number(volume || 0) + Number(clarity || 0)) / 2);
}

export function scoreImageGenerationSmell(intensity) {
  return clampScore(intensity);
}

export function scoreImageGenerationTouch(value) {
  return clampScore(value);
}

export function scoreImageGenerationEmotion(intensity) {
  return clampScore(intensity);
}

export function scoreImageGenerationTotal(parts) {
  const totals = [
    Number(parts?.visualisation?.total || 0),
    Number(parts?.auditory?.total || 0),
    Number(parts?.smell?.total || 0),
    Number(parts?.touch?.total || 0),
    Number(parts?.emotion?.total || 0),
  ];

  const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
  return clampScore(average);
}

export function scoreManipulation(trials) {
  if (!trials.length) return 0;

  const hasExplicitTrialScores = trials.some((trial) => typeof trial.trialScore === 'number');
  if (hasExplicitTrialScores) {
    const average =
      trials.reduce((sum, trial) => {
        if (typeof trial.trialScore === 'number') {
          return sum + Math.max(0, Math.min(10, Number(trial.trialScore)));
        }
        return sum + (trial.correct ? 10 : 0);
      }, 0) / trials.length;
    return clampScore(average);
  }

  const correctTrials = trials.filter((trial) => trial.correct);
  const accuracy = correctTrials.length / trials.length;

  // Speed bonus rewards quick and correct responding.
  const avgCorrectRt =
    correctTrials.reduce((sum, trial) => sum + trial.reactionTime, 0) / Math.max(correctTrials.length, 1);

  const speedBonus = Math.max(0, Math.min(1, (8500 - avgCorrectRt) / 5500));
  const weighted = accuracy * 0.78 + speedBonus * 0.22;
  return clampScore(weighted * 10);
}

export function scoreAutobiographical(data) {
  const animals = Array.isArray(data?.animals) ? data.animals.filter(Boolean) : [];
  const totalAnimals = Math.max(0, Number(data?.totalAnimals ?? animals.length));
  const clarityScores = Array.isArray(data?.clarityScores)
    ? data.clarityScores
        .slice(0, totalAnimals)
        .map((value) => Math.max(1, Math.min(10, Number(value || 0))))
    : [];
  const averageClarity = clarityScores.length
    ? clarityScores.reduce((sum, value) => sum + value, 0) / clarityScores.length
    : Math.max(0, Math.min(10, Number(data?.averageClarity || 0)));
  const continuityType = data?.continuityType === 'fragmented' ? 'fragmented' : 'continuous';

  const fluencyScaled = clampScore(Math.min(10, totalAnimals / 1.2));
  const vividness = Math.max(0, Math.min(10, averageClarity));
  const continuityBonus = continuityType === 'continuous' ? 1 : 0;
  const weighted = fluencyScaled * 0.45 + vividness * 0.45 + continuityBonus * 0.1;

  return {
    score: clampScore(weighted),
    details: {
      totalAnimals,
      clarityScores,
      averageClarity: Number(averageClarity.toFixed(1)),
      fluencyScaled,
      vividness: Number(vividness.toFixed(1)),
      continuityType,
      continuityBonus,
    },
  };
}

export function scoreIntegration(similarityValue) {
  return clampScore(similarityValue);
}

export function scoreExploration(similarityValue) {
  return scoreIntegration(similarityValue);
}

export function scoreAuditory(loudness, clarity) {
  return clampScore((loudness + clarity) / 2);
}

export function scoreGoal(goalSize, goalDistance) {
  return clampScore((goalSize + goalDistance) / 2);
}

export function scoreImprovise(data) {
  const stability = Math.max(1, Math.min(10, Number(data?.stabilityScore || 5)));
  const control = Math.max(1, Math.min(10, Number(data?.controlScore || 5)));
  const continuity = Math.max(1, Math.min(10, Number(data?.continuityScore || 5)));
  const base = (stability + control + continuity) / 3;
  const anchorBoost = data?.anchorType === 'Nothing stayed stable' ? -0.5 : 0.5;
  return clampScore(base + anchorBoost);
}

export function scoreNavigate(metrics) {
  const meanError = Number(metrics?.meanError);
  if (Number.isFinite(meanError)) {
    const value = Math.max(0, meanError);
    if (value <= 10) return 10;
    if (value <= 20) return clampScore(10 - ((value - 10) / 10));
    if (value <= 40) return clampScore(9 - ((value - 20) / 10));
    if (value <= 60) return clampScore(7 - ((value - 40) / 10));

    const tail = Math.max(0, 5 - ((value - 60) / 80) * 5);
    return clampScore(tail);
  }

  // Backward compatibility for older persisted navigation payloads.
  const landmark = Math.max(0, Math.min(10, Number(metrics?.landmarkAccuracy || 0)));
  const endpoint = Math.max(0, Math.min(10, Number(metrics?.endpointAccuracy || 0)));
  const deviation = Math.max(0, Math.min(10, Number(metrics?.pathDeviation || 0)));
  const lengthMatch = Math.max(0, Math.min(10, Number(metrics?.pathLengthMatch || 0)));
  const weighted = landmark * 0.35 + deviation * 0.25 + endpoint * 0.3 + lengthMatch * 0.1;
  return clampScore(weighted);
}

export function getInterpretation(totalScore) {
  if (totalScore <= 19) return 'Emerging Imagery';
  if (totalScore <= 34) return 'Developing Imagery';
  if (totalScore <= 44) return 'Strong Imagery';
  return 'Exceptional Imagery';
}
