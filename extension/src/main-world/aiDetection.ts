/**
 * Runtime detection for “is this HTTP request probably going to an LLM / generative-AI backend?”.
 * Manifest stays on <all_urls>; we decide what to intercept here — easy to extend without new host_patterns.
 */

const HOST_EXACT = new Set(
  [
    "gemini.google.com",
    "aistudio.google.com",
    "generativelanguage.googleapis.com",
    "copilot.microsoft.com",
    "sydney.bing.com",
    "edgeservices.bing.com",
    "chatgpt.com",
    "chat.openai.com",
  ].map((h) => h.toLowerCase()),
);

/** Any subdomain of these roots is treated as an AI vendor surface (UI or API). */
const HOST_SUFFIX_REGISTRY: string[] = [
  "openai.com",
  "chatgpt.com",
  "oaistatic.com",
  "anthropic.com",
  "claude.ai",
  "cursor.sh",
  "cursor.com",
  "perplexity.ai",
  "cohere.ai",
  "mistral.ai",
  "grok.com",
  "x.ai",
  "deepseek.com",
  "openrouter.ai",
  "replicate.com",
  "poe.com",
  "character.ai",
  "groq.com",
  "together.ai",
  "fireworks.ai",
  "anyscale.com",
  "meta.ai",
  "lmstudio.ai",
  "ollama.com",
];

/** Don’t treat analytics / ads as AI traffic. */
const DENY_HOST_SUFFIX = [
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
  "facebook.com",
  "hotjar.com",
];

export function isLikelyStaticAssetUrl(url: URL): boolean {
  const p = url.pathname.toLowerCase();
  return (
    /\.(js|mjs|cjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|mp4|webm|mp3|json)(\?|$)/i.test(
      p,
    ) || /\/(cdn|assets|static|dist|build|pack|bundle)\//i.test(p)
  );
}

function hostDenied(host: string): boolean {
  const h = host.toLowerCase();
  return DENY_HOST_SUFFIX.some((d) => h === d || h.endsWith("." + d));
}

function hostMatchesRegistry(host: string): boolean {
  const h = host.toLowerCase();
  if (HOST_EXACT.has(h)) return true;
  for (const suf of HOST_SUFFIX_REGISTRY) {
    if (h === suf || h.endsWith("." + suf)) return true;
  }
  return false;
}

/**
 * Strong URL/path signals seen across OpenAI-compatible and vendor-specific APIs.
 * Used for hosts not in the registry (new / self-hosted / regional endpoints).
 */
function pathSuggestGenerativeApi(url: URL): boolean {
  const path = (url.pathname + url.search).toLowerCase();
  const href = url.href.toLowerCase();
  const strong = [
    /\/chat\/completions?\b/i,
    /\/v\d+\/chat\/completions?\b/i,
    /\/v\d+\/messages\b/i,
    /anthropic\.com\/v\d+\/messages/i,
    /\/generatecontent\b/i,
    /\/models\/[^/?#]+:generate(content|message|answer)/i,
    /\/backend-api\/conversation/i,
    /\/backend-anon\//i,
    /\/conversations\/[^/]+\/(continue|completion|send)/i,
    /\/rpc\/gen_?ai/i,
    /\/generative(_|-)?ai\//i,
    /\/llm\/(chat|complete|infer)/i,
    /openai\.com\/v\d/i,
    /\/gateway\/v\d+\//i,
  ];
  return strong.some((re) => re.test(path) || re.test(href));
}

/** True when this request URL should be inspected (body parsed for user prompt). */
export function isProbablyGenerativeAIRequest(urlStr: string): boolean {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return false;
  }
  if (!/^https?:$/i.test(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (hostDenied(host)) return false;
  if (isLikelyStaticAssetUrl(url)) return false;

  if (hostMatchesRegistry(host)) return true;
  if (pathSuggestGenerativeApi(url)) return true;
  return false;
}
