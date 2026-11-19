"""Run the bundled nand2tetris CPU test cases with a small Hack CPU model."""

import re
import tempfile
import unittest
from pathlib import Path

from VMTranslator import CodeWriter, VMError, main


ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"
COMP = {
    "0", "1", "-1", "D", "A", "M", "!D", "!A", "!M", "-D", "-A", "-M",
    "D+1", "A+1", "M+1", "D-1", "A-1", "M-1", "D+A", "D+M", "D-A", "D-M",
    "A-D", "M-D", "D&A", "D&M", "D|A", "D|M",
}
JUMPS = {"JGT": lambda v: v > 0, "JEQ": lambda v: v == 0, "JGE": lambda v: v >= 0,
         "JLT": lambda v: v < 0, "JNE": lambda v: v != 0, "JLE": lambda v: v <= 0,
         "JMP": lambda v: True}


def signed(value):
    value &= 0xffff
    return value - 65536 if value & 32768 else value


class Hack:
    def __init__(self, source):
        self.ram = [0] * 32768
        self.a = self.d = self.pc = 0
        self.symbols = {f"R{i}": i for i in range(16)}
        self.symbols.update(SP=0, LCL=1, ARG=2, THIS=3, THAT=4, SCREEN=16384, KBD=24576)
        self.rom = []
        for raw in source.splitlines():
            line = raw.split("//", 1)[0].strip()
            if line.startswith("(") and line.endswith(")"):
                name = line[1:-1]
                if name in self.symbols:
                    raise ValueError(f"duplicate label: {name}")
                self.symbols[name] = len(self.rom)
            elif line:
                self.rom.append(line)
        self.next_var = 16

    def step(self):
        if not 0 <= self.pc < len(self.rom):
            return
        line = self.rom[self.pc]
        if line.startswith("@"):
            operand = line[1:]
            if operand.isdecimal():
                self.a = int(operand)
                assert self.a <= 32767
            else:
                if operand not in self.symbols:
                    self.symbols[operand] = self.next_var
                    self.next_var += 1
                self.a = self.symbols[operand]
            self.pc += 1
            return
        dest, sep, rest = line.partition("=")
        if not sep:
            dest, rest = "", dest
        expr, _, jump = rest.partition(";")
        if expr not in COMP or jump and jump not in JUMPS or any(c not in "ADM" for c in dest):
            raise ValueError(f"invalid Hack instruction: {line}")
        old_a = self.a
        values = {"A": signed(self.a), "D": signed(self.d), "M": signed(self.ram[self.a & 32767])}
        expression = expr.replace("!", "~")
        result = signed(eval(expression, {"__builtins__": {}}, values))
        if "M" in dest:
            self.ram[old_a & 32767] = result & 0xffff
        if "A" in dest:
            self.a = result & 0xffff
        if "D" in dest:
            self.d = result & 0xffff
        self.pc = old_a if jump and JUMPS[jump](result) else self.pc + 1

    def run(self, cycles):
        for _ in range(cycles):
            self.step()


class TranslatorTests(unittest.TestCase):
    def test_official_cpu_cases(self):
        for test_path in sorted(EXAMPLES.rglob("*.tst")):
            with self.subTest(test=test_path.stem, week=test_path.parts[-5]):
                folder = test_path.parent
                files = sorted(folder.glob("*.vm"))
                self.assertTrue(files)
                writer = CodeWriter()
                # Official early cases set their own SP and frame. The final two need bootstrap.
                if folder.name in ("FibonacciElement", "StaticsTest"):
                    writer.bootstrap()
                for file in files:
                    writer.translate(file)
                cpu = Hack("\n".join(writer.lines))
                script = test_path.read_text(encoding="utf-8")
                for addr, value in re.findall(r"^\s*set RAM\[(\d+)\]\s+(-?\d+)", script, re.M):
                    cpu.ram[int(addr)] = int(value) & 0xffff
                match = re.search(r"\brepeat\s+(\d+)", script)
                self.assertIsNotNone(match)
                cpu.run(int(match.group(1)))
                cmp_rows = [re.findall(r"[^|]+", row) for row in folder.joinpath(test_path.stem + ".cmp").read_text().splitlines()]
                for head, expected in zip(cmp_rows[::2], cmp_rows[1::2]):
                    for name, value in zip(head, expected):
                        addr = re.fullmatch(r"\s*RAM\[(\d+)\]?\s*", name)
                        self.assertIsNotNone(addr)
                        self.assertEqual(signed(cpu.ram[int(addr.group(1))]), int(value.strip()), name)

    def test_signed_comparisons_at_overflow(self):
        cases = [
            ("push constant 32767\npush constant 1\ngt", -1),
            ("push constant 32767\npush constant 1\nlt", 0),
            ("push constant 32767\npush constant 1\nneg\ngt", -1),
            ("push constant 32767\npush constant 1\nneg\nlt", 0),
        ]
        for program, expected in cases:
            with self.subTest(program=program):
                writer = CodeWriter()
                for line in program.splitlines():
                    writer.command(line.split())
                cpu = Hack("\n".join(writer.lines))
                cpu.ram[0] = 256
                cpu.run(len(cpu.rom) + 1)
                self.assertEqual(signed(cpu.ram[256]), expected)

    def test_invalid_command_does_not_write_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "tests") as folder:
            path = Path(folder) / "Invalid.vm"
            path.write_text("push temp 8\n")
            self.assertEqual(main([str(path)]), 1)
            self.assertFalse(path.with_suffix(".asm").exists())


if __name__ == "__main__":
    unittest.main()
