# HW2 多元線性回歸網站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一個純靜態網站：選內建題目或貼 CSV 網址，瀏覽器內做多元線性回歸、backward elimination、評估與 95% 預測區間。

**Architecture:** 無 build step 的 ES modules。純函式（CSV 解析、統計、前處理、特徵選擇、分析流程）放 `js/` 各自一檔，用 Node 內建 `node:test` 測試；`js/charts.js` 與 `js/app.js` 負責 SVG 與 DOM。GitHub Pages 從 repo 根目錄發布。

**Tech Stack:** HTML / CSS / vanilla JavaScript (ES modules)、Node 24 `node --test`（只用於測試，無 npm 依賴）、Python `http.server`（只用於本機預覽）、Edge headless（驗證頁面）。

**Spec:** `docs/superpowers/specs/2026-10-30-hw2-regression-site-design.md`

## Global Constraints

- 零外部依賴：不用 npm 套件、不用 CDN、不用圖表函式庫。
- 程式碼、變數、註解用英文；網頁上使用者看到的文字用繁體中文。
- 所有選擇與擬合只用訓練資料；80/20 切分，seed = 42。
- One-Hot 丟第一個類別（依類別字串排序後的第一個）。
- 文字欄不同值 > 20 → 丟掉；常數欄 → 丟掉；編碼後特徵 > 100 或訓練筆數 ≤ 特徵數 + 1 → 錯誤。
- 預測區間：`ŷ ± t(0.975, n−p−1) · s · sqrt(1 + x₀ᵀ(XᵀX)⁻¹x₀)`，其中 x₀ 含截距 1。
- 圖表點數 > 500 時均勻抽樣到 500；指標用全部資料。
- 樣式 B：白底 `#ffffff`、細線 `#e5e5e5`、重點色 `#0f766e`、無卡片陰影、數字用 `ui-monospace, Consolas, monospace`。不得使用舊作業的 `#5b55db`、深藍橫幅、Inter 字型。
- 讀資料用相對路徑 `data/flood.csv`、`data/50_Startups.csv`。
- 錯誤一律以 `AnalysisError`（繁中訊息）拋出，由 `app.js` 顯示，頁面不可當掉。

## Review Focus

1. 網址讀不到（CORS 擋、404、不是 CSV）→ 顯示「讀不到資料，請用 GitHub raw 網址」，不是空白頁。→ Task 6 headless 檢查。
2. CSV 有 BOM、CRLF 換行、欄位名前後空白、引號包住含逗號的值 → 欄位名正確。→ Task 1 測試。
3. 目標欄有空值或是文字 → 空值列被刪；文字目標拋錯。→ Task 3 測試。
4. 完全共線（例如兩欄一模一樣）→ 拋「矩陣不可逆」錯誤，不回傳 NaN。→ Task 2 測試。
5. 換資料集或拉滑桿後，舊圖、舊錯誤訊息被清掉。→ Task 6 headless 檢查。

---

### Task 1: Repo 骨架 + CSV 解析

**Files:**
- Create: `package.json`、`.gitignore`、`data/50_Startups.csv`、`js/csv.js`
- Test: `tests/csv.test.js`

**Interfaces:**
- Produces: `parseCsv(text: string) -> { headers: string[], rows: string[][] }`（rows 為原始字串，空欄為 `''`）

- [ ] **Step 1: 初始化**
  - `git init -b main`（在 `D:\git\Homework\IOT\HW2`）
  - `package.json`：`{ "name": "hw2-multiple-linear-regression", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }`
  - `.gitignore`：`.superpowers/`、`node_modules/`
  - 下載 `https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv` 到 `data/50_Startups.csv`；確認 51 行。

- [ ] **Step 2: 寫失敗測試** `tests/csv.test.js`

```js
test('parses headers and rows', () => {
  const r = parseCsv('a,b\n1,2\n3,4\n');
  assert.deepEqual(r.headers, ['a', 'b']);
  assert.deepEqual(r.rows, [['1', '2'], ['3', '4']]);
});
test('strips BOM, CRLF, header whitespace', () => {
  const r = parseCsv('\uFEFF a ,b \r\n1,2\r\n');
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
```

