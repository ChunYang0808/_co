# 期中作業整合清單

這份清單整理計算機結構課程第 3～8 週的作業與學習內容。這幾週都有上課，也都準時繳交作業。

## 每週檢驗表格

| 第幾週 | 習題內容 | 有上課且準時繳交 | 補交且附上請假證明 | 作業連結 |
|---|---|---|---|---|
| 3 | 第 1、2 章 | 是 | — | [01](https://github.com/ChunYang0808/_co/tree/main/01)、[02](https://github.com/ChunYang0808/_co/tree/main/02) |
| 4 | 第 3 章除 PC | 是 | — | [03](https://github.com/ChunYang0808/_co/tree/main/03) |
| 5 | 第 4 章 | 是 | — | [04](https://github.com/ChunYang0808/_co/tree/main/04) |
| 6 | HackCPU 電路圖 | 是 | — | [電路圖](https://github.com/ChunYang0808/_co/blob/main/IMG/IMG_9707.jpg) |
| 7 | 第 5 章 | 是 | — | [05](https://github.com/ChunYang0808/_co/tree/main/05) |
| 8 | EDA 軟體報告 | 是 | — | [報告](https://github.com/ChunYang0808/_co/blob/main/08/README.md) |

## 每週作業內容

### 第 3 週：第 1、2 章

這週先從第 1 章的基本邏輯閘開始，用 HDL 製作 And、Or、Mux、DMux 等元件，並進一步組成 16 位元及多路選擇元件。第 2 章則製作半加器、全加器、16 位元加法器與 ALU，練習讓電路完成加法及邏輯運算。相關的 HDL 與測試檔分別放在 [01](https://github.com/ChunYang0808/_co/tree/main/01) 和 [02](https://github.com/ChunYang0808/_co/tree/main/02)。

### 第 4 週：第 3 章（不含 PC）

這週練習具有記憶功能的電路，從 Bit、Register 開始，再將暫存器組合成 RAM8、RAM64、RAM512、RAM4K 和 RAM16K。透過位址選擇要讀取或寫入的位置，了解記憶體容量如何逐層擴充。本週作業範圍不含 PC，內容見 [03](https://github.com/ChunYang0808/_co/tree/main/03)。

### 第 5 週：第 4 章

這週改用 Hack 組合語言寫程式。Mult 程式以重複加法計算 R0 與 R1 的乘積，並將結果存到 R2；Fill 程式持續檢查鍵盤，按鍵時把畫面塗黑，沒有按鍵時清空畫面。程式與相關測試檔放在 [04](https://github.com/ChunYang0808/_co/tree/main/04)。

### 第 6 週：HackCPU 電路圖

這週以手繪方式整理 HackCPU 相關的運算電路。圖中從 16 位元的 x、y 輸入出發，標出 Mux16、Not16 等元件與控制訊號，幫助理解資料如何經過選擇、反相和運算後形成輸出。手繪成果見 [電路圖](https://github.com/ChunYang0808/_co/blob/main/IMG/IMG_9707.jpg)。

### 第 7 週：第 5 章

這週用 HDL 製作 CPU、Memory 和 Computer，將前面學到的元件組合成 Hack 電腦。CPU 負責處理指令與運算；Memory 依位址連接 RAM、螢幕與鍵盤；Computer 再把 CPU、記憶體和指令 ROM 接在一起。程式與測試檔放在 [05](https://github.com/ChunYang0808/_co/tree/main/05)。

### 第 8 週：EDA 軟體報告

這週撰寫 EDA（電子設計自動化）報告，整理軟體工具如何協助 IC 設計與驗證。報告介紹從 HDL 描述、功能驗證、邏輯合成到實體設計與檢查的流程，並用半加器作為例子，也比較 ASIC 與 FPGA 的實作方向。完整內容見 [報告](https://github.com/ChunYang0808/_co/blob/main/08/README.md)。