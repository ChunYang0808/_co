"""Project 11 compilation and focused code generation checks."""

import re
import unittest
from pathlib import Path

from jack_compiler import Compiler


PROJECT = Path(__file__).resolve().parents[1]
VM_COMMAND = re.compile(
    r"(?:push|pop) (?:constant|argument|local|static|this|that|pointer|temp) \d+|"
    r"(?:add|sub|neg|eq|gt|lt|and|or|not|return)|"
    r"(?:label|goto|if-goto) [A-Za-z_.$:][\w.$:]*|"
    r"(?:function|call) [A-Za-z_.$:][\w.$:]* \d+"
)


class JackCompilerTests(unittest.TestCase):
    def test_all_project_11_sources(self):
        files = sorted(PROJECT.glob("*/*.jack"))
        self.assertEqual(11, len(files))
        for file in files:
            with self.subTest(file=file.relative_to(PROJECT)):
                vm = Compiler(file.read_text(encoding="utf-8")).compile()
                self.assertTrue(vm.startswith("function ") or "\nfunction " in vm)
                for command in vm.splitlines():
                    self.assertIsNotNone(VM_COMMAND.fullmatch(command), command)
                self.assertEqual(vm, file.with_suffix(".vm").read_text(encoding="utf-8"))

    def test_array_string_constructor_and_method(self):
        source = '''class Demo {
            field Array a;
            constructor Demo new() { let a = Array.new(2); return this; }
            method void set(int i) { let a[i] = "Hi"; return; }
        }'''
        vm = Compiler(source).compile()
        for command in ("function Demo.new 0", "call Memory.alloc 1", "call Array.new 1",
                        "function Demo.set 0", "push argument 0", "call String.new 1",
                        "call String.appendChar 2", "pop that 0"):
            self.assertIn(command, vm)

    def test_invalid_input_reports_line(self):
        with self.assertRaisesRegex(SyntaxError, "line 2"):
            Compiler("class A {\n function void f() { let x = @; } }").compile()


if __name__ == "__main__":
    unittest.main()
