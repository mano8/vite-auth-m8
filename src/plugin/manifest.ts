import { buildExtensionCsp, cspAllowsOrigin, hostPermissionFromOrigin, mergeHostPermissions } from "./csp.js";
import type { ExtensionManifestConfig, FaAuthM8ExtensionConfig, NormalizedFaAuthM8ExtensionConfig, RuntimeVirtualConfig } from "./types.js";

export interface ChromeExtensionManifest extends ExtensionManifestConfig {
  manifest_version: 3;
  action: NonNullable<ExtensionManifestConfig["action"]>;
  background: {
    service_worker: string;
    type: "module";
  };
  permissions: string[];
  host_permissions: string[];
  content_security_policy: {
    extension_pages: string;
  };
}

const allowedFrameworks = new Set(["vanilla", "preact", "react"]);
const allowedPermissions = new Set([
  "activeTab",
  "alarms",
  "clipboardRead",
  "clipboardWrite",
  "contextMenus",
  "cookies",
  "identity",
  "notifications",
  "offscreen",
  "scripting",
  "storage",
  "tabs",
  "webRequest"
]);

function normalizeHttpUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must use http: or https:.`);
  }
  return url;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function validatePermissions(permissions: string[]): void {
  const invalid = permissions.filter((permission) => !allowedPermissions.has(permission));
  if (invalid.length > 0) {
    throw new Error(`Unsupported extension permission: ${invalid.join(", ")}.`);
  }
}

export function normalizePluginConfig(config: FaAuthM8ExtensionConfig): NormalizedFaAuthM8ExtensionConfig {
  if (!allowedFrameworks.has(config.framework)) {
    throw new Error(`Unsupported framework "${config.framework}". Use vanilla, preact, or react.`);
  }
  const apiBase = normalizeHttpUrl(config.apiBase, "apiBase").toString().replace(/\/$/, "");
  const configuredOrigins = config.backendOrigins ?? [new URL(apiBase).origin];
  const backendOrigins = unique(configuredOrigins.map((origin) => normalizeHttpUrl(origin, "backendOrigins").origin));
  const oauth = {
    google: config.oauth?.google ?? true,
    callbackPage: config.oauth?.callbackPage ?? "oauth-callback.html"
  };
  const entries = {
    popup: config.entries?.popup ?? "popup.html",
    oauthCallback: config.entries?.oauthCallback ?? "oauth-callback.html",
    background: config.entries?.background ?? "src/background.ts"
  };
  const pages = {
    popup: config.pages?.popup ?? "popup.html",
    oauthCallback: config.pages?.oauthCallback ?? oauth.callbackPage
  };
  const permissions = unique(["storage", ...(oauth.google ? ["identity"] : []), ...(config.manifest.permissions ?? []), ...(config.permissions ?? [])]);
  validatePermissions(permissions);
  const generatedHostPermissions = backendOrigins.map(hostPermissionFromOrigin);
  const hostPermissions = mergeHostPermissions(generatedHostPermissions, [
    ...(config.manifest.host_permissions ?? []),
    ...(config.hostPermissions ?? [])
  ]);
  return {
    framework: config.framework,
    apiBase,
    backendOrigins,
    manifest: config.manifest,
    oauth,
    entries,
    pages,
    permissions,
    hostPermissions
  };
}

export function buildRuntimeVirtualConfig(config: NormalizedFaAuthM8ExtensionConfig): RuntimeVirtualConfig {
  return {
    framework: config.framework,
    apiBase: config.apiBase,
    backendOrigins: config.backendOrigins,
    oauthCallbackPage: config.pages.oauthCallback,
    googleOAuth: config.oauth.google
  };
}

export function buildManifest(config: NormalizedFaAuthM8ExtensionConfig): ChromeExtensionManifest {
  const existingCsp = config.manifest.content_security_policy?.extension_pages;
  return {
    ...config.manifest,
    manifest_version: 3,
    action: {
      ...config.manifest.action,
      default_popup: config.manifest.action?.default_popup ?? config.pages.popup
    },
    background: {
      service_worker: config.manifest.background?.service_worker ?? "background.js",
      type: "module"
    },
    permissions: config.permissions,
    host_permissions: config.hostPermissions,
    content_security_policy: {
      extension_pages: buildExtensionCsp(config.backendOrigins, existingCsp)
    }
  };
}

export function validateManifestAlignment(config: NormalizedFaAuthM8ExtensionConfig): string[] {
  const configuredHostPermissions = config.manifest.host_permissions ?? [];
  const configuredCsp = config.manifest.content_security_policy?.extension_pages;
  return config.backendOrigins.flatMap((origin) => {
    const warnings: string[] = [];
    if (configuredHostPermissions.length > 0 && !configuredHostPermissions.includes(hostPermissionFromOrigin(origin))) {
      warnings.push(`host_permissions did not include ${origin}; vite-auth-m8 will add it from backendOrigins.`);
    }
    if (configuredCsp && !cspAllowsOrigin(configuredCsp, origin)) {
      warnings.push(`content_security_policy.connect-src did not include ${origin}; vite-auth-m8 will add it from backendOrigins.`);
    }
    return warnings;
  });
}
