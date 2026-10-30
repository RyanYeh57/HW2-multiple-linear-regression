import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/csv.js';

test('parses headers and rows', () => {
  const r = parseCsv('a,b\n1,2\n3,4\n');
  assert.deepEqual(r.headers, ['a', 'b']);
  assert.deepEqual(r.rows, [['1', '2'], ['3', '4']]);
});

test('strips BOM, CRLF, header whitespace', () => {
  const r = parseCsv('﻿ a ,b \r\n1,2\r\n');
  assert.deepEqual(r.headers, ['a', 'b']);
  assert.deepEqual(r.rows, [['1', '2']]);
});

test('handles quoted values with commas and escaped quotes', () => {
  const r = parseCsv('name,v\n"New York, NY",1\n"say ""hi""",2\n');
  assert.deepEqual(r.rows, [['New York, NY', '1'], ['say "hi"', '2']]);
});

test('detects semicolon delimiter', () => {
  assert.deepEqual(parseCsv('a;b\n1;2\n').rows, [['1', '2']]);
});

test('keeps empty fields, skips blank lines', () => {
  assert.deepEqual(parseCsv('a,b\n1,\n\n3,4\n').rows, [['1', ''], ['3', '4']]);
});
