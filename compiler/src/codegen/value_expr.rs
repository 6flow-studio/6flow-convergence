//! ValueExpr → TypeScript expression string conversion.

use crate::ir::types::*;

/// Convert a `ValueExpr` into a TypeScript expression string.
/// Uses `runtime.config.X` for config refs (handler context).
pub fn emit_value_expr(expr: &ValueExpr) -> String {
    emit_value_expr_ctx(expr, "runtime.config")
}

/// Convert a `ValueExpr` using `config.X` for config refs (initWorkflow context).
pub fn emit_value_expr_init(expr: &ValueExpr) -> String {
    emit_value_expr_ctx(expr, "config")
}

fn emit_value_expr_ctx(expr: &ValueExpr, config_prefix: &str) -> String {
    match expr {
        ValueExpr::Literal(lit) => emit_literal(lit),
        ValueExpr::Binding(binding) => emit_binding(binding),
        ValueExpr::ConfigRef { field } => format!("{}.{}", config_prefix, field),
        ValueExpr::TriggerDataRef { field } => format!("triggerData.{}", field),
        ValueExpr::Template { parts } => emit_template_ctx(parts, config_prefix),
        ValueExpr::RawExpr { expr } => expr.clone(),
    }
}

fn emit_literal(lit: &LiteralValue) -> String {
    match lit {
        LiteralValue::String { value } => format!("\"{}\"", escape_string(value)),
        LiteralValue::Number { value } => {
            if value.fract() == 0.0 && value.is_finite() {
                format!("{}", *value as i64)
            } else {
                format!("{}", value)
            }
        }
        LiteralValue::Integer { value } => format!("{}", value),
        LiteralValue::Boolean { value } => format!("{}", value),
        LiteralValue::Null => "null".to_string(),
        LiteralValue::Json { value } => value.clone(),
    }
}

fn emit_binding(binding: &BindingRef) -> String {
    let var_name = binding_var_name(&binding.step_id);
    if binding.field_path.is_empty() {
        var_name
    } else {
        format!("{}.{}", var_name, binding.field_path)
    }
}

/// Convert a step ID to its TypeScript variable name.
/// Convention: `step_{sanitized_id}` where `-` becomes `_`.
pub fn binding_var_name(step_id: &str) -> String {
    format!("step_{}", step_id.replace('-', "_"))
}

fn emit_template_ctx(parts: &[TemplatePart], config_prefix: &str) -> String {
    let mut out = String::from("`");
    for part in parts {
        match part {
            TemplatePart::Lit { value } => {
                out.push_str(&value.replace('`', "\\`").replace("${", "\\${"));
            }
            TemplatePart::Expr { value } => {
                out.push_str("${");
                out.push_str(&emit_value_expr_ctx(value, config_prefix));
                out.push('}');
            }
        }
    }
    out.push('`');
    out
}

/// Emit a condition expression from `ConditionIR` list + combinator.
pub fn emit_condition(conditions: &[ConditionIR], combine: &LogicCombinator) -> String {
    let parts: Vec<String> = conditions.iter().map(emit_single_condition).collect();
    let joiner = match combine {
        LogicCombinator::And => " && ",
        LogicCombinator::Or => " || ",
    };
    if parts.len() == 1 {
        parts[0].clone()
    } else {
        parts.join(joiner)
    }
}

