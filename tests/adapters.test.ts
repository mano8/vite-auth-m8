import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "../src/runtime/authFetch.js";
import { configureFaAuthM8Extension } from "../src/runtime/config.js";
import { type AuthStorage } from "../src/runtime/schemas.js";
import { storeAuthData } from "../src/runtime/tokenStore.js";
import {
  authSnapshotFromError,
  authSnapshotFromStorage,
  createAuthAdapterSession,
  type AuthAdapterSession,
  type AuthAdapterSnapshot,
  readAuthAdapterSnapshot,
  toAuthErrorMessage
} from "../src/adapters/shared.js";
import {
  createVanillaAuthController,
  renderVanillaAccountView,
  renderVanillaLoginView
} from "../src/adapters/vanilla/index.js";
import {
  createFrameworkAuthAdapter,
  type FrameworkContext,
  type FrameworkRuntime
} from "../src/adapters/framework.js";
import { createReactAuthAdapter } from "../src/adapters/react/index.js";
import { createPreactAuthAdapter } from "../src/adapters/preact/index.js";
import { createReactAuthAdapter as createReactUiAuthAdapter } from "../src/ui/react/index.js";
import { createPreactAuthAdapter as createPreactUiAuthAdapter } from "../src/ui/preact/index.js";
import { MemoryStorageDriver } from "./testStorage.js";

interface ElementNode {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
}

interface FakeProvider<T> {
  context: FakeContext<T>;
}

interface FakeContext<T> extends FrameworkContext<T> {
  Provider: FakeProvider<T>;
  current: T;
}

function isProvider(value: unknown): value is FakeProvider<unknown> {
  return typeof value === "object" && value !== null && "context" in value;
}

function element(value: unknown): ElementNode {
  return value as ElementNode;
}

function elementProps(value: unknown): Record<string, unknown> {
  return element(value).props;
}

function child(value: unknown, index: number): unknown {
  return element(value).children[index];
}

function createFakeRuntime() {
  let stateValues: unknown[] = [];
  let stateIndex = 0;
  const cleanups: Array<() => void> = [];
  const setters: Array<(value: unknown) => void> = [];

  const runtime: FrameworkRuntime = {
    createContext<T>(defaultValue: T): FakeContext<T> {
      const context = { current: defaultValue } as FakeContext<T>;
      context.Provider = { context };
      return context;
    },
    createElement(type, props, ...children): ElementNode {
      if (isProvider(type)) {
        type.context.current = props?.value;
      }
      return {
        type,
        props: props ?? {},
        children
      };
    },
    useCallback<T>(callback: T): T {
      return callback;
    },
    useContext<T>(context: FrameworkContext<T>): T {
      return (context as FakeContext<T>).current;
    },
    useEffect(effect): void {
      const cleanup = effect();
      if (cleanup) {
        cleanups.push(cleanup);
      }
    },
    useMemo<T>(factory: () => T): T {
      return factory();
    },
    useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
      const index = stateIndex;
      stateIndex += 1;
      const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
      const current = (index in stateValues ? stateValues[index] : fallback) as T;
      setters[index] = (value: unknown): void => {
        stateValues[index] = typeof value === "function" ? (value as (previous: T) => T)(stateValues[index] as T) : value;
      };
      return [current, setters[index] as (value: T | ((previous: T) => T)) => void];
    }
  };

  return {
    runtime,
    reset(nextStateValues: unknown[] = []) {
      stateValues = nextStateValues;
      stateIndex = 0;
      setters.length = 0;
    },
    cleanup() {
      for (const runCleanup of cleanups.splice(0)) {
        runCleanup();
      }
    }
  };
}

const authStorage: AuthStorage = {
  auth: {
    accessToken: "token",
    expiresAt: 100_000,
    loginTimestamp: 1,
    sessionId: "session",
    tokenType: "bearer"
  },
  user: {
    name: "Reader",
    email: "reader@example.com",
    avatar: ""
  }
};

