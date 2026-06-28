import { getConfiguredFetch } from "./config.js";
import { getAuthState, isSessionExpired, logout } from "./tokenStore.js";

function mergeHeaders(initHeaders: HeadersInit | undefined, authHeaders: Record<string, string>): Headers {
  const headers = new Headers(initHeaders);
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }
  return headers;
}

export async function authFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const stored = await getAuthState();
  if (!stored || isSessionExpired(stored.auth)) {
    await logout();
    throw new Error("Session expired. Please sign in again.");
  }

  const authHeaders: Record<string, string> = stored.auth.tokenType === "apikey"
    ? { "X-API-Key": stored.auth.accessToken }
    : { Authorization: `Bearer ${stored.auth.accessToken}` };

  const response = await getConfiguredFetch()(input, {
    ...init,
    headers: mergeHeaders(init.headers, authHeaders)
  });

  if (response.status === 401) {
    await logout();
  }

  return response;
}
