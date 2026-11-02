import { ols, lasso, predict, metrics } from './stats.js';

const P_THRESHOLD = 0.05;

export const pickColumns = (X, cols) => X.map(row => cols.map(c => row[c]));

// Start with every feature; repeatedly drop the one with the largest training p-value.
function buildSteps(prep, order) {
  const { Xtrain, ytrain, Xtest, ytest, featureNames } = prep;
  const steps = [];
  for (let size = order.length; size > 0; size--) {
    const features = order.slice(0, size);
    const trainX = pickColumns(Xtrain, features);
    const testX = pickColumns(Xtest, features);
    const model = ols(trainX, ytrain);
    const featureP = model.p.slice(1);
    const trainFit = metrics(ytrain, predict(model, trainX), features.length);
    const testFit = metrics(ytest, predict(model, testX), features.length);
    steps.push({
      features,
      names: features.map(i => featureNames[i]),
      trainAdjR2: trainFit.adjR2,
      testR2: testFit.r2,
      maxP: Math.max(...featureP),
    });
  }
  const firstSignificant = steps.findIndex(s => s.maxP < P_THRESHOLD);
  return { steps, defaultIndex: firstSignificant >= 0 ? firstSignificant : steps.length - 1 };
}

function rankDescending(values) {
  return values.map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .map(item => item.index);
}

export function backwardElimination(prep) {
  const { Xtrain, ytrain, Xtest, ytest, featureNames } = prep;
  let features = featureNames.map((_, i) => i);
  const steps = [];

  while (features.length > 0) {
    const model = ols(pickColumns(Xtrain, features), ytrain);
    const trainFit = metrics(ytrain, predict(model, pickColumns(Xtrain, features)), features.length);
    const testFit = metrics(ytest, predict(model, pickColumns(Xtest, features)), features.length);
    const featureP = model.p.slice(1);
    const worst = featureP.indexOf(Math.max(...featureP));

    steps.push({
      features,
      names: features.map(i => featureNames[i]),
      trainAdjR2: trainFit.adjR2,
      testR2: testFit.r2,
      maxP: featureP[worst],
    });
    features = features.filter((_, i) => i !== worst);
  }

  const firstSignificant = steps.findIndex(s => s.maxP < P_THRESHOLD);
  return { steps, defaultIndex: firstSignificant >= 0 ? firstSignificant : steps.length - 1 };
}

export function forwardSelection(prep) {
  const { Xtrain, ytrain, featureNames } = prep;
  const remaining = featureNames.map((_, i) => i);
  const order = [];
  while (remaining.length) {
    let best = remaining[0];
    let bestP = Infinity;
    for (const candidate of remaining) {
      const features = [...order, candidate];
      const model = ols(pickColumns(Xtrain, features), ytrain);
      const p = model.p.at(-1);
      if (p < bestP || (p === bestP && candidate < best)) {
        best = candidate;
        bestP = p;
      }
    }
    order.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return buildSteps(prep, order);
}

function correlations(X, y) {
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const yDev = Math.sqrt(y.reduce((sum, value) => sum + (value - yMean) ** 2, 0));
  return X[0].map((_, j) => {
    const xMean = X.reduce((sum, row) => sum + row[j], 0) / X.length;
    let numerator = 0, xSum = 0;
    for (let i = 0; i < X.length; i++) {
      const dx = X[i][j] - xMean;
      numerator += dx * (y[i] - yMean);
      xSum += dx * dx;
    }
    return Math.abs(numerator / (Math.sqrt(xSum) * yDev || 1));
  });
}

export function selectKBest(prep) {
  return buildSteps(prep, rankDescending(correlations(prep.Xtrain, prep.ytrain)));
}

export function rfeSelection(prep) {
  const remaining = prep.featureNames.map((_, i) => i);
  const removed = [];
  while (remaining.length) {
    const model = ols(pickColumns(prep.Xtrain, remaining), prep.ytrain);
    const t = model.t.slice(1).map(Math.abs);
    const worst = t.indexOf(Math.min(...t));
    removed.push(remaining[worst]);
    remaining.splice(worst, 1);
  }
  return buildSteps(prep, removed.reverse());
}

export function lassoSelection(prep) {
  const model = lasso(prep.Xtrain, prep.ytrain, 0.01);
  const order = rankDescending(model.standardized.map(Math.abs));
  return buildSteps(prep, order);
}

export const selectionAlgorithms = {
  backward: backwardElimination,
  forward: forwardSelection,
  kbest: selectKBest,
  rfe: rfeSelection,
  lasso: lassoSelection,
};
