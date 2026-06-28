import {
  type AuthAdapterSession,
  type AuthAdapterSnapshot,
  createAuthAdapterSession
} from "../shared.js";

export interface VanillaAuthController {
  readonly session: AuthAdapterSession;
  login(username: string, password: string): Promise<AuthAdapterSnapshot>;
  logout(): Promise<AuthAdapterSnapshot>;
  renderLogin(snapshot?: AuthAdapterSnapshot): string;
  renderAccount(snapshot?: AuthAdapterSnapshot): string;
  destroy(): void;
}

export interface VanillaAuthLabels {
  email: string;
  password: string;
  submit: string;
  signedOut: string;
  signOut: string;
}

export interface VanillaAuthOptions {
  session?: AuthAdapterSession;
  labels?: Partial<VanillaAuthLabels>;
}

const DEFAULT_LABELS: VanillaAuthLabels = {
  email: "Email",
  password: "Password",
  submit: "Sign in",
  signedOut: "Signed out",
  signOut: "Sign out"
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function labelsFromOptions(options?: VanillaAuthOptions): VanillaAuthLabels {
  return { ...DEFAULT_LABELS, ...options?.labels };
}

export function renderVanillaLoginView(snapshot: AuthAdapterSnapshot, options?: VanillaAuthOptions): string {
  const labels = labelsFromOptions(options);
  const disabled = snapshot.status === "loading" ? " disabled" : "";
  const error = snapshot.error
    ? `<p class="mt-2 text-sm text-red-600" role="alert">${escapeHtml(snapshot.error)}</p>`
    : "";
  return [
    '<form class="fa-m8-auth-grid space-y-3" data-fa-auth-view="login">',
    `<label class="block text-sm font-medium text-slate-900">${escapeHtml(labels.email)}</label>`,
    `<input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="username" type="email" autocomplete="username"${disabled}>`,
    `<label class="block text-sm font-medium text-slate-900">${escapeHtml(labels.password)}</label>`,
    `<input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="password" type="password" autocomplete="current-password"${disabled}>`,
    `<button class="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" type="submit"${disabled}>${escapeHtml(labels.submit)}</button>`,
    error,
    "</form>"
  ].join("");
}

export function renderVanillaAccountView(snapshot: AuthAdapterSnapshot, options?: VanillaAuthOptions): string {
  const labels = labelsFromOptions(options);
  if (!snapshot.user) {
    return `<section class="fa-m8-auth-account text-sm text-slate-600" data-fa-auth-view="account">${escapeHtml(labels.signedOut)}</section>`;
  }
  const displayName = snapshot.user.name || snapshot.user.email;
  return [
    '<section class="fa-m8-auth-account space-y-2" data-fa-auth-view="account">',
    `<p class="text-sm font-medium text-slate-900">${escapeHtml(displayName)}</p>`,
    `<p class="text-sm text-slate-600">${escapeHtml(snapshot.user.email)}</p>`,
    `<button class="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900" type="button">${escapeHtml(labels.signOut)}</button>`,
    "</section>"
  ].join("");
}

export function createVanillaAuthController(options: VanillaAuthOptions = {}): VanillaAuthController {
  const session = options.session ?? createAuthAdapterSession();
  return {
    session,
    login(username, password) {
      return session.loginWithPassword(username, password);
    },
    logout() {
      return session.logout();
    },
    renderLogin(snapshot = session.getSnapshot()) {
      return renderVanillaLoginView(snapshot, options);
    },
    renderAccount(snapshot = session.getSnapshot()) {
      return renderVanillaAccountView(snapshot, options);
    },
    destroy() {
      session.destroy();
    }
  };
}
