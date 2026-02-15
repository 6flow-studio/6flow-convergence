import type { Workflow } from '../model/node';

// =============================================================================
// 1. Simple Cron → HTTP (Linear, 3 nodes)
// Use case: Periodic health-check ping to an external API
// =============================================================================

export const simpleCronHttp: Workflow = {
  id: 'simple-cron-http',
  name: 'Get Random Number',
  description: 'Get random number from external API every 5 minutes',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: 'ethereum-testnet-sepolia',
    secrets: [],
    rpcs:[
      {
        chainName: 'ethereum-testnet-sepolia',
        url: 'https://0xrpc.io/sep',
      }
    ],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'cronTrigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Every 5 Minutes',
        config: {
          schedule: '0 */5 * * * *',
          timezone: 'UTC',
        },
      },
    },
    {
      id: 'http-1',
      type: 'httpRequest',
      position: { x: 300, y: 200 },
      data: {
        label: 'GET Status',
        config: {
          method: 'GET',
          url: 'https://fake-json-api.mock.beeceptor.com/users',
          authentication: { type: 'none' },
          responseFormat: 'json',
          timeout: 5000,
          expectedStatusCodes: [200],
        },
      },
    },
    {
      id: 'return-1',
      type: 'return',
      position: { x: 500, y: 200 },
      data: {
        label: 'Return Result',
        config: {
          returnExpression: '{{http-1.body}}',
        },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'http-1' },
    { id: 'e2', source: 'http-1', target: 'return-1' },
  ],
  createdAt: '2026-02-14T00:00:00Z',
  updatedAt: '2026-02-14T00:00:00Z',
};

// =============================================================================
// 2. Webhook → JSON Parse → Log (Linear, 4 nodes)
// Use case: Receive webhook data, parse it, log it
// =============================================================================

export const webhookParseLog: Workflow = {
  id: 'webhook-parse-log',
  name: 'Webhook Logger',
  description: 'Receive webhook data via POST, parse the JSON body, log it, and return',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: 'ethereum-mainnet',
    secrets: [
      { name: 'WEBHOOK_AUTH_TOKEN', envVariable: 'WEBHOOK_AUTH_TOKEN_VAR' },
    ],
    rpcs:[
      {
        chainName: 'ethereum-testnet-sepolia',
        url: 'https://0xrpc.io/sep',
      }
    ],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'httpTrigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'Webhook Endpoint',
        config: {
          httpMethod: 'POST',
          path: '/incoming-data',
          authentication: {
            type: 'headerAuth',
            headerName: 'X-Auth-Token',
            headerValueSecret: 'WEBHOOK_AUTH_TOKEN',
          },
          responseMode: 'lastNode',
          responseCode: 200,
        },
      },
    },
    {
      id: 'parse-1',
      type: 'jsonParse',
      position: { x: 300, y: 200 },
      data: {
        label: 'Parse Body',
        config: {
          strict: true,
        },
      },
    },
    {
      id: 'log-1',
      type: 'log',
      position: { x: 500, y: 200 },
      data: {
        label: 'Log Payload',
        config: {
          level: 'info',
          messageTemplate: 'Received webhook: {{parse-1.data}}',
        },
      },
    },
    {
      id: 'return-1',
      type: 'return',
      position: { x: 700, y: 200 },
      data: {
        label: 'Return OK',
        config: {
          returnExpression: '"OK"',
        },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'parse-1' },
    { id: 'e2', source: 'parse-1', target: 'log-1' },
    { id: 'e3', source: 'log-1', target: 'return-1' },
  ],
  createdAt: '2026-02-14T00:00:00Z',
  updatedAt: '2026-02-14T00:00:00Z',
};

// =============================================================================
// 3. Cron → HTTP → Filter → If/Else Branching (Diamond, 7 nodes)
// Use case: Fetch token holders, filter active ones, branch on balance threshold
// =============================================================================

