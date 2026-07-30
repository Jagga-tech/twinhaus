# @twinhaus/agent

The AI brain. A provider-agnostic tool-calling loop mapped to Home Assistant services and twin queries. Swap between **Anthropic**, **OpenAI**, and **Ollama** (fully local) without touching the agent logic.

## Usage

```ts
import { Agent, AnthropicProvider, type HomeContext } from '@twinhaus/agent';

const context: HomeContext = {
  describeHome: async () => '...rooms and devices...',
  getRoomDevices: async (room) => '...devices in room...',
  callService: async ({ domain, service, entityId }) =>
    `Called ${domain}.${service} on ${entityId}.`,
};

const agent = new Agent({
  provider: new AnthropicProvider({ apiKey: '<key>' }), // or OpenAiProvider / OllamaProvider
  context,
});

const reply = await agent.send('dim the living room and lock the back door', (event) => {
  console.log(event); // 'text' | 'tool_call' | 'tool_result'
});
```

- **`Agent`**, runs the tool loop until the model produces a final answer.
- **`HomeContext`**, the runtime the tools act on (`describe_home`, `get_room_devices`, `call_service`). The consumer wires it to the twin + `@twinhaus/ha-bridge`; the agent stays decoupled from both.
- **Providers**, `AnthropicProvider` (defaults to `claude-opus-5`), `OpenAiProvider`, `OllamaProvider`.
