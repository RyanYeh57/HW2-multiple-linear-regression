import { prepare } from './prep.js';
import { ols, predict, predictionInterval, metrics } from './stats.js';
import { backwardElimination, pickColumns } from './select.js';

export function analyze(table, target) {
  const prep = prepare(table, target);
  return { prep, selection: backwardElimination(prep) };
}

// Fit OLS on the step's features; test-set points carry 95% prediction intervals.
export function fitStep(prep, step) {
  const Xtrain = pickColumns(prep.Xtrain, step.features);
  const Xtest = pickColumns(prep.Xtest, step.features);
  const model = ols(Xtrain, prep.ytrain);

  const coefTable = ['(截距)', ...step.names].map((name, j) => ({
    name,
    coef: model.coef[j],
    se: model.se[j],
    p: model.p[j],
  }));

  const points = Xtest
    .map((x, i) => ({ actual: prep.ytest[i], ...predictionInterval(model, x) }))
    .sort((a, b) => a.fit - b.fit);

  return {
    model,
    metrics: metrics(prep.ytest, predict(model, Xtest), step.features.length),
    coefTable,
    points,
  };
}

export function sampleEvenly(arr, max = 500) {
  if (arr.length <= max) return arr;
  return Array.from({ length: max }, (_, i) => arr[Math.round((i * (arr.length - 1)) / (max - 1))]);
}
