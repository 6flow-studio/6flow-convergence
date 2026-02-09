//! Emit `configSchema` Zod object and `type Config`.

use crate::ir::types::*;
use super::writer::CodeWriter;

/// Emit the configSchema and Config type.
pub fn emit_config_schema(fields: &[ConfigField], w: &mut CodeWriter) {
    if fields.is_empty() {
        w.line("type Config = Record<string, never>;");
        return;
    }

    w.line("const configSchema = z.object({");
    w.indent();
    for field in fields {
        let zod_call = match &field.zod_type {
            ZodType::String => "z.string()".to_string(),
            ZodType::Number => "z.number()".to_string(),
            ZodType::Boolean => "z.boolean()".to_string(),
            ZodType::Raw(expr) => expr.clone(),
        };

        let with_default = if let Some(default) = &field.default_value {
            format!("{}.default({})", zod_call, format_default(default, &field.zod_type))
        } else {
            zod_call
        };

        w.line(&format!("{}: {},", field.name, with_default));
    }
    w.dedent();
    w.line("});");
    w.blank();
    w.line("type Config = z.infer<typeof configSchema>;");
}

fn format_default(value: &str, zod_type: &ZodType) -> String {
    match zod_type {
        ZodType::String => format!("\"{}\"", value.replace('"', "\\\"")),
        ZodType::Number => value.to_string(),
        ZodType::Boolean => value.to_string(),
        ZodType::Raw(_) => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_config_schema() {
        let fields = vec![
            ConfigField {
                name: "schedule".into(),
                zod_type: ZodType::String,
                default_value: Some("0 */10 * * * *".into()),
                description: None,
            },
            ConfigField {
                name: "walletAddress".into(),
                zod_type: ZodType::String,
                default_value: None,
                description: None,
            },
        ];

        let mut w = CodeWriter::new();
        emit_config_schema(&fields, &mut w);
        let out = w.finish();

        assert!(out.contains("const configSchema = z.object({"));
        assert!(out.contains("schedule: z.string().default(\"0 */10 * * * *\"),"));
        assert!(out.contains("walletAddress: z.string(),"));
        assert!(out.contains("type Config = z.infer<typeof configSchema>;"));
    }

    #[test]
    fn empty_config() {
        let mut w = CodeWriter::new();
        emit_config_schema(&[], &mut w);
        let out = w.finish();
        assert!(out.contains("type Config = Record<string, never>;"));
    }
}
