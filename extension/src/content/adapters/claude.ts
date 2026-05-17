import { BaseAdapter } from "./base";

export class ClaudeAdapter extends BaseAdapter {
  protected platform = "claude";

  protected isAIEndpoint(url: string): boolean {
    return (
      url.includes("claude.ai/api") ||
      url.includes("/chat_conversations") ||
      url.includes("anthropic.com/v1/messages")
    );
  }

  protected extractPrompt(body: string): string | null {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed?.prompt === "string") return parsed.prompt;
      const messages = parsed?.messages ?? [];
      const last     = [...messages].reverse().find(
        (m: { role: string }) => m.role === "human" || m.role === "user"
      );
      if (!last) return null;
      const c = last.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c.filter((p: { type: string }) => p.type === "text")
                .map((p: { text: string }) => p.text)
                .join(" ");
      }
      return null;
    } catch { return null; }
  }
}
