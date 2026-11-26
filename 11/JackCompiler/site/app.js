import {compileFiles, JackError} from './jack-compiler.js';

const $ = id => document.getElementById(id);
const starter = `// Project 11 · Seven\nclass Main {\n  function void main() {\n    do Output.printInt(1 + (2 * 3));\n    return;\n  }\n}\n`;
const samples = {
  seven: [{name:'Main.jack',content:starter}],
  array: [{name:'Main.jack',content:`class Main {\n  function void main() {\n    var Array numbers;\n    let numbers = Array.new(2);\n    let numbers[0] = 7;\n    let numbers[1] = 5;\n    do Output.printInt(numbers[0] + numbers[1]);\n    return;\n  }\n}\n`}],
  square: [
    {name:'Main.jack',content:`class Main {\n  function void main() {\n    var Counter c;\n    let c = Counter.new();\n    do c.add(7);\n    do Output.printInt(c.value());\n    return;\n  }\n}\n`},
    {name:'Counter.jack',content:`class Counter {\n  field int total;\n  constructor Counter new() {\n    let total = 0;\n    return this;\n  }\n  method void add(int amount) {\n    let total = total + amount;\n    return;\n  }\n  method int value() {\n    return total;\n  }\n}\n`}
  ]
};
const state = {files: samples.seven.map(x=>({...x})),active:'Main.jack',outputs:[]};
const lines = value => Array.from({length:Math.max(1,value.split('\n').length)},(_,i)=>i+1).join('\n');
function message(text,kind='') {$('message').className=`message ${kind}`;$('message-text').textContent=text;}
function activeFile() {return state.files.find(f=>f.name===state.active);}
function activeOutput() {return state.outputs.find(f=>f.name===state.active.replace(/\.jack$/i,'.vm'));}
function updateOutput() {
  const output=activeOutput(); const value=output?.content||'';
  $('vm-output').value=value;$('output-lines').textContent=lines(value);
  $('output-lines-count').textContent=`${value?value.trimEnd().split('\n').length:0} 行`;
  $('output-name').textContent=output?.name||'等待編譯';
  $('output-status').textContent=output?'編譯成功':'尚未產生結果';
  $('copy-button').disabled=!output;$('download-button').disabled=!output;$('download-all-button').disabled=!state.outputs.length;
}
function tabs() {
  const box=$('file-tabs');box.replaceChildren();
  for(const file of state.files) {
    const tab=document.createElement('button');tab.type='button';tab.className='file-tab'+(file.name===state.active?' active':'');tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(file.name===state.active));tab.textContent=file.name;
    tab.addEventListener('click',()=>{state.active=file.name;refresh();});
    if(state.files.length>1){const close=document.createElement('span');close.className='tab-remove';close.textContent='×';close.title=`移除 ${file.name}`;close.addEventListener('click',event=>{event.stopPropagation();state.files=state.files.filter(x=>x!==file);if(state.active===file.name)state.active=state.files[0].name;stale();refresh();});tab.append(close);}
    box.append(tab);
  }
}
function refresh() {const file=activeFile();$('jack-input').value=file?.content||'';$('input-lines').textContent=lines($('jack-input').value);$('input-lines-count').textContent=`${$('jack-input').value.split('\n').length} 行`;$('input-status').textContent=file?.name||'就緒';$('file-count').textContent=`${state.files.length} 個檔案`;tabs();updateOutput();}
function stale(){state.outputs=[];updateOutput();message('原始碼已更新，請重新編譯。');}
function useSample(key){state.files=samples[key].map(x=>({...x}));state.active=state.files[0].name;stale();refresh();message(`已載入 ${key==='seven'?'Seven':key==='array'?'陣列':'物件'} 範例。`);}
function compile(){
  try{state.outputs=compileFiles(state.files);updateOutput();message(`編譯完成：${state.files.length} 個 Jack 檔，產生 ${state.outputs.length} 個 VM 檔。`,'success');}
  catch(error){state.outputs=[];if(error.file){state.active=error.file;refresh();if(error.line){const source=$('jack-input').value.split('\n');const start=source.slice(0,error.line-1).join('\n').length+(error.line>1?1:0);$('jack-input').focus();$('jack-input').setSelectionRange(start,start+(source[error.line-1]?.length||0));}}updateOutput();message(`${error.file||state.active}${error.line?`:${error.line}`:''} · ${error.message}`,'error');}
}
async function importFiles(list){
  const incoming=[...list].filter(f=>f.name.toLowerCase().endsWith('.jack'));
  if(!incoming.length){message('找不到 .jack 檔案。','error');return;}
  if(incoming.length>50||incoming.some(f=>f.size>1024*1024)){message('一次最多匯入 50 個 Jack 檔，每個檔案上限 1 MB。','error');return;}
  const data=await Promise.all(incoming.map(async f=>({name:f.name,content:await f.text()})));
  if(state.files.length===1&&state.files[0].content===starter)state.files=[];
  for(const file of data){const old=state.files.find(f=>f.name.toLowerCase()===file.name.toLowerCase());if(old)old.content=file.content;else state.files.push(file);}
  state.active=data[0].name;stale();refresh();message(`已匯入 ${data.length} 個 Jack 檔案。`);
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^-1)>>>0;}
function zipFiles(files){
  const enc=new TextEncoder(), parts=[],directory=[];let offset=0;
  for(const file of files){
    const name=enc.encode(file.name),data=enc.encode(file.content),crc=crc32(data);
    const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
    parts.push(local,data);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);
    offset+=local.length+data.length;
  }
  const dirLength=directory.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,dirLength,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...directory,end],{type:'application/zip'});
}
$('jack-input').addEventListener('input',e=>{activeFile().content=e.target.value;$('input-lines').textContent=lines(e.target.value);$('input-lines-count').textContent=`${e.target.value.split('\n').length} 行`;stale();});
$('jack-input').addEventListener('scroll',e=>{$('input-lines').scrollTop=e.target.scrollTop;});
$('vm-output').addEventListener('scroll',e=>{$('output-lines').scrollTop=e.target.scrollTop;});
$('jack-input').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();e.target.setRangeText('  ',e.target.selectionStart,e.target.selectionEnd,'end');e.target.dispatchEvent(new Event('input',{bubbles:true}));}});
$('compile-button').addEventListener('click',compile);
$('clear-button').addEventListener('click',()=>{if(!confirm('清空目前工作區？'))return;state.files=[{name:'Main.jack',content:''}];state.active='Main.jack';stale();refresh();});
$('add-file').addEventListener('click',()=>{let i=1;while(state.files.some(f=>f.name===`Untitled${i}.jack`))i++;const file={name:`Untitled${i}.jack`,content:''};state.files.push(file);state.active=file.name;stale();refresh();$('jack-input').focus();});
$('import-files').addEventListener('click',()=>$('files-input').click());$('import-folder').addEventListener('click',()=>$('folder-input').click());
for(const id of ['files-input','folder-input'])$(id).addEventListener('change',e=>{importFiles(e.target.files);e.target.value='';});
document.querySelectorAll('[data-sample]').forEach(b=>b.addEventListener('click',()=>useSample(b.dataset.sample)));
$('copy-button').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(activeOutput().content);}catch{$('vm-output').select();document.execCommand('copy');}message('VM 已複製。','success');});
$('download-button').addEventListener('click',()=>{const f=activeOutput();download(new Blob([f.content],{type:'text/plain;charset=utf-8'}),f.name);});
$('download-all-button').addEventListener('click',()=>download(zipFiles(state.outputs),'JackVM.zip'));
const drop=$('drop-zone');let depth=0;drop.addEventListener('dragenter',e=>{e.preventDefault();depth++;drop.classList.add('dragging');});drop.addEventListener('dragover',e=>e.preventDefault());drop.addEventListener('dragleave',e=>{e.preventDefault();if(--depth<=0){depth=0;drop.classList.remove('dragging');}});drop.addEventListener('drop',e=>{e.preventDefault();depth=0;drop.classList.remove('dragging');importFiles(e.dataTransfer.files);});
refresh();
