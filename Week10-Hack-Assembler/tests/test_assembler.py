import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from assembler import AssemblyError, assemble


class AssemblerTests(unittest.TestCase):
    def test_project_6_examples(self):
        examples = Path(__file__).resolve().parents[1] / "examples"
        for folder, name in (("max", "Max"), ("rect", "Rect"), ("pong", "Pong")):
            with self.subTest(program=name):
                symbolic = assemble((examples / folder / f"{name}.asm").read_text(encoding="utf-8"))
                numeric = assemble((examples / folder / f"{name}L.asm").read_text(encoding="utf-8"))
                self.assertEqual(symbolic, numeric)
                self.assertEqual(symbolic, (examples / folder / f"{name}.hack").read_text(encoding="ascii"))

    def test_add_program_exact_output(self):
        self.assertEqual(
            assemble("@2\nD=A\n@3\nD=D+A\n@0\nM=D\n"),
            "0000000000000010\n1110110000010000\n"
            "0000000000000011\n1110000010010000\n"
            "0000000000000000\n1110001100001000\n",
        )

    def test_forward_label_variables_and_predefined_symbols(self):
        self.assertEqual(
            assemble("@END // forward\n0;JMP\n@x\nM=1\n@x\nD=M\n(END)\n@SCREEN\n@R15\n"),
            "0000000000000110\n1110101010000111\n"
            "0000000000010000\n1110111111001000\n"
            "0000000000010000\n1111110000010000\n"
            "0100000000000000\n0000000000001111\n",
        )

    def test_all_comp_dest_jump_encodings(self):
        from assembler import COMP, DEST, JUMP

        for mnemonic, bits in COMP.items():
            with self.subTest(comp=mnemonic):
                self.assertEqual(assemble(mnemonic), f"111{bits}000000\n")
        for mnemonic, bits in DEST.items():
            if mnemonic:
                with self.subTest(dest=mnemonic):
                    self.assertEqual(assemble(f"{mnemonic}=0"), f"1110101010{bits}000\n")
        for mnemonic, bits in JUMP.items():
            if mnemonic:
                with self.subTest(jump=mnemonic):
                    self.assertEqual(assemble(f"0;{mnemonic}"), f"1110101010000{bits}\n")

    def test_bad_input_reports_line(self):
        for program in ("@32768", "@-1", "@", "(R0)", "(BAD", "D=A;", "A+D", "M=M+2"):
            with self.subTest(program=program), self.assertRaisesRegex(AssemblyError, "line 2:"):
                assemble("// comment\n" + program)

    def test_cli_writes_file_and_does_not_replace_on_error(self):
        script = Path(__file__).resolve().parents[1] / "assembler.py"
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as folder:
            source = Path(folder) / "Add.asm"
            destination = source.with_suffix(".hack")
            source.write_text("@2\nD=A\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(script), str(source)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(destination.read_text(encoding="ascii"), assemble("@2\nD=A\n"))
            source.write_text("@-2\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(script), str(source)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(destination.read_text(encoding="ascii"), assemble("@2\nD=A\n"))


if __name__ == "__main__":
    unittest.main()
