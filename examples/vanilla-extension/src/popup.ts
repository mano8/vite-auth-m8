import { configureFaAuthM8Extension, getCurrentProfile, verifyApiKey } from "@fa-m8/vite-auth-m8/client";
import { createVanillaAuthController } from "@fa-m8/vite-auth-m8/vanilla";
import runtimeConfig from "virtual:fa-auth-m8-extension/config";
import "./styles.css";

configureFaAuthM8Extension({ apiBase: runtimeConfig.apiBase });

const root = document.querySelector<HTMLDivElement>("#app");
const controller = createVanillaAuthController();

function render(): void {
  if (!root) {
    return;
  }
  const snapshot = controller.session.getSnapshot();
  root.innerHTML = [
    '<section class="shell">',
    '<h1>Auth M8</h1>',
    snapshot.isAuthenticated ? controller.renderAccount(snapshot) : controller.renderLogin(snapshot),
    '<div class="actions">',
    '<button type="button" data-action="google">Google OAuth</button>',
    '<button type="button" data-action="profile">Fetch profile</button>',
    "</div>",
    '<form class="apikey" data-action="api-key">',
    '<input name="apiKey" type="password" autocomplete="off" placeholder="API key" />',
    '<button type="submit">Verify key</button>',
    "</form>",
    '<pre id="result"></pre>',
    "</section>"
  ].join("");
}

function showResult(value: unknown): void {
  const target = document.querySelector<HTMLPreElement>("#result");
  if (target) {
    target.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
}

controller.session.subscribe(render);
void controller.session.refresh();

root?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  if (form.dataset.action === "api-key") {
    const apiKey = new FormData(form).get("apiKey");
    if (typeof apiKey === "string" && apiKey.length > 0) {
      void verifyApiKey(apiKey).then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "API key failed."));
    }
    return;
  }
  const data = new FormData(form);
  const username = data.get("username");
  const password = data.get("password");
  if (typeof username === "string" && typeof password === "string") {
    void controller.login(username, password).catch((error: unknown) => showResult(error instanceof Error ? error.message : "Sign in failed."));
  }
});

root?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (action === "google") {
    void chrome.runtime.sendMessage({ type: "fa-auth-m8:start-google-oauth" });
  } else if (action === "profile") {
    void getCurrentProfile().then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "Profile request failed."));
  } else if (target.matches('[data-fa-auth-view="account"] button')) {
    void controller.logout();
  }
});
