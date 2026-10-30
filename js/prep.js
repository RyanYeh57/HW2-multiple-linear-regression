import { AnalysisError } from './errors.js';

const MAX_TEXT_CATEGORIES = 20;
const MAX_FEATURES = 100;
const MISSING_CATEGORY = '(missing)';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function splitIndices(n, testRatio = 0.2, seed = 42) {
  const rand = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTest = Math.round(n * testRatio);
  const byIndex = (a, b) => a - b;
  return { train: idx.slice(nTest).sort(byIndex), test: idx.slice(0, nTest).sort(byIndex) };
}

const isMissing = v => v === undefined || v.trim() === '';
const isNumeric = v => Number.isFinite(Number(v.trim()));

// Turns raw string cells into a numeric design matrix: one encoder per kept column.
function buildEncoders(headers, rows, targetIndex, trainIdx) {
  const encoders = [];
  const dropped = [];
  let missingCells = 0;

  headers.forEach((name, col) => {
    if (col === targetIndex) return;
    const values = rows.map(r => r[col]);
    const present = values.filter(v => !isMissing(v));
    missingCells += values.length - present.length;

    if (present.every(isNumeric)) {
      if (new Set(present.map(v => Number(v.trim()))).size <= 1) {
        dropped.push({ name, reason: '所有值都一樣' });
        return;
      }
      const trainValues = trainIdx.map(i => values[i]).filter(v => !isMissing(v)).map(Number);
      const source = trainValues.length ? trainValues : present.map(Number);
      const mean = source.reduce((a, b) => a + b, 0) / source.length;
      encoders.push({ names: [name], encode: v => [isMissing(v) ? mean : Number(v.trim())], col });
      return;
    }

    const categories = [...new Set(values.map(v => (isMissing(v) ? MISSING_CATEGORY : v.trim())))].sort();
    if (categories.length > MAX_TEXT_CATEGORIES) {
      dropped.push({ name, reason: '不同值太多（像 ID）' });
      return;
    }
    if (categories.length <= 1) {
      dropped.push({ name, reason: '所有值都一樣' });
      return;
    }
    const kept = categories.slice(1);
    encoders.push({
      names: kept.map(c => `${name}_${c}`),
      encode: v => {
        const c = isMissing(v) ? MISSING_CATEGORY : v.trim();
        return kept.map(k => (k === c ? 1 : 0));
      },
      col,
    });
  });

  return { encoders, dropped, missingCells };
}

export function prepare(table, target, opts = {}) {
  const { testRatio = 0.2, seed = 42 } = opts;
  const targetIndex = table.headers.indexOf(target);
  if (targetIndex < 0) throw new AnalysisError(`找不到目標欄「${target}」`);

  const rows = table.rows.filter(r => !isMissing(r[targetIndex]));
  const droppedTargetRows = table.rows.length - rows.length;
  if (rows.length === 0) throw new AnalysisError(`目標欄「${target}」沒有任何數值`);
  if (!rows.every(r => isNumeric(r[targetIndex]))) {
    throw new AnalysisError(`目標欄「${target}」不是數字，請選擇數值欄位`);
  }

  const { train, test } = splitIndices(rows.length, testRatio, seed);
  const { encoders, dropped, missingCells } = buildEncoders(table.headers, rows, targetIndex, train);
  const featureNames = encoders.flatMap(e => e.names);

  if (featureNames.length === 0) throw new AnalysisError('沒有可用的特徵欄位');
  if (featureNames.length > MAX_FEATURES) {
    throw new AnalysisError(`編碼後有 ${featureNames.length} 個特徵，超過上限 ${MAX_FEATURES}`);
  }
  if (train.length <= featureNames.length + 1) {
    throw new AnalysisError(`訓練資料只有 ${train.length} 筆，不夠估計 ${featureNames.length} 個特徵`);
  }

  const encodeRow = r => encoders.flatMap(e => e.encode(r[e.col]));
  const yOf = r => Number(r[targetIndex].trim());

  return {
    Xtrain: train.map(i => encodeRow(rows[i])),
    ytrain: train.map(i => yOf(rows[i])),
    Xtest: test.map(i => encodeRow(rows[i])),
    ytest: test.map(i => yOf(rows[i])),
    featureNames,
    dropped,
    summary: {
      rows: rows.length,
      droppedTargetRows,
      missingCells,
      features: featureNames.length,
      trainRows: train.length,
      testRows: test.length,
    },
  };
}
