import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../js/csv.js';
import { analyze, fitStep, sampleEvenly } from '../js/analyze.js';

const load = path => parseCsv(readFileSync(path, 'utf8'));

test('50 Startups end to end', () => {
  const { prep, selection } = analyze(load('data/50_Startups.csv'), 'Profit');
  assert.equal(prep.summary.trainRows, 40);
  assert.equal(prep.summary.testRows, 10);
  assert.deepEqual(prep.featureNames, ['R&D Spend', 'Administration', 'Marketing Spend', 'State_Florida', 'State_New York']);
  const f = fitStep(prep, selection.steps[0]);
  assert.ok(f.metrics.r2 > 0.8);
  assert.ok(f.points.every(p => p.lo < p.fit && p.fit < p.hi));
  assert.equal(f.coefTable[0].name, '(截距)');
  assert.equal(f.coefTable.length, 6);
});

test('points are sorted by fitted value', () => {
  const { prep, selection } = analyze(load('data/50_Startups.csv'), 'Profit');
  const { points } = fitStep(prep, selection.steps[selection.defaultIndex]);
  assert.ok(points.every((p, i) => i === 0 || points[i - 1].fit <= p.fit));
});

test('Flood end to end under 5s', () => {
  const t0 = Date.now();
  const { prep, selection } = analyze(load('data/flood.csv'), 'FloodProbability');
  assert.equal(prep.featureNames.length, 20);
  assert.equal(prep.summary.trainRows, 40000);
  assert.ok(fitStep(prep, selection.steps[selection.defaultIndex]).metrics.r2 > 0.5);
  assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0}ms`);
});

// The site must show a visible prediction band, so Flood cannot be a noiseless formula.
test('Flood data has noise: R² below 0.99 and intervals wider than 0.01', () => {
  const { prep, selection } = analyze(load('data/flood.csv'), 'FloodProbability');
  const { metrics, points } = fitStep(prep, selection.steps[selection.defaultIndex]);
  assert.ok(metrics.r2 < 0.99, `r2 = ${metrics.r2}`);
  assert.ok(points[0].hi - points[0].lo > 0.01, `width = ${points[0].hi - points[0].lo}`);
  assert.ok(!prep.featureNames.includes('id'));
});

test('Flood fitStep is fast enough for slider dragging (< 150ms)', () => {
  const { prep, selection } = analyze(load('data/flood.csv'), 'FloodProbability');
  const step = selection.steps[selection.defaultIndex];
  fitStep(prep, step); // warm up
  const t0 = performance.now();
  fitStep(prep, step);
  const ms = performance.now() - t0;
  assert.ok(ms < 150, `took ${ms.toFixed(0)}ms`);
});

test('sampleEvenly keeps ends and caps length', () => {
  const s = sampleEvenly([...Array(10000).keys()]);
  assert.equal(s.length, 500);
  assert.equal(s[0], 0);
  assert.equal(s.at(-1), 9999);
  assert.deepEqual(sampleEvenly([1, 2, 3]), [1, 2, 3]);
});
