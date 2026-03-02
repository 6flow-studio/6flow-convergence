import { cre, ok, consensusIdenticalAggregation, getNetwork, encodeCallMsg, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { encodeFunctionData } from "viem";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC 0 */10 * * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_node_1772451941969_1 = (sendRequester: HTTPSendRequester, config: Config) => {
  const req = {
    url: "https://api.real-time-reserves.verinumus.io/v1/chainlink/proof-of-reserves/TrueUSD",
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
  const evmClient_ethereum_testnet_sepolia = new cre.capabilities.EVMClient(getNetwork({ chainFamily: "evm", chainSelectorName: "ethereum-testnet-sepolia", isTestnet: true })!.chainSelector.selector);

  const __stringify = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x);

  // getOffChainReserves
  const step_node_1772451941969_1 = httpClient.sendRequest(runtime, fetch_node_1772451941969_1, consensusIdenticalAggregation())(runtime.config).result();
  runtime.log(`[getOffChainReserves] ${__stringify(step_node_1772451941969_1)}`);
  // getOnChainSupply
  const _calldata_node_1772452114820_3 = encodeFunctionData({
    abi: [{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","indexed":null,"components":null}],"stateMutability":"view"}] as const,
    functionName: "totalSupply",
  });
  const step_node_1772452114820_3 = evmClient_ethereum_testnet_sepolia.callContract(runtime, {
    call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: "0x41f77d6aa3F8C8113Bc95831490D5206c5d1cFeE", data: _calldata_node_1772452114820_3 }),
  }).result();
  runtime.log(`[getOnChainSupply] ${__stringify(step_node_1772452114820_3)}`);
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
