import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backwardElimination,
  forwardSelection,
  selectKBest,
  rfeSelection,
  lassoSelection,
  selectionAlgorithms,
} from '../js/select.js';

// Deterministic pseudo-noise in [-0.5, 0.5).
function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648 - 0.5;
  };
}

function makeSyntheticPrep() {
  const r = noise(7);
  const make = n => {
    const X = Array.from({ length: n }, () => [r() * 10, r(), r()]);
    const y = X.map(([x1]) => 3 * x1 + 0.1 * r());
    return { X, y };
  };
  const train = make(160);
  const test = make(40);
  return { Xtrain: train.X, ytrain: train.y, Xtest: test.X, ytest: test.y, featureNames: ['x1', 'x2', 'x3'] };
}

test('eliminates noise features and keeps the signal', () => {
  const r = backwardElimination(makeSyntheticPrep());
  assert.equal(r.steps.length, 3);
  assert.deepEqual(r.steps[0].names, ['x1', 'x2', 'x3']);
  assert.deepEqual(r.steps[r.defaultIndex].names, ['x1']);
  assert.ok(r.steps[r.defaultIndex].maxP < 0.05);
});

test('each step records train adjusted R² and test R²', () => {
  const r = backwardElimination(makeSyntheticPrep());
  for (const s of r.steps) {
    // x1 is never removed, so every step explains almost all variance
    assert.ok(s.trainAdjR2 > 0.99);
    assert.ok(Number.isFinite(s.testR2));
    assert.equal(s.features.length, s.names.length);
  }
});

test('all selection algorithms return one step per feature', () => {
  const prep = makeSyntheticPrep();
  for (const [key, select] of Object.entries(selectionAlgorithms)) {
    const result = select(prep);
    assert.equal(result.steps.length, prep.featureNames.length, key);
    assert.deepEqual(result.steps.map(s => s.features.length), [3, 2, 1], key);
    assert.ok(result.steps.every(s => s.names.length > 0 && s.maxP >= 0), key);
    assert.ok(result.defaultIndex >= 0 && result.defaultIndex < result.steps.length, key);
  }
});

test('selection algorithms do not use test targets to choose features', () => {
  const prep = makeSyntheticPrep();
  const changed = { ...prep, ytest: prep.ytest.map((_, i) => i * 1000) };
  for (const [key, select] of Object.entries(selectionAlgorithms)) {
    const a = select(prep);
    const b = select(changed);
    assert.deepEqual(a.steps.map(s => s.features), b.steps.map(s => s.features), key);
    assert.equal(a.defaultIndex, b.defaultIndex, key);
  }
});

test('new selection algorithms rank the signal feature first', () => {
  const prep = makeSyntheticPrep();
  const forward = forwardSelection(prep);
  const kbest = selectKBest(prep);
  const rfe = rfeSelection(prep);
  const lasso = lassoSelection(prep);
  assert.equal(forward.steps.at(-1).names[0], 'x1');
  assert.equal(kbest.steps.at(-1).names[0], 'x1');
  assert.equal(rfe.steps.at(-1).names[0], 'x1');
  assert.equal(lasso.steps.at(-1).names[0], 'x1');
});

test('lasso selection ranks by standardized effect, not raw coefficient size', () => {
  const r = noise(11);
  const make = n => {
    // x1 has a tiny raw coefficient on a wide scale; x2 is a 0/1 dummy with a large raw coefficient.
    const X = Array.from({ length: n }, (_, i) => [r() * 1000, i % 2, r()]);
    const y = X.map(([x1, x2]) => 0.01 * x1 + 1 * x2 + 0.1 * r());
    return { X, y };
  };
  const train = make(160);
  const test = make(40);
  const prep = { Xtrain: train.X, ytrain: train.y, Xtest: test.X, ytest: test.y, featureNames: ['x1', 'x2', 'x3'] };
  assert.equal(lassoSelection(prep).steps.at(-1).names[0], 'x1');
});
