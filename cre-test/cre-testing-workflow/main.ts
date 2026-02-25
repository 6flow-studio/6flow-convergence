import { cre, ok, consensusIdenticalAggregation, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC 0 */10 * * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_node_1771844795623_1 = (sendRequester: HTTPSendRequester, config: Config) => {
  const req = {
    url: "https://jsonplaceholder.typicode.com/posts",
    method: "GET" as const,
  };

  const resp = sendRequester.sendRequest(req).result();

  if (!ok(resp)) {
    throw new Error(`HTTP request failed with status: ${resp.statusCode}`);
  }

  return { statusCode: resp.statusCode, body: resp.body, headers: resp.headers };
};

const onCronTrigger = (runtime: Runtime<Config>, triggerData: CronTrigger): string => {
  const httpClient = new cre.capabilities.HTTPClient();

  // HTTP Request
  const step_node_1771844795623_1 = httpClient.sendRequest(runtime, fetch_node_1771844795623_1, consensusIdenticalAggregation())(runtime.config).result();
  runtime.log(`API response: ${JSON.stringify(step_node_1771844795623_1)}`);
  return "\"ok\"";
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
