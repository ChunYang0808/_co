const SYMBOL = /^[A-Za-z_.$:][A-Za-z0-9_.$:]*$/;
const ARITHMETIC = new Set(['add', 'sub', 'neg', 'eq', 'gt', 'lt', 'and', 'or', 'not']);
const BASE = { local: 'LCL', argument: 'ARG', this: 'THIS', that: 'THAT' };

export class VMError extends Error {
  constructor(message, file = '', line = 0) {
    super(message);
    this.name = 'VMError';
    this.file = file;
    this.line = line;
  }
}

export class CodeWriter {
  constructor() {
    this.lines = [];
    this.file = '';
    this.functionName = '';
    this.serial = 0;
  }

  emit(...lines) { this.lines.push(...lines); }
  unique(tag) { return `VM$INTERNAL.${tag}.${++this.serial}`; }
  pushD() { this.emit('@SP', 'A=M', 'M=D', '@SP', 'M=M+1'); }
  popD() { this.emit('@SP', 'AM=M-1', 'D=M'); }
  scope(label) { return `${this.functionName || this.file}$${label}`; }

  compare(op) {
    const yes = this.unique('TRUE');
    const end = this.unique('END');
    if (op === 'eq') {
      this.popD();
      this.emit('A=A-1', 'D=M-D', `@${yes}`, 'D;JEQ');
    } else {
      // Check signs before subtracting to avoid 16-bit signed overflow.
      const xneg = this.unique('XNEG');
      const same = this.unique('SAME');
      const no = this.unique('FALSE');
      this.popD();
      this.emit('@R13', 'M=D', '@SP', 'A=M-1', 'D=M', `@${xneg}`, 'D;JLT');
      this.emit('@R13', 'D=M', `@${op === 'gt' ? yes : no}`, 'D;JLT', `@${same}`, '0;JMP');
      this.emit(`(${xneg})`, '@R13', 'D=M', `@${op === 'gt' ? no : yes}`, 'D;JGE');
      this.emit(`(${same})`, '@SP', 'A=M-1', 'D=M', '@R13', 'D=D-M', `@${yes}`, `D;${op === 'gt' ? 'JGT' : 'JLT'}`);
      this.emit(`(${no})`);
    }
    this.emit('@SP', 'A=M-1', 'M=0', `@${end}`, '0;JMP', `(${yes})`, '@SP', 'A=M-1', 'M=-1', `(${end})`);
  }

  arithmetic(op) {
    if (op === 'neg' || op === 'not') {
      this.emit('@SP', 'A=M-1', op === 'neg' ? 'M=-M' : 'M=!M');
    } else if (['add', 'sub', 'and', 'or'].includes(op)) {
      const expression = { add: 'D+M', sub: 'M-D', and: 'D&M', or: 'D|M' }[op];
      this.popD();
      this.emit('A=A-1', `M=${expression}`);
    } else {
      this.compare(op);
    }
  }

  memory(op, segment, index) {
    if (segment === 'constant') {
      if (op === 'pop') throw new VMError('constant 區段不能使用 pop');
      this.emit(`@${index}`, 'D=A');
      this.pushD();
    } else if (segment in BASE) {
      this.emit(`@${index}`, 'D=A', `@${BASE[segment]}`);
      if (op === 'push') {
        this.emit('A=D+M', 'D=M');
        this.pushD();
      } else {
        this.emit('D=D+M', '@R13', 'M=D');
        this.popD();
        this.emit('@R13', 'A=M', 'M=D');
      }
    } else {
      const address = segment === 'temp' ? `R${index + 5}` : segment === 'pointer' ? (index === 0 ? 'THIS' : 'THAT') : `${this.file}.${index}`;
      if (op === 'push') {
        this.emit(`@${address}`, 'D=M');
        this.pushD();
      } else {
        this.popD();
        this.emit(`@${address}`, 'M=D');
      }
    }
  }

  call(name, args) {
    const ret = this.unique('RETURN');
    this.emit(`@${ret}`, 'D=A');
    this.pushD();
    for (const register of ['LCL', 'ARG', 'THIS', 'THAT']) {
      this.emit(`@${register}`, 'D=M');
      this.pushD();
    }
    this.emit('@SP', 'D=M', '@5', 'D=D-A', `@${args}`, 'D=D-A', '@ARG', 'M=D');
    this.emit('@SP', 'D=M', '@LCL', 'M=D', `@${name}`, '0;JMP', `(${ret})`);
  }

