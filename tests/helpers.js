import assert from 'node:assert/strict';

export function close(actual, expected, tol) {
  assert.ok(Math.abs(actual - expected) < tol, `expected ${actual} to be within ${tol} of ${expected}`);
}
