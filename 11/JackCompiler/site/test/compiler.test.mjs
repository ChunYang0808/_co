import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {compileJack,compileFiles,JackError} from '../jack-compiler.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'../../..');

test('all Project 11 files match the Python compiler output',()=>{
  let count=0;
  for(const dir of readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory())){
    for(const name of readdirSync(join(root,dir.name)).filter(x=>x.endsWith('.jack'))){
      const path=join(root,dir.name,name);
      assert.equal(compileJack(readFileSync(path,'utf8')),readFileSync(path.replace(/\.jack$/,'.vm'),'utf8').replace(/\r\n/g,'\n'),path);
      count++;
    }
  }
  assert.equal(count,11);
});

test('multi-file compilation returns one VM file per Jack class',()=>{
  const files=[{name:'A.jack',content:'class A { function void f() { return; } }'},{name:'B.jack',content:'class B { function void g() { return; } }'}];
  assert.deepEqual(compileFiles(files).map(x=>x.name),['A.vm','B.vm']);
});

test('syntax errors include the source line',()=>{
  assert.throws(()=>compileJack('class A {\n function void f() { let x = @; } }'),error=>error instanceof JackError&&error.line===2);
});