- [ ] **Step 3: 跑測試確認失敗** — `npm test` → FAIL（module not found）
- [ ] **Step 4: 實作 `parseCsv`** in `js/csv.js`。分隔符：第一行（引號外）分號數 > 逗號數則用 `;`。逐字元狀態機處理引號。
- [ ] **Step 5: 跑測試確認通過** — `npm test` → 5 pass
- [ ] **Step 6: Commit** — `git add -A`（先 `git status` 確認沒有 `.superpowers/`）；`git commit -m "chore: scaffold repo and add CSV parser"`

---

### Task 2: 統計核心（OLS、t 分布、指標、預測區間）

**Files:**
- Create: `js/errors.js`、`js/stats.js`
- Test: `tests/stats.test.js`

**Interfaces:**
- Produces:
  - `class AnalysisError extends Error`（`js/errors.js`）
  - `tCdf(t: number, df: number) -> number`
  - `tQuantile(p: number, df: number) -> number`
  - `ols(X: number[][], y: number[]) -> Model`，X **不含**截距欄，函式自己加。`Model = { coef: number[] /* [intercept, ...] */, se: number[], t: number[], p: number[], sigma2: number, df: number, XtXinv: number[][], n: number, k: number /* features, not counting intercept */ }`
  - `predict(model, X: number[][]) -> number[]`
  - `predictionInterval(model, x: number[], level = 0.95) -> { fit, lo, hi }`
  - `metrics(yTrue: number[], yPred: number[], k: number) -> { r2, adjR2, mae, rmse }`

- [ ] **Step 1: 寫失敗測試** `tests/stats.test.js`（`close(a, b, tol)` 為 `Math.abs(a-b) < tol` 的小 helper）

```js
test('tQuantile known values', () => {
  close(tQuantile(0.975, 3), 3.182446, 1e-4);
  close(tQuantile(0.975, 10), 2.228139, 1e-4);
  close(tQuantile(0.975, 1000), 1.962339, 1e-4);
});
test('tCdf known value', () => close(tCdf(2.0, 10), 0.963306, 1e-5));

const X1 = [[1], [2], [3], [4], [5]], Y1 = [2, 4, 5, 4, 5];
test('ols simple regression', () => {
  const m = ols(X1, Y1);
  close(m.coef[0], 2.2, 1e-9); close(m.coef[1], 0.6, 1e-9);
  close(m.sigma2, 0.8, 1e-9); close(m.se[1], 0.282843, 1e-5);
  close(m.p[1], 0.1240, 1e-3); assert.equal(m.df, 3);
});
test('ols recovers exact multivariate coefficients', () => {
  const X = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 5]];
  const y = X.map(([a, b]) => 1 + 2 * a + 3 * b);
  ols(X, y).coef.forEach((c, i) => close(c, [1, 2, 3][i], 1e-8));
});
test('predictionInterval at x mean', () => {
  const r = predictionInterval(ols(X1, Y1), [3]);
  close(r.fit, 4.0, 1e-9); close(r.lo, 0.8819, 1e-3); close(r.hi, 7.1181, 1e-3);
});
test('metrics', () => {
  const r = metrics([1, 2, 3, 4], [1, 2, 3, 5], 1);
  close(r.mae, 0.25, 1e-12); close(r.rmse, 0.5, 1e-12);
  close(r.r2, 0.8, 1e-12); close(r.adjR2, 0.7, 1e-12);
});
test('collinear columns throw AnalysisError', () => {
  assert.throws(() => ols([[1, 1], [2, 2], [3, 3], [4, 4]], [1, 2, 3, 5]), AnalysisError);
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test` → stats tests FAIL
- [ ] **Step 3: 實作** `js/errors.js`、`js/stats.js`
  - XᵀX 用 Gauss-Jordan（partial pivoting）求反矩陣；pivot 絕對值 < `1e-10 × 對角線最大值` → `throw new AnalysisError('矩陣不可逆：特徵之間完全共線，請移除重複或互相決定的欄位')`。
  - 先把每個特徵欄標準化再算反矩陣可提高穩定度——由實作者決定，但輸出係數必須是原始尺度。
  - `tCdf` 用 regularized incomplete beta（continued fraction）；`tQuantile` 用二分法求 `tCdf(x, df) = p`，區間 `[0, 1000]`，迭代到 1e-10。
  - p-value = `2 × (1 − tCdf(|t|, df))`。
