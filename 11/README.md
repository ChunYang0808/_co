# Jack 編譯器（nand2tetris Project 11）

以 Python 標準函式庫實作 Jack → VM 編譯器，並提供可直接在瀏覽器使用的 JavaScript 版本。兩版都涵蓋 Jack tokenizer、類別與子程式符號表、運算式與敘述解析，以及 VM 程式碼產生；支援 constructor、method、function、陣列、字串、控制流程與方法呼叫。

## 網頁版 Jack Lab

網頁程式位於 [`JackCompiler/site`](JackCompiler/site/index.html)。介面延續第 8 章 VM Lab 的雙欄工作台：左側可編輯或匯入多個 `.jack` 檔，右側查看各檔的 `.vm` 輸出；提供 Seven、陣列、物件範例、錯誤行號定位、單檔下載與多檔 ZIP 下載。編譯完全在瀏覽器內進行，不需要伺服器處理原始碼。

在儲存庫根目錄啟動本機預覽：

```powershell
py -3 -m http.server 8000
```

瀏覽器開啟 `http://localhost:8000/11/JackCompiler/site/`。此網頁亦可作為靜態網站部署。

## 使用

在儲存庫根目錄執行（Windows）：

```powershell
py -3 11/JackCompiler/jack_compiler.py 11/Seven/Main.jack
py -3 11/JackCompiler/jack_compiler.py 11/Square
```

輸入可為單一 `.jack` 檔或含有 `.jack` 檔的資料夾；每個輸入檔旁會產生同名 `.vm` 檔。語法錯誤會指出檔案與行號，且該批輸入不會寫入任何輸出。

## 第 11 章範例驗證

```powershell
py -3 -m unittest discover -s 11/JackCompiler -p 'test_*.py' -v
```

測試會編譯 `11` 下的六組官方 Project 11 範例（Average、ComplexArrays、ConvertToBin、Pong、Seven、Square），檢查輸出的 VM 指令格式與必要的呼叫、函式宣告，並覆蓋陣列、字串、方法與錯誤輸入。儲存庫中的 11 個 `.vm` 檔由本編譯器產生。

網頁版測試：

```powershell
node --test 11/JackCompiler/site/test/*.test.mjs
```

測試會確認 11 個 Project 11 檔案在網頁版與 Python 版產生完全相同的 VM 輸出。

另外已用本機官方 `VMEmulator.bat` 測試：將每組產生的 `.vm` 與官方 `tools/OS/*.vm` 複製到各自的臨時目錄，載入該目錄並執行 100 個 `vmstep`。六組範例均顯示 `End of script`。Project 11 範例沒有附 `.tst`/`.cmp`，所以這項測試確認可載入及初步執行，並非完整遊戲或互動流程驗收。
