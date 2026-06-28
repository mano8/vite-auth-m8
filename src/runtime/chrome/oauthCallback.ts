import { exchangeGoogleCode } from "../api/oauth.js";
import { getConfiguredStorage } from "../config.js";
import { type GoogleExchangeResponse } from "../schemas.js";
import { storeAuthData, userProfileFromUnknown } from "../tokenStore.js";

const OAUTH_FLOWS_KEY = "oauth_flows";

type OAuthFlows = Record<string, string>;

function parseFlows(value: unknown): OAuthFlows {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return Object.fromEntries(entries);
}

export async function savePkceVerifier(flowId: string, verifier: string): Promise<void> {
  const storage = getConfiguredStorage();
  const stored = await storage.session.get(OAUTH_FLOWS_KEY);
  const flows = parseFlows(stored[OAUTH_FLOWS_KEY]);
  await storage.session.set({ [OAUTH_FLOWS_KEY]: { ...flows, [flowId]: verifier } });
}

export async function takePkceVerifier(flowId: string): Promise<string> {
  const storage = getConfiguredStorage();
  const stored = await storage.session.get(OAUTH_FLOWS_KEY);
  const flows = parseFlows(stored[OAUTH_FLOWS_KEY]);
  const verifier = flows[flowId] ?? "";
  const remaining = { ...flows };
  delete remaining[flowId];
  await storage.session.set({ [OAUTH_FLOWS_KEY]: remaining });
  return verifier;
}

export function readOAuthCallbackUrl(url: URL): { authCode: string | null; flowId: string | null } {
  const hashParams = new URLSearchParams(url.hash.slice(1));
  return {
    authCode: hashParams.get("auth_code"),
    flowId: url.searchParams.get("flow_id")
  };
}

export interface OAuthCallbackOptions {
  url: URL;
  clearUrl: () => void;
  closeWindow?: () => void;
  clientHint?: string;
}

export async function handleOAuthCallback(options: OAuthCallbackOptions): Promise<boolean> {
  const { authCode, flowId } = readOAuthCallbackUrl(options.url);
  options.clearUrl();

  if (!authCode || !flowId) {
    options.closeWindow?.();
    return false;
  }

  const verifier = await takePkceVerifier(flowId);
  if (!verifier) {
    options.closeWindow?.();
    return false;
  }

  const exchange: GoogleExchangeResponse = await exchangeGoogleCode({
    code: authCode,
    code_verifier: verifier,
    client_hint: options.clientHint
  });

  await storeAuthData(
    exchange.access_token,
    exchange.expires_at,
    userProfileFromUnknown(exchange.user),
    "bearer"
  );
  options.closeWindow?.();
  return true;
}
