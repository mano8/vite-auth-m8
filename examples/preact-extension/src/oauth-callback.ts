import { configureFaAuthM8Extension, handleOAuthCallback } from "@fa-m8/vite-auth-m8/client";
import runtimeConfig from "virtual:fa-auth-m8-extension/config";

configureFaAuthM8Extension({ apiBase: runtimeConfig.apiBase });

const target = document.querySelector("#app");

try {
  const completed = await handleOAuthCallback({
    url: new URL(window.location.href),
    clearUrl: () => {
      window.history.replaceState(null, document.title, runtimeConfig.oauthCallbackPage);
    },
    closeWindow: () => {
      window.close();
    },
    clientHint: "preact-extension"
  });
  if (target) {
    target.textContent = completed ? "Sign in complete." : "No OAuth session was found.";
  }
} catch (error) {
  if (target) {
    target.textContent = error instanceof Error ? error.message : "OAuth sign in failed.";
  }
}
