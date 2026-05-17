import type { Rule, MatchResult } from "../../shared/types";
import { storage } from "../../shared/storage";
import { checkText } from "../engine/matcher";
import { showBlockOverlay } from "../ui/BlockOverlay";
import { showWarnBanner }   from "../ui/WarnBanner";
import { showFlagBadge }    from "../ui/FlagBadge";
import { clearOverlays }    from "../ui/index";

export abstract class BaseAdapter {
  protected rules:   Rule[]   = [];
  protected enabled: boolean  = true;
  protected platform: string  = "unknown";

  async init(): Promise<void> {
    [this.rules, this.enabled] = await Promise.all([storage.getRules(), storage.isEnabled()]);
    this.interceptFetch();
    this.watchNavigation();
    this.attachDomFallback();

    // Refresh rules when service worker pushes an update
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "rulesUpdated") {
        storage.getRules().then((r) => { this.rules = r; });
      }
      if (msg.action === "enabledChanged") {
        this.enabled = msg.value;
        if (!this.enabled) clearOverlays();
      }
    });
  }

  private interceptFetch(): void {
    const self           = this;
    const originalFetch  = window.fetch.bind(window);

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      if (self.enabled) {
        const url = typeof input === "string" ? input
          : input instanceof URL ? input.href
          : (input as Request).url;

        if (self.isAIEndpoint(url) && init?.body) {
          const prompt = self.extractPrompt(String(init.body));
          if (prompt) {
            const result = checkText(prompt, self.rules, "input");
            if (result.matched && result.rule) {
              await self.handleMatch(result, prompt);
              if (result.rule.action === "block") {
                throw new Error(`[Argus] Blocked by rule: ${result.rule.title}`);
              }
            }
          }
        }
      }
      return originalFetch(input, init);
    };
  }

  private async handleMatch(result: MatchResult, prompt: string): Promise<void> {
    if (!result.rule) return;

    if (result.rule.action === "block") {
      showBlockOverlay(result);
      await this.log(result, prompt);
      return;
    }
    if (result.rule.action === "warn") {
      const proceed = await showWarnBanner(result);
      await this.log(result, prompt);
      if (!proceed) throw new Error(`[Argus] Cancelled by user after warning.`);
      return;
    }
    if (result.rule.action === "flag") {
      showFlagBadge(result);
      await this.log(result, prompt);
    }
  }

  private async log(result: MatchResult, prompt: string): Promise<void> {
    if (!result.rule) return;
    await storage.queueLog({
      rule_id:     result.rule.id,
      rule_title:  result.rule.title,
      action:      result.rule.action,
      matched_kw:  result.matchedKeywords?.[0] ?? "",
      platform:    this.platform,
      prompt_text: prompt.slice(0, 20000),
      created_at:  Date.now(),
    });
  }

  // SPA navigation — re-attach DOM fallback on URL change
  private watchNavigation(): void {
    let last = location.href;
    new MutationObserver(() => {
      if (location.href !== last) {
        last = location.href;
        setTimeout(() => this.attachDomFallback(), 600);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Override in each adapter for platform-specific DOM backup
  protected attachDomFallback(): void {}

  protected abstract isAIEndpoint(url: string): boolean;
  protected abstract extractPrompt(body: string): string | null;
}
