import { AnalysisError } from './errors.js';

// ---------- t distribution ----------

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

// Continued fraction for the incomplete beta function (modified Lentz).
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a, b).
function incbeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// Two-sided tail probability P(|T| > |t|), computed directly to avoid 1 - (1 - tiny).
function twoSidedP(t, df) {
  return incbeta(df / (df + t * t), df / 2, 0.5);
}

export function tCdf(t, df) {
  const tail = twoSidedP(t, df) / 2;
  return t >= 0 ? 1 - tail : tail;
}

export function tQuantile(p, df) {
  if (p < 0.5) return -tQuantile(1 - p, df);
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- linear algebra ----------

// Gauss-Jordan inverse with partial pivoting; throws when (near) singular.
function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  const scale = Math.max(...A.map((row, i) => Math.abs(row[i])));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-10 * scale) {
      throw new AnalysisError('矩陣不可逆：特徵之間完全共線，請移除重複或互相決定的欄位');
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col || M[r][col] === 0) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row.slice(n));
}

// ---------- regression ----------

// X excludes the intercept column; it is added here.
export function ols(X, y) {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  const p = k + 1;
  const df = n - p;
  if (df <= 0) throw new AnalysisError(`資料筆數太少：${n} 筆無法估計 ${k} 個特徵`);

  // Scale columns to RMS 1 for numerical stability; undone below.
  const s = [1];
  for (let j = 0; j < k; j++) {
    let sq = 0;
    for (let i = 0; i < n; i++) sq += X[i][j] * X[i][j];
    s.push(Math.sqrt(sq / n) || 1);
  }

  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  const z = new Array(p);
  for (let i = 0; i < n; i++) {
    z[0] = 1;
    for (let j = 0; j < k; j++) z[j + 1] = X[i][j] / s[j + 1];
    for (let a = 0; a < p; a++) {
      Xty[a] += z[a] * y[i];
      for (let b = a; b < p; b++) XtX[a][b] += z[a] * z[b];
    }
  }
  for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];

  const invZ = invert(XtX);
  const XtXinv = invZ.map((row, a) => row.map((v, b) => v / (s[a] * s[b])));
  const coef = invZ.map((row, a) => row.reduce((acc, v, b) => acc + v * Xty[b], 0) / s[a]);

  let sse = 0;
  for (let i = 0; i < n; i++) {
    let fit = coef[0];
    for (let j = 0; j < k; j++) fit += coef[j + 1] * X[i][j];
    sse += (y[i] - fit) ** 2;
  }
  const sigma2 = sse / df;
  const se = XtXinv.map((row, j) => Math.sqrt(sigma2 * row[j]));
  const t = coef.map((c, j) => c / se[j]);
  const pv = t.map(v => (Number.isFinite(v) ? twoSidedP(v, df) : 0));

  return { coef, se, t, p: pv, sigma2, df, XtXinv, n, k };
}

export function predict(model, X) {
  return X.map(row => row.reduce((acc, v, j) => acc + model.coef[j + 1] * v, model.coef[0]));
}

// tQuantile is a bisection; cache it so per-point intervals stay cheap.
const tCache = new Map();
function criticalT(level, df) {
  const key = `${level}|${df}`;
  if (!tCache.has(key)) tCache.set(key, tQuantile(1 - (1 - level) / 2, df));
  return tCache.get(key);
}

export function predictionInterval(model, x, level = 0.95) {
  const x0 = [1, ...x];
  const fit = x0.reduce((acc, v, j) => acc + model.coef[j] * v, 0);
  let h = 0;
  for (let a = 0; a < x0.length; a++) {
    for (let b = 0; b < x0.length; b++) h += x0[a] * model.XtXinv[a][b] * x0[b];
  }
  const half = criticalT(level, model.df) * Math.sqrt(model.sigma2 * (1 + h));
  return { fit, lo: fit - half, hi: fit + half };
}

export function metrics(yTrue, yPred, k) {
  const n = yTrue.length;
  const mean = yTrue.reduce((a, b) => a + b, 0) / n;
  let sse = 0, sst = 0, abs = 0;
  for (let i = 0; i < n; i++) {
    const e = yTrue[i] - yPred[i];
    sse += e * e;
    abs += Math.abs(e);
    sst += (yTrue[i] - mean) ** 2;
  }
  const r2 = 1 - sse / sst;
  return {
    r2,
    adjR2: 1 - ((1 - r2) * (n - 1)) / (n - k - 1),
    mae: abs / n,
    rmse: Math.sqrt(sse / n),
  };
}
