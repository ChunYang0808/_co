import assert from 'node:assert/strict';
import test from 'node:test';
import { translateFiles, VMError } from '../vm-translator.js';

test('translates stack arithmetic and memory access', () => {
  const { asm, commands, bootstrap } = translateFiles([{ name: 'Simple.vm', content: 'push constant 7\npush constant 8\nadd\npop temp 0\n' }]);
  assert.equal(commands, 4);
  assert.equal(bootstrap, false);
  assert.match(asm, /@7\nD=A/);
  assert.match(asm, /M=D\+M/);
  assert.match(asm, /@R5\nM=D/);
});

test('scopes labels and static values per function and file', () => {
  const { asm } = translateFiles([
    { name: 'Class2.vm', content: 'function Class2.f 0\nlabel LOOP\npush static 0\ngoto LOOP' },
    { name: 'Class1.vm', content: 'function Class1.f 0\nlabel LOOP\npop static 0\ngoto LOOP' },
  ], 'off');
  assert.match(asm, /\(Class1\.f\$LOOP\)/);
  assert.match(asm, /\(Class2\.f\$LOOP\)/);
  assert.match(asm, /@Class1\.0/);
  assert.match(asm, /@Class2\.0/);
});

test('detects Sys.init for bootstrap and allows override', () => {
  const files = [{ name: 'Sys.vm', content: 'function Sys.init 0\nreturn' }];
  assert.equal(translateFiles(files).bootstrap, true);
  assert.equal(translateFiles(files, 'off').bootstrap, false);
  assert.match(translateFiles(files, 'on').asm, /^\/\/ bootstrap: SP=256/);
});

test('reports file and line for invalid input', () => {
  assert.throws(() => translateFiles([{ name: 'Broken.vm', content: 'push constant 7\npush pointer 2' }]), error => {
    assert.ok(error instanceof VMError);
    assert.equal(error.file, 'Broken.vm');
    assert.equal(error.line, 2);
    return true;
  });
});

test('uses overflow-safe signed comparisons', () => {
  const { asm } = translateFiles([{ name: 'Compare.vm', content: 'push constant 32767\npush constant 1\ngt' }]);
  assert.match(asm, /VM\$INTERNAL\.XNEG/);
  assert.match(asm, /D;JLT/);
});
