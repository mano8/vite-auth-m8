import { loginWithPassword as runtimeLoginWithPassword } from "../runtime/api/auth.js";
import { authFetch } from "../runtime/authFetch.js";
import { type AuthStorage } from "../runtime/schemas.js";
import { getAuthState, logout as runtimeLogout, subscribeAuthState } from "../runtime/tokenStore.js";

export type AuthAdapterStatus = "loading" | "anonymous" | "authenticated" | "error";

export interface AuthAdapterSnapshot {
  status: AuthAdapterStatus;
  auth: AuthStorage["auth"] | null;
  user: AuthStorage["user"] | null;
  error: string | null;
  isAuthenticated: boolean;
}

export type AuthAdapterListener = (snapshot: AuthAdapterSnapshot) => void;

export interface AuthAdapterSession {
  getSnapshot(): AuthAdapterSnapshot;
  subscribe(listener: AuthAdapterListener): () => void;
  refresh(): Promise<AuthAdapterSnapshot>;
  loginWithPassword(username: string, password: string): Promise<AuthAdapterSnapshot>;
  logout(): Promise<AuthAdapterSnapshot>;
  fetch: typeof authFetch;
  destroy(): void;
}

export function toAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Authentication failed.";
}

export function authSnapshotFromStorage(storage: AuthStorage | null): AuthAdapterSnapshot {
  if (!storage) {
    return {
      status: "anonymous",
      auth: null,
      user: null,
      error: null,
      isAuthenticated: false
    };
  }
  return {
    status: "authenticated",
    auth: storage.auth,
    user: storage.user,
    error: null,
    isAuthenticated: true
  };
}

export function authSnapshotFromError(error: unknown): AuthAdapterSnapshot {
  return {
    status: "error",
    auth: null,
    user: null,
    error: toAuthErrorMessage(error),
    isAuthenticated: false
  };
}

export async function readAuthAdapterSnapshot(): Promise<AuthAdapterSnapshot> {
  try {
    return authSnapshotFromStorage(await getAuthState());
  } catch (error) {
    return authSnapshotFromError(error);
  }
}

export function createAuthAdapterSession(): AuthAdapterSession {
  let snapshot: AuthAdapterSnapshot = {
    status: "loading",
    auth: null,
    user: null,
    error: null,
    isAuthenticated: false
  };
  const listeners = new Set<AuthAdapterListener>();

  const emit = (nextSnapshot: AuthAdapterSnapshot): AuthAdapterSnapshot => {
    snapshot = nextSnapshot;
    for (const listener of listeners) {
      listener(snapshot);
    }
    return snapshot;
  };

  const unsubscribeRuntime = subscribeAuthState((storage) => {
    emit(authSnapshotFromStorage(storage));
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    async refresh() {
      return emit(await readAuthAdapterSnapshot());
    },
    async loginWithPassword(username, password) {
      await runtimeLoginWithPassword(username, password);
      return this.refresh();
    },
    async logout() {
      await runtimeLogout();
      return emit(authSnapshotFromStorage(null));
    },
    fetch: authFetch,
    destroy() {
      unsubscribeRuntime();
      listeners.clear();
    }
  };
}
