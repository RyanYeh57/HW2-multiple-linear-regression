# HW2 多元線性回歸網站：設計文件

日期：2026-10-30
作業原文：`spec.md`（同資料夾根目錄）

## 1. 目的與動機

HW2 要用一個 14–39 個特徵的資料集做多元線性回歸，走完 CRISP-DM，交 GitHub repo + 網頁。

舊作業（DIC2，repo `RyanYeh57/DIC2-50-startup-and-boston-housing`）不符合 HW2：特徵數不夠（13 和 4）、沒有預測區間、沒有加分題的「任意輸入資料集」。
所以**開新 repo、新樣式**，不改舊 repo。

成功的樣子：
- 老師打開網頁，選一個題目或貼一個 CSV 網址，馬上看到完整分析。
- spec 的必要項目和兩個加分項目都看得到。

## 2. 目標、非目標、反目標

**目標**
- 下拉選單切換兩個內建題目：**Predict the Flood**、**50 Startups**（加分 1）。
- 網址輸入框：貼任意 CSV 網址，瀏覽器內即時分析（加分 2）。
- 多元線性回歸 + 多種特徵選擇 + 多種線性模型比較 + 含 95% 預測區間的預測圖。
- 網頁只放分析工具與資料來源。CRISP-DM 報告、GPT 對話 PDF、NotebookLM 摘要是**另外繳交的檔案**，不放網站（使用者 2026-10-30 決定）。README 另有 CRISP-DM 對照表（2026-11-02 決定）。

**非目標**（使用者確認不做）
- 不寫 Python 程式或 notebook。
- 不做舊網站的 10 種模型比較；本網站只比較 Linear、Ridge、Lasso。不做即時試算（live predictor）。
- 不改舊 repo。

**反目標**（做了就算失敗）
- 樣式像舊作業：紫色重點色（`#5b55db`）、深藍大橫幅、卡片陰影儀表板、Inter 字型為主。
- 需要後端伺服器才能跑。
- 頁面因資料量大而卡死。

## 3. 限制

- 純靜態網站，放 GitHub Pages。所有計算在瀏覽器用 JavaScript 完成。
- 外部 CSV 必須允許跨站讀取（CORS，`Access-Control-Allow-Origin`）。已驗證 `raw.githubusercontent.com` 回 `*`；Kaggle 下載需要登入，瀏覽器讀不到。
- 使用者全域規則：KISS、避免過度設計、程式碼與註解用英文、對話與文件用繁體中文。

## 4. 使用者已決定的部分

| 項目 | 決定 |
|---|---|
| Repo | 開新 repo **`HW2-multiple-linear-regression`**，跟舊作業分開。`D:\git\Homework\IOT\HW2` 資料夾就是 repo 根目錄。本機沒有 `gh`，改為：使用者在 GitHub 網頁建立空 repo 並開啟 Pages，Claude 用 git 推送 |
| Flood 資料 | Kaggle 比賽版 playground-series-s4e5 的 `train.csv`（1,117,957 筆），用 `scripts/sample-flood.js` 隨機抽 50,000 筆（seed 42）、拿掉 `id` 欄 → `data/flood.csv`。原始檔放 `data/raw/`（gitignore，不上傳）。原本的 naiyakhalid 版是無雜訊公式（R² = 1，看不到預測區間），2026-10-30 換掉 |
| 內建題目 | Predict the Flood、50 Startups |
| 自訂資料 | 一個網址輸入框，貼 CSV 網址即時分析 |
| 技術 | 不要 Python；全部在瀏覽器用 JavaScript |
| 樣式 | **B「白底工具」**：純白底、細灰線、無卡片陰影；左側設定欄、右側結果；墨綠重點色（約 `#0f766e`）；數字用等寬字 |
| 結果區塊 | 見第 5.3 節七個區塊 |
| 不做的 | 見第 2 節非目標 |

視覺參考：`.superpowers/brainstorm/1847-1793329378/content/visual-style.html` 的選項 B。

## 5. 設計細節

### 5.1 版面