fn emit_single_condition(cond: &ConditionIR) -> String {
    let lhs = emit_value_expr(&cond.field);
    let rhs = cond.value.as_ref().map(|v| emit_value_expr(v));

    match &cond.operator {
        ComparisonOp::Equals => format!("{} === {}", lhs, rhs.unwrap()),
        ComparisonOp::NotEquals => format!("{} !== {}", lhs, rhs.unwrap()),
        ComparisonOp::Gt => format!("{} > {}", lhs, rhs.unwrap()),
        ComparisonOp::Gte => format!("{} >= {}", lhs, rhs.unwrap()),
        ComparisonOp::Lt => format!("{} < {}", lhs, rhs.unwrap()),
        ComparisonOp::Lte => format!("{} <= {}", lhs, rhs.unwrap()),
        ComparisonOp::Contains => {
            format!("{}.includes({})", lhs, rhs.unwrap())
        }
        ComparisonOp::NotContains => {
            format!("!{}.includes({})", lhs, rhs.unwrap())
        }
        ComparisonOp::StartsWith => {
            format!("{}.startsWith({})", lhs, rhs.unwrap())
        }
        ComparisonOp::EndsWith => {
            format!("{}.endsWith({})", lhs, rhs.unwrap())
        }
        ComparisonOp::Regex => {
            format!("new RegExp({}).test({})", rhs.unwrap(), lhs)
        }
        ComparisonOp::NotRegex => {
            format!("!new RegExp({}).test({})", rhs.unwrap(), lhs)
        }
        ComparisonOp::Exists => format!("{} != null", lhs),
        ComparisonOp::NotExists => format!("{} == null", lhs),
        ComparisonOp::IsEmpty => format!("{} === \"\" || {} == null", lhs, lhs),
        ComparisonOp::IsNotEmpty => format!("{} !== \"\" && {} != null", lhs, lhs),
    }
}

fn escape_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn literal_string() {
        assert_eq!(emit_value_expr(&ValueExpr::string("hello")), "\"hello\"");
    }

    #[test]
    fn literal_integer() {
        assert_eq!(emit_value_expr(&ValueExpr::integer(42)), "42");
    }

    #[test]
    fn literal_boolean() {
        assert_eq!(emit_value_expr(&ValueExpr::boolean(true)), "true");
    }

    #[test]
    fn literal_null() {
        assert_eq!(emit_value_expr(&ValueExpr::null()), "null");
    }

    #[test]
    fn binding_with_field() {
        assert_eq!(
            emit_value_expr(&ValueExpr::binding("http-1", "body")),
            "step_http_1.body"
        );
    }

    #[test]
    fn binding_whole_value() {
        assert_eq!(
            emit_value_expr(&ValueExpr::binding("parse-1", "")),
            "step_parse_1"
        );
    }

    #[test]
    fn config_ref() {
        assert_eq!(
            emit_value_expr(&ValueExpr::config("schedule")),
            "runtime.config.schedule"
        );
    }

    #[test]
    fn trigger_data_ref() {
        assert_eq!(
            emit_value_expr(&ValueExpr::trigger_data("scheduledTime")),
            "triggerData.scheduledTime"
        );
    }

    #[test]
    fn template_expr() {
        let expr = ValueExpr::Template {
            parts: vec![
                TemplatePart::Lit {
                    value: "hi ".into(),
                },
                TemplatePart::Expr {
                    value: ValueExpr::binding("x", "name"),
                },
            ],
        };
        assert_eq!(emit_value_expr(&expr), "`hi ${step_x.name}`");
    }

    #[test]
    fn raw_expr() {
        assert_eq!(emit_value_expr(&ValueExpr::raw("Date.now()")), "Date.now()");
    }

    #[test]
    fn condition_equals() {
        let cond = emit_condition(
            &[ConditionIR {
                field: ValueExpr::binding("parse-1", "isApproved"),
                operator: ComparisonOp::Equals,
                value: Some(ValueExpr::boolean(true)),
            }],
            &LogicCombinator::And,
        );
        assert_eq!(cond, "step_parse_1.isApproved === true");
    }

    #[test]
    fn condition_combined_or() {
        let cond = emit_condition(
            &[
                ConditionIR {
                    field: ValueExpr::binding("a", "x"),
                    operator: ComparisonOp::Gt,
                    value: Some(ValueExpr::integer(10)),
                },
                ConditionIR {
                    field: ValueExpr::binding("a", "y"),
                    operator: ComparisonOp::Lt,
                    value: Some(ValueExpr::integer(5)),
                },
            ],
            &LogicCombinator::Or,
        );
        assert_eq!(cond, "step_a.x > 10 || step_a.y < 5");
    }
}
