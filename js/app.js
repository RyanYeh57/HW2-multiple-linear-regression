import { parseCsv } from './csv.js';
import { analyze, compareModels, fitStep } from './analyze.js';
import { selectionChart, predictionChart, residualChart } from './charts.js';
import { AnalysisError } from './errors.js';

const DATASETS = {
  flood: { url: 'data/flood.csv', target: 'FloodProbability' },
  startups: { url: 'data/50_Startups.csv', target: 'Profit' },
};
const LOAD_ERROR = '讀不到資料。請確認網址正確，並使用允許跨站讀取的網址（例如 GitHub raw）。Kaggle 網址需登入，無法直接讀取。';
const RESULT_IDS = ['overview', 'selection', 'model-comparison', 'metrics', 'prediction', 'residuals', 'coefs'];
const SUMMARY_LABELS = {
  rows: '可用資料筆數',
  droppedTargetRows: '目標欄空白而刪掉的筆數',
  missingCells: '用平均值／(missing) 補上的空格數',
  features: '特徵數（One-Hot 編碼後）',
  trainRows: '訓練集筆數（80%）',
  testRows: '測試集筆數（20%）',
};

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r2 = v => v.toFixed(4);
const num = v => (Number.isFinite(v) ? v.toPrecision(5) : '—');

let table = null;
let result = null;
let loadId = 0; // ignore responses from loads that were superseded

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

function clearResults() {
  result = null;
  for (const id of RESULT_IDS) {
    $(id).hidden = true;
    $(id).querySelector('.body').innerHTML = '';
  }
}

function show(id, html) {
  $(id).querySelector('.body').innerHTML = html;
  $(id).hidden = false;
}

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

function fillTargets(headers, preferred) {
  const select = $('target');
  select.replaceChildren(...headers.map(h => new Option(h, h)));
  select.value = headers.includes(preferred) ? preferred : headers.at(-1);
}

async function loadAndAnalyze() {
  const id = ++loadId;
  const dataset = $('dataset').value;
  const url = dataset === 'custom' ? $('url').value.trim() : DATASETS[dataset].url;
  clearResults();
  table = null;
  $('target').replaceChildren();
  if (!url) {
    setStatus('請先貼上 CSV 網址，再按「分析」。', true);
    return;
  }

  setStatus('讀取資料中…');
  let text;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch {
    if (id === loadId) setStatus(LOAD_ERROR, true);
    return;
  }
  if (id !== loadId) return;

  table = parseCsv(text);
  if (table.headers.length === 0) {
    setStatus('檔案沒有內容。', true);
    return;
  }
  fillTargets(table.headers, DATASETS[dataset]?.target);
  await runAnalysis();
}

async function runAnalysis() {
  clearResults();
  setStatus('分析中…');
  await nextFrame(); // let the status paint before the synchronous fit
  try {
    result = analyze(table, $('target').value, $('algorithm').value);
    const { steps, defaultIndex } = result.selection;
    const slider = $('k');
    slider.max = steps.length;
    slider.value = steps[defaultIndex].names.length;
    renderOverview(result.prep);
    renderStep(defaultIndex);
    setStatus('');
  } catch (err) {
    clearResults();
    if (err instanceof AnalysisError) {
      setStatus(err.message, true);
    } else {
      console.error(err);
      setStatus(`分析失敗：${err.message}`, true);
    }
  }
}

function renderOverview(prep) {
  const rows = Object.entries(SUMMARY_LABELS)
    .map(([key, label]) => `<tr><td>${label}</td><td class="num">${prep.summary[key]}</td></tr>`)
    .join('');
  const dropped = prep.dropped.length
    ? `<p class="note">丟掉的欄位：</p><ul class="dropped">${prep.dropped
        .map(d => `<li><b>${esc(d.name)}</b>：${esc(d.reason)}</li>`)
        .join('')}</ul>`
    : '<p class="note">沒有丟掉任何欄位。</p>';
  show('overview', `<table>${rows}</table>${dropped}`);
}

// Steps go from all features down to one, so step i keeps (steps.length - i) features.
const stepIndexForK = k => result.selection.steps.length - k;

function renderStep(index) {
  const { prep, selection } = result;
  const step = selection.steps[index];
  const fit = fitStep(prep, step);
  const comparison = compareModels(prep, step);
  const isDefault = index === selection.defaultIndex;

  $('k-label').textContent = `${step.names.length} 個特徵${isDefault ? '（預設）' : ''}`;
  show('selection', [
    selectionChart(selection.steps, index),
    `<p class="note">預設停在「所有特徵 p 值都 &lt; 0.05」的第一步。目前這一步最大 p 值 = ${num(step.maxP)}。</p>`,
    `<p class="note">使用的特徵：${step.names.map(esc).join('、')}</p>`,
  ].join(''));

  const m = fit.metrics;
  const stat = (label, value) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`;
  show('model-comparison', `<div class="table-wrap"><table><thead><tr><th>模型</th><th class="num">R²</th>` +
    `<th class="num">Adjusted R²</th><th class="num">MAE</th><th class="num">RMSE</th></tr></thead><tbody>` +
    comparison.rows.map(row => `<tr><td>${esc(row.name)}</td><td class="num">${r2(row.metrics.r2)}</td>` +
      `<td class="num">${r2(row.metrics.adjR2)}</td><td class="num">${num(row.metrics.mae)}</td>` +
      `<td class="num">${num(row.metrics.rmse)}</td></tr>`).join('') + '</tbody></table></div>');

  show('metrics', `<div class="stats">${[
    stat('R²', r2(m.r2)),
    stat('Adjusted R²', r2(m.adjR2)),
    stat('MAE', num(m.mae)),
    stat('RMSE', num(m.rmse)),
  ].join('')}</div>`);

  show('prediction', predictionChart(fit.points));
  show('residuals', residualChart(fit.points));

  const coefRows = fit.coefTable
    .map(c => `<tr class="${c.p < 0.05 ? 'significant' : ''}"><td>${esc(c.name)}</td>` +
      `<td class="num">${num(c.coef)}</td><td class="num">${num(c.se)}</td><td class="num">${num(c.p)}</td></tr>`)
    .join('');
  show('coefs', `<div class="table-wrap"><table><thead><tr><th>變數</th><th class="num">係數</th>` +
    `<th class="num">標準誤</th><th class="num">p 值</th></tr></thead><tbody>${coefRows}</tbody></table></div>`);
}

$('dataset').addEventListener('change', () => {
  const custom = $('dataset').value === 'custom';
  $('url').disabled = !custom;
  if (custom) {
    loadId++;
    clearResults();
    table = null;
    $('target').replaceChildren();
    setStatus('貼上 CSV 網址後按「分析」。');
    $('url').focus();
  } else {
    loadAndAnalyze();
  }
});

$('run').addEventListener('click', loadAndAnalyze);
$('algorithm').addEventListener('change', () => {
  if (table) runAnalysis();
});
$('url').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadAndAnalyze();
});
$('target').addEventListener('change', () => {
  if (table) runAnalysis();
});
$('k').addEventListener('input', () => {
  if (result) renderStep(stepIndexForK(Number($('k').value)));
});

const sharedUrl = new URLSearchParams(location.search).get('url');
if (sharedUrl) {
  $('dataset').value = 'custom';
  $('url').disabled = false;
  $('url').value = sharedUrl;
}
loadAndAnalyze();