function fakeSession(snapshot: AuthAdapterSnapshot): AuthAdapterSession {
  return {
    getSnapshot: vi.fn(() => snapshot),
    subscribe: vi.fn((listener) => {
      listener(snapshot);
      return vi.fn();
    }),
    refresh: vi.fn(async () => snapshot),
    loginWithPassword: vi.fn(async () => snapshot),
    logout: vi.fn(async () => authSnapshotFromStorage(null)),
    fetch: authFetch,
    destroy: vi.fn()
  };
}

describe("shared adapter session", () => {
  let storage: MemoryStorageDriver;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new MemoryStorageDriver();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "jwt" }), { status: 200 }));
    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage,
      fetch: fetchMock,
      now: () => 1,
      randomUUID: () => "uuid"
    });
  });

  it("maps runtime auth into adapter snapshots and messages", () => {
    expect(authSnapshotFromStorage(null)).toMatchObject({ status: "anonymous", isAuthenticated: false });
    expect(authSnapshotFromStorage(authStorage)).toMatchObject({ status: "authenticated", user: authStorage.user });
    expect(authSnapshotFromError(new Error("Boom")).error).toBe("Boom");
    expect(toAuthErrorMessage("Nope")).toBe("Nope");
    expect(toAuthErrorMessage({})).toBe("Authentication failed.");
  });

  it("refreshes, logs in, publishes, logs out, and destroys adapter state", async () => {
    const session = createAuthAdapterSession();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: "loading" }));

    await expect(session.refresh()).resolves.toMatchObject({ status: "anonymous" });
    await storeAuthData("stored", 100_000, authStorage.user, "bearer");
    storage.emitAuthChanged(storage.local.data.auth);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: "authenticated" })));

    await expect(session.loginWithPassword("reader@example.com", "password")).resolves.toMatchObject({ status: "authenticated" });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/login/access-token"), expect.objectContaining({ method: "POST" }));

    await expect(session.logout()).resolves.toMatchObject({ status: "anonymous" });
    unsubscribe();
    session.destroy();
  });

  it("returns error snapshots when runtime storage cannot be read", async () => {
    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage: {
        local: {
          async get() {
            throw new Error("storage down");
          },
          async set() {},
          async remove() {}
        },
        session: storage.session
      },
      fetch: fetchMock
    });
    await expect(readAuthAdapterSnapshot()).resolves.toMatchObject({ status: "error", error: "storage down" });
  });
});

describe("vanilla auth adapter", () => {
  it("renders login and account views with Tailwind-compatible classes", () => {
    const loading = { ...authSnapshotFromStorage(null), status: "loading" as const };
    expect(renderVanillaLoginView(loading, { labels: { email: "Email <work>" } })).toContain("Email &lt;work&gt;");
    expect(renderVanillaLoginView(authSnapshotFromError("Bad credentials"))).toContain("Bad credentials");
    expect(renderVanillaAccountView(authSnapshotFromStorage(null))).toContain("Signed out");
    expect(renderVanillaAccountView(authSnapshotFromStorage({ ...authStorage, user: { ...authStorage.user, name: "" } }))).toContain("reader@example.com");
  });

  it("wraps a shared auth session for vanilla UI callers", async () => {
    const snapshot = authSnapshotFromStorage(authStorage);
    const session = fakeSession(snapshot);
    const controller = createVanillaAuthController({ session, labels: { signOut: "Log out" } });
    expect(controller.renderLogin()).toContain("Sign in");
    expect(controller.renderAccount()).toContain("Log out");
    await expect(controller.login("reader@example.com", "password")).resolves.toBe(snapshot);
    await expect(controller.logout()).resolves.toMatchObject({ status: "anonymous" });
    controller.destroy();
    expect(session.destroy).toHaveBeenCalled();

    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage: new MemoryStorageDriver(),
      fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    });
    createVanillaAuthController().destroy();
  });
});

