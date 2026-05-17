import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Argus Guardrails",
  version: "2.0.0",
  description: "Enforce your custom AI guardrails on ChatGPT, Claude, and Gemini.",

  permissions: ["storage", "activeTab", "alarms", "scripting"],

  /** Broad injection; actual “is this AI?” is decided in main-world aiDetection.ts */
  host_permissions: ["<all_urls>"],

  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_start",
      all_frames: true,
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
      resources: [
        "icons/*",
        "config.json",
        "rules.json",
        "argus-logo.png",
        "argus-main-world.js",
      ],
      matches: ["<all_urls>"],
    },
  ],
});
