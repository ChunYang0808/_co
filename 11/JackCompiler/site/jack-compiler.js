// Project 11 Jack → VM compiler. No server or external packages required.
const keywords = new Set('class constructor function method field static var int char boolean void true false null this let do if else while return'.split(' '));
const symbols = new Set('{}()[].,;+-*/&|<>=~');
const ops = {'+':'add','-':'sub','*':'call Math.multiply 2','/':'call Math.divide 2','&':'and','|':'or','<':'lt','>':'gt','=':'eq'};
const segments = {static:'static',field:'this',arg:'argument',var:'local'};

export class JackError extends Error {
  constructor(message, line) { super(message); this.name = 'JackError'; this.line = line; }
}

export function tokenize(source) {
  const out = []; let i = 0, line = 1;
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) { if (c === '\n') line++; i++; continue; }
    if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new JackError('未結束的區塊註解', line);
      line += (source.slice(i, end + 2).match(/\n/g) || []).length; i = end + 2; continue;
    }
    if (c === '"') {
      const end = source.indexOf('"', i + 1);
      if (end < 0 || source.slice(i, end).includes('\n')) throw new JackError('未結束的字串', line);
      out.push({value: source.slice(i + 1, end), kind:'string', line}); i = end + 1; continue;
    }
    if (symbols.has(c)) { out.push({value:c, kind:'symbol', line}); i++; continue; }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+/.exec(source.slice(i))[0];
      if (+m > 32767) throw new JackError('整數不得超過 32767', line);
      out.push({value:m, kind:'integer', line}); i += m.length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(source.slice(i))[0];
      out.push({value:m, kind:keywords.has(m)?'keyword':'identifier', line}); i += m.length; continue;
    }
    throw new JackError(`不支援的字元 ${c}`, line);
  }
  out.push({value:'<EOF>',kind:'eof',line}); return out;
}

