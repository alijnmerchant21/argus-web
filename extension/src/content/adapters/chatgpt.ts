import { BaseAdapter } from "./base";

export class ChatGPTAdapter extends BaseAdapter {
  protected platform = "chatgpt";

  protected isAIEndpoint(url: string): boolean {
    return (
      url.includes("/backend-api/conversation") ||
      url.includes("/backend-anon/conversation") ||
      url.includes("openai.com/v1/chat/completions")
    );
  }

  protected extractPrompt(body: string): string | null {
    try {
      const parsed   = JSON.parse(body);
      const messages = parsed?.messages ?? [];
      const last     = [...messages].reverse().find(
        (m: { role: string }) => m.role === "user"
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
