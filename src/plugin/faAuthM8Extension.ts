import type { Plugin, UserConfig } from "vite";
import { buildManifest, buildRuntimeVirtualConfig, normalizePluginConfig, validateManifestAlignment } from "./manifest.js";
import { buildRollupInputs, mergeRollupInputs } from "./rollupInputs.js";
import type { FaAuthM8ExtensionConfig, NormalizedFaAuthM8ExtensionConfig } from "./types.js";
import { renderVirtualConfigModule, resolvedVirtualConfigModuleId, virtualConfigModuleId } from "./virtualModules.js";

function frameworkWarning(config: NormalizedFaAuthM8ExtensionConfig, pluginNames: string[]): string | null {
  if (config.framework === "preact" && !pluginNames.some((name) => name.includes("preact"))) {
    return "vite-auth-m8 framework is preact, but no Preact Vite plugin was detected.";
  }
  if (config.framework === "react" && !pluginNames.some((name) => name.includes("react"))) {
    return "vite-auth-m8 framework is react, but no React Vite plugin was detected.";
  }
  return null;
}

export function faAuthM8Extension(config: FaAuthM8ExtensionConfig): Plugin {
  const normalized = normalizePluginConfig(config);
  const runtimeConfig = buildRuntimeVirtualConfig(normalized);
  return {
    name: "vite-auth-m8-extension",
    enforce: "pre",
    config(userConfig): UserConfig {
      const root = userConfig.root ?? process.cwd();
      const injectedInputs = buildRollupInputs(root, normalized);
      return {
        define: {
          __FA_AUTH_M8_EXTENSION_CONFIG__: JSON.stringify(runtimeConfig),
          ...userConfig.define
        },
        build: {
          ...userConfig.build,
          rollupOptions: {
            ...userConfig.build?.rollupOptions,
            input: mergeRollupInputs(userConfig.build?.rollupOptions?.input, injectedInputs),
            output: {
              entryFileNames: "[name].js",
              chunkFileNames: "chunks/[name]-[hash].js",
              assetFileNames: "assets/[name][extname]",
              ...(
                Array.isArray(userConfig.build?.rollupOptions?.output)
                  ? {}
                  : userConfig.build?.rollupOptions?.output
              )
            }
          }
        }
      };
    },
    configResolved(resolvedConfig): void {
      const pluginNames = resolvedConfig.plugins.map((plugin) => plugin.name);
      const warning = frameworkWarning(normalized, pluginNames);
      if (warning) {
        resolvedConfig.logger.warn(warning);
      }
      for (const alignmentWarning of validateManifestAlignment(normalized)) {
        resolvedConfig.logger.warn(alignmentWarning);
      }
    },
    resolveId(id): string | null {
      return id === virtualConfigModuleId ? resolvedVirtualConfigModuleId : null;
    },
    load(id): string | null {
      return id === resolvedVirtualConfigModuleId ? renderVirtualConfigModule(runtimeConfig) : null;
    },
    generateBundle(): void {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(buildManifest(normalized), null, 2)
      });
    }
  };
}
