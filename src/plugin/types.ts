export type AuthM8ExtensionFramework = "vanilla" | "preact" | "react";

export interface ExtensionEntryConfig {
  popup?: string;
  oauthCallback?: string;
  background?: string;
}

export interface ExtensionPageConfig {
  popup?: string;
  oauthCallback?: string;
}

export interface ExtensionOauthConfig {
  google?: boolean;
  callbackPage?: string;
}

export interface ExtensionActionConfig {
  default_title?: string;
  default_popup?: string;
  default_icon?: string | Record<string, string>;
}

export interface ExtensionBackgroundConfig {
  service_worker?: string;
  type?: "module";
}

export interface ExtensionCspConfig {
  extension_pages?: string;
}

export interface ExtensionManifestConfig {
  name: string;
  version: string;
  description?: string;
  icons?: Record<string, string>;
  action?: ExtensionActionConfig;
  background?: ExtensionBackgroundConfig;
  permissions?: string[];
  host_permissions?: string[];
  content_security_policy?: ExtensionCspConfig;
}

export interface FaAuthM8ExtensionConfig {
  framework: AuthM8ExtensionFramework;
  apiBase: string;
  backendOrigins?: string[];
  manifest: ExtensionManifestConfig;
  oauth?: ExtensionOauthConfig;
  entries?: ExtensionEntryConfig;
  pages?: ExtensionPageConfig;
  permissions?: string[];
  hostPermissions?: string[];
}

export interface NormalizedFaAuthM8ExtensionConfig {
  framework: AuthM8ExtensionFramework;
  apiBase: string;
  backendOrigins: string[];
  manifest: ExtensionManifestConfig;
  oauth: Required<ExtensionOauthConfig>;
  entries: Required<ExtensionEntryConfig>;
  pages: Required<ExtensionPageConfig>;
  permissions: string[];
  hostPermissions: string[];
}

export interface RuntimeVirtualConfig {
  framework: AuthM8ExtensionFramework;
  apiBase: string;
  backendOrigins: string[];
  oauthCallbackPage: string;
  googleOAuth: boolean;
}
