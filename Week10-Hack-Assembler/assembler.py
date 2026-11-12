"""Two-pass assembler for the nand2tetris Hack computer."""

import argparse
import re
import sys
from pathlib import Path

SYMBOL = re.compile(r"[A-Za-z_.$:][A-Za-z_.$:0-9]*\Z")
DEST = {"": "000", "M": "001", "D": "010", "MD": "011", "A": "100", "AM": "101", "AD": "110", "AMD": "111"}
JUMP = {"": "000", "JGT": "001", "JEQ": "010", "JGE": "011", "JLT": "100", "JNE": "101", "JLE": "110", "JMP": "111"}
COMP = {
    "0": "0101010", "1": "0111111", "-1": "0111010",
    "D": "0001100", "A": "0110000", "M": "1110000",
    "!D": "0001101", "!A": "0110001", "!M": "1110001",
    "-D": "0001111", "-A": "0110011", "-M": "1110011",
    "D+1": "0011111", "A+1": "0110111", "M+1": "1110111",
    "D-1": "0001110", "A-1": "0110010", "M-1": "1110010",
    "D+A": "0000010", "D+M": "1000010",
    "D-A": "0010011", "D-M": "1010011",
    "A-D": "0000111", "M-D": "1000111",
    "D&A": "0000000", "D&M": "1000000",
    "D|A": "0010101", "D|M": "1010101",
}


class AssemblyError(ValueError):
    """Invalid Hack assembly source."""


def predefined_symbols():
    symbols = {f"R{i}": i for i in range(16)}
    symbols.update(SP=0, LCL=1, ARG=2, THIS=3, THAT=4, SCREEN=16384, KBD=24576)
    return symbols


def error(line, message):
    return AssemblyError(f"line {line}: {message}")


def assemble(source):
    """Return one 16-bit binary Hack instruction per line."""
    cleaned = []
    for number, raw in enumerate(source.splitlines(), 1):
        instruction = "".join(raw.split("//", 1)[0].split())
        if instruction:
            cleaned.append((number, instruction))

    symbols = predefined_symbols()
    instructions = []
    # Pass 1: label addresses count instructions, not source lines.
    for line, instruction in cleaned:
        if instruction.startswith("("):
            if not instruction.endswith(")") or not SYMBOL.fullmatch(instruction[1:-1]):
                raise error(line, f"invalid label: {instruction}")
            name = instruction[1:-1]
            if name in symbols:
                raise error(line, f"duplicate or reserved symbol: {name}")
            if len(instructions) > 32767:
                raise error(line, "label address exceeds 32767")
            symbols[name] = len(instructions)
        else:
            instructions.append((line, instruction))

    # Pass 2: first use of each variable assigns RAM[16], RAM[17], ...
    variable_address = 16
    output = []
    for line, instruction in instructions:
        if instruction.startswith("@"):
            operand = instruction[1:]
            if operand.isascii() and operand.isdecimal():
                address = int(operand)
            elif SYMBOL.fullmatch(operand):
                if operand not in symbols:
                    if variable_address > 32767:
                        raise error(line, "variable address exceeds 32767")
                    symbols[operand] = variable_address
                    variable_address += 1
                address = symbols[operand]
            else:
                raise error(line, f"invalid A-instruction: {instruction}")
            if not 0 <= address <= 32767:
                raise error(line, f"A-instruction address out of range: {address}")
            output.append(f"{address:016b}")
            continue

        if instruction.count("=") > 1 or instruction.count(";") > 1:
            raise error(line, f"invalid C-instruction: {instruction}")
        body, semicolon, jump = instruction.partition(";")
        dest, equals, comp = body.partition("=")
        if not equals:
            dest, comp = "", dest
        if semicolon and not jump:
            raise error(line, "missing jump mnemonic")
        if dest not in DEST or comp not in COMP or jump not in JUMP:
            raise error(line, f"invalid C-instruction: {instruction}")
        output.append("111" + COMP[comp] + DEST[dest] + JUMP[jump])
    return "\n".join(output) + ("\n" if output else "")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Translate a nand2tetris .asm file into .hack")
    parser.add_argument("source", type=Path, help="input .asm file")
    parser.add_argument("-o", "--output", type=Path, help="output path (default: same name with .hack)")
    args = parser.parse_args(argv)
    if args.source.suffix.lower() != ".asm":
        parser.error("input file must end in .asm")
    destination = args.output or args.source.with_suffix(".hack")
    try:
        machine_code = assemble(args.source.read_text(encoding="utf-8-sig"))
        destination.write_text(machine_code, encoding="ascii", newline="\n")
    except (OSError, UnicodeError, AssemblyError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(f"Assembled {args.source} -> {destination} ({len(machine_code.splitlines())} instructions)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
