# Feature Selection and Model Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 HW2 回歸網站加入 Feature Selection Algorithm 選擇，以及 Linear Regression、Ridge、Lasso 的比較表。

**Architecture:** 保留現有 OLS、Backward Elimination、滑桿和預測圖。新增的特徵選擇方法共用 `Step` 介面；正則化模型只在模型比較使用，不改變目前的 95% OLS 預測區間流程。所有選擇和模型 fit 只讀 training split，test split 只計算最後評估指標。

**Tech Stack:** HTML / CSS / vanilla JavaScript ES modules、Node 24 `node:test`、零外部依賴。

**Spec:** `docs/superpowers/specs/2026-10-30-hw2-regression-site-design.md`

## Global Constraints

- 零外部依賴；不加入 npm 套件或 CDN。
- 程式碼、變數、註解用英文；使用者看見的 UI 文字用繁體中文，可保留指定英文標題。
- 固定 80/20 split、seed = 42；Feature Selection 不得讀 `ytest`。
- Selection methods：Backward Elimination、Forward Selection、SelectKBest、RFE、Lasso。
- Model comparison：Linear Regression（OLS）、Ridge（lambda = `1`）、Lasso（lambda = `0.01`）。
- Ridge/Lasso 使用 training 欄位尺度標準化後 fit，輸出的係數要回到原始欄位尺度；Lasso 用 coordinate descent，最多 200 次迭代並有 convergence tolerance。
- 保留現有 OLS 95% prediction interval、prediction/residual charts 和 slider 行為。
- 測試線只供參考，不得用 test R² 選演算法或特徵數。

## Review Focus

1. 把 `ytest` 改成亂數後，各 selection method 的步驟與 default step 必須不變。
2. Flood 20 features 選 Lasso 時不能讓瀏覽器卡死；整個 `npm test` 與 Flood end-to-end 仍須在既有限制內。
3. Ridge/Lasso 的係數與 metrics 必須是 finite，且不能誤用 test rows 估計模型。
4. 切換 algorithm 或 dataset 後，舊 selection、比較表和錯誤訊息必須清掉。
5. 50 Startups 的 categorical one-hot 特徵與小樣本仍要能顯示三個模型的比較結果。

---

### Task 1: Regularized regression core

**Files:**
- Modify: `js/stats.js`
- Test: `tests/stats.test.js`

**Interfaces:**
- Produces `ridge(X, y, lambda) -> RegularizedModel` and `lasso(X, y, lambda, options?) -> RegularizedModel`.
- `RegularizedModel` must contain `coef: number[]` with intercept first, and be usable by `predict`.

- [ ] **Step 1: Write failing tests**
  - Ridge on a small synthetic dataset returns finite coefficients and shrinks a correlated coefficient compared with OLS.
  - Lasso on a signal-plus-noise dataset returns finite coefficients and gives the noise feature a smaller absolute coefficient than the signal feature.
- [ ] **Step 2: Run `node --test tests/stats.test.js` and verify the new tests fail** because the exports do not exist.
- [ ] **Step 3: Implement `ridge` and `lasso`** in `js/stats.js`.
  - Ridge solves the intercept-unpenalized normal equations after training-column RMS scaling.
  - Lasso standardizes training columns, keeps the intercept unpenalized, uses coordinate descent with soft thresholding, then converts coefficients back to the original scale.
- [ ] **Step 4: Run the stats tests and then `npm test`; expect all tests to pass.**
- [ ] **Step 5: Commit** `feat: add ridge and lasso regression cores`.

---

### Task 2: Multiple feature-selection algorithms

**Files:**
- Modify: `js/select.js`
- Test: `tests/select.test.js`

**Interfaces:**
- Produces `forwardSelection(prep)`, `selectKBest(prep)`, `rfeSelection(prep)`, `lassoSelection(prep)`, and `selectionAlgorithms`.
- Each selection function returns `{ steps, defaultIndex }` with the existing `Step` shape. Steps contain `featureNames.length` down to 1 kept features, matching the existing slider's `steps[0] = all features` convention.

- [ ] **Step 1: Write failing tests**
  - Every algorithm returns the expected number of steps, valid feature indices, and non-empty names.
  - On the same prepared data, changing only `ytest` does not change any algorithm's steps or `defaultIndex`.
  - A signal feature ranks ahead of pure noise in Forward, SelectKBest, RFE and Lasso on a seeded synthetic dataset.
