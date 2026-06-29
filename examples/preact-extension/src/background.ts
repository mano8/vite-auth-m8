import { configureFaAuthM8Extension, createPkcePair, getGoogleLoginUrl, savePkceVerifier } from "@fa-m8/vite-auth-m8/client";
import runtimeConfig from "virtual:fa-auth-m8-extension/config";

configureFaAuthM8Extension({ apiBase: runtimeConfig.apiBase });

type RuntimeMessage = { type: "fa-auth-m8:start-google-oauth" };

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return typeof value === "object"
    && value !== null
    && (value as { type?: unknown }).type === "fa-auth-m8:start-google-oauth";
}

async function startGoogleOAuth(): Promise<void> {
  const flowId = crypto.randomUUID();
  const { verifier, challenge } = await createPkcePair();
  await savePkceVerifier(flowId, verifier);
  const callbackUrl = chrome.runtime.getURL(`${runtimeConfig.oauthCallbackPage}?flow_id=${encodeURIComponent(flowId)}`);
  const login = await getGoogleLoginUrl({
    redirect_target: callbackUrl,
    code_challenge: challenge
  });
  await chrome.tabs.create({ url: login.url });
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRuntimeMessage(message)) {
    return false;
  }
  void startGoogleOAuth();
  return false;
});
