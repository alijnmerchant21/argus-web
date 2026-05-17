import { BaseAdapter } from "./base";

export class GeminiAdapter extends BaseAdapter {
  protected platform = "gemini";

  protected isAIEndpoint(url: string): boolean {
    return (
      url.includes("gemini.google.com") ||
      url.includes("generativelanguage.googleapis.com")
    );
  }

  protected extractPrompt(body: string): string | null {
    try {
      const parsed   = JSON.parse(body);
      const contents = parsed?.contents ?? parsed?.inputs ?? [];
      const last     = [...contents].reverse().find(
        (c: { role?: string }) => !c.role || c.role === "user"
      );
      if (!last) return null;
      const parts: { text?: string }[] = last.parts ?? last.content ?? [];
      return parts.filter((p) => p.text).map((p) => p.text as string).join(" ") || null;
    } catch { return null; }
  }
}
