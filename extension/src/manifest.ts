import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Argus Guardrails",
  version: "2.0.0",
  description: "Enforce your custom AI guardrails on ChatGPT, Claude, and Gemini.",

  permissions: ["storage", "activeTab", "alarms"],

  host_permissions: [
    "http://localhost:3000/*",
    "http://127.0.0.1:3000/*",
    "http://localhost:5173/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
  ],

  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_start",
    },
  ],

  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      "16":  "icons/icon-16.png",
      "48":  "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },

  icons: {
    "16":  "icons/icon-16.png",
    "48":  "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },

  web_accessible_resources: [
    {
      resources: ["icons/*", "config.json", "rules.json", "argus-logo.png"],
      matches: ["<all_urls>"],
    },
  ],
});
