import { cre, ok, consensusIdenticalAggregation, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC */1 * * * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_node_1772083694834_2 = (sendRequester: HTTPSendRequester, config: any, apiKey: string) => {
  const body = {
    system_instruction: {
      parts: [{ text: "You're a helpful assistant" }],
    },
    contents: [
      { role: "user", parts: [{ text: "return the random number 1-100" }] },
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

  // AI
  const _aiApiKey_node_1772083694834_2 = runtime.getSecret({ id: "GOOGLE_API" }).result();
  const step_node_1772083694834_2 = httpClient.sendRequest(runtime, fetch_node_1772083694834_2, consensusIdenticalAggregation())(runtime.config, _aiApiKey_node_1772083694834_2.value).result();
  runtime.log(step_node_1772083694834_2.candidates[0].content.parts[0].text);
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
