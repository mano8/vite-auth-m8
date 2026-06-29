import * as React from "react";
import { createRoot } from "react-dom/client";
import { configureFaAuthM8Extension, getCurrentProfile, verifyApiKey } from "@fa-m8/vite-auth-m8/client";
import { createReactAuthAdapter, type ReactAuthRuntime } from "@fa-m8/vite-auth-m8/react";
import runtimeConfig from "virtual:fa-auth-m8-extension/config";
import "./styles.css";

configureFaAuthM8Extension({ apiBase: runtimeConfig.apiBase });

const adapter = createReactAuthAdapter(React as unknown as ReactAuthRuntime);
const AuthProvider = adapter.AuthProvider as React.ComponentType<React.PropsWithChildren>;
const LoginView = adapter.LoginView as React.ComponentType<{ className?: string }>;
const AccountView = adapter.AccountView as React.ComponentType<{ className?: string }>;

function App(): React.ReactElement {
  const [result, setResult] = React.useState("");

  const showResult = React.useCallback((value: unknown) => {
    setResult(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }, []);

  const verifyKey = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiKey = new FormData(event.currentTarget).get("apiKey");
    if (typeof apiKey === "string" && apiKey.length > 0) {
      void verifyApiKey(apiKey).then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "API key failed."));
    }
  }, [showResult]);

  return (
    <AuthProvider>
      <section className="shell">
        <h1>Auth M8</h1>
        <LoginView className="panel" />
        <AccountView className="panel" />
        <div className="actions">
          <button type="button" onClick={() => void chrome.runtime.sendMessage({ type: "fa-auth-m8:start-google-oauth" })}>
            Google OAuth
          </button>
          <button type="button" onClick={() => void getCurrentProfile().then(showResult).catch((error: unknown) => showResult(error instanceof Error ? error.message : "Profile request failed."))}>
            Fetch profile
          </button>
        </div>
        <form className="apikey" onSubmit={verifyKey}>
          <input name="apiKey" type="password" autoComplete="off" placeholder="API key" />
          <button type="submit">Verify key</button>
        </form>
        <pre>{result}</pre>
      </section>
    </AuthProvider>
  );
}

const target = document.querySelector("#app");
if (target) {
  createRoot(target).render(<App />);
}