export const filterBranching: Workflow = {
  id: 'filter-branching',
  name: 'Token Holder Monitor',
  description: 'Fetch token holders, filter active ones, branch on balance threshold',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: 'ethereum-testnet-sepolia',
    secrets: [
      { name: 'DATA_API_KEY', envVariable: 'DATA_API_KEY_VAR' },
    ],
    rpcs: [
      {
        chainName: 'ethereum-testnet-sepolia',
        url: 'https://rpc.example.com/ethereum-testnet-sepolia',
      },
      {
        chainName: 'base-testnet-sepolia',
        url: 'https://rpc.example.com/base-testnet-sepolia',
      },
    ],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'cronTrigger',
      position: { x: 100, y: 300 },
      data: {
        label: 'Every Hour',
        config: {
          schedule: '0 0 * * * *',
          timezone: 'UTC',
        },
      },
    },
    {
      id: 'http-1',
      type: 'httpRequest',
      position: { x: 300, y: 300 },
      data: {
        label: 'Fetch Holders',
        config: {
          method: 'GET',
          url: 'https://api.example.com/token-holders',
          authentication: {
            type: 'bearerToken',
            tokenSecret: 'DATA_API_KEY',
          },
          responseFormat: 'json',
          timeout: 10000,
        },
      },
    },
    {
      id: 'parse-1',
      type: 'jsonParse',
      position: { x: 500, y: 300 },
      data: {
        label: 'Parse Response',
        config: {
          sourcePath: '$.holders',
          strict: true,
        },
      },
    },
    {
      id: 'filter-1',
      type: 'filter',
      position: { x: 700, y: 300 },
      data: {
        label: 'Active Only',
        config: {
          conditions: [
            { field: 'input.isActive', operator: 'equals', value: 'true' },
          ],
          combineWith: 'and',
        },
      },
    },
    {
      id: 'if-1',
      type: 'if',
      position: { x: 900, y: 300 },
      data: {
        label: 'Balance > 1000?',
        config: {
          conditions: [
            { field: '{{filter-1.balance}}', operator: 'gt', value: '1000' },
          ],
          combineWith: 'and',
        },
      },
    },
    {
      id: 'log-high',
      type: 'log',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Log High Balance',
        config: {
          level: 'info',
          messageTemplate: 'High balance holder: {{filter-1.address}} with {{filter-1.balance}}',
        },
      },
    },
    {
      id: 'log-low',
      type: 'log',
      position: { x: 1100, y: 400 },
      data: {
        label: 'Log Low Balance',
        config: {
          level: 'warn',
          messageTemplate: 'Low balance holder: {{filter-1.address}} with {{filter-1.balance}}',
        },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'http-1' },
    { id: 'e2', source: 'http-1', target: 'parse-1' },
    { id: 'e3', source: 'parse-1', target: 'filter-1' },
    { id: 'e4', source: 'filter-1', target: 'if-1' },
    { id: 'e5', source: 'if-1', target: 'log-high', sourceHandle: 'true' },
    { id: 'e6', source: 'if-1', target: 'log-low', sourceHandle: 'false' },
  ],
  createdAt: '2026-02-14T00:00:00Z',
  updatedAt: '2026-02-14T00:00:00Z',
};

// =============================================================================
// 4. EvmLogTrigger → EVM Read → HTTP → If → MintToken / Error (Complex, 8 nodes)
// Use case: On-chain event triggers cross-chain minting with API validation
// =============================================================================

