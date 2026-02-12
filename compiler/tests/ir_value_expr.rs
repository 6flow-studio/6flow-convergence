use compiler::ir::types::*;

/// Round-trip a ValueExpr through JSON and return the deserialized result.
fn roundtrip(expr: &ValueExpr) -> ValueExpr {
    let json = serde_json::to_string(expr).expect("serialize");
    serde_json::from_str(&json).expect("deserialize")
}

#[test]
fn test_literal_string_roundtrip() {
    let v = ValueExpr::string("hello world");
    let rt = roundtrip(&v);
    if let ValueExpr::Literal(LiteralValue::String { value }) = &rt {
        assert_eq!(value, "hello world");
    } else {
        panic!("Expected Literal::String, got {:?}", rt);
    }
}

#[test]
fn test_literal_number_roundtrip() {
    let v = ValueExpr::number(3.14);
    let rt = roundtrip(&v);
    if let ValueExpr::Literal(LiteralValue::Number { value }) = &rt {
        assert!((value - 3.14).abs() < f64::EPSILON);
    } else {
        panic!("Expected Literal::Number, got {:?}", rt);
    }
}

#[test]
fn test_literal_integer_roundtrip() {
    let v = ValueExpr::integer(42);
    let rt = roundtrip(&v);
    if let ValueExpr::Literal(LiteralValue::Integer { value }) = &rt {
        assert_eq!(*value, 42);
    } else {
        panic!("Expected Literal::Integer, got {:?}", rt);
    }
}

#[test]
fn test_literal_boolean_roundtrip() {
    let v = ValueExpr::boolean(true);
    let rt = roundtrip(&v);
    if let ValueExpr::Literal(LiteralValue::Boolean { value }) = &rt {
        assert!(*value);
    } else {
        panic!("Expected Literal::Boolean, got {:?}", rt);
    }
}

#[test]
fn test_literal_null_roundtrip() {
    let v = ValueExpr::null();
    let rt = roundtrip(&v);
    assert!(matches!(rt, ValueExpr::Literal(LiteralValue::Null)));
}

#[test]
fn test_literal_json_roundtrip() {
    let v = ValueExpr::Literal(LiteralValue::Json {
        value: r#"{"key":"value","arr":[1,2,3]}"#.into(),
    });
    let rt = roundtrip(&v);
    if let ValueExpr::Literal(LiteralValue::Json { value }) = &rt {
        assert_eq!(value, r#"{"key":"value","arr":[1,2,3]}"#);
    } else {
        panic!("Expected Literal::Json, got {:?}", rt);
    }
}

#[test]
fn test_binding_ref_roundtrip() {
    let v = ValueExpr::binding("http-1", "body.data.items");
    let rt = roundtrip(&v);
    if let ValueExpr::Binding(r) = &rt {
        assert_eq!(r.step_id, "http-1");
        assert_eq!(r.field_path, "body.data.items");
    } else {
        panic!("Expected Binding, got {:?}", rt);
    }
}

#[test]
fn test_config_ref_roundtrip() {
    let v = ValueExpr::config("walletAddress");
    let rt = roundtrip(&v);
    if let ValueExpr::ConfigRef { field } = &rt {
        assert_eq!(field, "walletAddress");
    } else {
        panic!("Expected ConfigRef, got {:?}", rt);
    }
}

#[test]
fn test_trigger_data_ref_roundtrip() {
    let v = ValueExpr::trigger_data("topics");
    let rt = roundtrip(&v);
    if let ValueExpr::TriggerDataRef { field } = &rt {
        assert_eq!(field, "topics");
    } else {
        panic!("Expected TriggerDataRef, got {:?}", rt);
    }
}

#[test]
fn test_template_with_mixed_parts() {
    let v = ValueExpr::Template {
        parts: vec![
            TemplatePart::Lit {
                value: "https://api.com/".into(),
            },
            TemplatePart::Expr {
                value: ValueExpr::binding("http-1", "id"),
            },
            TemplatePart::Lit {
                value: "/status?chain=".into(),
            },
            TemplatePart::Expr {
                value: ValueExpr::config("chainName"),
            },
        ],
    };
    let rt = roundtrip(&v);
    if let ValueExpr::Template { parts } = &rt {
        assert_eq!(parts.len(), 4);
        assert!(matches!(&parts[0], TemplatePart::Lit { value } if value == "https://api.com/"));
        assert!(matches!(&parts[1], TemplatePart::Expr { value: ValueExpr::Binding(_) }));
        assert!(matches!(&parts[2], TemplatePart::Lit { value } if value == "/status?chain="));
        assert!(matches!(&parts[3], TemplatePart::Expr { value: ValueExpr::ConfigRef { .. } }));
    } else {
        panic!("Expected Template, got {:?}", rt);
    }
}

#[test]
fn test_raw_expr_roundtrip() {
    let v = ValueExpr::raw("Buffer.from(data, 'base64').toString('utf-8')");
    let rt = roundtrip(&v);
    if let ValueExpr::RawExpr { expr } = &rt {
        assert_eq!(expr, "Buffer.from(data, 'base64').toString('utf-8')");
    } else {
        panic!("Expected RawExpr, got {:?}", rt);
    }
}
