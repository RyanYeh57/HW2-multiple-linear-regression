import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionChart, predictionChart, residualChart, niceTicks } from '../js/charts.js';

const points = Array.from({ length: 20 }, (_, i) => ({ actual: i + (i % 3) - 1, fit: i, lo: i - 2, hi: i + 2 }));
const steps = [3, 2, 1].map((k, i) => ({ names: Array(k).fill('x'), trainAdjR2: 0.9 - i * 0.1, testR2: 0.85 - i * 0.1 }));

test('niceTicks covers the range with round steps', () => {
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(3, 97, 5), [0, 20, 40, 60, 80, 100]);
});

test('selectionChart draws train and test lines and the current marker', () => {
  const svg = selectionChart(steps, 1);
  assert.match(svg, /^<svg/);
  assert.equal((svg.match(/class="line-train"/g) || []).length, 1);
  assert.equal((svg.match(/class="line-test"/g) || []).length, 1);
  assert.match(svg, /class="marker"/);
});

test('predictionChart draws an interval band, a fit line and one dot per point', () => {
  const svg = predictionChart(points);
  assert.match(svg, /class="band"/);
  assert.match(svg, /class="line-fit"/);
  assert.equal((svg.match(/<circle/g) || []).length, 20);
});

test('predictionChart samples down to 500 dots', () => {
  const many = Array.from({ length: 3000 }, (_, i) => ({ actual: i, fit: i, lo: i - 1, hi: i + 1 }));
  assert.equal((predictionChart(many).match(/<circle/g) || []).length, 500);
});

test('residualChart draws a zero line and one dot per point', () => {
  const svg = residualChart(points);
  assert.match(svg, /class="zero"/);
  assert.equal((svg.match(/<circle/g) || []).length, 20);
});

test('charts survive a zero-width range', () => {
  const flat = [{ actual: 1, fit: 1, lo: 1, hi: 1 }, { actual: 1, fit: 1, lo: 1, hi: 1 }];
  assert.doesNotMatch(predictionChart(flat) + residualChart(flat), /NaN|Infinity/);
});

test('niceTicks terminates on a range of a few ULPs', () => {
  const ticks = niceTicks(1, 1 + 2 ** -52 * 3, 5);
  assert.ok(ticks.length >= 2 && ticks.length <= 20, `got ${ticks.length} ticks`);
});
