import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { faAuthM8Extension } from "@fa-m8/vite-auth-m8/plugin";

const root = fileURLToPath(new URL(".", import.meta.url));
const reactRuntimePlugin: Plugin = { name: "vite:react-example-runtime" };

export default defineConfig({
  root,
  plugins: [
    faAuthM8Extension({
      framework: "react",
      apiBase: "https://localhost:4430/user",
      backendOrigins: ["https://localhost:4430"],
      manifest: {
        name: "Auth M8 React Example",
        version: "0.1.0",
        description: "React Chrome MV3 auth example."
      },
      oauth: {
        google: true,
        callbackPage: "oauth-callback.html"
      }
    }),
    reactRuntimePlugin
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
