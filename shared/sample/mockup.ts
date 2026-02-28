import type { Workflow } from '../model/node';

export const mockupWorkflow: Workflow = {
  "id": "k1757pf7fpab0k6x231nt0sg5n821rrp",
  "name": "claude",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "node_1772290478148_0",
      "type": "cronTrigger",
      "position": {
        "x": 346,
        "y": 290
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
      "id": "node_1772290494095_1",
      "type": "ai",
      "position": {
        "x": 594,
        "y": 292
      },
      "data": {
        "label": "AI",
        "config": {
          "provider": "openai",
          "baseUrl": "https://api.openai.com/v1/chat/completions",
          "model": "gpt-5-nano",
          "apiKeySecret": "OPENAI_KEY",
          "systemPrompt": "you are helpful",
          "userPrompt": "hi",
          "temperature": 0.7,
          "responseFormat": "text"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "xy-edge__node_1772290478148_0output-node_1772290494095_1input",
      "source": "node_1772290478148_0",
      "target": "node_1772290494095_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    }
  ],
  "globalConfig": {
    "isTestnet": true,
    "secrets": [
      {
        "name": "CLAUDE_KEY",
        "envVariable": "CLAUDE_API_KEY"
      },
      {
        "name": "OPENAI_KEY",
        "envVariable": "OPENAI_API_KEY"
      }
    ],
    "rpcs": []
  },
  "createdAt": "2026-02-28T15:15:39.130Z",
  "updatedAt": "2026-02-28T15:15:39.130Z"
};