class Compiler {
  constructor(source) {
    this.tokens = tokenize(source); this.i = 0; this.out = []; this.name = ''; this.labelId = 0;
    this.classScope = new Map(); this.localScope = new Map(); this.counts = {static:0,field:0,arg:0,var:0};
  }
  get t() { return this.tokens[this.i]; }
  peek() { return this.tokens[this.i+1]?.value; }
  take(want, kind) {
    const t = this.t;
    if ((want && t.value !== want) || (kind && t.kind !== kind)) throw new JackError(`預期 ${want || kind}，實際是 ${t.value}`, t.line);
    this.i++; return t.value;
  }
  emit(s) { this.out.push(s); }
  label(stem) { return `${this.name}.${stem}.${this.labelId++}`; }
  type() { if (this.t.kind !== 'identifier' && !['int','char','boolean'].includes(this.t.value)) throw new JackError('預期型別', this.t.line); return this.take(); }
  define(name,type,kind) {
    const scope = ['static','field'].includes(kind) ? this.classScope : this.localScope;
    if (scope.has(name)) throw new JackError(`重複宣告 ${name}`,this.t.line);
    scope.set(name,{type,kind,index:this.counts[kind]++});
  }
  lookup(name) { const x = this.localScope.get(name) || this.classScope.get(name); if (!x) throw new JackError(`未定義變數 ${name}`,this.t.line); return x; }
  variable(name, action) { const x = this.lookup(name); this.emit(`${action} ${segments[x.kind]} ${x.index}`); }
  compile() {
    this.take('class'); this.name = this.take(null,'identifier'); this.take('{');
    while (['static','field'].includes(this.t.value)) {
      const kind=this.take(), type=this.type(); this.define(this.take(null,'identifier'),type,kind);
      while (this.t.value===',') { this.take(','); this.define(this.take(null,'identifier'),type,kind); } this.take(';');
    }
    while (['constructor','function','method'].includes(this.t.value)) this.subroutine();
    this.take('}'); this.take(null,'eof'); return this.out.join('\n')+'\n';
  }
  subroutine() {
    const kind=this.take(); this.localScope=new Map(); this.counts.arg=0; this.counts.var=0;
    if (kind==='method') this.define('this',this.name,'arg');
    if (this.t.value==='void') this.take('void'); else this.type();
    const name=this.take(null,'identifier'); this.take('(');
    if (this.t.value!==')') { do { const type=this.type(); this.define(this.take(null,'identifier'),type,'arg'); if (this.t.value!==',') break; this.take(','); } while (true); }
    this.take(')'); this.take('{');
    while (this.t.value==='var') { this.take('var'); const type=this.type(); this.define(this.take(null,'identifier'),type,'var'); while(this.t.value===',') {this.take(',');this.define(this.take(null,'identifier'),type,'var');} this.take(';'); }
    this.emit(`function ${this.name}.${name} ${this.counts.var}`);
    if (kind==='constructor') {this.emit(`push constant ${this.counts.field}`);this.emit('call Memory.alloc 1');this.emit('pop pointer 0');}
    if (kind==='method') {this.emit('push argument 0');this.emit('pop pointer 0');}
    this.statements();this.take('}');
  }
  statements() { while(['let','if','while','do','return'].includes(this.t.value)) this['statement_'+this.t.value](); }
  statement_let() {
    this.take('let'); const name=this.take(null,'identifier'), array=this.t.value==='[';
    if(array) {this.variable(name,'push');this.take('[');this.expression();this.take(']');this.emit('add');}
    this.take('=');this.expression();this.take(';');
    if(array) this.out.push('pop temp 0','pop pointer 1','push temp 0','pop that 0'); else this.variable(name,'pop');
  }
  statement_if() {
    this.take('if');this.take('(');this.expression();this.take(')'); const no=this.label('IF_FALSE'),end=this.label('IF_END');
    this.emit('not');this.emit(`if-goto ${no}`);this.take('{');this.statements();this.take('}');
    if(this.t.value==='else') {this.emit(`goto ${end}`);this.emit(`label ${no}`);this.take('else');this.take('{');this.statements();this.take('}');this.emit(`label ${end}`);}
    else this.emit(`label ${no}`);
  }
  statement_while() {
    this.take('while');const start=this.label('WHILE_EXP'),end=this.label('WHILE_END');this.emit(`label ${start}`);
    this.take('(');this.expression();this.take(')');this.emit('not');this.emit(`if-goto ${end}`);
    this.take('{');this.statements();this.take('}');this.emit(`goto ${start}`);this.emit(`label ${end}`);
  }
  statement_do() {this.take('do');this.call();this.take(';');this.emit('pop temp 0');}
  statement_return() {this.take('return');if(this.t.value===';')this.emit('push constant 0');else this.expression();this.take(';');this.emit('return');}
  expression() {this.term();while(Object.hasOwn(ops,this.t.value)){const op=this.take();this.term();this.emit(ops[op]);}}
  term() {
    const t=this.t;
    if(t.kind==='integer') this.emit(`push constant ${this.take()}`);
    else if(t.kind==='string') {const s=this.take();this.emit(`push constant ${s.length}`);this.emit('call String.new 1');for(const c of s){this.emit(`push constant ${c.charCodeAt(0)}`);this.emit('call String.appendChar 2');}}
    else if(['true','false','null','this'].includes(t.value)){const x=this.take();this.emit(x==='this'?'push pointer 0':'push constant 0');if(x==='true')this.emit('not');}
    else if(t.value==='('){this.take('(');this.expression();this.take(')');}
    else if(['-','~'].includes(t.value)){const x=this.take();this.term();this.emit(x==='-'?'neg':'not');}
    else if(t.kind==='identifier') {
      if(['(','.'].includes(this.peek())) this.call();
      else {const name=this.take(null,'identifier');this.variable(name,'push');if(this.t.value==='['){this.take('[');this.expression();this.take(']');this.out.push('add','pop pointer 1','push that 0');}}
    } else throw new JackError(`預期運算式，實際是 ${t.value}`,t.line);
  }
  call() {
    let target=this.take(null,'identifier'),n=0;
    if(this.t.value==='.') {this.take('.');const sub=this.take(null,'identifier'),x=this.localScope.get(target)||this.classScope.get(target);if(x){this.variable(target,'push');n=1;target=x.type;}target+=`.${sub}`;}
    else {this.emit('push pointer 0');n=1;target=`${this.name}.${target}`;}
    this.take('(');if(this.t.value!==')'){do{this.expression();n++;if(this.t.value!==',')break;this.take(',');}while(true);}this.take(')');this.emit(`call ${target} ${n}`);
  }
}

export function compileJack(source) { return new Compiler(source).compile(); }
export function compileFiles(files) {
  const outputs=[];
  for(const file of files){try{outputs.push({name:file.name.replace(/\.jack$/i,'.vm'),content:compileJack(file.content)});}catch(error){error.file=file.name;throw error;}}
  return outputs;
}
