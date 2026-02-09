//! Indent-aware string builder for TypeScript code generation.
//!
//! CRE TypeScript uses 2-space indentation.

/// Indent-aware string builder that produces formatted TypeScript source code.
pub struct CodeWriter {
    buf: String,
    indent_level: usize,
    /// True if the current line has not yet been written to.
    at_line_start: bool,
}

impl CodeWriter {
    pub fn new() -> Self {
        Self {
            buf: String::with_capacity(4096),
            indent_level: 0,
            at_line_start: true,
        }
    }

    /// Write a complete line (appends newline).
    pub fn line(&mut self, text: &str) {
        self.write_indent();
        self.buf.push_str(text);
        self.buf.push('\n');
        self.at_line_start = true;
    }

    /// Write an empty line.
    pub fn blank(&mut self) {
        self.buf.push('\n');
        self.at_line_start = true;
    }

    /// Write text without a trailing newline.
    #[allow(dead_code)]
    pub fn write(&mut self, text: &str) {
        self.write_indent();
        self.buf.push_str(text);
    }

    /// Increase indent by one level.
    pub fn indent(&mut self) {
        self.indent_level += 1;
    }

    /// Decrease indent by one level.
    pub fn dedent(&mut self) {
        self.indent_level = self.indent_level.saturating_sub(1);
    }

    /// Write `text {` and increase indent (e.g. `if (cond) {`).
    pub fn block_open(&mut self, text: &str) {
        self.line(&format!("{} {{", text));
        self.indent();
    }

    /// Decrease indent and write `}`.
    pub fn block_close(&mut self) {
        self.dedent();
        self.line("}");
    }

    /// Decrease indent and write `};`.
    pub fn block_close_semi(&mut self) {
        self.dedent();
        self.line("};");
    }

    /// Decrease indent and write `} else {` and re-indent.
    pub fn block_else(&mut self) {
        self.dedent();
        self.line("} else {");
        self.indent();
    }

    /// Consume the writer and return the generated string.
    pub fn finish(self) -> String {
        self.buf
    }

    fn write_indent(&mut self) {
        if self.at_line_start && self.indent_level > 0 {
            for _ in 0..self.indent_level {
                self.buf.push_str("  ");
            }
        }
        self.at_line_start = false;
    }
}

impl Default for CodeWriter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_line() {
        let mut w = CodeWriter::new();
        w.line("const x = 1;");
        assert_eq!(w.finish(), "const x = 1;\n");
    }

    #[test]
    fn indent_dedent() {
        let mut w = CodeWriter::new();
        w.line("function foo() {");
        w.indent();
        w.line("return 1;");
        w.dedent();
        w.line("}");
        assert_eq!(w.finish(), "function foo() {\n  return 1;\n}\n");
    }

    #[test]
    fn block_open_close() {
        let mut w = CodeWriter::new();
        w.block_open("if (true)");
        w.line("doStuff();");
        w.block_close();
        assert_eq!(w.finish(), "if (true) {\n  doStuff();\n}\n");
    }

    #[test]
    fn block_else() {
        let mut w = CodeWriter::new();
        w.block_open("if (x)");
        w.line("a();");
        w.block_else();
        w.line("b();");
        w.block_close();
        assert_eq!(
            w.finish(),
            "if (x) {\n  a();\n} else {\n  b();\n}\n"
        );
    }

    #[test]
    fn nested_indent() {
        let mut w = CodeWriter::new();
        w.block_open("function outer()");
        w.block_open("if (true)");
        w.line("inner();");
        w.block_close();
        w.block_close();
        assert_eq!(
            w.finish(),
            "function outer() {\n  if (true) {\n    inner();\n  }\n}\n"
        );
    }

    #[test]
    fn blank_line() {
        let mut w = CodeWriter::new();
        w.line("a();");
        w.blank();
        w.line("b();");
        assert_eq!(w.finish(), "a();\n\nb();\n");
    }

    #[test]
    fn dedent_saturates_at_zero() {
        let mut w = CodeWriter::new();
        w.dedent();
        w.line("x;");
        assert_eq!(w.finish(), "x;\n");
    }
}
