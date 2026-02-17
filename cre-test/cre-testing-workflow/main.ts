import { cre, ok, consensusIdenticalAggregation, Runner, type Runtime, type HTTPSendRequester, type HTTPPayload } from "@chainlink/cre-sdk";

type Config = Record<string, never>;

const fetch_ai_1 = (sendRequester: HTTPSendRequester, config: Config) => {
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an operations assistant. Return a concise next-action recommendation in JSON." },
      { role: "user", content: "Analyze the incoming webhook request and return one clear recommended action." },
    ],
    temperature: 0.2,
    max_tokens: 200,
  };

  const bodyBytes = new TextEncoder().encode(JSON.stringify(body));

  const req = {
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST" as const,
    body: Buffer.from(bodyBytes).toString("base64"),
    headers: {
      "Content-Type": "application/json",
    },
  };

  const resp = sendRequester.sendRequest(req).result();

  if (!ok(resp)) {
    throw new Error(`AI call failed with status: ${resp.statusCode}`);
  }

  return JSON.parse(Buffer.from(resp.body, "base64").toString("utf-8"));
};

const onHttpRequest = (runtime: Runtime<Config>, triggerData: HTTPPayload): string => {
  const httpClient = new cre.capabilities.HTTPClient();

  // Decide Next Action
  const step_ai_1 = httpClient.sendRequest(runtime, fetch_ai_1, consensusIdenticalAggregation())(runtime.config).result();
  return step_ai_1.choices[0].message.content;
};

const initWorkflow = (config: Config) => {
  return [
    cre.handler(
      new cre.capabilities.HTTPCapability().trigger({}),
      onHttpRequest,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
