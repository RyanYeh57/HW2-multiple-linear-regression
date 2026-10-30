import { ols, predict, metrics } from './stats.js';

const P_THRESHOLD = 0.05;

export const pickColumns = (X, cols) => X.map(row => cols.map(c => row[c]));

// Start with every feature; repeatedly drop the one with the largest training p-value.
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