- [ ] **Step 4: 跑測試確認通過** — `npm test` → all pass
- [ ] **Step 5: Commit** — `git commit -m "feat: add OLS, t distribution, metrics and prediction interval"`

---

### Task 3: 前處理（切分、欄位分類、補值、One-Hot、防呆）

**Files:**
- Create: `js/prep.js`
- Test: `tests/prep.test.js`

**Interfaces:**
- Consumes: `parseCsv` 的輸出、`AnalysisError`
- Produces:
  - `splitIndices(n: number, testRatio = 0.2, seed = 42) -> { train: number[], test: number[] }`（mulberry32 洗牌；test 數 = `Math.round(n × testRatio)`）
  - `prepare(table: {headers, rows}, target: string, opts = { testRatio: 0.2, seed: 42 }) -> Prepared`
  - `Prepared = { Xtrain, ytrain, Xtest, ytest: number[][]|number[], featureNames: string[], dropped: {name, reason}[], summary: { rows, droppedTargetRows, missingCells, features, trainRows, testRows } }`
  - One-Hot 欄名格式：`${column}_${category}`

- [ ] **Step 1: 寫失敗測試** `tests/prep.test.js`

```js
test('split is deterministic, disjoint, 40/10 for n=50', () => {
  const a = splitIndices(50), b = splitIndices(50);
  assert.deepEqual(a, b);
  assert.equal(a.train.length, 40); assert.equal(a.test.length, 10);
  assert.equal(new Set([...a.train, ...a.test]).size, 50);
});
test('one-hot drops first sorted category', () => {
  const t = { headers: ['x', 'S', 'y'], rows: Array.from({ length: 30 }, (_, i) => [String(i), ['NY', 'CA', 'FL'][i % 3], String(i * 2)]) };
  assert.deepEqual(prepare(t, 'y').featureNames, ['x', 'S_FL', 'S_NY']);
});
test('drops ID-like text column (>20 unique) and constant column', () => {
  const t = { headers: ['id', 'c', 'x', 'y'], rows: Array.from({ length: 30 }, (_, i) => [`u${i}`, '7', String(i % 5), String(i)]) };
  const p = prepare(t, 'y');
  assert.deepEqual(p.featureNames, ['x']);
  assert.deepEqual(p.dropped.map(d => d.name).sort(), ['c', 'id']);
});
test('rows with missing target are removed', () => {
  const t = { headers: ['x', 'y'], rows: Array.from({ length: 30 }, (_, i) => [String(i), i < 5 ? '' : String(i)]) };
  const p = prepare(t, 'y');
  assert.equal(p.summary.droppedTargetRows, 5); assert.equal(p.summary.rows, 25);
});
test('missing numeric feature filled with train mean', () => {
  const t = { headers: ['x', 'z', 'y'], rows: Array.from({ length: 30 }, (_, i) => [i === 0 ? '' : String(i), String(i % 7), String(i * 3)]) };
  const p = prepare(t, 'y');
  // x equals the row index, so the expected fill is the mean of the non-missing train indices
  const { train, test } = splitIndices(30);
  const order = [...train, ...test];
  const filled = [...p.Xtrain, ...p.Xtest][order.indexOf(0)][0];
  const known = train.filter(i => i !== 0);
  close(filled, known.reduce((a, b) => a + b, 0) / known.length, 1e-9);
  assert.equal(p.summary.missingCells, 1);
});
test('non-numeric target throws', () => {
  assert.throws(() => prepare({ headers: ['x', 'y'], rows: [['1', 'a'], ['2', 'b']] }, 'y'), AnalysisError);
});
test('too few rows throws', () => {
  assert.throws(() => prepare({ headers: ['a', 'b', 'c', 'y'], rows: Array.from({ length: 5 }, (_, i) => [String(i), String(i * i), String(i % 2), String(i)]) }, 'y'), AnalysisError);
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test` → prep tests FAIL
- [ ] **Step 3: 實作 `prepare`** in `js/prep.js`。順序：刪目標空值列 → 欄位分類（非空值全可 `Number()` 轉換為數字欄，否則文字欄）→ 丟 >20 類文字欄、丟常數欄 → `splitIndices` → 用訓練集平均補數字缺值、文字缺值當類別 `'(missing)'` → One-Hot → 檢查特徵數 > 100 或 `trainRows ≤ features + 1` 拋錯。所有 `dropped.reason` 用繁中（`'不同值太多（像 ID）'`、`'所有值都一樣'`）。
- [ ] **Step 4: 跑測試確認通過** — `npm test` → all pass
- [ ] **Step 5: Commit** — `git commit -m "feat: add data preparation with split, imputation and one-hot"`

