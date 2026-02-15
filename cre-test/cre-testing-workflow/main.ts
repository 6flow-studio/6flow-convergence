import { cre, ok, consensusIdenticalAggregation, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC 0 */5 * * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_http_1 = (sendRequester: HTTPSendRequester, config: Config) => {
  const req = {
    url: "https://fake-json-api.mock.beeceptor.com/users",
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

  // GET Status
  const step_http_1 = httpClient.sendRequest(runtime, fetch_http_1, consensusIdenticalAggregation())(runtime.config).result();
  return step_http_1.body;
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
