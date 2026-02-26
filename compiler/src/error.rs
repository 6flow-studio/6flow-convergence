//! Unified compiler error type used across all phases.

use crate::ir::validate::ValidationError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Phase {
    Parse,
    Validate,
    Lower,
    IrValidate,
    Codegen,
}

impl std::fmt::Display for Phase {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Phase::Parse => write!(f, "Parse"),
            Phase::Validate => write!(f, "Validate"),
            Phase::Lower => write!(f, "Lower"),
            Phase::IrValidate => write!(f, "IR Validate"),
            Phase::Codegen => write!(f, "Codegen"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CompilerError {
    pub code: String,
    pub phase: Phase,
    pub message: String,
    pub node_id: Option<String>,
}

impl std::fmt::Display for CompilerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.node_id {
            Some(id) => write!(
                f,
                "[{}:{}] {} (node '{}')",
                self.phase, self.code, self.message, id
            ),
            None => write!(f, "[{}:{}] {}", self.phase, self.code, self.message),
        }
    }
}

impl std::error::Error for CompilerError {}

impl From<ValidationError> for CompilerError {
    fn from(e: ValidationError) -> Self {
        CompilerError {
            code: e.code.to_string(),
            phase: Phase::IrValidate,
            message: e.message,
            node_id: e.step_id,
        }
    }
}

impl CompilerError {
    pub fn parse(code: &str, message: impl Into<String>) -> Self {
        CompilerError {
            code: code.into(),
            phase: Phase::Parse,
            message: message.into(),
            node_id: None,
        }
    }

    pub fn validate(code: &str, message: impl Into<String>, node_id: Option<String>) -> Self {
        CompilerError {
            code: code.into(),
            phase: Phase::Validate,
            message: message.into(),
            node_id,
        }
    }

    pub fn lower(code: &str, message: impl Into<String>, node_id: Option<String>) -> Self {
        CompilerError {
            code: code.into(),
            phase: Phase::Lower,
            message: message.into(),
            node_id,
        }
    }
}