---

### Task 4: Backward elimination

**Files:**
- Create: `js/select.js`
- Test: `tests/select.test.js`

**Interfaces:**
- Consumes: `ols`, `predict`, `metrics`（Task 2）
- Produces: `backwardElimination(prep: Prepared) -> { steps: Step[], defaultIndex: number }`
  - `Step = { features: number[] /* column indices into featureNames */, names: string[], trainAdjR2: number, testR2: number, maxP: number }`
  - `steps[0]` 為全部特徵，最後一步剩 1 個特徵；共 `featureNames.length` 步。
  - `defaultIndex` = 第一個 `maxP < 0.05` 的步；都沒有則最後一步。

- [ ] **Step 1: 寫失敗測試** `tests/select.test.js`

```js
test('eliminates noise features and keeps the signal', () => {
  // build n=200 with mulberry32-style seeded noise: y = 3*x1 + small noise; x2, x3 pure noise
  const prep = makeSyntheticPrep(); // helper in the test file, featureNames ['x1','x2','x3']
  const r = backwardElimination(prep);
  assert.equal(r.steps.length, 3);
  assert.deepEqual(r.steps[0].names, ['x1', 'x2', 'x3']);
  assert.deepEqual(r.steps[r.defaultIndex].names, ['x1']);
  assert.ok(r.steps[r.defaultIndex].maxP < 0.05);
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test` → FAIL
- [ ] **Step 3: 實作**：每步用目前特徵子集對訓練集 `ols`，記錄指標，移除 `p`（不含截距）最大的特徵。
- [ ] **Step 4: 跑測試確認通過** — `npm test` → all pass
- [ ] **Step 5: Commit** — `git commit -m "feat: add backward elimination feature selection"`

---

### Task 5: 分析流程 + 真實資料整合測試

**Files:**
- Create: `js/analyze.js`
- Test: `tests/analyze.test.js`

**Interfaces:**
- Consumes: Task 1–4 全部
- Produces:
  - `analyze(table, target) -> { prep: Prepared, selection: {steps, defaultIndex} }`
  - `fitStep(prep, step: Step) -> { model, metrics, coefTable: {name, coef, se, p}[] /* 第一列 name='(截距)' */, points: {actual, fit, lo, hi}[] /* test set, sorted by fit */ }`
  - `sampleEvenly<T>(arr: T[], max = 500) -> T[]`（保留第一與最後一個，等距抽樣）

- [ ] **Step 1: 寫失敗測試** `tests/analyze.test.js`（用 `fs.readFileSync` 讀 `data/` 下的 CSV）

