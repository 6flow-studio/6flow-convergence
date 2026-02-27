import { cre, ok, consensusIdenticalAggregation, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC 0 0 */1 * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_node_1772176743838_1 = (sendRequester: HTTPSendRequester, config: any, apiKey: string) => {
  const body = {
    system_instruction: {
      parts: [{ text: "Let's play the rock, paper, scissor game" }],
    },
    contents: [
      { role: "user", parts: [{ text: "Choose your move" }] },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const bodyBytes = new TextEncoder().encode(JSON.stringify(body));

  const req = {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    method: "POST" as const,
    body: Buffer.from(bodyBytes).toString("base64"),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
  };

  const resp = sendRequester.sendRequest(req).result();

  if (!ok(resp)) {
    throw new Error(`AI call failed with status: ${resp.statusCode}`);
  }

  return JSON.parse(Buffer.from(resp.body, "base64").toString("utf-8"));
};

const onCronTrigger = (runtime: Runtime<Config>, triggerData: CronTrigger): string => {
  const httpClient = new cre.capabilities.HTTPClient();

  const __stringify = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x);

  // AI
  const _aiApiKey_node_1772176743838_1 = runtime.getSecret({ id: "GEMINI_KEY" }).result();
  const step_node_1772176743838_1 = httpClient.sendRequest(runtime, fetch_node_1772176743838_1, consensusIdenticalAggregation())(runtime.config, _aiApiKey_node_1772176743838_1.value).result();
  runtime.log(`[AI] ${__stringify(step_node_1772176743838_1)}`);
  return "Workflow completed";
};

const initWorkflow = (config: Config) => {
  return [
    cre.handler(
      new cre.capabilities.CronCapability().trigger({
        schedule: config.schedule,
      }),
      onCronTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
