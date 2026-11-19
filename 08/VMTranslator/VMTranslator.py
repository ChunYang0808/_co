#!/usr/bin/env python3
"""Translate nand2tetris VM code (projects 7 and 8) into Hack assembly."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys


SYMBOL = re.compile(r"[A-Za-z_.$:][A-Za-z0-9_.$:]*\Z")
ARITHMETIC = {"add", "sub", "neg", "eq", "gt", "lt", "and", "or", "not"}
BASE = {"local": "LCL", "argument": "ARG", "this": "THIS", "that": "THAT"}


class VMError(ValueError):
    pass


class CodeWriter:
    def __init__(self) -> None:
        self.lines: list[str] = []
        self.file = ""
        self.function = ""
        self.serial = 0

    def emit(self, *lines: str) -> None:
        self.lines.extend(lines)

    def unique(self, tag: str) -> str:
        self.serial += 1
        return f"VM$INTERNAL.{tag}.{self.serial}"

    def push_d(self) -> None:
        self.emit("@SP", "A=M", "M=D", "@SP", "M=M+1")

    def pop_d(self) -> None:
        self.emit("@SP", "AM=M-1", "D=M")

    def scope(self, label: str) -> str:
        # A file's global commands are scoped to the file; function labels to the function.
        return f"{self.function or self.file}${label}"

    def arithmetic(self, op: str) -> None:
        if op in ("neg", "not"):
            self.emit("@SP", "A=M-1", "M=-M" if op == "neg" else "M=!M")
        elif op in ("add", "sub", "and", "or"):
            expr = {"add": "D+M", "sub": "M-D", "and": "D&M", "or": "D|M"}[op]
            self.pop_d()
            self.emit("A=A-1", f"M={expr}")
        else:
            self.compare(op)

    def compare(self, op: str) -> None:
        true = self.unique("TRUE")
        end = self.unique("END")
        if op == "eq":
            self.pop_d()
            self.emit("A=A-1", "D=M-D", f"@{true}", "D;JEQ")
        else:
            # Subtracting two opposite-sign 16-bit values can overflow.
            # Compare signs first, then subtract only when signs match.
            xneg = self.unique("XNEG")
            same = self.unique("SAME")
            false = self.unique("FALSE")
            self.pop_d()  # y
            self.emit("@R13", "M=D", "@SP", "A=M-1", "D=M", f"@{xneg}", "D;JLT")
            self.emit("@R13", "D=M", f"@{true if op == 'gt' else false}", "D;JLT", f"@{same}", "0;JMP")
            self.emit(f"({xneg})", "@R13", "D=M", f"@{false if op == 'gt' else true}", "D;JGE")
            self.emit(f"({same})", "@SP", "A=M-1", "D=M", "@R13", "D=D-M", f"@{true}", f"D;{'JGT' if op == 'gt' else 'JLT'}")
            self.emit(f"({false})")
        self.emit("@SP", "A=M-1", "M=0", f"@{end}", "0;JMP", f"({true})", "@SP", "A=M-1", "M=-1", f"({end})")

    def memory(self, op: str, segment: str, index: int) -> None:
        if segment == "constant":
            if op == "pop":
                raise VMError("cannot pop constant")
            self.emit(f"@{index}", "D=A")
            self.push_d()
        elif segment in BASE:
            self.emit(f"@{index}", "D=A", f"@{BASE[segment]}")
            if op == "push":
                self.emit("A=D+M", "D=M")
                self.push_d()
            else:
                self.emit("D=D+M", "@R13", "M=D")
                self.pop_d()
                self.emit("@R13", "A=M", "M=D")
        else:
            if segment == "temp":
                addr = f"R{index + 5}"
            elif segment == "pointer":
                addr = "THIS" if index == 0 else "THAT"
            else:
                addr = f"{self.file}.{index}"
            if op == "push":
                self.emit(f"@{addr}", "D=M")
                self.push_d()
            else:
                self.pop_d()
                self.emit(f"@{addr}", "M=D")

    def call(self, function: str, args: int) -> None:
        ret = self.unique("RETURN")
        self.emit(f"@{ret}", "D=A")
        self.push_d()
        for register in ("LCL", "ARG", "THIS", "THAT"):
            self.emit(f"@{register}", "D=M")
            self.push_d()
        self.emit("@SP", "D=M", "@5", "D=D-A", f"@{args}", "D=D-A", "@ARG", "M=D")
        self.emit("@SP", "D=M", "@LCL", "M=D", f"@{function}", "0;JMP", f"({ret})")

    def return_(self) -> None:
        self.emit("@LCL", "D=M", "@R13", "M=D", "@5", "A=D-A", "D=M", "@R14", "M=D")
        self.pop_d()
        self.emit("@ARG", "A=M", "M=D", "@ARG", "D=M+1", "@SP", "M=D")
        for register in ("THAT", "THIS", "ARG", "LCL"):
            self.emit("@R13", "AM=M-1", "D=M", f"@{register}", "M=D")
        self.emit("@R14", "A=M", "0;JMP")

    def bootstrap(self) -> None:
        self.emit("// bootstrap: SP=256, call Sys.init", "@256", "D=A", "@SP", "M=D")
        self.call("Sys.init", 0)

    def command(self, parts: list[str]) -> None:
        op = parts[0]
        if op in ARITHMETIC and len(parts) == 1:
            self.arithmetic(op)
        elif op in ("push", "pop") and len(parts) == 3:
            segment = parts[1]
            if segment not in (*BASE, "constant", "temp", "pointer", "static"):
                raise VMError(f"unknown segment: {segment}")
            if not parts[2].isdecimal() or int(parts[2]) > 32767:
                raise VMError("index must be an integer from 0 to 32767")
            index = int(parts[2])
            if segment == "temp" and index > 7 or segment == "pointer" and index > 1:
                raise VMError(f"invalid {segment} index: {index}")
            self.memory(op, segment, index)
        elif op in ("label", "goto", "if-goto") and len(parts) == 2:
            label = parts[1]
            if not SYMBOL.fullmatch(label) or label.startswith("VM$INTERNAL."):
                raise VMError(f"invalid label: {label}")
            target = self.scope(label)
            if op == "label":
                self.emit(f"({target})")
            elif op == "goto":
                self.emit(f"@{target}", "0;JMP")
            else:
                self.pop_d()
                self.emit(f"@{target}", "D;JNE")
        elif op in ("function", "call") and len(parts) == 3:
            name = parts[1]
            if not SYMBOL.fullmatch(name) or name.startswith("VM$INTERNAL."):
                raise VMError(f"invalid function name: {name}")
            if not parts[2].isdecimal() or int(parts[2]) > 32767:
                raise VMError("count must be an integer from 0 to 32767")
            count = int(parts[2])
            if op == "call":
                self.call(name, count)
            else:
                self.function = name
                self.emit(f"({name})")
                for _ in range(count):
                    self.emit("@0", "D=A")
                    self.push_d()
        elif op == "return" and len(parts) == 1:
            self.return_()
        else:
            raise VMError(f"unknown or malformed command: {' '.join(parts)}")

    def translate(self, path: Path) -> None:
        self.file = path.stem
        self.function = ""
        if not SYMBOL.fullmatch(self.file) or self.file.startswith("VM$INTERNAL."):
            raise VMError(f"invalid VM filename: {path.name}")
        for number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            line = raw.split("//", 1)[0].strip()
            if not line:
                continue
            try:
                self.command(line.split())
            except VMError as exc:
                raise VMError(f"{path}:{number}: {exc}") from exc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="nand2tetris VM -> Hack assembly")
    parser.add_argument("input", type=Path, help=".vm file or folder containing .vm files")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--bootstrap", action="store_true", help="always emit SP=256 and call Sys.init")
    group.add_argument("--no-bootstrap", action="store_true", help="omit bootstrap (tests that initialize SP themselves)")
    args = parser.parse_args(argv)
    source = args.input.resolve()
    if source.is_file() and source.suffix.lower() == ".vm":
        files, output = [source], source.with_suffix(".asm")
    elif source.is_dir():
        files = sorted((p for p in source.iterdir() if p.is_file() and p.suffix.lower() == ".vm"), key=lambda p: p.name)
        output = source / f"{source.name}.asm"
    else:
        parser.error("input must be a .vm file or folder")
    if not files:
        parser.error("no .vm files found")
    writer = CodeWriter()
    # Official project 7 / early project 8 scripts initialize SP themselves.
    # Programs defining Sys.init need bootstrap even when Sys.vm is the only file.
    has_sys_init = any(re.search(r"^\s*function\s+Sys\.init\s+\d+(?=\s|//|$)", p.read_text(encoding="utf-8-sig"), re.M) for p in files)
    if args.bootstrap or (not args.no_bootstrap and has_sys_init):
        writer.bootstrap()
    try:
        for path in files:
            writer.translate(path)
    except (VMError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    output.write_text("\n".join(writer.lines) + "\n", encoding="utf-8")
    print(f"Translated {len(files)} VM file(s) -> {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