- **左側設定欄**（窄，固定）：
  1. 資料集下拉選單：`Predict the Flood`、`50 Startups`、`自訂網址`
  2. CSV 網址輸入框（選「自訂網址」時啟用；placeholder 放 spec 給的範例網址）
  3. 目標欄位下拉選單（讀完 CSV 後填入欄位名）
  4. 「分析」按鈕
  5. 錯誤／狀態訊息
- **右側結果區**：第 5.3 節七個區塊，由上往下。
- **結果區下方**：資料來源。
- 手機寬度：設定欄移到上方，單欄排列。

### 5.2 資料處理流程

1. 讀 CSV（內建題目讀 repo 內的檔案；自訂讀使用者網址）。
2. 第一列當欄位名。欄位名去頭尾空白。
3. 目標欄位：內建題目預設 `FloodProbability`／`Profit`；自訂網址預設最後一欄。目標欄必須是數字，否則顯示錯誤。
4. 刪除目標欄缺值的列；數字特徵缺值用訓練集平均值填補。
5. 文字欄位做 One-Hot 編碼，**丟掉第一個類別**（避免共線性讓矩陣不可逆）。
6. 80/20 切訓練／測試，固定亂數種子 42（可重現）。
7. 所有選擇與擬合只用訓練資料；指標在測試資料算。

### 5.3 結果區七個區塊

| # | 區塊 | 內容 |
|---|---|---|
| 1 | 資料概況 | 筆數、特徵數（編碼後）、缺值數、訓練／測試筆數 |
| 2 | 特徵選擇 | 下拉選擇 **Backward Elimination、Forward Selection、SelectKBest、RFE、Lasso**。每種方法都只用訓練集選特徵，並用滑桿查看不同特徵數。圖顯示特徵數 vs 訓練 Adjusted R² 與測試 R²；測試線只供參考，不用來挑方法或特徵數。 |
| 3 | 模型比較 | 比較 **Linear Regression、Ridge、Lasso** 三種模型；顯示測試集 R²、Adjusted R²、MAE、RMSE。這些數字是評估結果，不用測試集反過來選特徵。 |
| 4 | 模型評估 | 目前選定特徵與 Linear Regression 的測試集 R²、Adjusted R²、MAE、RMSE |
| 5 | 預測圖 | 測試資料按預測值排序：點＝實際值，線＝預測值，帶狀＝**95% 預測區間** |
| 6 | 殘差圖 | 預測值 vs 殘差 |
| 7 | 係數表 | 截距與各特徵係數、標準誤、p-value |

預測區間公式：`ŷ ± t(0.975, n−p−1) · s · sqrt(1 + x₀ᵀ(XᵀX)⁻¹x₀)`。

### 5.4 特徵選擇與模型比較規則

- **Backward Elimination**：從全部特徵開始，每一步刪掉 training OLS 中 p-value 最大的特徵。
- **Forward Selection**：從零個特徵開始，每一步加入 training OLS p-value 最小的剩餘特徵；p-value 門檻只用於決定預設步驟，不會停止建立完整滑桿步驟。
- **SelectKBest**：依 training 集中每個特徵與目標的單變量相關強度排序，建立前 1 到全部特徵的步驟。
- **RFE**：從全部特徵開始，每一步刪掉 training OLS 中絕對 t 值最小的特徵。
- **Lasso**：用 training 集 fit Lasso；依絕對係數由大到小建立前 1 到全部特徵的步驟，係數相同時用原始欄位順序決定。Lasso 的 lambda 固定為 `0.01`，並用 coordinate descent。
- 預設步驟：優先選第一個所有保留特徵 p-value 都小於 0.05 的步驟；沒有則選只保留 1 個特徵的最後一步。不得使用 test target 選方法或特徵數。
- 模型比較的三個模型固定為：Linear Regression（OLS）、Ridge（lambda = `1`）、Lasso（lambda = `0.01`）。Ridge 與 Lasso 會先以 training 集的欄位尺度做標準化，再將係數轉回原始欄位尺度；評估使用相同的選定特徵與相同 test split。

## 5.5 內建資料集