export const evmMintingPipeline: Workflow = {
  id: 'evm-minting-pipeline',
  name: 'Cross-Chain KYC Minting',
  description: 'On-chain Transfer event triggers balance check, API validation, and conditional token minting on another chain',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: 'ethereum-testnet-sepolia',
    secrets: [
      { name: 'VALIDATION_API_KEY', envVariable: 'VALIDATION_API_KEY_VAR' },
    ],
    rpcs: [
      {
        chainName: 'ethereum-testnet-sepolia',
        url: 'https://0xrpc.io/sep',
      },
      {
        chainName: 'base-testnet-sepolia',
        url: 'https://base-sepolia.drpc.org',
      },
    ],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'evmLogTrigger',
      position: { x: 100, y: 300 },
      data: {
        label: 'Transfer Event',
        config: {
          chainSelectorName: 'ethereum-testnet-sepolia',
          contractAddresses: ['0x1234567890abcdef1234567890abcdef12345678'],
          eventSignature: 'Transfer(address,address,uint256)',
          eventAbi: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { name: 'from', type: 'address', indexed: true },
              { name: 'to', type: 'address', indexed: true },
              { name: 'value', type: 'uint256', indexed: false },
            ],
          },
          blockConfirmation: 'finalized',
        },
      },
    },
    {
      id: 'evm-read-1',
      type: 'evmRead',
      position: { x: 300, y: 300 },
      data: {
        label: 'Check Balance',
        config: {
          chainSelectorName: 'ethereum-testnet-sepolia',
          contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
          abi: {
            type: 'function',
            name: 'balanceOf',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
            stateMutability: 'view',
          },
          functionName: 'balanceOf',
          args: [
            {
              type: 'reference',
              value: '{{trigger-1.to}}',
              abiType: 'address',
            },
          ],
          blockNumber: 'latest',
        },
      },
    },
    {
      id: 'http-1',
      type: 'httpRequest',
      position: { x: 500, y: 300 },
      data: {
        label: 'Validate User',
        config: {
          method: 'POST',
          url: 'https://api.example.com/validate',
          authentication: {
            type: 'bearerToken',
            tokenSecret: 'VALIDATION_API_KEY',
          },
          headers: { 'Content-Type': 'application/json' },
          body: {
            contentType: 'json',
            data: '{"address":"{{trigger-1.to}}","balance":"{{evm-read-1.balance}}"}',
          },
          responseFormat: 'json',
          timeout: 10000,
        },
      },
    },
    {
      id: 'parse-1',
      type: 'jsonParse',
      position: { x: 700, y: 300 },
      data: {
        label: 'Parse Validation',
        config: {
          strict: true,
        },
      },
    },
    {
      id: 'if-1',
      type: 'if',
      position: { x: 900, y: 300 },
      data: {
        label: 'Is Valid?',
        config: {
          conditions: [
            { field: '{{parse-1.isValid}}', operator: 'equals', value: 'true' },
          ],
          combineWith: 'and',
        },
      },
    },
    {
      id: 'mint-1',
      type: 'mintToken',
      position: { x: 1100, y: 200 },
      data: {
        label: 'Mint Tokens',
        config: {
          chainSelectorName: 'base-testnet-sepolia',
          tokenContractAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          tokenAbi: {
            type: 'function',
            name: 'mint',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
          },
          recipientSource: '{{trigger-1.to}}',
          amountSource: '{{evm-read-1.balance}}',
          gasLimit: '500000',
        },
      },
    },
    {
      id: 'return-1',
      type: 'return',
      position: { x: 1300, y: 200 },
      data: {
        label: 'Return Success',
        config: {
          returnExpression: '"Minted successfully"',
        },
      },
    },
    {
      id: 'error-1',
      type: 'error',
      position: { x: 1100, y: 400 },
      data: {
        label: 'Validation Failed',
        config: {
          errorMessage: 'User {{trigger-1.to}} failed validation',
        },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'evm-read-1' },
    { id: 'e2', source: 'evm-read-1', target: 'http-1' },
    { id: 'e3', source: 'http-1', target: 'parse-1' },
    { id: 'e4', source: 'parse-1', target: 'if-1' },
    { id: 'e5', source: 'if-1', target: 'mint-1', sourceHandle: 'true' },
    { id: 'e6', source: 'if-1', target: 'error-1', sourceHandle: 'false' },
    { id: 'e7', source: 'mint-1', target: 'return-1' },
  ],
  createdAt: '2026-02-14T00:00:00Z',
  updatedAt: '2026-02-14T00:00:00Z',
};
