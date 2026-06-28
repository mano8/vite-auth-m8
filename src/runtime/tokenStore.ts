import { getConfiguredNow, getConfiguredRandomUUID, getConfiguredStorage } from "./config.js";
import { AuthStorageSchema, parseAuthStorage, type AuthState, type AuthStorage, type UserProfile } from "./schemas.js";

const AUTH_KEYS = ["auth", "user"];
const REFRESH_MARGIN_MS = 60_000;
const EMPTY_USER: UserProfile = { name: "", email: "unknown@example.invalid", avatar: "" };

let authWriteQueue: Promise<void> = Promise.resolve();

export function isFreshAuthState(current: AuthState | null, incoming: AuthState): boolean {
  return !current || incoming.loginTimestamp > current.loginTimestamp;
}

export function buildAuthStorage(accessToken: string, expiresAt: number, user: UserProfile, tokenType: AuthState["tokenType"]): AuthStorage {
  return AuthStorageSchema.parse({
    auth: {
      accessToken,
      expiresAt,
      sessionId: getConfiguredRandomUUID()(),
      tokenType,
      loginTimestamp: getConfiguredNow()()
    },
    user
  });
}

export async function storeAuthData(accessToken: string, expiresAt: number, user: UserProfile, tokenType: AuthState["tokenType"]): Promise<void> {
  const storage = buildAuthStorage(accessToken, expiresAt, user, tokenType);
  authWriteQueue = authWriteQueue.then(() => getConfiguredStorage().local.set(storage));
  return authWriteQueue;
}

export function userProfileFromUnknown(value: unknown): UserProfile {
  const user = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    name: typeof user.name === "string" ? user.name : "",
    email: typeof user.email === "string" ? user.email : EMPTY_USER.email,
    avatar: typeof user.avatar === "string" ? user.avatar : ""
  };
}

export async function storeBearerToken(accessToken: string, user: UserProfile = EMPTY_USER, expiresAt = Number.MAX_SAFE_INTEGER): Promise<void> {
  await storeAuthData(accessToken, expiresAt, user, "bearer");
}

export async function getAuthState(): Promise<AuthStorage | null> {
  const stored = await getConfiguredStorage().local.get(AUTH_KEYS);
  const parsed = parseAuthStorage(stored);
  if (!parsed) {
    await logout();
  }
  return parsed;
}

export function isSessionExpired(auth: AuthState, now = getConfiguredNow()()): boolean {
  return now > auth.expiresAt - REFRESH_MARGIN_MS;
}

export async function logout(): Promise<void> {
  await getConfiguredStorage().local.remove(AUTH_KEYS);
}

export function subscribeAuthState(callback: (state: AuthStorage | null) => void): () => void {
  const storage = getConfiguredStorage();
  const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string): void => {
    if (areaName !== "local" || !("auth" in changes)) {
      return;
    }
    void getAuthState().then(callback);
  };
  storage.addChangeListener?.(listener);
  return () => storage.removeChangeListener?.(listener);
}