  returnCommand() {
    this.emit('@LCL', 'D=M', '@R13', 'M=D', '@5', 'A=D-A', 'D=M', '@R14', 'M=D');
    this.popD();
    this.emit('@ARG', 'A=M', 'M=D', '@ARG', 'D=M+1', '@SP', 'M=D');
    for (const register of ['THAT', 'THIS', 'ARG', 'LCL']) {
      this.emit('@R13', 'AM=M-1', 'D=M', `@${register}`, 'M=D');
    }
    this.emit('@R14', 'A=M', '0;JMP');
  }

  bootstrap() {
    this.emit('// bootstrap: SP=256, call Sys.init', '@256', 'D=A', '@SP', 'M=D');
    this.call('Sys.init', 0);
  }

  command(parts) {
    const [op, first, second] = parts;
    if (ARITHMETIC.has(op) && parts.length === 1) {
      this.arithmetic(op);
    } else if (['push', 'pop'].includes(op) && parts.length === 3) {
      if (!(first in BASE) && !['constant', 'temp', 'pointer', 'static'].includes(first)) throw new VMError(`未知的記憶體區段：${first}`);
      if (!/^\d+$/.test(second) || Number(second) > 32767) throw new VMError('索引必須是 0 到 32767 的整數');
      const index = Number(second);
      if (first === 'temp' && index > 7 || first === 'pointer' && index > 1) throw new VMError(`${first} 索引超出範圍：${index}`);
      this.memory(op, first, index);
    } else if (['label', 'goto', 'if-goto'].includes(op) && parts.length === 2) {
      if (!SYMBOL.test(first) || first.startsWith('VM$INTERNAL.')) throw new VMError(`無效的標籤：${first}`);
      const target = this.scope(first);
      if (op === 'label') this.emit(`(${target})`);
      else if (op === 'goto') this.emit(`@${target}`, '0;JMP');
      else { this.popD(); this.emit(`@${target}`, 'D;JNE'); }
    } else if (['function', 'call'].includes(op) && parts.length === 3) {
      if (!SYMBOL.test(first) || first.startsWith('VM$INTERNAL.')) throw new VMError(`無效的函式名稱：${first}`);
      if (!/^\d+$/.test(second) || Number(second) > 32767) throw new VMError('數量必須是 0 到 32767 的整數');
      const count = Number(second);
      if (op === 'call') this.call(first, count);
      else {
        this.functionName = first;
        this.emit(`(${first})`);
        for (let i = 0; i < count; i++) { this.emit('@0', 'D=A'); this.pushD(); }
      }
    } else if (op === 'return' && parts.length === 1) {
      this.returnCommand();
    } else {
      throw new VMError(`未知或格式錯誤的指令：${parts.join(' ')}`);
    }
  }

  translateFile(name, source) {
    this.file = name.replace(/\.vm$/i, '');
    this.functionName = '';
    if (!SYMBOL.test(this.file) || this.file.startsWith('VM$INTERNAL.')) throw new VMError(`無效的檔名：${name}`, name, 0);
    const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
    let commands = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].split('//', 1)[0].trim();
      if (!line) continue;
      try { this.command(line.split(/\s+/)); commands++; }
      catch (error) {
        if (error instanceof VMError) throw new VMError(error.message, name, i + 1);
        throw error;
      }
    }
    return commands;
  }
}

export function translateFiles(files, bootstrap = 'auto') {
  if (!Array.isArray(files) || files.length === 0) throw new VMError('請先新增至少一個 .vm 檔案');
  const seen = new Set();
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.vm')) throw new VMError(`僅支援 .vm 檔案：${file.name}`);
    const key = file.name.toLowerCase();
    if (seen.has(key)) throw new VMError(`檔名重複：${file.name}`);
    seen.add(key);
  }
  const writer = new CodeWriter();
  const hasSys = files.some(file => /^\s*function\s+Sys\.init\s+\d+(?=\s|\/\/|$)/m.test(file.content));
  const withBootstrap = bootstrap === 'on' || (bootstrap === 'auto' && hasSys);
  if (withBootstrap) writer.bootstrap();
  let commands = 0;
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name, 'en'))) commands += writer.translateFile(file.name, file.content);
  return { asm: writer.lines.join('\n') + '\n', commands, bootstrap: withBootstrap, instructions: writer.lines.filter(line => line && !line.startsWith('//') && !line.startsWith('(')).length };
}
