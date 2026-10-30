import { sampleEvenly } from './analyze.js';

const W = 640;
const H = 360;
const M = { left: 72, right: 40, top: 36, bottom: 52 };

// Round step (1, 2, 5 × 10^n) ticks that cover [min, max].
export function niceTicks(min, max, count = 5) {
  // A range of a few ULPs would make `v += step` a no-op, so treat it as a single value.
  if (max - min <= Math.abs(max) * 1e-9) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(parseFloat(v.toPrecision(12)));
  return ticks;
}

const scale = ([d0, d1], [r0, r1]) => v => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const fmt = v => v.toLocaleString('en-US', { maximumFractionDigits: 6 });
const extent = values => [Math.min(...values), Math.max(...values)];
const r1 = v => v.toFixed(1);

function axes(xTicks, yTicks, xLabel, yLabel) {
  const x = scale([xTicks[0], xTicks.at(-1)], [M.left, W - M.right]);
  const y = scale([yTicks[0], yTicks.at(-1)], [H - M.bottom, M.top]);
  const grid = [
    ...yTicks.map(t => `<line class="grid" x1="${M.left}" x2="${W - M.right}" y1="${r1(y(t))}" y2="${r1(y(t))}"/>` +
      `<text class="tick" x="${M.left - 8}" y="${r1(y(t))}" text-anchor="end" dominant-baseline="middle">${fmt(t)}</text>`),
    ...xTicks.map(t => `<text class="tick" x="${r1(x(t))}" y="${H - M.bottom + 18}" text-anchor="middle">${fmt(t)}</text>`),
    `<line class="axis" x1="${M.left}" x2="${W - M.right}" y1="${H - M.bottom}" y2="${H - M.bottom}"/>`,
    `<text class="axis-title" x="${(M.left + W - M.right) / 2}" y="${H - 8}" text-anchor="middle">${xLabel}</text>`,
    `<text class="axis-title" transform="translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)" text-anchor="middle">${yLabel}</text>`,
  ].join('');
  return { x, y, grid };
}

const svg = (label, body) =>
  `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${body}</svg>`;

const linePath = (pts, x, y, fx, fy) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${r1(x(fx(p)))},${r1(y(fy(p)))}`).join('');

export function selectionChart(steps, currentIndex) {
  const ks = steps.map(s => s.names.length);
  const scores = steps.flatMap(s => [s.trainAdjR2, s.testR2]);
  const xTicks = niceTicks(...extent(ks), 6).filter(Number.isInteger);
  const yTicks = niceTicks(...extent(scores), 5);
  const { x, y, grid } = axes(xTicks, yTicks, '特徵數', 'R²');
  const cx = r1(x(ks[currentIndex]));
  // Legend sits in the top margin so it never covers the lines.
  const legend = (cls, label, lx) =>
    `<line class="${cls}" x1="${lx}" x2="${lx + 20}" y1="12" y2="12"/>` +
    `<text class="legend" x="${lx + 26}" y="12" dominant-baseline="middle">${label}</text>`;
  return svg('特徵選擇：特徵數與 R² 的關係', [
    grid,
    `<line class="marker" x1="${cx}" x2="${cx}" y1="${M.top}" y2="${H - M.bottom}"/>`,
    `<path class="line-train" d="${linePath(steps, x, y, s => s.names.length, s => s.trainAdjR2)}"/>`,
    `<path class="line-test" d="${linePath(steps, x, y, s => s.names.length, s => s.testR2)}"/>`,
    legend('swatch-train', '訓練 Adj R²', M.left),
    legend('swatch-test', '測試 R²', M.left + 140),
  ].join(''));
}

export function predictionChart(points) {
  const pts = sampleEvenly(points);
  const xTicks = niceTicks(...extent(pts.map(p => p.fit)), 5);
  const yTicks = niceTicks(...extent(pts.flatMap(p => [p.actual, p.lo, p.hi])), 5);
  const { x, y, grid } = axes(xTicks, yTicks, '預測值', '實際值');
  const upper = linePath(pts, x, y, p => p.fit, p => p.hi);
  const lower = pts.slice().reverse().map(p => `L${r1(x(p.fit))},${r1(y(p.lo))}`).join('');
  const dots = pts.map(p => `<circle class="dot" cx="${r1(x(p.fit))}" cy="${r1(y(p.actual))}" r="2.5"/>`).join('');
  return svg('預測值與實際值，含 95% 預測區間', [
    grid,
    `<path class="band" d="${upper}${lower}Z"/>`,
    `<path class="line-fit" d="${linePath(pts, x, y, p => p.fit, p => p.fit)}"/>`,
    dots,
  ].join(''));
}

export function residualChart(points) {
  const pts = sampleEvenly(points);
  const res = pts.map(p => p.actual - p.fit);
  const xTicks = niceTicks(...extent(pts.map(p => p.fit)), 5);
  const yTicks = niceTicks(...extent([0, ...res]), 5);
  const { x, y, grid } = axes(xTicks, yTicks, '預測值', '殘差（實際 − 預測）');
  const dots = pts.map((p, i) => `<circle class="dot" cx="${r1(x(p.fit))}" cy="${r1(y(res[i]))}" r="2.5"/>`).join('');
  return svg('殘差圖', [
    grid,
    `<line class="zero" x1="${M.left}" x2="${W - M.right}" y1="${r1(y(0))}" y2="${r1(y(0))}"/>`,
    dots,
  ].join(''));
}
