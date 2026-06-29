import { h, render, type ComponentChildren, type ComponentType, type VNode } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";
import { configureFaAuthM8Extension, getCurrentProfile, verifyApiKey } from "@fa-m8/vite-auth-m8/client";
import { createPreactAuthAdapter, type PreactHooksRuntime } from "@fa-m8/vite-auth-m8/preact";
import runtimeConfig from "virtual:fa-auth-m8-extension/config";
import "./styles.css";

configureFaAuthM8Extension({ apiBase: runtimeConfig.apiBase });

const adapter = createPreactAuthAdapter(
  { createContext, h },
  {
    useCallback: useCallback as unknown as PreactHooksRuntime["useCallback"],
    useContext,
    useEffect,
    useMemo,
    useState
  }
);

const AuthProvider = adapter.AuthProvider as ComponentType<{ children?: ComponentChildren }>;
const LoginView = adapter.LoginView as ComponentType<{ className?: string }>;
const AccountView = adapter.AccountView as ComponentType<{ className?: string }>;

function App(): VNode {
  const [result, setResult] = useState("");

  const showResult = useCallback((value: unknown) => {
    setResult(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }, []);

  const verifyKey = useCallback((event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const apiKey = new FormData(form).get("apiKey");
    if (typeof apiKey === "string" && apiKey.length > 0) {
      void verifyApiKey(apiKey).then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "API key failed."));
    }
  }, [showResult]);

  return h(AuthProvider, null,
    h("section", { className: "shell" },
      h("h1", null, "Auth M8"),
      h(LoginView, { className: "panel" }),
      h(AccountView, { className: "panel" }),
      h("div", { className: "actions" },
        h("button", { type: "button", onClick: () => void chrome.runtime.sendMessage({ type: "fa-auth-m8:start-google-oauth" }) }, "Google OAuth"),
        h("button", { type: "button", onClick: () => void getCurrentProfile().then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "Profile request failed.")) }, "Fetch profile")
      ),
      h("form", { className: "apikey", onSubmit: verifyKey },
        h("input", { name: "apiKey", type: "password", autoComplete: "off", placeholder: "API key" }),
        h("button", { type: "submit" }, "Verify key")
      ),
      h("pre", null, result)
    )
  );
}

const target = document.querySelector("#app");
if (target) {
  render(h(App, null), target);
}
