// TanStack Start + Cloudflare — server entry wraps SSR errors (see src/server.ts).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
