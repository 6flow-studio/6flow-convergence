//! Parse `{{nodeId.field}}` strings into `ValueExpr`.

use std::collections::HashMap;

use crate::ir::types::*;

/// Parse a string that may contain `{{nodeId.field}}` references into a ValueExpr.
///
/// `id_map` maps original node IDs to expanded step IDs (for convenience nodes).
pub fn resolve_value_expr(input: &str, id_map: &HashMap<String, String>) -> ValueExpr {
    let trimmed = input.trim();

    // Pure reference: entire string is {{nodeId.field}}
    if trimmed.starts_with("{{") && trimmed.ends_with("}}") && trimmed.matches("{{").count() == 1 {
        let inner = &trimmed[2..trimmed.len() - 2];
        return parse_single_ref(inner, id_map);
    }

    // Check if it contains any references at all
    if !trimmed.contains("{{") {
        return ValueExpr::string(trimmed);
    }

    // Template: mixed literal + references
    let parts = parse_template_parts(trimmed, id_map);
    if parts.len() == 1 {
        if let TemplatePart::Lit { value } = &parts[0] {
            return ValueExpr::string(value.as_str());
        }
    }
    ValueExpr::Template { parts }
}

fn parse_single_ref(inner: &str, id_map: &HashMap<String, String>) -> ValueExpr {
    let (node_id, field_path) = split_ref(inner);

    // Check if this is a config ref
    if node_id == "config" {
        return ValueExpr::config(field_path);
    }

    // Check if this is a trigger data ref
    if node_id == "trigger" {
        return ValueExpr::trigger_data(field_path);
    }

    // Resolve through id_map for expanded convenience nodes and trigger aliases
    let step_id = id_map
        .get(node_id)
        .cloned()
        .unwrap_or_else(|| node_id.to_string());

    // Re-check after id_map resolution (e.g. "trigger-1" → "trigger")
    if step_id == "trigger" {
        return ValueExpr::trigger_data(field_path);
    }

    ValueExpr::binding(step_id, field_path)
}

fn split_ref(s: &str) -> (&str, &str) {
    match s.find('.') {
        Some(pos) => (&s[..pos], &s[pos + 1..]),
        None => (s, ""),
    }
}

fn parse_template_parts(input: &str, id_map: &HashMap<String, String>) -> Vec<TemplatePart> {
    let mut parts = Vec::new();
    let mut remaining = input;

    while let Some(start) = remaining.find("{{") {
        // Literal before the reference
        if start > 0 {
            parts.push(TemplatePart::Lit {
                value: remaining[..start].to_string(),
            });
        }

        let after_open = &remaining[start + 2..];
        match after_open.find("}}") {
            Some(end) => {
                let inner = &after_open[..end];
                let expr = parse_single_ref(inner, id_map);
                parts.push(TemplatePart::Expr { value: expr });
                remaining = &after_open[end + 2..];
            }
            None => {
                // Malformed — treat rest as literal
                parts.push(TemplatePart::Lit {
                    value: remaining.to_string(),
                });
                return parts;
            }
        }
    }

    // Trailing literal
    if !remaining.is_empty() {
        parts.push(TemplatePart::Lit {
            value: remaining.to_string(),
        });
    }

    parts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pure_literal() {
        let result = resolve_value_expr("hello world", &HashMap::new());
        assert!(matches!(result, ValueExpr::Literal(LiteralValue::String { value }) if value == "hello world"));
    }

    #[test]
    fn pure_reference() {
        let result = resolve_value_expr("{{http-1.body}}", &HashMap::new());
        assert!(matches!(result, ValueExpr::Binding(BindingRef { step_id, field_path }) if step_id == "http-1" && field_path == "body"));
    }

    #[test]
    fn config_ref() {
        let result = resolve_value_expr("{{config.walletAddress}}", &HashMap::new());
        assert!(matches!(result, ValueExpr::ConfigRef { field } if field == "walletAddress"));
    }

    #[test]
    fn trigger_ref() {
        let result = resolve_value_expr("{{trigger.body}}", &HashMap::new());
        assert!(matches!(result, ValueExpr::TriggerDataRef { field } if field == "body"));
    }

    #[test]
    fn template_with_mixed() {
        let result = resolve_value_expr("https://api.com/{{parse-1.id}}/status", &HashMap::new());
        match result {
            ValueExpr::Template { parts } => {
                assert_eq!(parts.len(), 3);
            }
            other => panic!("Expected Template, got {:?}", other),
        }
    }

    #[test]
    fn id_map_resolves() {
        let mut map = HashMap::new();
        map.insert("mint-1".to_string(), "mint-1___write".to_string());
        let result = resolve_value_expr("{{mint-1.txHash}}", &map);
        assert!(matches!(result, ValueExpr::Binding(BindingRef { step_id, .. }) if step_id == "mint-1___write"));
    }
}
