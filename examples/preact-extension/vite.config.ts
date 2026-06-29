import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { faAuthM8Extension } from "@fa-m8/vite-auth-m8/plugin";

const root = fileURLToPath(new URL(".", import.meta.url));
const preactRuntimePlugin: Plugin = { name: "vite:preact-example-runtime" };

export default defineConfig({
  root,
  plugins: [
    faAuthM8Extension({
      framework: "preact",
      apiBase: "https://localhost:4430/user",
      backendOrigins: ["https://localhost:4430"],
      manifest: {
        name: "Auth M8 Preact Example",
        version: "0.1.0",
        description: "Preact Chrome MV3 auth example."
      },
      oauth: {
        google: true,
        callbackPage: "oauth-callback.html"
      }
    }),
    preactRuntimePlugin
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