```js
test('50 Startups end to end', () => {
  const { prep, selection } = analyze(parseCsv(readFileSync('data/50_Startups.csv', 'utf8')), 'Profit');
  assert.equal(prep.summary.trainRows, 40); assert.equal(prep.summary.testRows, 10);
  assert.deepEqual(prep.featureNames, ['R&D Spend', 'Administration', 'Marketing Spend', 'State_Florida', 'State_New York']);
  const f = fitStep(prep, selection.steps[0]);
  assert.ok(f.metrics.r2 > 0.8);
  assert.ok(f.points.every(p => p.lo < p.fit && p.fit < p.hi));
  assert.equal(f.coefTable[0].name, '(截距)');
});
test('Flood end to end under 5s', () => {
  const t0 = Date.now();
  const { prep, selection } = analyze(parseCsv(readFileSync('data/flood.csv', 'utf8')), 'FloodProbability');
  assert.equal(prep.featureNames.length, 20);
  assert.equal(prep.summary.trainRows, 40000);
  assert.ok(fitStep(prep, selection.steps[selection.defaultIndex]).metrics.r2 > 0.5);
  assert.ok(Date.now() - t0 < 5000);
});
test('sampleEvenly', () => {
  const s = sampleEvenly([...Array(10000).keys()]);
  assert.equal(s.length, 500); assert.equal(s[0], 0); assert.equal(s.at(-1), 9999);
  assert.deepEqual(sampleEvenly([1, 2, 3]), [1, 2, 3]);
});
```

- [ ] **Step 2: 跑測試確認失敗** — `npm test` → FAIL
- [ ] **Step 3: 實作** `analyze`、`fitStep`、`sampleEvenly`。
- [ ] **Step 4: 跑測試確認通過** — `npm test` → all pass。若 Flood 超過 5 秒，先優化 XᵀX 累加（只算上三角）再談別的。
- [ ] **Step 5: Commit** — `git commit -m "feat: add analysis pipeline with real-data tests"`

---

### Task 6: 頁面（樣式 B）、SVG 圖表、互動

**Files:**
- Create: `index.html`、`styles.css`、`js/charts.js`、`js/app.js`

**Interfaces:**
- Consumes: `parseCsv`、`analyze`、`fitStep`、`sampleEvenly`、`AnalysisError`
- Produces（`js/charts.js`，各回傳 SVG 字串）：
  - `selectionChart(steps, currentIndex) -> string`（x = 特徵數；兩條線：訓練 Adj R²、測試 R²；目前步驟畫直線標記）
  - `predictionChart(points) -> string`（點 = actual、線 = fit、帶狀 = lo–hi；先 `sampleEvenly`）
  - `residualChart(points) -> string`（x = fit、y = actual − fit、y=0 參考線）

- [ ] **Step 1: `index.html` 結構**（`<html lang="zh-Hant">`，`<script type="module" src="js/app.js">`）
  - 左欄 `<aside>`：`#dataset` select（`flood` = Predict the Flood、`startups` = 50 Startups、`custom` = 自訂網址）、`#url` input（placeholder = spec 範例網址；只在 `custom` 啟用）、`#target` select、`#run` button「分析」、`#status`（`role="status"`）。
  - 右欄 `<main>`：`#overview`、`#selection`（含 `<input type="range" id="k">` 與圖）、`#metrics`、`#prediction`、`#residuals`、`#coefs`。
  - 結果下方預留 `#crisp-dm`、`#ai-gpt`、`#ai-notebooklm`、`#sources` 四個 `<section>`（內容由 Task 7 填）。