| 題目 | 來源 | 特徵 | 目標 | 備註 |
|---|---|---|---|---|
| Predict the Flood | Kaggle「Regression with a Flood Prediction Dataset」<https://www.kaggle.com/competitions/playground-series-s4e5/data> 的 `train.csv`，抽 50,000 筆存成 `data/flood.csv` | 20 個數字特徵（整數 0–16 左右） | `FloodProbability` | 符合 14–39 特徵要求。測試集 R² 約 0.85 |
| 50 Startups | spec 範例網址 <https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/master/datasets/50_Startups.csv>，複製一份到 `data/50_Startups.csv` | 4 個（含文字欄 `State`） | `Profit` | 只有 4 個特徵，作為「任意資料集」示範 |

### 5.6 CRISP-DM 與 AI 區塊

- **不放網站。** 使用者另外繳交 CRISP-DM 報告、GPT 對話 PDF、NotebookLM 摘要（2026-10-30 決定）。
- **README 有 CRISP-DM 對照表**（2026-11-02 使用者決定）：六個階段各對應網站做了什麼、在哪個區塊。網站本身不加 CRISP-DM 區塊；GPT 與 NotebookLM 內容仍不放 repo。

### 5.7 自訂 CSV 的防呆

| 狀況 | 處理 |
|---|---|
| 網址讀不到（CORS、404） | 顯示錯誤，提示「請用 GitHub raw 網址」 |
| 分隔符號 | 自動判斷逗號或分號 |
| 文字欄的不同值超過 20 個（像 ID、名字） | 丟掉該欄，並在資料概況列出 |
| 所有值都一樣的欄 | 丟掉，並列出 |
| 目標欄不是數字 | 顯示錯誤 |
| 編碼後特徵數 > 100，或訓練筆數 ≤ 特徵數 + 1 | 顯示錯誤，不計算 |
| 矩陣不可逆（完全共線） | 顯示錯誤，列出可能原因 |
| 日期欄 | 當一般文字欄處理（通常會因不同值太多被丟掉） |

## 6. 實作結果

- 修改 `js/stats.js`：新增 training-only Ridge 與 Lasso；Ridge lambda = 1，Lasso lambda = 0.01。
- 修改 `js/select.js`：新增 Forward Selection、SelectKBest、RFE、Lasso Selection；所有 steps 維持原滑桿的特徵數 N→1 順序。
- 修改 `js/analyze.js`：新增 algorithm dispatch 與 Linear/Ridge/Lasso 的比較 API。
- 修改 `index.html`、`js/app.js`：新增 `Feature Selection Algorithm` 選單與 `Comparison of Regression Models` 表格。
- 修改 `README.md` 與進度／驗收文件：同步新功能和限制。
- 與原設計的差異：Forward 會完整建立所有步驟，p-value < 0.05 只決定預設位置；Lasso 會將所有特徵依係數排序，確保滑桿步驟完整。
- 驗證：`npm test` 47/47；Flood Lasso + 三模型比較 593ms；headless 顯示三個模型，390px iframe 的 `scrollWidth = clientWidth = 375`。

## 7. 交給實作者決定的部分

我（Claude）做的決定，使用者可推翻：
- 不用打包工具（no build step），純 HTML/CSS/JS。
- 圖表自己用 SVG 畫，不依賴圖表函式庫。
- 測試點太多時（Flood 測試集約 10,000 點），預測圖與殘差圖只**抽樣約 500 點**畫，指標仍用全部資料算。
- GitHub Pages 從 repo 根目錄發布，網站檔案放根目錄（避免和 `docs/` 裡的設計文件混在一起）。
- t 分布分位數用數值近似計算。
- `.superpowers/`（樣式討論的暫存檔）加入 `.gitignore`，不提交。
- 資料讀取用相對路徑（`data/flood.csv`），所以 GitHub Pages 的子路徑 `/HW2-multiple-linear-regression/` 不影響。
- 第 5.7 節的防呆門檻（20 個不同值、100 個特徵）。

完全交給實作者：
- 檔案切分方式、CSS 細節、數學實作（矩陣反運算方法等）、測試工具選擇。
