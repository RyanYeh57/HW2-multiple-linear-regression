# HW2 網站進度

計畫：`docs/superpowers/plans/2026-10-30-hw2-regression-site.md`
驗收清單：`docs/plans/hw2-site-features.json`
逐步紀錄（git-ignored）：`.superpowers/sdd/2026-10-30-hw2-regression-site/progress.md`
分支：`build-site`（baseline 在 `main` 6f62193）

## 已完成
- Baseline：spec、計畫、兩份資料集已 commit — 驗證：`git log` 有 6f62193（2026-10-30）
- Task 1–5（CSV、統計、前處理、特徵選擇、分析）— 驗證：`npm test` 全過；commits e367a3f..a7a9fea
- Task 6（頁面、圖表、互動）— 驗證：`npm test` 33/33；headless dump-dom 與截圖（1400 寬、390 寬 iframe 無橫向捲動）；commit b4113cd
- CRISP-DM／GPT／NotebookLM 區塊移出網站（使用者另外繳交）— commit 411859d
- Flood 資料換成 Kaggle playground-series-s4e5 抽 5 萬筆（R² 0.85）— commit 83f621b
- Task 7（資料來源、README）— commit 29a7bba
- 最終審查修正（只用訓練集建編碼、常數目標、niceTicks 卡死、滑桿變快、測試線提示）— 驗證：`npm test` 39/39；headless 看得到提示句；commit 32930ff
- F-01～F-10 已標 passes:true

## 進行中
- Task 8 發布：等使用者在 GitHub 建空的 repo `HW2-multiple-linear-regression`，並同意 push（2026-10-30）
- 下一步第一個動作：使用者同意後 merge `build-site` 到 `main`，加 remote，push `main`；使用者開 Pages（main / root）

## 未動
- 線上網站驗證（200 + #metrics 有數字）後標 F-11 passes:true
