# HW2 網站進度

計畫：`docs/superpowers/plans/2026-10-30-hw2-regression-site.md`
新增功能計畫：`docs/superpowers/plans/2026-10-30-hw2-model-selection-comparison.md`
驗收清單：`docs/plans/hw2-site-features.json`、`docs/plans/hw2-model-selection-comparison-features.json`
逐步紀錄（git-ignored）：`.superpowers/sdd/2026-10-30-hw2-regression-site/progress.md`、`.superpowers/sdd/2026-10-30-hw2-model-selection-comparison/progress.md`
分支：`feature/model-selection-comparison`（從 `main` 4c980c9 分出；原始網站分支為 `build-site`）

## 已完成
- 原始 HW2 網站 F-01～F-10：CSV、OLS、Backward Elimination、預測區間、Flood/Startups、自訂網址與樣式 B — 驗證：原本 `npm test` 39/39、headless checks；commit 32930ff
- Task 1：Ridge 與 Lasso core — 驗證：`npm test` 41/41；commit f7fa7b4
- Task 2：Forward、SelectKBest、RFE、Lasso selection — 驗證：selection tests 5/5、`npm test` 44/44；commit d9f96e8
- Task 3：`analyze` algorithm dispatch 與 `compareModels` — 驗證：analyze tests 9/9、`npm test` 47/47；commit cd668c4
- Task 4：Feature Selection Algorithm 選單與 Comparison of Regression Models 表格 — 驗證：Flood Lasso 609ms、headless 有選單／三模型／空白 status、`npm test` 47/47；commit f20c44d
- README 已同步五種特徵選擇、三種模型、lambda 與 test line 限制

## 進行中
- GitHub Pages 仍未發布；F-11 保持 false。需要使用者同意後才可 merge、push 和開 Pages。

## 未動
- 合併到 `main`、push 與 Pages 線上驗證
