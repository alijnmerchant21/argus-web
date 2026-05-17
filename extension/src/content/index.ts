import { ChatGPTAdapter } from "./adapters/chatgpt";
import { ClaudeAdapter }   from "./adapters/claude";
import { GeminiAdapter }   from "./adapters/gemini";
import type { BaseAdapter } from "./adapters/base";

const HOST = location.hostname;

let adapter: BaseAdapter | null = null;

if (HOST.includes("chatgpt.com") || HOST.includes("chat.openai.com")) {
  adapter = new ChatGPTAdapter();
} else if (HOST.includes("claude.ai")) {
  adapter = new ClaudeAdapter();
} else if (HOST.includes("gemini.google.com")) {
  adapter = new GeminiAdapter();
}

adapter?.init().catch(console.error);
