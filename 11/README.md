# Jack Compiler · nand2tetris Project 11

將 Jack 原始碼編譯成 nand2tetris 虛擬機的 `.vm` 指令。專案包含 **Python 命令列編譯器**、**純前端網頁版 Jack Lab**，以及第 11 章六組範例的編譯結果。

### [開啟 Jack Lab 網頁版](https://chunyang0808.github.io/_co/11/JackCompiler/site/)

在瀏覽器編輯或匯入 `.jack` 檔、查看對應的 VM 程式，並下載單一 `.vm` 或多檔 ZIP。程式碼只在瀏覽器內處理，不會上傳。

## 功能

| 部分 | 內容 |
| --- | --- |
| 詞彙解析 | 辨識關鍵字、符號、識別字、整數、字串與註解 |
| 符號表 | 管理 `static`、`field`、`argument`、`var` 的作用域與索引 |
| VM 程式碼產生 | 支援運算式、陣列、字串、控制流程、函式、建構子與方法 |
| 多檔案專案 | 每個 `.jack` 檔產生同名 `.vm` 檔；網頁版可一次下載 ZIP |
| 錯誤提示 | 顯示來源檔與行號，網頁版會定位到出錯的程式碼 |

## 快速開始

**使用網頁：**直接開啟 [Jack Lab](https://chunyang0808.github.io/_co/11/JackCompiler/site/)，選擇 Seven、陣列或物件範例，再按「編譯成 VM」。也可以匯入第 11 章範例資料夾。

**使用 Python：**在儲存庫根目錄執行，需 Python 3，無須安裝額外套件。

```powershell
py -3 11/JackCompiler/jack_compiler.py 11/Seven/Main.jack
py -3 11/JackCompiler/jack_compiler.py 11/Square
```

輸入可為單一 `.jack` 檔或資料夾。輸出的 `.vm` 會放在來源檔旁；若該批輸入有語法錯誤，編譯器會顯示檔案與行號，且不寫入該批輸出。

## 第 11 章範例與驗證

| 範例 | 主要驗證內容 |
| --- | --- |
| [Seven](Seven) | 常數、運算式、`do`、`return` |
| [ConvertToBin](ConvertToBin) | 變數、流程控制與函式 |
| [Square](Square) | 建構子、方法、欄位與物件呼叫 |
| [Average](Average) | 陣列與字串 |
| [Pong](Pong) | 物件與靜態變數 |
| [ComplexArrays](ComplexArrays) | 複雜的陣列存取與運算式 |

上述六組範例共 11 個 Jack 檔，已由本專案編譯成同資料夾中的 `.vm` 檔。Python 與 JavaScript 版本對這 11 個檔案的輸出一致。

在儲存庫根目錄執行測試：

```powershell
py -3 -m unittest discover -s 11/JackCompiler -p 'test_*.py' -v
node --test 11/JackCompiler/site/test/*.test.mjs
```

另已將六組編譯結果搭配官方 Jack OS 載入 VM Emulator，各執行 100 個 VM 步驟，均顯示 `End of script`。這項檢查確認程式可載入並初步執行；互動遊戲的完整流程仍需依 [Project 11 官方測試說明](https://www.nand2tetris.org/project11)操作。

## 專案檔案

- [Python 編譯器](JackCompiler/jack_compiler.py)
- [網頁介面](JackCompiler/site/index.html)與 [JavaScript 編譯核心](JackCompiler/site/jack-compiler.js)
- [Python 測試](JackCompiler/test_jack_compiler.py)與 [網頁版測試](JackCompiler/site/test/compiler.test.mjs)

若要在本機預覽網頁，可在儲存庫根目錄執行 `py -3 -m http.server 8000`，再開啟 `http://localhost:8000/11/JackCompiler/site/`。
