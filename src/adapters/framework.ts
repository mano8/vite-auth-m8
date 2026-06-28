import { authFetch } from "../runtime/authFetch.js";
import {
  type AuthAdapterSession,
  type AuthAdapterSnapshot,
  createAuthAdapterSession,
  toAuthErrorMessage
} from "./shared.js";

export interface FrameworkContext<T> {
  Provider: unknown;
  current?: T;
}

export interface FrameworkRuntime {
  createContext<T>(defaultValue: T): FrameworkContext<T>;
  createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
  useCallback<T>(callback: T, dependencies: readonly unknown[]): T;
  useContext<T>(context: FrameworkContext<T>): T;
  useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void;
  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
}

export interface FrameworkAuthProviderProps {
  children?: unknown;
  session?: AuthAdapterSession;
}

export interface FrameworkLoginViewProps {
  className?: string;
  disabled?: boolean;
  onAuthenticated?: (snapshot: AuthAdapterSnapshot) => void;
}

export interface FrameworkAccountViewProps {
  className?: string;
}

export interface FrameworkAuthContextValue extends AuthAdapterSession {
  snapshot: AuthAdapterSnapshot;
}

export interface FrameworkAuthAdapter {
  AuthProvider(props: FrameworkAuthProviderProps): unknown;
  useAuth(): FrameworkAuthContextValue;
  useAuthFetch(): typeof authFetch;
  LoginView(props: FrameworkLoginViewProps): unknown;
  AccountView(props: FrameworkAccountViewProps): unknown;
}

interface TextInputEvent {
  currentTarget?: {
    value?: string;
  };
}

interface SubmitEventLike {
  preventDefault?: () => void;
}

function textFromInput(event: TextInputEvent): string {
  return event.currentTarget?.value ?? "";
}

export function createFrameworkAuthAdapter(runtime: FrameworkRuntime): FrameworkAuthAdapter {
  const AuthContext = runtime.createContext<FrameworkAuthContextValue | null>(null);

  function useAuth(): FrameworkAuthContextValue {
    const context = runtime.useContext(AuthContext);
    if (!context) {
      throw new Error("AuthProvider is required before using vite-auth-m8 auth hooks.");
    }
    return context;
  }

  function AuthProvider(props: FrameworkAuthProviderProps): unknown {
    const session = runtime.useMemo(() => props.session ?? createAuthAdapterSession(), [props.session]);
    const [snapshot, setSnapshot] = runtime.useState<AuthAdapterSnapshot>(() => session.getSnapshot());
    runtime.useEffect(() => {
      const unsubscribe = session.subscribe(setSnapshot);
      void session.refresh();
      return () => {
        unsubscribe();
        if (!props.session) {
          session.destroy();
        }
      };
    }, [props.session, session]);
    const value = runtime.useMemo<FrameworkAuthContextValue>(() => ({ ...session, snapshot }), [session, snapshot]);
    return runtime.createElement(AuthContext.Provider, { value }, props.children);
  }

  function useAuthFetch(): typeof authFetch {
    return runtime.useCallback(authFetch, []);
  }

  function LoginView(props: FrameworkLoginViewProps): unknown {
    const auth = useAuth();
    const [username, setUsername] = runtime.useState("");
    const [password, setPassword] = runtime.useState("");
    const [error, setError] = runtime.useState<string | null>(null);
    const disabled = props.disabled === true || auth.snapshot.status === "loading";
    const onSubmit = (event: SubmitEventLike): void => {
      event.preventDefault?.();
      setError(null);
      void auth.loginWithPassword(username, password)
        .then((snapshot) => props.onAuthenticated?.(snapshot))
        .catch((caught: unknown) => setError(toAuthErrorMessage(caught)));
    };
    const onUsername = (event: TextInputEvent): void => setUsername(textFromInput(event));
    const onPassword = (event: TextInputEvent): void => setPassword(textFromInput(event));
    const errorNode = error
      ? runtime.createElement("p", { className: "mt-2 text-sm text-red-600", role: "alert" }, error)
      : null;

    return runtime.createElement(
      "form",
      { className: props.className ?? "space-y-3", onSubmit },
      runtime.createElement("label", { className: "block text-sm font-medium text-slate-900" }, "Email"),
      runtime.createElement("input", {
        autoComplete: "username",
        className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm",
        disabled,
        name: "username",
        onChange: onUsername,
        onInput: onUsername,
        type: "email",
        value: username
      }),
      runtime.createElement("label", { className: "block text-sm font-medium text-slate-900" }, "Password"),
      runtime.createElement("input", {
        autoComplete: "current-password",
        className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm",
        disabled,
        name: "password",
        onChange: onPassword,
        onInput: onPassword,
        type: "password",
        value: password
      }),
      runtime.createElement(
        "button",
        {
          className: "inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60",
          disabled,
          type: "submit"
        },
        "Sign in"
      ),
      errorNode
    );
  }

  function AccountView(props: FrameworkAccountViewProps): unknown {
    const auth = useAuth();
    if (auth.snapshot.status === "error") {
      return runtime.createElement("p", { className: props.className ?? "text-sm text-red-600", role: "alert" }, auth.snapshot.error);
    }
    if (!auth.snapshot.user) {
      return runtime.createElement("p", { className: props.className ?? "text-sm text-slate-600" }, "Signed out");
    }
    const displayName = auth.snapshot.user.name || auth.snapshot.user.email;
    return runtime.createElement(
      "section",
      { className: props.className ?? "space-y-2" },
      runtime.createElement("p", { className: "text-sm font-medium text-slate-900" }, displayName),
      runtime.createElement("p", { className: "text-sm text-slate-600" }, auth.snapshot.user.email),
      runtime.createElement(
        "button",
        {
          className: "inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900",
          onClick: () => {
            void auth.logout();
          },
          type: "button"
        },
        "Sign out"
      )
    );
  }

  return {
    AuthProvider,
    useAuth,
    useAuthFetch,
    LoginView,
    AccountView
  };
}
