## Nand2Tetris Hack Assembler
---
## 實作內容

| 功能 | 說明 |
| --- | --- |
| A 指令 | `@數字` 或 `@符號`，輸出最高位元為 0 的 16 位元指令 |
| C 指令 | `dest=comp;jump`，依 Hack 規格編碼 `comp`、`dest`、`jump`；可省略 `dest=` 或 `;jump` |
| 標籤 | `(LOOP)` 代表下一個指令的 ROM 位址，支援向前參照 |
| 變數 | 第一次使用的符號從 RAM[16] 開始依序配置 |
| 預設符號 | `R0`～`R15`、`SP`、`LCL`、`ARG`、`THIS`、`THAT`、`SCREEN`、`KBD` |
| 輸入整理 | 忽略空白和 `//` 註解；錯誤訊息指出原始碼行號 |

程式採**兩遍掃描**：第一遍記錄標籤位址，第二遍配置變數並輸出機器碼。標籤與註解不佔 ROM 指令位址。若輸入有錯，程式不會覆寫既有的 `.hack` 檔。

## 如何使用

在專案根目錄開啟 PowerShell 或終端機：

```powershell
python assembler.py examples/add/Add.asm
```

預設在來源檔旁產生同名檔案 `examples/add/Add.hack`。也可用 `-o` 指定輸出位置：

```powershell
python assembler.py examples/max/Max.asm -o Max.hack
```

如果 Windows 找不到 `python` 指令，可改用 `py`。輸入檔必須以 `.asm` 結尾。

### 輸入與輸出範例

`Add.asm` 的組語：

```asm
@2
D=A
@3
D=D+A
@0
M=D
```

對應的 `Add.hack`：

```text
0000000000000010
1110110000010000
0000000000000011
1110000010010000
0000000000000000
1110001100001000
```

此程式會將 `2 + 3` 的結果寫入 `RAM[0]`。

## 專案檔案

```text
Week10-nand2tetris-Hack-Assembler/
├── assembler.py             # 組譯器與命令列入口
├── README.md                # 作業說明
├── examples/                # 從第六週作業複製的官方組語與產生的機器碼
│   ├── add/                 # Add.asm / Add.hack
│   ├── max/                 # Max.asm、MaxL.asm 與 .hack
│   ├── rect/                # Rect.asm、RectL.asm 與 .hack
│   └── pong/                # Pong.asm、PongL.asm 與 .hack
└── tests/test_assembler.py  # 自動測試
```

`examples` 的 `.asm` 檔案複製自第六週的 `06` 資料夾；原本的第六週作業沒有修改。

## 測試結果

在專案根目錄執行：

```powershell
python -m unittest discover -s tests -v
```

| 第六週範例 | 輸出指令數 | 驗證 |
| --- | ---: | --- |
| Add | 6 | 對照已知機器碼 |
| Max / MaxL | 16 | 兩種組語輸出一致 |
| Rect / RectL | 25 | 兩種組語輸出一致 |
| Pong / PongL | 27,483 | 兩種組語輸出一致 |

測試亦涵蓋所有 `comp`、`dest`、`jump` 編碼、標籤、變數、預設符號、命令列輸出及錯誤處理。`.hack` 檔可進一步載入 nand2tetris CPU Emulator 執行。


