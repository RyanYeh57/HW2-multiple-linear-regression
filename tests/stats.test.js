import { test } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './helpers.js';
import { AnalysisError } from '../js/errors.js';
import { tCdf, tQuantile, ols, predict, predictionInterval, metrics } from '../js/stats.js';

test('tQuantile known values', () => {
  close(tQuantile(0.975, 3), 3.182446, 1e-4);
  close(tQuantile(0.975, 10), 2.228139, 1e-4);
  close(tQuantile(0.975, 1000), 1.962339, 1e-4);
});

test('tCdf known value', () => close(tCdf(2.0, 10), 0.963306, 1e-5));

const X1 = [[1], [2], [3], [4], [5]];
const Y1 = [2, 4, 5, 4, 5];

test('ols simple regression', () => {
  const m = ols(X1, Y1);
  close(m.coef[0], 2.2, 1e-9);
  close(m.coef[1], 0.6, 1e-9);
  close(m.sigma2, 0.8, 1e-9);
  close(m.se[1], 0.282843, 1e-5);
  close(m.p[1], 0.1240, 1e-3);
  assert.equal(m.df, 3);
});

test('ols recovers exact multivariate coefficients', () => {
  const X = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 5]];
  const y = X.map(([a, b]) => 1 + 2 * a + 3 * b);
  ols(X, y).coef.forEach((c, i) => close(c, [1, 2, 3][i], 1e-8));
});

test('predict applies intercept and coefficients', () => {
  const m = ols(X1, Y1);
  predict(m, [[0], [10]]).forEach((v, i) => close(v, [2.2, 8.2][i], 1e-9));
});

test('predictionInterval at x mean', () => {
  const r = predictionInterval(ols(X1, Y1), [3]);
  close(r.fit, 4.0, 1e-9);
  close(r.lo, 0.8819, 1e-3);
  close(r.hi, 7.1181, 1e-3);
});

test('metrics', () => {
  const r = metrics([1, 2, 3, 4], [1, 2, 3, 5], 1);
  close(r.mae, 0.25, 1e-12);
  close(r.rmse, 0.5, 1e-12);
  close(r.r2, 0.8, 1e-12);
  close(r.adjR2, 0.7, 1e-12);
});

test('collinear columns throw AnalysisError', () => {
  assert.throws(() => ols([[1, 1], [2, 2], [3, 3], [4, 4]], [1, 2, 3, 5]), AnalysisError);
});
