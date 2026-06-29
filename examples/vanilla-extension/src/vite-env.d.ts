declare module "virtual:fa-auth-m8-extension/config" {
  interface RuntimeVirtualConfig {
    framework: "vanilla" | "preact" | "react";
    apiBase: string;
    backendOrigins: string[];
    oauthCallbackPage: string;
    googleOAuth: boolean;
  }

  const config: RuntimeVirtualConfig;
  export default config;
  export const framework: RuntimeVirtualConfig["framework"];
  export const apiBase: string;
  export const backendOrigins: string[];
  export const oauthCallbackPage: string;
  export const googleOAuth: boolean;
}
