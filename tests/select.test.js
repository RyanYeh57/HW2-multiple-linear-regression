import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backwardElimination } from '../js/select.js';

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
