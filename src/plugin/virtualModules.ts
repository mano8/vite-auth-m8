import type { RuntimeVirtualConfig } from "./types.js";

export const virtualConfigModuleId = "virtual:fa-auth-m8-extension/config";
export const resolvedVirtualConfigModuleId = `\0${virtualConfigModuleId}`;

export function renderVirtualConfigModule(config: RuntimeVirtualConfig): string {
  const serialized = JSON.stringify(config);
  return [
    `const config = Object.freeze(${serialized});`,
    "export default config;",
    "export const framework = config.framework;",
    "export const apiBase = config.apiBase;",
    "export const backendOrigins = config.backendOrigins;",
    "export const oauthCallbackPage = config.oauthCallbackPage;",
    "export const googleOAuth = config.googleOAuth;"
  ].join("\n");
}
