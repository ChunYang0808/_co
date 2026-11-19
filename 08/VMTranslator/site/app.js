import { translateFiles, VMError } from './vm-translator.js';

const $ = id => document.getElementById(id);
const state = { files: [{ name: 'Main.vm', content: '// 在這裡輸入 VM 指令，或點選上方範例\npush constant 7\npush constant 8\nadd\n' }], active: 'Main.vm', output: '', outputName: 'Main.asm', project: '' };

const samples = {
  simple: [{ name: 'SimpleAdd.vm', content: '// SimpleAdd: 7 + 8 = 15\npush constant 7\npush constant 8\nadd\n' }],
  fibonacci: [
    { name: 'Main.vm', content: `// Recursive Fibonacci
function Main.fibonacci 0
push argument 0
push constant 2
lt
if-goto N_LT_2
goto N_GE_2
label N_LT_2
push argument 0
return
label N_GE_2
push argument 0
push constant 2
sub
call Main.fibonacci 1
push argument 0
push constant 1
sub
call Main.fibonacci 1
add
return
` },
    { name: 'Sys.vm', content: `// Start with fibonacci(4)
function Sys.init 0
push constant 4
call Main.fibonacci 1
label END
goto END
` },
  ],
};

function countLines(value) { return value ? value.split('\n').length : 1; }
function lineNumbers(value) { return Array.from({ length: countLines(value) }, (_, i) => i + 1).join('\n'); }
function setMessage(message, type = '') {
  $('message').className = `message ${type}`;
  $('message-text').textContent = message;
}
function activeFile() { return state.files.find(file => file.name === state.active); }
function refreshInput() {
  const file = activeFile();
  $('vm-input').value = file?.content ?? '';
  $('input-lines').textContent = lineNumbers($('vm-input').value);
  $('input-lines-count').textContent = `${countLines($('vm-input').value)} 行`;
  $('input-status').textContent = file?.name ?? '就緒';
  $('file-count').textContent = `${state.files.length} 個檔案`;
  renderTabs();
}
function renderTabs() {
  const container = $('file-tabs');
  container.replaceChildren();
  for (const file of state.files) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `file-tab${file.name === state.active ? ' active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', file.name === state.active ? 'true' : 'false');
    tab.textContent = file.name;
    tab.addEventListener('click', () => { state.active = file.name; refreshInput(); });
    if (state.files.length > 1) {
      const close = document.createElement('span');
      close.className = 'tab-remove';
      close.title = `移除 ${file.name}`;
      close.setAttribute('aria-label', `移除 ${file.name}`);
      close.textContent = '×';
      close.addEventListener('click', event => {
        event.stopPropagation();
        state.files = state.files.filter(item => item !== file);
        if (state.active === file.name) state.active = state.files[0].name;
        state.project = '';
        markStale();
        refreshInput();
      });
      tab.append(close);
    }
    container.append(tab);
  }
}
function markStale() {
  if (state.output) {
    state.output = '';
    $('asm-output').value = '';
    $('output-lines').textContent = '1';
    $('output-lines-count').textContent = '0 行';
    $('output-status').textContent = '程式已修改，請重新轉譯';
    $('output-name').textContent = '等待轉譯';
    $('copy-button').disabled = true;
    $('download-button').disabled = true;
  }
  setMessage('程式已更新，按「轉譯成 ASM」產生新結果。');
}
function useSample(key) {
  state.files = samples[key].map(file => ({ ...file }));
  state.active = state.files[0].name;
  state.project = key === 'fibonacci' ? 'FibonacciElement' : '';
  $('bootstrap').value = 'auto';
  markStale();
  refreshInput();
  setMessage(key === 'fibonacci' ? '已載入遞迴 Fibonacci 範例（Main.vm + Sys.vm）。' : '已載入 SimpleAdd 範例。');
}
function translate() {
  try {
    const result = translateFiles(state.files, $('bootstrap').value);
    state.output = result.asm;
    state.outputName = state.project ? `${state.project}.asm` : state.files.length === 1 ? state.files[0].name.replace(/\.vm$/i, '.asm') : 'VMProgram.asm';
    $('asm-output').value = result.asm;
    $('output-lines').textContent = lineNumbers(result.asm);
    $('output-lines-count').textContent = `${result.asm.trimEnd().split('\n').length} 行`;
    $('output-name').textContent = state.outputName;
    $('output-status').textContent = `${result.instructions} 條 Hack 指令`;
    $('copy-button').disabled = false;
    $('download-button').disabled = false;
    setMessage(`轉譯成功：${result.commands} 條 VM 指令 · ${state.files.length} 個檔案 · Bootstrap ${result.bootstrap ? '已加入' : '未加入'}`, 'success');
  } catch (error) {
    state.output = '';
    $('asm-output').value = '';
    $('copy-button').disabled = true;
    $('download-button').disabled = true;
    $('output-name').textContent = '轉譯失敗';
    $('output-status').textContent = '請修正左側指令';
    if (error instanceof VMError && error.file) {
      state.active = error.file;
      refreshInput();
      if (error.line) {
        const lines = $('vm-input').value.split('\n');
        const start = lines.slice(0, error.line - 1).join('\n').length + (error.line > 1 ? 1 : 0);
        $('vm-input').focus();
        $('vm-input').setSelectionRange(start, start + lines[error.line - 1].length);
      }
    }
    setMessage(`${error.file ? `${error.file}${error.line ? `:${error.line}` : ''} · ` : ''}${error.message}`, 'error');
  }
}
async function importVMFiles(fileList) {
  const incoming = Array.from(fileList).filter(file => file.name.toLowerCase().endsWith('.vm'));
  if (!incoming.length) { setMessage('找不到 .vm 檔案。請選取 VM 程式檔。', 'error'); return; }
  if (incoming.length > 50 || incoming.some(file => file.size > 1024 * 1024)) { setMessage('一次最多匯入 50 個 .vm 檔，每個檔案上限 1 MB。', 'error'); return; }
  const folder = incoming[0].webkitRelativePath?.split('/')[0];
  const contents = await Promise.all(incoming.map(async file => ({ name: file.name, content: await file.text() })));
  if (state.files.length === 1 && state.files[0].name === 'Main.vm' && state.files[0].content.startsWith('// 在這裡輸入')) state.files = [];
  for (const file of contents) {
    const existing = state.files.find(item => item.name.toLowerCase() === file.name.toLowerCase());
    if (existing) existing.content = file.content;
    else state.files.push(file);
  }
  state.active = contents[0].name;
  state.project = folder || '';
  markStale();
  refreshInput();
  setMessage(`已匯入 ${contents.length} 個 .vm 檔案。`);
}

$('vm-input').addEventListener('input', event => {
  activeFile().content = event.target.value;
  $('input-lines').textContent = lineNumbers(event.target.value);
  $('input-lines-count').textContent = `${countLines(event.target.value)} 行`;
  markStale();
});
$('vm-input').addEventListener('scroll', event => { $('input-lines').scrollTop = event.target.scrollTop; });
$('asm-output').addEventListener('scroll', event => { $('output-lines').scrollTop = event.target.scrollTop; });
$('vm-input').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const field = event.target;
  const start = field.selectionStart;
  field.setRangeText('  ', start, field.selectionEnd, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
});
$('bootstrap').addEventListener('change', markStale);
$('translate-button').addEventListener('click', translate);
$('clear-button').addEventListener('click', () => {
  if (!window.confirm('清空目前工作區的 VM 程式與轉譯結果？')) return;
  state.files = [{ name: 'Main.vm', content: '' }];
  state.active = 'Main.vm';
  state.project = '';
  markStale();
  refreshInput();
  setMessage('工作區已清空。');
});
$('add-file').addEventListener('click', () => {
  let i = 1;
  while (state.files.some(file => file.name === `Untitled${i}.vm`)) i++;
  const file = { name: `Untitled${i}.vm`, content: '' };
  state.files.push(file);
  state.active = file.name;
  state.project = '';
  markStale();
  refreshInput();
  $('vm-input').focus();
});
$('import-files').addEventListener('click', () => $('files-input').click());
$('import-folder').addEventListener('click', () => $('folder-input').click());
$('files-input').addEventListener('change', event => { importVMFiles(event.target.files); event.target.value = ''; });
$('folder-input').addEventListener('change', event => { importVMFiles(event.target.files); event.target.value = ''; });
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => useSample(button.dataset.sample)));
$('copy-button').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(state.output); setMessage('ASM 已複製到剪貼簿。', 'success'); }
  catch { $('asm-output').select(); document.execCommand('copy'); setMessage('ASM 已複製到剪貼簿。', 'success'); }
});
$('download-button').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([state.output], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = state.outputName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage(`已下載 ${state.outputName}。`, 'success');
});

const dropZone = $('drop-zone');
let dragDepth = 0;
dropZone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragover', event => event.preventDefault());
dropZone.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; dropZone.classList.remove('dragging'); } });
dropZone.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; dropZone.classList.remove('dragging'); importVMFiles(event.dataTransfer.files); });

refreshInput();
