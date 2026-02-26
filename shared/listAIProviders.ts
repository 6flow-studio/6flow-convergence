export const AI_PROVIDERS = [
  {
    value: "gpt-5.2",
    label: "GPT-5.2",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "gpt-5-mini",
    label: "GPT-5 Mini",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "gpt-5-nano",
    label: "GPT-5 Nano",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    provider: "OpenAI",
  },
  {
    value: "claude-opus-4.6",
    label: "Claude Opus 4.6",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    baseUrl: "https://api.anthropic.com/v1/messages",
    provider: "Anthropic",
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    provider: "Google",
  },
  {
    value: "gemini-3-pro-preview",
    label: "Gemini 3 Pro",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
    provider: "Google",
  },
  {
    value: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    provider: "Google",
  },
];
