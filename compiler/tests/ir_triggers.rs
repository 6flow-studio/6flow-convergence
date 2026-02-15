use compiler::ir::types::*;

/// Round-trip a TriggerDef through JSON and return the deserialized result.
fn roundtrip(trigger: &TriggerDef) -> TriggerDef {
    let json = serde_json::to_string(trigger).expect("serialize");
    serde_json::from_str(&json).expect("deserialize")
}

#[test]
fn test_cron_trigger_roundtrip() {
    let trigger = TriggerDef::Cron(CronTriggerDef {
        schedule: ValueExpr::config("schedule"),
    });
    let rt = roundtrip(&trigger);
    if let TriggerDef::Cron(cron) = &rt {
        if let ValueExpr::ConfigRef { field } = &cron.schedule {
            assert_eq!(field, "schedule");
        } else {
            panic!("Expected ConfigRef schedule");
        }
    } else {
        panic!("Expected Cron trigger");
    }
}

#[test]
fn test_http_trigger_roundtrip() {
    let trigger = TriggerDef::Http(HttpTriggerDef {
        path: ValueExpr::string("/webhook/process"),
        methods: vec!["POST".into(), "PUT".into()],
    });
    let rt = roundtrip(&trigger);
    if let TriggerDef::Http(http) = &rt {
        if let ValueExpr::Literal(LiteralValue::String { value }) = &http.path {
            assert_eq!(value, "/webhook/process");
        } else {
            panic!("Expected string path");
        }
        assert_eq!(http.methods, vec!["POST", "PUT"]);
    } else {
        panic!("Expected Http trigger");
    }
}

#[test]
fn test_evm_log_trigger_roundtrip() {
    let trigger = TriggerDef::EvmLog(EvmLogTriggerDef {
        evm_client_binding: "evmClient_eth_sepolia".into(),
        contract_addresses: vec![
            ValueExpr::string("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
        ],
        event_signature: "Transfer(address,address,uint256)".into(),
        event_abi_json: r#"[{"type":"event","name":"Transfer","inputs":[{"name":"from","type":"address","indexed":true},{"name":"to","type":"address","indexed":true},{"name":"value","type":"uint256","indexed":false}]}]"#.into(),
        topic_filters: vec![
            TopicFilter {
                index: 1,
                values: vec!["0x000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef".into()],
            },
        ],
        confidence: "0.5".into(),
    });
    let rt = roundtrip(&trigger);
    if let TriggerDef::EvmLog(evm) = &rt {
        assert_eq!(evm.evm_client_binding, "evmClient_eth_sepolia");
        assert_eq!(evm.event_signature, "Transfer(address,address,uint256)");
        assert_eq!(evm.topic_filters.len(), 1);
        assert_eq!(evm.topic_filters[0].index, 1);
        assert_eq!(evm.confidence, "0.5");
    } else {
        panic!("Expected EvmLog trigger");
    }
}
