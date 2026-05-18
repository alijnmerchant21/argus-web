export type AiPlatform =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "copilot"
  | "perplexity"
  | "cursor"
  | "poe"
  | "grok"
  | "deepseek"
  | "mistral"
  | "cohere"
  | "openrouter"
  | "replicate"
  | "meta-ai"
  | "ollama"
  | "lmstudio"
  | "ai";

type HostRule = {
  platform: AiPlatform;
  hosts?: string[];
  suffixes?: string[];
};

const AI_HOST_RULES: HostRule[] = [
  {
    platform: "chatgpt",
    hosts: ["chatgpt.com", "chat.openai.com"],
    suffixes: ["chatgpt.com", "openai.com", "oaistatic.com"],
  },
  {
    platform: "claude",
    hosts: ["claude.ai", "console.anthropic.com"],
    suffixes: ["claude.ai", "anthropic.com"],
  },
  {
    platform: "gemini",
    hosts: ["gemini.google.com", "aistudio.google.com", "generativelanguage.googleapis.com"],
    suffixes: ["generativelanguage.googleapis.com"],
  },
  {
    platform: "copilot",
    hosts: ["copilot.microsoft.com", "sydney.bing.com", "edgeservices.bing.com"],
    suffixes: ["copilot.microsoft.com"],
  },
  { platform: "perplexity", suffixes: ["perplexity.ai"] },
  { platform: "cursor", suffixes: ["cursor.sh", "cursor.com"] },
  { platform: "poe", suffixes: ["poe.com"] },
  { platform: "grok", suffixes: ["grok.com", "x.ai"] },
  { platform: "deepseek", suffixes: ["deepseek.com"] },
  { platform: "mistral", suffixes: ["mistral.ai"] },
  { platform: "cohere", suffixes: ["cohere.ai"] },
  { platform: "openrouter", suffixes: ["openrouter.ai"] },
  { platform: "replicate", suffixes: ["replicate.com"] },
  { platform: "meta-ai", suffixes: ["meta.ai"] },
  { platform: "ollama", suffixes: ["ollama.com"] },
  { platform: "lmstudio", suffixes: ["lmstudio.ai"] },
  {
    platform: "ai",
    suffixes: [
      "character.ai",
      "groq.com",
      "together.ai",
      "fireworks.ai",
      "anyscale.com",
      "huggingface.co",
      "you.com",
      "phind.com",
      "notebooklm.google.com",
      "writesonic.com",
      "jasper.ai",
      "copy.ai",
      "midjourney.com",
      "leonardo.ai",
      "ideogram.ai",
      "runwayml.com",
      "suno.com",
      "udio.com",
    ],
  },
];

const DENY_HOST_SUFFIX = [
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
  "facebook.com",
  "hotjar.com",
];

function normalizedHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function hostMatches(host: string, candidate: string): boolean {
  const h = normalizedHost(host);
  const c = normalizedHost(candidate);
  return h === c || h.endsWith("." + c);
}

function hostDenied(host: string): boolean {
  return DENY_HOST_SUFFIX.some((d) => hostMatches(host, d));
}

export function identifyAIPlatformForHost(host: string): AiPlatform | null {
  const h = normalizedHost(host);
  if (hostDenied(h)) return null;
  for (const rule of AI_HOST_RULES) {
    if (rule.hosts?.some((candidate) => normalizedHost(candidate) === h)) return rule.platform;
    if (rule.suffixes?.some((candidate) => hostMatches(h, candidate))) return rule.platform;
  }
  return null;
}

export function identifyAIPlatformForUrl(urlStr: string): AiPlatform | null {
  try {
    const url = new URL(urlStr, location.href);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return identifyAIPlatformForHost(url.hostname);
  } catch {
    return null;
  }
}

export function isLikelyStaticAssetUrl(url: URL): boolean {
  const p = url.pathname.toLowerCase();
  return (
    /\.(js|mjs|cjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|mp4|webm|mp3|json)(\?|$)/i.test(
      p,
    ) || /\/(cdn|assets|static|dist|build|pack|bundle)\//i.test(p)
  );
}

function pathSuggestGenerativeApi(url: URL): boolean {
  const path = (url.pathname + url.search).toLowerCase();
  const href = url.href.toLowerCase();
  const strong = [
    /\/chat\/completions?\b/i,
    /\/v\d+\/chat\/completions?\b/i,
    /\/v\d+\/responses\b/i,
    /\/v\d+\/messages\b/i,
    /\/v\d+\/complete\b/i,
    /\/v\d+\/embeddings\b/i,
    /\/generatecontent\b/i,
    /\/models\/[^/?#]+:(generatecontent|streamgeneratecontent|generate|complete|chat|predict)/i,
    /\/backend-api\/conversation/i,
    /\/backend-api\/models/i,
    /\/backend-anon\//i,
    /\/conversations\/[^/]+\/(continue|completion|send|messages?)/i,
    /\/rpc\/gen_?ai/i,
    /\/generative(_|-)?ai\//i,
    /\/llm\/(chat|complete|infer|generate)/i,
    /\/ai\/(chat|complete|generate|messages?)/i,
    /\/gateway\/v\d+\//i,
    /\/inference\//i,
  ];
  return strong.some((re) => re.test(path) || re.test(href));
}

export function isProbablyGenerativeAIRequest(urlStr: string): boolean {
  let url: URL;
  try {
    url = new URL(urlStr, location.href);
  } catch {
    return false;
  }
  if (!/^https?:$/i.test(url.protocol)) return false;
  const host = normalizedHost(url.hostname);
  if (hostDenied(host)) return false;
  if (isLikelyStaticAssetUrl(url)) return false;

  if (identifyAIPlatformForHost(host)) return true;
  return pathSuggestGenerativeApi(url);
}

export function isCurrentPageAISurface(): boolean {
  return identifyAIPlatformForHost(location.hostname) !== null;
}
