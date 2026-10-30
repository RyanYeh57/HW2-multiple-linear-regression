// Build data/flood.csv from Kaggle playground-series-s4e5 train.csv:
// pick 50,000 random rows (seed 42) and drop the id column.
// Usage: node scripts/sample-flood.js [data/raw/train.csv] [data/flood.csv]
import { readFileSync, writeFileSync } from 'node:fs';
import { splitIndices } from '../js/prep.js';

const SAMPLE_SIZE = 50000;
const [input = 'data/raw/train.csv', output = 'data/flood.csv'] = process.argv.slice(2);

const lines = readFileSync(input, 'utf8').split(/\r?\n/).filter(line => line !== '');
const [header, ...rows] = lines;
const dropId = line => line.slice(line.indexOf(',') + 1);
if (!header.startsWith('id,')) throw new Error(`expected first column "id", got: ${header.slice(0, 40)}`);

const { test: picked } = splitIndices(rows.length, SAMPLE_SIZE / rows.length, 42);
writeFileSync(output, [header, ...picked.map(i => rows[i])].map(dropId).join('\n') + '\n');
console.log(`${input}: ${rows.length} rows -> ${output}: ${picked.length} rows`);
