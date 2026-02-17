import type { Workflow } from '../model/node';

export const mockupWorkflow: Workflow = {
  id: 'mockup-workflow',
  name: 'HTTP Trigger to AI Action',
  description: 'Receive an HTTP request and use an AI node to decide the next action',
  version: '1.0.0',
  globalConfig: {
    isTestnet: true,
    defaultChainSelector: '',
    secrets: [
      {
        name: 'OPENAI_API_KEY',
        envVariable: 'OPENAI_API_KEY',
      },
    ],
    rpcs: [],
  },
  nodes: [
    {
      id: 'trigger-1',
      type: 'httpTrigger',
      position: { x: 120, y: 220 },
      data: {
        label: 'Incoming Webhook',
        config: {
          httpMethod: 'POST',
          path: '/ai/action',
          authentication: { type: 'none' },
          responseMode: 'lastNode',
          responseCode: 200,
          responseHeaders: {
            'Content-Type': 'application/json',
          },
          allowedOrigins: ['*'],
        },
      },
    },
    {
      id: 'ai-1',
      type: 'ai',
      position: { x: 400, y: 220 },
      data: {
        label: 'Decide Next Action',
        config: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
          apiKeySecret: 'OPENAI_API_KEY',
          systemPrompt: 'You are an operations assistant. Return a concise next-action recommendation in JSON.',
          userPrompt: 'Analyze the incoming webhook request and return one clear recommended action.',
          temperature: 0.2,
          maxTokens: 200,
          responseFormat: 'json',
          timeout: 10000,
          maxRetries: 2,
        },
      },
    },
    {
      id: 'return-1',
      type: 'return',
      position: { x: 680, y: 220 },
      data: {
        label: 'Return AI Result',
        config: {
          returnExpression: '{{ai-1.choices[0].message.content}}',
        },
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'trigger-1', target: 'ai-1' },
    { id: 'e2', source: 'ai-1', target: 'return-1' },
  ],
  createdAt: '2026-02-17T00:00:00Z',
  updatedAt: '2026-02-17T00:00:00Z',
};
