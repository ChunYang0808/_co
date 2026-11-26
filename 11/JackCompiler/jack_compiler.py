"""Compile nand2tetris Jack source files to stack VM code (Project 11)."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


KEYWORDS = set("class constructor function method field static var int char boolean void true false null this let do if else while return".split())
SYMBOLS = set("{}()[].,;+-*/&|<>=~")
OPS = {"+": "add", "-": "sub", "*": "call Math.multiply 2", "/": "call Math.divide 2", "&": "and", "|": "or", "<": "lt", ">": "gt", "=": "eq"}
KINDS = {"static": "static", "field": "this", "arg": "argument", "var": "local"}


@dataclass(frozen=True)
class Token:
    value: str
    kind: str
    line: int


def tokenize(source: str) -> list[Token]:
    tokens = []
    i = 0
    line = 1
    while i < len(source):
        c = source[i]
        if c.isspace():
            line += c == "\n"
            i += 1
        elif source.startswith("//", i):
            end = source.find("\n", i)
            i = len(source) if end < 0 else end
        elif source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise SyntaxError(f"line {line}: unterminated block comment")
            line += source[i:end + 2].count("\n")
            i = end + 2
        elif c == '"':
            end = source.find('"', i + 1)
            if end < 0 or "\n" in source[i:end]:
                raise SyntaxError(f"line {line}: unterminated string")
            tokens.append(Token(source[i + 1:end], "string", line))
            i = end + 1
        elif c in SYMBOLS:
            tokens.append(Token(c, "symbol", line))
            i += 1
        elif c.isdigit():
            end = i + 1
            while end < len(source) and source[end].isdigit():
                end += 1
            value = source[i:end]
            if int(value) > 32767:
                raise SyntaxError(f"line {line}: integer exceeds 32767")
            tokens.append(Token(value, "integer", line))
            i = end
        elif c.isalpha() or c == "_":
            end = i + 1
            while end < len(source) and (source[end].isalnum() or source[end] == "_"):
                end += 1
            value = source[i:end]
            tokens.append(Token(value, "keyword" if value in KEYWORDS else "identifier", line))
            i = end
        else:
            raise SyntaxError(f"line {line}: unexpected character {c!r}")
    tokens.append(Token("<EOF>", "eof", line))
    return tokens


class Symbols:
    def __init__(self) -> None:
        self.class_scope: dict[str, tuple[str, str, int]] = {}
        self.local_scope: dict[str, tuple[str, str, int]] = {}
        self.counts = {kind: 0 for kind in KINDS}

    def start_subroutine(self) -> None:
        self.local_scope = {}
        self.counts["arg"] = self.counts["var"] = 0

    def define(self, name: str, type_: str, kind: str) -> None:
        scope = self.class_scope if kind in ("static", "field") else self.local_scope
        if name in scope:
            raise SyntaxError(f"duplicate declaration: {name}")
        scope[name] = (type_, kind, self.counts[kind])
        self.counts[kind] += 1

    def get(self, name: str) -> tuple[str, str, int]:
        if name in self.local_scope:
            return self.local_scope[name]
        if name in self.class_scope:
            return self.class_scope[name]
        raise SyntaxError(f"undefined variable: {name}")


class Compiler:
    def __init__(self, source: str) -> None:
        self.tokens = tokenize(source)
        self.pos = 0
        self.output: list[str] = []
        self.symbols = Symbols()
        self.class_name = ""
        self.label_number = 0

    @property
    def token(self) -> Token:
        return self.tokens[self.pos]

    def peek(self, offset: int = 1) -> str:
        return self.tokens[self.pos + offset].value

    def take(self, expected: str | None = None, kind: str | None = None) -> str:
        token = self.token
        if (expected is not None and token.value != expected) or (kind is not None and token.kind != kind):
            raise SyntaxError(f"line {token.line}: expected {expected or kind}, got {token.value!r}")
        self.pos += 1
        return token.value

    def emit(self, command: str) -> None:
        self.output.append(command)

    def label(self, stem: str) -> str:
        result = f"{self.class_name}.{stem}.{self.label_number}"
        self.label_number += 1
        return result

    def push_var(self, name: str) -> None:
        _, kind, index = self.symbols.get(name)
        self.emit(f"push {KINDS[kind]} {index}")

    def pop_var(self, name: str) -> None:
        _, kind, index = self.symbols.get(name)
        self.emit(f"pop {KINDS[kind]} {index}")

    def type_name(self) -> str:
        if self.token.kind != "identifier" and self.token.value not in ("int", "char", "boolean"):
            raise SyntaxError(f"line {self.token.line}: expected type")
        return self.take()

    def compile(self) -> str:
        self.take("class")
        self.class_name = self.take(kind="identifier")
        self.take("{")
        while self.token.value in ("static", "field"):
            kind = self.take()
            type_ = self.type_name()
            self.symbols.define(self.take(kind="identifier"), type_, kind)
            while self.token.value == ",":
                self.take(",")
                self.symbols.define(self.take(kind="identifier"), type_, kind)
            self.take(";")
        while self.token.value in ("constructor", "function", "method"):
            self.subroutine()
        self.take("}")
        self.take(kind="eof")
        return "\n".join(self.output) + "\n"

    def subroutine(self) -> None:
        kind = self.take()
        self.symbols.start_subroutine()
        if kind == "method":
            self.symbols.define("this", self.class_name, "arg")
        if self.token.value == "void":
            self.take("void")
        else:
            self.type_name()
        name = self.take(kind="identifier")
        self.take("(")
        if self.token.value != ")":
            while True:
                type_ = self.type_name()
                self.symbols.define(self.take(kind="identifier"), type_, "arg")
                if self.token.value != ",":
                    break
                self.take(",")
        self.take(")")
        self.take("{")
        while self.token.value == "var":
            self.take("var")
            type_ = self.type_name()
            self.symbols.define(self.take(kind="identifier"), type_, "var")
            while self.token.value == ",":
                self.take(",")
                self.symbols.define(self.take(kind="identifier"), type_, "var")
            self.take(";")
        self.emit(f"function {self.class_name}.{name} {self.symbols.counts['var']}")
        if kind == "constructor":
            self.emit(f"push constant {self.symbols.counts['field']}")
            self.emit("call Memory.alloc 1")
            self.emit("pop pointer 0")
        elif kind == "method":
            self.emit("push argument 0")
            self.emit("pop pointer 0")
        self.statements()
        self.take("}")

    def statements(self) -> None:
        while self.token.value in ("let", "if", "while", "do", "return"):
            getattr(self, "statement_" + self.token.value)()

    def statement_let(self) -> None:
        self.take("let")
        name = self.take(kind="identifier")
        array = self.token.value == "["
        if array:
            self.push_var(name)
            self.take("[")
            self.expression()
            self.take("]")
            self.emit("add")
        self.take("=")
        self.expression()
        self.take(";")
        if array:
            self.emit("pop temp 0")
            self.emit("pop pointer 1")
            self.emit("push temp 0")
            self.emit("pop that 0")
        else:
            self.pop_var(name)

    def statement_if(self) -> None:
        self.take("if")
        self.take("(")
        self.expression()
        self.take(")")
        false_label = self.label("IF_FALSE")
        end_label = self.label("IF_END")
        self.emit("not")
        self.emit(f"if-goto {false_label}")
        self.take("{")
        self.statements()
        self.take("}")
        if self.token.value == "else":
            self.emit(f"goto {end_label}")
            self.emit(f"label {false_label}")
            self.take("else")
            self.take("{")
            self.statements()
            self.take("}")
            self.emit(f"label {end_label}")
        else:
            self.emit(f"label {false_label}")

    def statement_while(self) -> None:
        self.take("while")
        start = self.label("WHILE_EXP")
        end = self.label("WHILE_END")
        self.emit(f"label {start}")
        self.take("(")
        self.expression()
        self.take(")")
        self.emit("not")
        self.emit(f"if-goto {end}")
        self.take("{")
        self.statements()
        self.take("}")
        self.emit(f"goto {start}")
        self.emit(f"label {end}")

    def statement_do(self) -> None:
        self.take("do")
        self.call()
        self.take(";")
        self.emit("pop temp 0")

    def statement_return(self) -> None:
        self.take("return")
        if self.token.value == ";":
            self.emit("push constant 0")
        else:
            self.expression()
        self.take(";")
        self.emit("return")

    def expression(self) -> None:
        self.term()
        while self.token.value in OPS:
            op = self.take()
            self.term()
            self.emit(OPS[op])

    def term(self) -> None:
        token = self.token
        if token.kind == "integer":
            self.emit(f"push constant {self.take()}")
        elif token.kind == "string":
            value = self.take()
            self.emit(f"push constant {len(value)}")
            self.emit("call String.new 1")
            for char in value:
                if ord(char) > 32767:
                    raise SyntaxError(f"line {token.line}: character outside Jack range")
                self.emit(f"push constant {ord(char)}")
                self.emit("call String.appendChar 2")
        elif token.value in ("true", "false", "null", "this"):
            value = self.take()
            self.emit("push pointer 0" if value == "this" else "push constant 0")
            if value == "true":
                self.emit("not")
        elif token.value == "(":
            self.take("(")
            self.expression()
            self.take(")")
        elif token.value in ("-", "~"):
            op = self.take()
            self.term()
            self.emit("neg" if op == "-" else "not")
        elif token.kind == "identifier":
            if self.peek() in ("(", "."):
                self.call()
            else:
                name = self.take(kind="identifier")
                self.push_var(name)
                if self.token.value == "[":
                    self.take("[")
                    self.expression()
                    self.take("]")
                    self.emit("add")
                    self.emit("pop pointer 1")
                    self.emit("push that 0")
        else:
            raise SyntaxError(f"line {token.line}: expected expression, got {token.value!r}")

    def call(self) -> None:
        target = self.take(kind="identifier")
        args = 0
        if self.token.value == ".":
            self.take(".")
            subroutine = self.take(kind="identifier")
            try:
                type_, _, _ = self.symbols.get(target)
            except SyntaxError:
                type_ = target
            else:
                self.push_var(target)
                args = 1
            target = f"{type_}.{subroutine}"
        else:
            self.emit("push pointer 0")
            args = 1
            target = f"{self.class_name}.{target}"
        self.take("(")
        if self.token.value != ")":
            while True:
                self.expression()
                args += 1
                if self.token.value != ",":
                    break
                self.take(",")
        self.take(")")
        self.emit(f"call {target} {args}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="a .jack file or a directory of .jack files")
    args = parser.parse_args()
    path = args.path
    if path.is_file() and path.suffix.lower() == ".jack":
        files = [path]
    elif path.is_dir():
        files = sorted(path.glob("*.jack"))
    else:
        parser.error("path must be a .jack file or directory")
    if not files:
        parser.error("no .jack files found")
    compiled = []
    for file in files:
        try:
            compiled.append((file.with_suffix(".vm"), Compiler(file.read_text(encoding="utf-8-sig")).compile()))
        except (SyntaxError, UnicodeError) as exc:
            parser.exit(1, f"{file}: {exc}\n")
    for output, vm in compiled:
        output.write_text(vm, encoding="utf-8", newline="\n")
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