- [ ] **Step 2: Run `node --test tests/select.test.js`; verify the new tests fail** because the functions do not exist.
- [ ] **Step 3: Implement the algorithms**.
  - Forward: add the remaining feature with the smallest training p-value at each step.
  - SelectKBest: rank features by absolute training Pearson correlation with `ytrain`, then use top-k prefixes.
  - RFE: remove the feature with the smallest absolute training OLS t-statistic at each step.
  - Lasso: fit training-only Lasso at lambda `0.01`, rank by absolute coefficient, then use prefixes; tie-break by original column index.
  - Reuse `pickColumns` and a shared step builder; calculate displayed train/test scores through the existing step shape, without using test scores for selection.
  - Keep `backwardElimination` behavior unchanged.
- [ ] **Step 4: Run the selection tests and then `npm test`; expect all tests to pass.**
- [ ] **Step 5: Commit** `feat: add selectable feature selection algorithms`.

---

### Task 3: Model comparison and analysis API

**Files:**
- Modify: `js/analyze.js`
- Test: `tests/analyze.test.js`

**Interfaces:**
- `analyze(table, target, algorithm = 'backward') -> { prep, selection }`.
- `compareModels(prep, step) -> { rows: { name, metrics }[] }`, with rows in this order: `Linear Regression`, `Ridge`, `Lasso`.

- [ ] **Step 1: Write failing tests**
  - `analyze(..., 'forward')` returns a valid selection and keeps existing end-to-end behavior.
  - `compareModels` returns the three named models, each with finite R², Adjusted R², MAE and RMSE, using the selected feature columns.
  - A repeated comparison with the same training arrays is deterministic; test values affect only the reported metrics.
- [ ] **Step 2: Run the focused analyze tests; verify the new tests fail** because the API is not present.
- [ ] **Step 3: Implement the API**.
  - Dispatch the selection algorithm by key while defaulting to backward for compatibility.
  - Fit OLS, Ridge and Lasso on `Xtrain` only; calculate metrics against `ytest` with the same selected feature count.
  - Keep `fitStep` as the OLS path used by charts, intervals and coefficient p-values.
- [ ] **Step 4: Run analyze tests and `npm test`; expect all tests to pass, including Flood timing.**
- [ ] **Step 5: Commit** `feat: expose selection and model comparison analysis APIs`.

---

### Task 4: UI algorithm selector and comparison section

**Files:**
- Modify: `index.html`, `js/app.js`, `styles.css`
- Test: `tests/app.test.js` (or a headless DOM verification script if the project has no DOM test library)

**Interfaces:**
- UI element `#algorithm` has values `backward`, `forward`, `kbest`, `rfe`, `lasso`.
- Result section `#model-comparison` renders a table with the three model rows and four metrics.

- [ ] **Step 1: Add a failing headless verification** for the algorithm select, the exact headings `Feature Selection Algorithm` and `Comparison of Regression Models`, and the three model names.
- [ ] **Step 2: Run the verification against the current page and confirm it fails** because those elements are absent.
- [ ] **Step 3: Implement the UI**.
  - Add the algorithm selector in the settings panel and bilingual headings in the result area.
  - On algorithm change, clear old results and rerun analysis with the selected key.
  - Render the comparison table for the current feature step; preserve the existing metrics section for OLS, charts and coefficient table.
  - Clear comparison output on load errors and AnalysisError.
  - Reuse existing table styles; add only the needed responsive rules.
- [ ] **Step 4: Start a local server only when needed and run Edge headless.** Verify Flood loads with no error, the new selector and comparison table are present, and switching to `lasso` still produces metrics.
- [ ] **Step 5: Run `npm test` and the focused headless checks; expect all to pass.**
- [ ] **Step 6: Commit** `feat: add feature selection and model comparison UI`.

---

### Task 5: Documentation, final verification and delivery

**Files:**
- Modify: `README.md`, `docs/plans/hw2-site-progress.md`, `docs/plans/hw2-site-features.json`, `docs/superpowers/specs/2026-10-30-hw2-regression-site-design.md`

- [ ] **Step 1: Update README and progress** with the five selection methods, three models, fixed lambda values, and the fact that test lines are descriptive only.
- [ ] **Step 2: Mark new acceptance items in `hw2-site-features.json`** and keep F-11 false until GitHub Pages is actually verified.
- [ ] **Step 3: Run `npm test`, Flood timing, and headless checks at desktop and mobile widths.**
- [ ] **Step 4: Read back the changed spec and plan; confirm code and docs agree.**
- [ ] **Step 5: Commit** `docs: document feature selection and model comparison`.
- [ ] **Step 6: Ask before any push or Pages change.**
