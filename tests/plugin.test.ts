import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build, createLogger, resolveConfig, type ConfigEnv, type Plugin, type UserConfig } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExtensionCsp, cspAllowsOrigin, hostPermissionFromOrigin, mergeHostPermissions } from "../src/plugin/csp.js";
import { faAuthM8Extension } from "../src/plugin/faAuthM8Extension.js";
import { buildManifest, buildRuntimeVirtualConfig, normalizePluginConfig, validateManifestAlignment } from "../src/plugin/manifest.js";
import { buildRollupInputs, mergeRollupInputs } from "../src/plugin/rollupInputs.js";
import { renderVirtualConfigModule } from "../src/plugin/virtualModules.js";
import type { AuthM8ExtensionFramework, FaAuthM8ExtensionConfig } from "../src/plugin/types.js";

const tempRoots: string[] = [];

function baseConfig(framework: AuthM8ExtensionFramework = "vanilla"): FaAuthM8ExtensionConfig {
  return {
    framework,
    apiBase: "https://localhost:4430/user/",
    backendOrigins: ["https://localhost:4430", "https://localhost:4430"],
    manifest: {
      name: "Fixture Auth",
      version: "0.1.0"
    }
  };
}

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "vite-auth-m8-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "popup.html"), '<script type="module" src="/src/popup.ts"></script>');
  await writeFile(path.join(root, "oauth-callback.html"), '<script type="module" src="/src/oauth-callback.ts"></script>');
  await writeFile(path.join(root, "src", "popup.ts"), 'import config from "virtual:fa-auth-m8-extension/config"; document.body.textContent = config.apiBase;');
  await writeFile(path.join(root, "src", "oauth-callback.ts"), 'import { oauthCallbackPage } from "virtual:fa-auth-m8-extension/config"; document.body.textContent = oauthCallbackPage;');
  await writeFile(path.join(root, "src", "background.ts"), 'import { apiBase } from "virtual:fa-auth-m8-extension/config"; globalThis.console.log(apiBase);');
  return root;
}

async function buildFixture(framework: AuthM8ExtensionFramework, extraPluginName?: string): Promise<{ root: string; manifest: unknown }> {
  const root = await createFixture();
  const extraPlugins: Plugin[] = extraPluginName ? [{ name: extraPluginName }] : [];
  await build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [
      faAuthM8Extension(baseConfig(framework)),
      ...extraPlugins
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  });
  const manifest = JSON.parse(await readFile(path.join(root, "dist", "manifest.json"), "utf8")) as unknown;
  return { root, manifest };
}

function runPluginConfigHook(plugin: Plugin, userConfig: UserConfig): UserConfig {
  const hook = plugin.config;
  if (typeof hook !== "function") {
    throw new Error("Expected plugin config hook.");
  }
  const env: ConfigEnv = {
    command: "build",
    mode: "production",
    isSsrBuild: false,
    isPreview: false
  };
  const result = hook(userConfig, env);
  if (!result || typeof result !== "object" || "then" in result) {
    throw new Error("Expected synchronous plugin config result.");
  }
  return result;
}

async function readFilesByExtension(root: string, extension: string): Promise<string> {
  const entries = await readdir(root, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return readFilesByExtension(fullPath, extension);
    }
    return entry.name.endsWith(extension) ? readFile(fullPath, "utf8") : "";
  }));
  return contents.join("\n");
}

