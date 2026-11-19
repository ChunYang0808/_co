# nand2tetris VM Translator（第 11 週作業）

這是 nand2tetris 第 7、8 章的虛擬機翻譯器。輸入一個 `.vm` 檔案或包含多個 `.vm` 檔案的資料夾，程式會輸出可在 Hack CPU Emulator 執行的 `.asm`。使用 Python 標準函式庫，無須安裝額外套件。

## 線上版本

**[開啟 VM Lab 線上轉譯器](https://chunyang0808.github.io/_co/08/VMTranslator/site/)**

網頁版是純前端程式：可以貼上 VM 程式、匯入多個 `.vm` 檔案或資料夾、切換範例及 bootstrap 模式，然後下載 `.asm`。原始碼只在自己的瀏覽器處理，不會上傳到伺服器。網頁版的轉譯核心另以官方 CPU Emulator 的 11 個案例驗證通過。

## 已實作功能

| 類別 | VM 指令 |
| --- | --- |
| 算術與邏輯 | `add`、`sub`、`neg`、`eq`、`gt`、`lt`、`and`、`or`、`not` |
| 記憶體 | `push`、`pop`：`local`、`argument`、`this`、`that`、`temp`、`pointer`、`static`；另支援 `push constant` |
| 程式流程 | `label`、`goto`、`if-goto`，標籤依函式區分 |
| 函式呼叫 | `function`、`call`、`return`，支援多檔案與遞迴 |

程式會為不同 VM 檔案產生不同的 `static` 符號；`gt`、`lt` 也處理 16 位元有號數比較時可能發生的溢位。

## 執行方式

在本資料夾開啟 PowerShell，執行：

```powershell
# 單一 VM 檔案：產生同名的 SimpleAdd.asm
python VMTranslator.py examples/07/StackArithmetic/SimpleAdd/SimpleAdd.vm

# 多個 VM 檔案：讀取整個資料夾，產生 FibonacciElement.asm
python VMTranslator.py examples/08/FunctionCalls/FibonacciElement
```

找到 `function Sys.init` 時，翻譯器會自動加入啟動程式：設定 `SP=256`，然後呼叫 `Sys.init`。若官方 `.tst` 已自行設定堆疊及呼叫框架，例如 `NestedCall.tst`，請改用：

```powershell
python VMTranslator.py examples/08/FunctionCalls/NestedCall --no-bootstrap
```

也可使用 `--bootstrap` 強制加入啟動程式。若電腦的 `python` 指令無法執行，可試 `py`。執行後將產生的 `.asm` 交給 nand2tetris 的 **CPU Emulator**；翻譯器本身不需先產生 `.hack`。

## 測試結果

使用 `C:\Users\tshes\Downloads\nand2tetris\tools` 裡的**官方 CPU Emulator**，將各範例產生的 `.asm` 搭配 `.tst`、`.cmp` 執行，**11 個案例全部通過**（`End of script - Comparison ended successfully`）：

| 章節 | 通過的案例 |
| --- | --- |
| 第 7 章 | SimpleAdd、StackTest、BasicTest、PointerTest、StaticTest |
| 第 8 章 | BasicLoop、FibonacciSeries、SimpleFunction、NestedCall、FibonacciElement、StaticsTest |

例如要自己重跑遞迴案例：

```powershell
python VMTranslator.py examples/08/FunctionCalls/FibonacciElement
& 'C:\Users\tshes\Downloads\nand2tetris\tools\CPUEmulator.bat' examples/08/FunctionCalls/FibonacciElement/FibonacciElement.tst
```

另附不依賴外部套件的自動測試，可在專案根目錄執行：

```powershell
python -m unittest discover -s tests -v
```

這組測試會檢查 11 個範例的記憶體結果，另測試有號比較邊界及無效指令。

網頁版的 JavaScript 單元測試（需要 Node.js）：

```powershell
cd site
npm test
```

## 檔案結構

```text
VMTranslator/
├── VMTranslator.py        # 翻譯器主程式
├── README.md              # 使用與驗證說明
├── site/                  # GitHub Pages 靜態網站及 JavaScript 轉譯核心
├── examples/
│   ├── 07/               # 第 7 章 VM 範例及官方 .tst/.cmp
│   └── 08/               # 第 8 章 VM 範例及官方 .tst/.cmp
└── tests/
    └── test_vmtranslator.py
```

`examples` 來自課程原始測試資料，保留作為可重現的驗證案例。產生的 `.asm`、`.out` 是執行結果，無須提交到 GitHub。

參考：[老師的第 11 週作業說明](https://github.com/ccc115a/_co/issues/16) · [nand2tetris Project 7](https://www.nand2tetris.org/project07) · [Project 8](https://www.nand2tetris.org/project08)
