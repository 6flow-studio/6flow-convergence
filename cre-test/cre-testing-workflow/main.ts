import { cre, ok, consensusIdenticalAggregation, getNetwork, encodeCallMsg, Runner, type Runtime, type HTTPSendRequester, type CronTrigger } from "@chainlink/cre-sdk";
import { encodeFunctionData } from "viem";
import { z } from "zod";

const configSchema = z.object({
  schedule: z.string().default("TZ=UTC 0 */10 * * * *"),
});

type Config = z.infer<typeof configSchema>;

const fetch_getoffchainreserves_1 = (sendRequester: HTTPSendRequester, config: Config) => {
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

const fetch_node_1772461505671_1 = (sendRequester: HTTPSendRequester, config: any, apiKey: string) => {
  const body = {
    system_instruction: {
      parts: [{ text: "You are a risk analyst. You will receive two numbers:\n- TotalSupply: total token supply, scaled to 18 decimal places (raw integer).\n- TotalReserveScaled: total reserved/collateral amount, scaled to 18 decimal places (raw integer).\n\nCompute coverage as: coverage = TotalReserveScaled / TotalSupply (both are same scale, so this is the reserve-to-supply ratio).\n\nApply this risk scale exactly:\n- If coverage >= 1.2: riskScore = 0\n- Else: riskScore = min(100, round(((1.2 - coverage) / 1.2) * 100))\n\nRespond with the risk score as structured JSON only, no other text or markdown.\n\nOutput format (valid JSON only):\n{\"riskScore\": <integer>}" }],
    },
    contents: [
      { role: "user", parts: [{ text: `TotalSupply: ${config._dyn0}
TotalReserveScaled: ${config._dyn1}` }] },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const bodyBytes = new TextEncoder().encode(JSON.stringify(body));

  const req = {
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
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
  const evmClient_ethereum_testnet_sepolia = new cre.capabilities.EVMClient(getNetwork({ chainFamily: "evm", chainSelectorName: "ethereum-testnet-sepolia", isTestnet: true })!.chainSelector.selector);

  const __stringify = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x);

  // getOffChainReserves
  const step_getoffchainreserves_1 = httpClient.sendRequest(runtime, fetch_getoffchainreserves_1, consensusIdenticalAggregation())(runtime.config).result();
  runtime.log(`[getOffChainReserves] ${__stringify(step_getoffchainreserves_1)}`);
  // getOnChainSupply
  const _calldata_getonchainsupply_3 = encodeFunctionData({
    abi: [{"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","indexed":null,"components":null}],"stateMutability":"view"}] as const,
    functionName: "totalSupply",
  });
  const step_getonchainsupply_3 = evmClient_ethereum_testnet_sepolia.callContract(runtime, {
    call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: "0x41f77d6aa3F8C8113Bc95831490D5206c5d1cFeE", data: _calldata_getonchainsupply_3 }),
  }).result();
  runtime.log(`[getOnChainSupply] ${__stringify(step_getonchainsupply_3)}`);
  // getRiskScore
  const _aiApiKey_node_1772461505671_1 = runtime.getSecret({ id: "GEMINI_KEY" }).result();
  const _fetchCfg_node_1772461505671_1 = {
    ...runtime.config,
    _dyn0: step_getonchainsupply_3.value,
    _dyn1: step_getoffchainreserves_1.token,
  };
  const step_node_1772461505671_1 = httpClient.sendRequest(runtime, fetch_node_1772461505671_1, consensusIdenticalAggregation())(_fetchCfg_node_1772461505671_1, _aiApiKey_node_1772461505671_1.value).result();
  runtime.log(`[getRiskScore] ${__stringify(step_node_1772461505671_1)}`);
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
