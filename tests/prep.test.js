import { test } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './helpers.js';
import { AnalysisError } from '../js/errors.js';
import { splitIndices, prepare } from '../js/prep.js';
import { ols } from '../js/stats.js';

const rows = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

test('split is deterministic, disjoint, 40/10 for n=50', () => {
  const a = splitIndices(50);
  const b = splitIndices(50);
  assert.deepEqual(a, b);
  assert.equal(a.train.length, 40);
  assert.equal(a.test.length, 10);
  assert.equal(new Set([...a.train, ...a.test]).size, 50);
});

test('one-hot drops first sorted category', () => {
  const t = { headers: ['x', 'S', 'y'], rows: rows(30, i => [String(i), ['NY', 'CA', 'FL'][i % 3], String(i * 2)]) };
  assert.deepEqual(prepare(t, 'y').featureNames, ['x', 'S_FL', 'S_NY']);
});

test('drops ID-like text column (>20 unique) and constant column', () => {
  const t = { headers: ['id', 'c', 'x', 'y'], rows: rows(30, i => [`u${i}`, '7', String(i % 5), String(i)]) };
  const p = prepare(t, 'y');
  assert.deepEqual(p.featureNames, ['x']);
  assert.deepEqual(p.dropped.map(d => d.name).sort(), ['c', 'id']);
});

test('rows with missing target are removed', () => {
  const t = { headers: ['x', 'y'], rows: rows(30, i => [String(i), i < 5 ? '' : String(i)]) };
  const p = prepare(t, 'y');
  assert.equal(p.summary.droppedTargetRows, 5);
  assert.equal(p.summary.rows, 25);
});

test('missing numeric feature filled with train mean', () => {
  const t = { headers: ['x', 'z', 'y'], rows: rows(30, i => [i === 0 ? '' : String(i), String(i % 7), String(i * 3)]) };
  const p = prepare(t, 'y');
  // x equals the row index, so the expected fill is the mean of the non-missing train indices
  const { train, test: testIdx } = splitIndices(30);
  const order = [...train, ...testIdx];
  const filled = [...p.Xtrain, ...p.Xtest][order.indexOf(0)][0];
  const known = train.filter(i => i !== 0);
  close(filled, known.reduce((a, b) => a + b, 0) / known.length, 1e-9);
  assert.equal(p.summary.missingCells, 1);
});

test('non-numeric target throws', () => {
  assert.throws(() => prepare({ headers: ['x', 'y'], rows: [['1', 'a'], ['2', 'b']] }, 'y'), AnalysisError);
});

test('too few rows throws', () => {
  const t = { headers: ['a', 'b', 'c', 'y'], rows: rows(5, i => [String(i), String(i * i), String(i % 2), String(i)]) };
  assert.throws(() => prepare(t, 'y'), AnalysisError);
});

test('more than 100 encoded features throws', () => {
  const headers = [...Array.from({ length: 101 }, (_, j) => `f${j}`), 'y'];
  const t = { headers, rows: rows(300, i => headers.map((_, j) => String((i * 7 + j * 13) % 23))) };
  assert.throws(() => prepare(t, 'y'), AnalysisError);
});

test('category seen only in the test set is not a feature, and the fit still works', () => {
  const rare = splitIndices(60).test[0];
  const t = { headers: ['x', 'S', 'y'], rows: rows(60, i => [String(i), i === rare ? 'Z' : ['A', 'B'][i % 2], String(i * 2 + (i % 3))]) };
  const p = prepare(t, 'y');
  assert.deepEqual(p.featureNames, ['x', 'S_B']);
  assert.doesNotThrow(() => ols(p.Xtrain, p.ytrain));
});

test('numeric column constant in the training set is dropped', () => {
  const testIdx = new Set(splitIndices(60).test);
  const t = { headers: ['x', 'c', 'y'], rows: rows(60, i => [String(i), testIdx.has(i) ? String(i) : '5', String(i * 2 + (i % 3))]) };
  const p = prepare(t, 'y');
  assert.deepEqual(p.featureNames, ['x']);
  assert.deepEqual(p.dropped, [{ name: 'c', reason: '所有值都一樣' }]);
});

test('constant target throws', () => {
  const t = { headers: ['x', 'y'], rows: rows(30, i => [String(i), '1']) };
  assert.throws(() => prepare(t, 'y'), /所有值都一樣/);
});