afterEach(async () => {
  const roots = tempRoots.splice(0);
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("Vite plugin generation", () => {
  it("builds vanilla, Preact, and React Vite fixtures", async () => {
    const vanilla = await buildFixture("vanilla");
    const preact = await buildFixture("preact", "vite:preact");
    const react = await buildFixture("react", "vite:react");

    for (const fixture of [vanilla, preact, react]) {
      await expect(readFilesByExtension(path.join(fixture.root, "dist"), ".js")).resolves.toContain("https://localhost:4430/user");
      await expect(readFile(path.join(fixture.root, "dist", "background.js"), "utf8")).resolves.toContain("console.log");
      await expect(readFile(path.join(fixture.root, "dist", "popup.html"), "utf8")).resolves.toContain("popup");
      await expect(readFile(path.join(fixture.root, "dist", "oauth-callback.html"), "utf8")).resolves.toContain("oauthCallback.js");
      expect(fixture.manifest).toMatchObject({
        manifest_version: 3,
        action: { default_popup: "popup.html" },
        background: { service_worker: "background.js", type: "module" },
        permissions: ["storage", "identity"],
        host_permissions: ["https://localhost:4430/*"]
      });
    }
  });

  it("warns for missing framework plugins and manifest alignment", async () => {
    const root = await createFixture();
    const logger = createLogger("silent");
    const warn = vi.fn();
    logger.warn = warn;
    await resolveConfig({
      root,
      configFile: false,
      customLogger: logger,
      plugins: [
        faAuthM8Extension({
          ...baseConfig("react"),
          manifest: {
            name: "Warn Fixture",
            version: "0.1.0",
            host_permissions: ["https://api.example.com/*"],
            content_security_policy: {
              extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self';"
            }
          }
        })
      ]
    }, "build");

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("React Vite plugin"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("host_permissions did not include https://localhost:4430"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("content_security_policy.connect-src did not include https://localhost:4430"));

    warn.mockClear();
    await resolveConfig({
      root,
      configFile: false,
      customLogger: logger,
      plugins: [faAuthM8Extension(baseConfig("preact"))]
    }, "build");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Preact Vite plugin"));
  });

  it("merges Vite config defaults with consumer define and output array settings", () => {
    const resolved = runPluginConfigHook(faAuthM8Extension(baseConfig()), {
      define: {
        __CONSUMER_DEFINE__: JSON.stringify("kept")
      },
      build: {
        rollupOptions: {
          output: [{ entryFileNames: "consumer-[name].js" }]
        }
      }
    });

    expect(resolved.define).toMatchObject({
      __CONSUMER_DEFINE__: '"kept"',
      __FA_AUTH_M8_EXTENSION_CONFIG__: expect.stringContaining("https://localhost:4430/user")
    });
    expect(resolved.build?.rollupOptions?.input).toMatchObject({
      popup: expect.stringMatching(/popup\.html$/),
      oauthCallback: expect.stringMatching(/oauth-callback\.html$/),
      background: expect.stringMatching(/src[\\/]background\.ts$/)
    });
    expect(resolved.build?.rollupOptions?.output).toMatchObject({
      entryFileNames: "[name].js"
    });
  });
});

describe("plugin config helpers", () => {
  it("normalizes config, manifests, CSP, and virtual module values", () => {
    const normalized = normalizePluginConfig({
      ...baseConfig(),
      oauth: { google: false, callbackPage: "auth-return.html" },
      entries: { popup: "custom/popup.html", oauthCallback: "custom/callback.html", background: "custom/background.ts" },
      pages: { popup: "custom-popup.html" },
      permissions: ["tabs"],
      hostPermissions: ["https://extra.example.com/*"],
      manifest: {
        name: "Custom Fixture",
        version: "1.2.3",
        description: "Generated from plugin config",
        action: { default_title: "Auth" },
        background: { service_worker: "worker.js", type: "module" },
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://already.example.com;"
        }
      }
    });

    expect(normalized).toMatchObject({
      apiBase: "https://localhost:4430/user",
      backendOrigins: ["https://localhost:4430"],
      oauth: { google: false, callbackPage: "auth-return.html" },
      pages: { popup: "custom-popup.html", oauthCallback: "auth-return.html" },
      permissions: ["storage", "tabs"],
      hostPermissions: ["https://extra.example.com/*", "https://localhost:4430/*"]
    });
    expect(buildManifest(normalized)).toMatchObject({
      name: "Custom Fixture",
      version: "1.2.3",
      action: { default_title: "Auth", default_popup: "custom-popup.html" },
      background: { service_worker: "worker.js", type: "module" },
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://already.example.com https://localhost:4430;"
      }
    });
    expect(renderVirtualConfigModule(buildRuntimeVirtualConfig(normalized))).toContain('"oauthCallbackPage":"auth-return.html"');
    expect(buildExtensionCsp(["https://localhost:4430"])).toBe("script-src 'self'; object-src 'self'; connect-src 'self' https://localhost:4430;");
    expect(cspAllowsOrigin(undefined, "https://localhost:4430")).toBe(false);
    expect(cspAllowsOrigin("script-src 'self';", "https://localhost:4430")).toBe(false);
    expect(cspAllowsOrigin("connect-src 'self' https://localhost:4430;", "https://localhost:4430")).toBe(true);
    expect(hostPermissionFromOrigin("https://localhost:4430")).toBe("https://localhost:4430/*");
    expect(mergeHostPermissions(["https://localhost:4430/*"])).toEqual(["https://localhost:4430/*"]);
    expect(mergeHostPermissions(["https://localhost:4430/*"], ["https://localhost:4430/*", "https://extra.example.com/*"])).toEqual([
      "https://localhost:4430/*",
      "https://extra.example.com/*"
    ]);
    expect(validateManifestAlignment(normalized)).toEqual([
      "content_security_policy.connect-src did not include https://localhost:4430; vite-auth-m8 will add it from backendOrigins."
    ]);
  });

  it("rejects invalid plugin configuration", () => {
    expect(normalizePluginConfig({ ...baseConfig(), backendOrigins: undefined }).backendOrigins).toEqual(["https://localhost:4430"]);
    expect(() => normalizePluginConfig({ ...baseConfig(), framework: "svelte" as AuthM8ExtensionFramework })).toThrow("Unsupported framework");
    expect(() => normalizePluginConfig({ ...baseConfig(), apiBase: "ftp://localhost/user" })).toThrow("apiBase");
    expect(() => normalizePluginConfig({ ...baseConfig(), backendOrigins: ["chrome-extension://abc"] })).toThrow("backendOrigins");
    expect(() => normalizePluginConfig({ ...baseConfig(), permissions: ["unknown"] })).toThrow("Unsupported extension permission");
  });

  it("builds and merges Rollup inputs", () => {
    const normalized = normalizePluginConfig(baseConfig());
    const inputs = buildRollupInputs("C:\\project", normalized);
    expect(inputs.popup).toMatch(/project[\\/]popup\.html$/);
    expect(buildRollupInputs("C:\\project", {
      ...normalized,
      entries: { ...normalized.entries, background: "C:\\project\\absolute-background.ts" }
    }).background).toBe("C:\\project\\absolute-background.ts");
    expect(mergeRollupInputs(undefined, inputs)).toBe(inputs);
    expect(mergeRollupInputs("src/index.html", inputs)).toMatchObject({ app: "src/index.html", popup: inputs.popup });
    expect(mergeRollupInputs(["src/index.html", "src/admin.html"], inputs)).toMatchObject({ app1: "src/index.html", app2: "src/admin.html" });
    expect(mergeRollupInputs({ app: "src/index.html" }, inputs)).toMatchObject({ app: "src/index.html", popup: inputs.popup });
    expect(() => mergeRollupInputs(["src/index.html", 1], inputs)).toThrow("rollupOptions.input");
    expect(() => mergeRollupInputs({ app: 1 }, inputs)).toThrow("rollupOptions.input");
  });
});