- [ ] **Step 2: `styles.css`** — 依 Global Constraints 的樣式 B 數值；左欄寬約 280px、`position: sticky`；≤ 760px 時左欄移到上方單欄；body 必須有明確背景色。
- [ ] **Step 3: `js/charts.js`** — 三個函式。座標軸含刻度與標題（繁中）；所有顏色用 CSS 變數。
- [ ] **Step 4: `js/app.js`** 行為：
  - 載入時自動分析 `flood`；若網址有 `?url=<csv>`，改為自動選 `custom`、填入網址並分析（方便分享連結，也供 headless 檢查使用）。
  - `#overview` 顯示 `summary` 各欄位，以及 `dropped` 清單（欄名 + 原因）。
  - 換資料集：`flood`/`startups` 直接讀 `data/…` 並分析；`custom` 等使用者按「分析」。
  - 讀完 CSV 先填 `#target`（內建題目預設 `FloodProbability`／`Profit`，自訂預設最後一欄）；改 `#target` 會重新分析。
  - `fetch` 失敗或非 2xx → `#status` 顯示「讀不到資料。請確認網址正確，並使用允許跨站讀取的網址（例如 GitHub raw）。Kaggle 網址需登入，無法直接讀取。」
  - 任何 `AnalysisError` → `#status` 顯示其訊息，清空結果區。每次分析開始先清空舊結果與舊訊息。
  - 滑桿 `#k` 綁 `selection.steps`，預設 `defaultIndex`；拖動時重繪 metrics、prediction、residuals、coefs、selection 標記。
  - 數字顯示：R² 類 4 位小數；其他用 `toPrecision(5)`。
- [ ] **Step 5: 本機預覽與 headless 檢查**
  - `python -m http.server 8000`（背景執行，於 repo 根目錄）
  - `& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --virtual-time-budget=15000 --dump-dom http://localhost:8000/ > $env:TEMP\dom.html`
  - 預期：`#metrics` 內有 R² 數字；`#prediction` 內有 `<svg`；`#status` 無錯誤。
  - 再用 `--screenshot=$env:TEMP\shot.png --window-size=1400,1800` 截圖，Read 圖片目視確認樣式 B（白底、左欄、墨綠）；再用 `--window-size=390,1800` 截一張確認手機版不會橫向捲動。
  - Review Focus 1：用 `?url=https://example.invalid/a.csv` 跑 dump-dom，預期 `#status` 有「讀不到資料」。
  - Review Focus 5：用 `?url=https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv` dump-dom，預期 `#target` 預設 `Profit`，有結果無錯誤。
- [ ] **Step 6: `npm test` 仍全綠；Commit** — `git commit -m "feat: add page layout, charts and interactions"`

---

### Task 7: 資料來源、README

> 2026-10-30 使用者決定：CRISP-DM、GPT、NotebookLM 另外繳交，不放網站。原 Step 1、2 與 `ai/` 資料夾取消。

**Files:**
- Modify: `index.html`（`#sources`）
- Create: `README.md`

- [ ] **Step 1: `#sources`** — Flood：Kaggle 連結（依最終 Flood 資料決定）；50 Startups：spec 範例網址。
- [ ] **Step 2: `README.md`**（繁中）— 線上網址 `https://ryanyeh57.github.io/HW2-multiple-linear-regression/`、功能、資料來源、本機預覽（`python -m http.server 8000`）、測試（`npm test`）、`?url=` 分享用法、限制（CORS、只做線性回歸）。
- [ ] **Step 3: 驗證** — headless dump-dom 確認 `#sources` 有內容、頁面沒有 `#crisp-dm`／`#ai-gpt`／`#ai-notebooklm`；`npm test` 全綠。
- [ ] **Step 4: Commit** — `git commit -m "docs: add data sources and README"`

---

### Task 8: 發布到 GitHub Pages

> 對外操作，執行前再跟使用者確認一次。本機沒有 `gh`，改用 git + 使用者手動建立 repo。

- [ ] **Step 1: 使用者在 https://github.com/new 建立空 repo** `HW2-multiple-linear-regression`（Public、不勾 README/.gitignore/license）。
- [ ] **Step 2: 推送** — `git remote add origin https://github.com/RyanYeh57/HW2-multiple-linear-regression.git`；`git status` 確認乾淨且無 `.superpowers/`；`git push -u origin main`。
- [ ] **Step 3: 使用者開 Pages** — repo → Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save。
- [ ] **Step 4: 驗證** — 約 1–2 分鐘後 `curl -s -o /dev/null -w "%{http_code}" https://ryanyeh57.github.io/HW2-multiple-linear-regression/` → `200`；`.../data/flood.csv` → `200`；對線上網址跑一次 headless dump-dom，`#metrics` 有數字。
