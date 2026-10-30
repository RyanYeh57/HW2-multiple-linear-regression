# HW2 網站進度

計畫：`docs/superpowers/plans/2026-10-30-hw2-regression-site.md`
驗收清單：`docs/plans/hw2-site-features.json`
逐步紀錄（git-ignored）：`.superpowers/sdd/2026-10-30-hw2-regression-site/progress.md`
分支：`build-site`（baseline 在 `main` 6f62193）

## 已完成
- Baseline：spec、計畫、兩份資料集已 commit — 驗證：`git log` 有 6f62193（2026-10-30）
- Task 1–5（CSV、統計、前處理、特徵選擇、分析）— 驗證：`npm test` 全過；commits e367a3f..a7a9fea
- Task 6（頁面、圖表、互動）— 驗證：`npm test` 33/33；headless dump-dom 與截圖（1400 寬、390 寬 iframe 無橫向捲動）；commit b4113cd
- F-01～F-09 已標 passes:true

## 進行中
- 等使用者決定 Flood 資料：A = 換 Kaggle 比賽版 playground-series-s4e5（抽 5 萬筆），B = 保留現有確定性資料。現有 `data/flood.csv` 的 R² = 1，看不到預測區間。
- 下一步第一個動作：使用者回覆後處理資料；之後做 Task 7（資料來源、README）。CRISP-DM／GPT／NotebookLM 使用者另外繳交，不放網站（2026-10-30）

## 未動
- Task 7–8、最終審查
