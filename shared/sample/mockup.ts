import type { Workflow } from '../model/node';

export const mockupWorkflow: Workflow = {
  "id": "k17ce7ppz28n0wx5wq9vk95srn8255tf",
  "name": "POR 1",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node_1772451937785_0",
      "type": "cronTrigger",
      "position": {
        "x": 272.34559225816463,
        "y": 286.90528612791843
      },
      "data": {
        "label": "Cron Trigger",
        "config": {
          "schedule": "0 */10 * * * *",
          "timezone": "UTC"
        }
      }
    },
    {
      "id": "getoffchainreserves_1",
      "type": "httpRequest",
      "position": {
        "x": 501.8148906363406,
        "y": 213.33844177696471
      },
      "data": {
        "label": "getOffChainReserves",
        "config": {
          "method": "GET",
          "url": "https://api.real-time-reserves.verinumus.io/v1/chainlink/proof-of-reserves/TrueUSD",
          "responseFormat": "json"
        },
        "editor": {
          "lastExecution": {
            "raw": {
              "statusCode": 200,
              "headers": {
                "apigw-requestid": "ZmLvaiuKiYcEPLA=",
                "connection": "keep-alive",
                "content-length": "410",
                "content-type": "application/json",
                "date": "Mon, 02 Mar 2026 13:12:40 GMT",
                "via": "1.1 ba8d8ed107bf844dc316ae0f8c191068.cloudfront.net (CloudFront)",
                "x-amz-cf-id": "92C7QYkczV1UQNOYFbYUS-oY7WkhX06PGP2UauPLmbrsgFTGkqVDXA==",
                "x-amz-cf-pop": "MRS52-P6",
                "x-cache": "Miss from cloudfront"
              },
              "body": "{\"accountName\":\"TrueUSD\",\"totalTrust\":501928900.88,\"totalToken\":494515082.75,\"updatedAt\":\"2026-03-02T13:12:35.628Z\",\"token\":[{\"tokenName\":\"TUSD (ETH)\",\"totalTokenByChain\":315125540.9523497},{\"tokenName\":\"TUSD (AVAX)\",\"totalTokenByChain\":845723.78},{\"tokenName\":\"TUSD (TRON)\",\"totalTokenByChain\":168513454.1376503},{\"tokenName\":\"TUSD (BSC)\",\"totalTokenByChain\":10030363.88}],\"ripcord\":false,\"ripcordDetails\":[]}"
            },
            "normalized": {
              "accountName": "TrueUSD",
              "totalTrust": 501928900.88,
              "totalToken": "[redacted]",
              "updatedAt": "2026-03-02T13:12:35.628Z",
              "token": "[redacted]",
              "ripcord": false,
              "ripcordDetails": []
            },
            "warnings": [],
            "truncated": false
          },
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "accountName",
                "path": "accountName",
                "schema": {
                  "type": "string",
                  "path": "accountName"
                }
              },
              {
                "key": "totalTrust",
                "path": "totalTrust",
                "schema": {
                  "type": "number",
                  "path": "totalTrust"
                }
              },
              {
                "key": "totalToken",
                "path": "totalToken",
                "schema": {
                  "type": "string",
                  "path": "totalToken"
                }
              },
              {
                "key": "updatedAt",
                "path": "updatedAt",
                "schema": {
                  "type": "string",
                  "path": "updatedAt"
                }
              },
              {
                "key": "token",
                "path": "token",
                "schema": {
                  "type": "string",
                  "path": "token"
                }
              },
              {
                "key": "ripcord",
                "path": "ripcord",
                "schema": {
                  "type": "boolean",
                  "path": "ripcord"
                }
              },
              {
                "key": "ripcordDetails",
                "path": "ripcordDetails",
                "schema": {
                  "type": "array",
                  "path": "ripcordDetails",
                  "itemSchema": {
                    "type": "unknown",
                    "path": "ripcordDetails[]"
                  }
                }
              }
            ]
          },
          "schemaSource": "executed",
          "executedAt": "2026-03-02T13:12:40.828Z"
        }
      }
    },
    {
      "id": "getonchainsupply_3",
      "type": "evmRead",
      "position": {
        "x": 506,
        "y": 360
      },
      "data": {
        "label": "getOnChainSupply",
        "config": {
          "chainSelectorName": "ethereum-testnet-sepolia",
          "contractAddress": "0x41f77d6aa3F8C8113Bc95831490D5206c5d1cFeE",
          "functionName": "totalSupply",
          "args": [],
          "abi": {
            "inputs": [],
            "name": "totalSupply",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          },
          "cachedAbi": {
            "address": "0x41f77d6aa3F8C8113Bc95831490D5206c5d1cFeE",
            "chain": "ethereum-testnet-sepolia",
            "functions": [
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "owner",
                    "type": "address"
                  },
                  {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                  }
                ],
                "name": "allowance",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [
                  {
                    "internalType": "address",
                    "name": "account",
                    "type": "address"
                  }
                ],
                "name": "balanceOf",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "decimals",
                "outputs": [
                  {
                    "internalType": "uint8",
                    "name": "",
                    "type": "uint8"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "name",
                "outputs": [
                  {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "owner",
                "outputs": [
                  {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "symbol",
                "outputs": [
                  {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              },
              {
                "inputs": [],
                "name": "totalSupply",
                "outputs": [
                  {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                  }
                ],
                "stateMutability": "view",
                "type": "function"
              }
            ]
          }
        },
        "editor": {
          "lastExecution": {
            "raw": {
              "rpcUrl": "https://eth-sepolia.g.alchemy.com/v2/5ksCAZD8NOI0ANaeCVCnS",
              "contractAddress": "0x41f77d6aa3F8C8113Bc95831490D5206c5d1cFeE",
              "functionName": "totalSupply",
              "args": [],
              "result": "1000000000000000000000000"
            },
            "normalized": {
              "value": "1000000000000000000000000"
            },
            "warnings": [],
            "truncated": false
          },
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "value",
                "path": "value",
                "schema": {
                  "type": "string",
                  "path": "value"
                }
              }
            ]
          },
          "schemaSource": "executed",
          "executedAt": "2026-03-02T13:13:11.967Z"
        }
      }
    },
    {
      "id": "getriskscore_1",
      "type": "ai",
      "position": {
        "x": 748.8482515595015,
        "y": 280.6282816466045
      },
      "data": {
        "label": "getRiskScore",
        "config": {
          "provider": "google",
          "baseUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
          "model": "gemini-3-flash-preview",
          "apiKeySecret": "GEMINI_KEY",
          "systemPrompt": "You are a risk analyst. You will receive two numbers:\n- TotalSupply: total token supply, scaled to 18 decimal places (raw integer).\n- TotalReserveScaled: total reserved/collateral amount, scaled to 18 decimal places (raw integer).\n\nCompute coverage as: coverage = TotalReserveScaled / TotalSupply (both are same scale, so this is the reserve-to-supply ratio).\n\nApply this risk scale exactly:\n- If coverage >= 1.2: riskScore = 0\n- Else: riskScore = min(100, round(((1.2 - coverage) / 1.2) * 100))\n\nRespond with the risk score as structured JSON only, no other text or markdown.\n\nOutput format (valid JSON only):\n{\"riskScore\": <integer>}",
          "userPrompt": "TotalSupply: {{getonchainsupply_3.value}}\nTotalReserveScaled: {{getoffchainreserves_1.totalToken}}",
          "temperature": 0.7,
          "responseFormat": "text"
        },
        "editor": {
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "candidates",
                "path": "candidates",
                "schema": {
                  "type": "array",
                  "path": "candidates",
                  "itemSchema": {
                    "type": "object",
                    "path": "candidates[]",
                    "fields": [
                      {
                        "key": "content",
                        "path": "candidates[0].content",
                        "schema": {
                          "type": "object",
                          "path": "candidates[0].content",
                          "fields": [
                            {
                              "key": "parts",
                              "path": "candidates[0].content.parts",
                              "schema": {
                                "type": "array",
                                "path": "candidates[0].content.parts",
                                "itemSchema": {
                                  "type": "object",
                                  "path": "candidates[0].content.parts[]",
                                  "fields": [
                                    {
                                      "key": "text",
                                      "path": "candidates[0].content.parts[0].text",
                                      "schema": {
                                        "type": "string",
                                        "path": "candidates[0].content.parts[0].text"
                                      }
                                    }
                                  ]
                                }
                              }
                            },
                            {
                              "key": "role",
                              "path": "candidates[0].content.role",
                              "schema": {
                                "type": "string",
                                "path": "candidates[0].content.role"
                              }
                            }
                          ]
                        }
                      },
                      {
                        "key": "finishReason",
                        "path": "candidates[0].finishReason",
                        "schema": {
                          "type": "string",
                          "path": "candidates[0].finishReason"
                        }
                      }
                    ]
                  }
                }
              },
              {
                "key": "promptFeedback",
                "path": "promptFeedback",
                "schema": {
                  "type": "object",
                  "path": "promptFeedback",
                  "fields": [
                    {
                      "key": "blockReason",
                      "path": "promptFeedback.blockReason",
                      "schema": {
                        "type": "string",
                        "path": "promptFeedback.blockReason"
                      }
                    }
                  ]
                }
              },
              {
                "key": "usageMetadata",
                "path": "usageMetadata",
                "schema": {
                  "type": "object",
                  "path": "usageMetadata",
                  "fields": [
                    {
                      "key": "promptTokenCount",
                      "path": "usageMetadata.promptTokenCount",
                      "schema": {
                        "type": "string",
                        "path": "usageMetadata.promptTokenCount"
                      }
                    },
                    {
                      "key": "candidatesTokenCount",
                      "path": "usageMetadata.candidatesTokenCount",
                      "schema": {
                        "type": "string",
                        "path": "usageMetadata.candidatesTokenCount"
                      }
                    },
                    {
                      "key": "totalTokenCount",
                      "path": "usageMetadata.totalTokenCount",
                      "schema": {
                        "type": "string",
                        "path": "usageMetadata.totalTokenCount"
                      }
                    }
                  ]
                }
              }
            ]
          },
          "schemaSource": "declared"
        }
      }
    },
    {
      "id": "node_1772523224998_2",
      "type": "abiEncode",
      "position": {
        "x": 1221.9381339879453,
        "y": 301.50683932017273
      },
      "data": {
        "label": "ABI Encode",
        "config": {
          "abiParams": [
            {
              "name": "totalMinted",
              "type": "uint256"
            },
            {
              "name": "totalReserve",
              "type": "uint256"
            },
            {
              "name": "riskScore",
              "type": "uint256"
            }
          ],
          "dataMapping": [
            {
              "paramName": "totalMinted",
              "source": "{{getonchainsupply_3.value}}"
            },
            {
              "paramName": "totalReserve",
              "source": "{{getoffchainreserves_1.totalToken}}"
            },
            {
              "paramName": "riskScore",
              "source": "{{getriskscore_1.candidates[0].content.parts[0].text}}"
            }
          ]
        },
        "editor": {
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "encoded",
                "path": "encoded",
                "schema": {
                  "type": "string",
                  "path": "encoded"
                }
              }
            ]
          },
          "schemaSource": "derived"
        }
      }
    },
    {
      "id": "node_1772544727219_1",
      "type": "evmWrite",
      "position": {
        "x": 1458.2326849721512,
        "y": 303.93164347546445
      },
      "data": {
        "label": "EVM Write",
        "config": {
          "chainSelectorName": "ethereum-testnet-sepolia",
          "receiverAddress": "0x93F212a3634D6259cF38cfad4AA4A3485C3d7D59",
          "gasLimit": "500000",
          "abiParams": [],
          "dataMapping": [],
          "encodedData": "{{node_1772523224998_2.encoded}}"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "xy-edge__node_1772451937785_0output-node_1772451941969_1input",
      "source": "node_1772451937785_0",
      "target": "getoffchainreserves_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__node_1772451937785_0output-node_1772452114820_3input",
      "source": "node_1772451937785_0",
      "target": "getonchainsupply_3",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__node_1772452114820_3output-node_1772461505671_1input",
      "source": "getonchainsupply_3",
      "target": "getriskscore_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getonchainsupply_3output-node_1772523224998_2input",
      "source": "getonchainsupply_3",
      "target": "node_1772523224998_2",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getriskscore_1output-node_1772523224998_2input",
      "source": "getriskscore_1",
      "target": "node_1772523224998_2",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getoffchainreserves_1output-getriskscore_1input",
      "source": "getoffchainreserves_1",
      "target": "getriskscore_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getoffchainreserves_1output-node_1772523224998_2input",
      "source": "getoffchainreserves_1",
      "target": "node_1772523224998_2",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__node_1772523224998_2output-node_1772544727219_1input",
      "source": "node_1772523224998_2",
      "target": "node_1772544727219_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    }
  ],
  "globalConfig": {
    "isTestnet": true,
    "secrets": [
      {
        "name": "GEMINI_KEY",
        "envVariable": "GEMINI_KEY_VALUE"
      }
    ],
    "rpcs": []
  },
  "createdAt": "2026-03-03T14:33:39.500Z",
  "updatedAt": "2026-03-03T14:33:39.500Z"
};
