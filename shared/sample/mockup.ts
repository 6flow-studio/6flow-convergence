import type { Workflow } from '../model/node';

export const mockupWorkflow: Workflow = {
  "id": "k17ce7ppz28n0wx5wq9vk95srn8255tf",
  "name": "Proof of Reserve",
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
                "apigw-requestid": "Zu3g1gDGiYcEMmg=",
                "connection": "keep-alive",
                "content-length": "410",
                "content-type": "application/json",
                "date": "Thu, 05 Mar 2026 04:26:44 GMT",
                "via": "1.1 d0f73d242b023619d4e4df51e5950fac.cloudfront.net (CloudFront)",
                "x-amz-cf-id": "ZnYLMn-ig3C91PLN4_9PqyxdaF8JSBaTGuaWC3ne8cFZtypy2ye6ng==",
                "x-amz-cf-pop": "MRS52-P6",
                "x-cache": "Miss from cloudfront"
              },
              "body": "{\"accountName\":\"TrueUSD\",\"totalTrust\":501928900.88,\"totalToken\":494515082.75,\"updatedAt\":\"2026-03-05T04:26:35.578Z\",\"token\":[{\"tokenName\":\"TUSD (ETH)\",\"totalTokenByChain\":315125540.9523497},{\"tokenName\":\"TUSD (AVAX)\",\"totalTokenByChain\":845723.78},{\"tokenName\":\"TUSD (TRON)\",\"totalTokenByChain\":168513454.1376503},{\"tokenName\":\"TUSD (BSC)\",\"totalTokenByChain\":10030363.88}],\"ripcord\":false,\"ripcordDetails\":[]}"
            },
            "normalized": {
              "statusCode": 200,
              "body": {
                "accountName": "TrueUSD",
                "totalTrust": 501928900.88,
                "totalToken": "[redacted]",
                "updatedAt": "2026-03-05T04:26:35.578Z",
                "token": "[redacted]",
                "ripcord": false,
                "ripcordDetails": []
              },
              "headers": {
                "apigw-requestid": "Zu3g1gDGiYcEMmg=",
                "connection": "keep-alive",
                "content-length": "410",
                "content-type": "application/json",
                "date": "Thu, 05 Mar 2026 04:26:44 GMT",
                "via": "1.1 d0f73d242b023619d4e4df51e5950fac.cloudfront.net (CloudFront)",
                "x-amz-cf-id": "ZnYLMn-ig3C91PLN4_9PqyxdaF8JSBaTGuaWC3ne8cFZtypy2ye6ng==",
                "x-amz-cf-pop": "MRS52-P6",
                "x-cache": "Miss from cloudfront"
              }
            },
            "warnings": [],
            "truncated": false
          },
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "statusCode",
                "path": "statusCode",
                "schema": {
                  "type": "number",
                  "path": "statusCode"
                }
              },
              {
                "key": "body",
                "path": "body",
                "schema": {
                  "type": "object",
                  "path": "body",
                  "fields": [
                    {
                      "key": "accountName",
                      "path": "body.accountName",
                      "schema": {
                        "type": "string",
                        "path": "body.accountName"
                      }
                    },
                    {
                      "key": "totalTrust",
                      "path": "body.totalTrust",
                      "schema": {
                        "type": "number",
                        "path": "body.totalTrust"
                      }
                    },
                    {
                      "key": "totalToken",
                      "path": "body.totalToken",
                      "schema": {
                        "type": "string",
                        "path": "body.totalToken"
                      }
                    },
                    {
                      "key": "updatedAt",
                      "path": "body.updatedAt",
                      "schema": {
                        "type": "string",
                        "path": "body.updatedAt"
                      }
                    },
                    {
                      "key": "token",
                      "path": "body.token",
                      "schema": {
                        "type": "string",
                        "path": "body.token"
                      }
                    },
                    {
                      "key": "ripcord",
                      "path": "body.ripcord",
                      "schema": {
                        "type": "boolean",
                        "path": "body.ripcord"
                      }
                    },
                    {
                      "key": "ripcordDetails",
                      "path": "body.ripcordDetails",
                      "schema": {
                        "type": "array",
                        "path": "body.ripcordDetails",
                        "itemSchema": {
                          "type": "unknown",
                          "path": "body.ripcordDetails[]"
                        }
                      }
                    }
                  ]
                }
              },
              {
                "key": "headers",
                "path": "headers",
                "schema": {
                  "type": "object",
                  "path": "headers",
                  "fields": [
                    {
                      "key": "apigw-requestid",
                      "path": "headers.apigw-requestid",
                      "schema": {
                        "type": "string",
                        "path": "headers.apigw-requestid"
                      }
                    },
                    {
                      "key": "connection",
                      "path": "headers.connection",
                      "schema": {
                        "type": "string",
                        "path": "headers.connection"
                      }
                    },
                    {
                      "key": "content-length",
                      "path": "headers.content-length",
                      "schema": {
                        "type": "string",
                        "path": "headers.content-length"
                      }
                    },
                    {
                      "key": "content-type",
                      "path": "headers.content-type",
                      "schema": {
                        "type": "string",
                        "path": "headers.content-type"
                      }
                    },
                    {
                      "key": "date",
                      "path": "headers.date",
                      "schema": {
                        "type": "string",
                        "path": "headers.date"
                      }
                    },
                    {
                      "key": "via",
                      "path": "headers.via",
                      "schema": {
                        "type": "string",
                        "path": "headers.via"
                      }
                    },
                    {
                      "key": "x-amz-cf-id",
                      "path": "headers.x-amz-cf-id",
                      "schema": {
                        "type": "string",
                        "path": "headers.x-amz-cf-id"
                      }
                    },
                    {
                      "key": "x-amz-cf-pop",
                      "path": "headers.x-amz-cf-pop",
                      "schema": {
                        "type": "string",
                        "path": "headers.x-amz-cf-pop"
                      }
                    },
                    {
                      "key": "x-cache",
                      "path": "headers.x-cache",
                      "schema": {
                        "type": "string",
                        "path": "headers.x-cache"
                      }
                    }
                  ]
                }
              }
            ]
          },
          "schemaSource": "executed",
          "executedAt": "2026-03-05T04:26:45.011Z"
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
                  "type": "number",
                  "path": "value"
                }
              }
            ]
          },
          "schemaSource": "derived",
          "executedAt": "2026-03-02T13:13:11.967Z"
        }
      }
    },
    {
      "id": "getriskscore_1",
      "type": "ai",
      "position": {
        "x": 909.6775798415616,
        "y": 294.03389556814176
      },
      "data": {
        "label": "getRiskScore",
        "config": {
          "provider": "google",
          "baseUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
          "model": "gemini-3-flash-preview",
          "apiKeySecret": "GEMINI_KEY",
          "systemPrompt": "You are a risk analyst. You will receive two numbers:\n- TotalSupply: total token supply, scaled to 18 decimal places (raw integer).\n- TotalReserveScaled: total reserved/collateral amount, scaled to 18 decimal places (raw integer).\n\nCompute coverage as: coverage = TotalReserveScaled / TotalSupply (both are same scale, so this is the reserve-to-supply ratio).\n\nApply this risk scale exactly:\n- If coverage >= 1.2: riskScore = 0\n- Else: riskScore = min(100, round(((1.2 - coverage) / 1.2) * 100))\n\nRespond with the risk score as structured JSON only, no other text or markdown.\n\nOutput format (valid JSON only):\n{\"riskScore\": <integer>}`",
          "userPrompt": "TotalSupply: {{getOnChainSupply.value}}\nTotalReserveScaled: {{getTotalSupply._totalSupply}}",
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
        "x": 1405.8888880454115,
        "y": 359.0012917731084
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
              "source": "{{getOnChainSupply.value}}"
            },
            {
              "paramName": "totalReserve",
              "source": "{{getTotalSupply._totalSupply}}"
            },
            {
              "paramName": "riskScore",
              "source": "{{riskScore.riskScore}}"
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
      "id": "updatereserves_0",
      "type": "evmWrite",
      "position": {
        "x": 1633.5658978090985,
        "y": 357.7701336705854
      },
      "data": {
        "label": "updateReserves",
        "config": {
          "chainSelectorName": "ethereum-testnet-sepolia",
          "receiverAddress": "0x93F212a3634D6259cF38cfad4AA4A3485C3d7D59",
          "gasLimit": "500000",
          "abiParams": [],
          "dataMapping": [],
          "encodedData": "{{node_1772523224998_2.encoded}}"
        }
      }
    },
    {
      "id": "gettotalsupply_14",
      "type": "codeNode",
      "position": {
        "x": 700.8326415553222,
        "y": 212.85653387798746
      },
      "data": {
        "label": "getTotalSupply",
        "config": {
          "code": "let _totalSupply = BigInt(Math.round(getOffChainReserves.body.totalToken)) * BigInt(1e18)",
          "language": "typescript",
          "executionMode": "runOnceForAll",
          "inputVariables": [],
          "outputFields": [
            {
              "key": "_totalSupply",
              "type": "number"
            }
          ]
        },
        "editor": {
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "_totalSupply",
                "path": "_totalSupply",
                "schema": {
                  "type": "number",
                  "path": "_totalSupply"
                }
              }
            ]
          },
          "schemaSource": "declared"
        }
      }
    },
    {
      "id": "riskscore_9",
      "type": "codeNode",
      "position": {
        "x": 1119.8485503406766,
        "y": 294.2025139915213
      },
      "data": {
        "label": "riskScore",
        "config": {
          "code": "const textString = getRiskScore.candidates[0].content.parts[0].text;\n// 2. Parse the string into a JavaScript object\nconst parsedData = JSON.parse(textString);\n// 3. Access the riskScore\nconst riskScore = parsedData.riskScore;",
          "language": "typescript",
          "executionMode": "runOnceForAll",
          "inputVariables": [],
          "outputFields": [
            {
              "key": "riskScore",
              "type": "number"
            }
          ]
        },
        "editor": {
          "outputSchema": {
            "type": "object",
            "path": "",
            "fields": [
              {
                "key": "riskScore",
                "path": "riskScore",
                "schema": {
                  "type": "number",
                  "path": "riskScore"
                }
              }
            ]
          },
          "schemaSource": "declared"
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
      "id": "xy-edge__node_1772523224998_2output-node_1772544727219_1input",
      "source": "node_1772523224998_2",
      "target": "updatereserves_0",
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
      "id": "xy-edge__getonchainsupply_3output-getriskscore_1input",
      "source": "getonchainsupply_3",
      "target": "getriskscore_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getoffchainreserves_1output-node_1772683801734_0input",
      "source": "getoffchainreserves_1",
      "target": "gettotalsupply_14",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__node_1772683801734_0output-getriskscore_1input",
      "source": "gettotalsupply_14",
      "target": "getriskscore_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__node_1772683801734_0output-node_1772523224998_2input",
      "source": "gettotalsupply_14",
      "target": "node_1772523224998_2",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__getriskscore_1output-node_1772691052135_0input",
      "source": "getriskscore_1",
      "target": "riskscore_9",
      "sourceHandle": "output",
      "targetHandle": "input"
    },
    {
      "id": "xy-edge__riskscore_9output-node_1772523224998_2input",
      "source": "riskscore_9",
      "target": "node_1772523224998_2",
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
  "createdAt": "2026-03-05T06:16:24.718Z",
  "updatedAt": "2026-03-05T06:16:24.718Z"
};