describe("framework auth adapters", () => {
  it("creates React-compatible provider, hooks, login UI, account UI, and fetch hook", async () => {
    const fake = createFakeRuntime();
    const adapter = createReactAuthAdapter(fake.runtime);
    const snapshot = authSnapshotFromStorage(authStorage);
    const session = fakeSession(snapshot);
    fake.reset();
    const provider = adapter.AuthProvider({ session, children: "child" });
    expect(child(provider, 0)).toBe("child");
    expect(adapter.useAuth()).toMatchObject({ snapshot });
    expect(adapter.useAuthFetch()).toBe(authFetch);

    fake.reset(["reader@example.com", "password", null]);
    const authenticated = vi.fn();
    const login = adapter.LoginView({ onAuthenticated: authenticated });
    const inputProps = elementProps(child(login, 1));
    (inputProps.onInput as (event: unknown) => void)({});
    (elementProps(child(login, 3)).onChange as (event: unknown) => void)({ currentTarget: { value: "changed" } });
    (elementProps(login).onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(session.loginWithPassword).toHaveBeenCalledWith("reader@example.com", "password"));
    expect(authenticated).toHaveBeenCalledWith(snapshot);

    fake.reset(["", "", "Bad credentials"]);
    const disabledLogin = adapter.LoginView({ className: "custom", disabled: true });
    expect(elementProps(disabledLogin).className).toBe("custom");
    expect(elementProps(child(disabledLogin, 1)).disabled).toBe(true);
    expect(elementProps(child(disabledLogin, 5)).role).toBe("alert");

    fake.reset();
    const account = adapter.AccountView({});
    expect(element(child(account, 0)).children[0]).toBe("Reader");
    (elementProps(child(account, 2)).onClick as () => void)();
    await vi.waitFor(() => expect(session.logout).toHaveBeenCalled());

    fake.cleanup();
  });

  it("covers unauthenticated, error, missing-provider, owned-session, and Preact factory paths", async () => {
    const fake = createFakeRuntime();
    const adapter = createFrameworkAuthAdapter(fake.runtime);
    expect(() => adapter.useAuth()).toThrow("AuthProvider");

    const anonymousSession = fakeSession(authSnapshotFromStorage(null));
    fake.reset();
    adapter.AuthProvider({ session: anonymousSession });
    expect(element(adapter.AccountView({})).children[0]).toBe("Signed out");

    const errorSession = fakeSession(authSnapshotFromError("Broken"));
    fake.reset();
    adapter.AuthProvider({ session: errorSession });
    expect(elementProps(adapter.AccountView({ className: "err" })).role).toBe("alert");
    expect(elementProps(adapter.AccountView({})).className).toBe("text-sm text-red-600");

    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage: new MemoryStorageDriver(),
      fetch: vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
    });
    fake.reset();
    adapter.AuthProvider({});
    fake.cleanup();

    const preactAdapter = createPreactAuthAdapter({
      createContext: fake.runtime.createContext,
      h: fake.runtime.createElement
    }, {
      useCallback: fake.runtime.useCallback,
      useContext: fake.runtime.useContext,
      useEffect: fake.runtime.useEffect,
      useMemo: fake.runtime.useMemo,
      useState: fake.runtime.useState
    });
    const preactSession = fakeSession(authSnapshotFromStorage({ ...authStorage, user: { ...authStorage.user, name: "" } }));
    fake.reset();
    preactAdapter.AuthProvider({ session: preactSession });
    expect(element(child(preactAdapter.AccountView({}), 0)).children[0]).toBe("reader@example.com");

    const rejectingSession = fakeSession(authSnapshotFromStorage(null));
    vi.mocked(rejectingSession.loginWithPassword).mockRejectedValueOnce(new Error("Denied"));
    fake.reset();
    adapter.AuthProvider({ session: rejectingSession });
    fake.reset(["reader@example.com", "password", null]);
    const rejectedLogin = adapter.LoginView({});
    (elementProps(rejectedLogin).onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    expect(rejectingSession.loginWithPassword).toHaveBeenCalledWith("reader@example.com", "password");
    await Promise.resolve();

    expect(createReactUiAuthAdapter(fake.runtime).useAuthFetch()).toBe(authFetch);
    expect(createPreactUiAuthAdapter({
      createContext: fake.runtime.createContext,
      h: fake.runtime.createElement
    }, {
      useCallback: fake.runtime.useCallback,
      useContext: fake.runtime.useContext,
      useEffect: fake.runtime.useEffect,
      useMemo: fake.runtime.useMemo,
      useState: fake.runtime.useState
    }).useAuthFetch()).toBe(authFetch);
  });
});
