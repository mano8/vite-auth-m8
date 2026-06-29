import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { faAuthM8Extension } from "@fa-m8/vite-auth-m8/plugin";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [
    faAuthM8Extension({
      framework: "vanilla",
      apiBase: "https://localhost:4430/user",
      backendOrigins: ["https://localhost:4430"],
      manifest: {
        name: "Auth M8 Vanilla Example",
        version: "0.1.0",
        description: "Vanilla Chrome MV3 auth example."
      },
      oauth: {
        google: true,
        callbackPage: "oauth-callback.html"
      }
    })
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
