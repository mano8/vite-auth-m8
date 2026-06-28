import { describe, expect, it } from "vitest";
import { DEFAULT_TAILWIND_CONTENT_GLOBS, parseCliArgs, patchTailwindConfig, renderCliUsage } from "../src/cli/index.js";

describe("CLI argument parsing", () => {
  it("parses help and init options", () => {
    expect(parseCliArgs([])).toEqual({ command: "help" });
    expect(parseCliArgs(["--help"])).toEqual({ command: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ command: "help" });
    expect(parseCliArgs(["init", "--framework", "react", "--shadcn", "--force"])).toEqual({
      command: "init",
      framework: "react",
      tailwind: true,
      shadcn: true,
      force: true
    });
    expect(parseCliArgs(["init", "--framework", "preact", "--tailwind"])).toEqual({
      command: "init",
      framework: "preact",
      tailwind: true,
      shadcn: false,
      force: false
    });
    expect(renderCliUsage()).toContain("vite-auth-m8 init");
  });

  it("rejects unsupported CLI input", () => {
    expect(() => parseCliArgs(["build"])).toThrow('Unsupported command "build"');
    expect(() => parseCliArgs(["init", "--framework", "solid"])).toThrow("--framework");
    expect(() => parseCliArgs(["init", "--unknown"])).toThrow('Unsupported option "--unknown"');
  });
});

describe("Tailwind config patching", () => {
  it("creates a config when none exists", () => {
    const patched = patchTailwindConfig("");
    expect(patched.changed).toBe(true);
    expect(patched.source).toContain('import type { Config } from "tailwindcss";');
    for (const glob of DEFAULT_TAILWIND_CONTENT_GLOBS) {
      expect(patched.source).toContain(glob);
    }
  });

  it("merges required content globs into an existing content array once", () => {
    const source = [
      "export default {",
      "  content: [",
      '    "./src/**/*.{ts,tsx}",',
      '    "./node_modules/@fa-m8/vite-auth-m8/dist/src/**/*.{js,d.ts}"',
      "  ],",
      "  plugins: []",
      "};",
      ""
    ].join("\n");
    const patched = patchTailwindConfig(source);
    expect(patched.changed).toBe(true);
    expect(patched.source.match(/@fa-m8\/vite-auth-m8/g)).toHaveLength(1);
    expect(patched.source).toContain("./components/**/*.{js,jsx,ts,tsx}");
  });

  it("reports unchanged when all required content globs are already present", () => {
    const source = [
      "module.exports = {",
      `  content: [${DEFAULT_TAILWIND_CONTENT_GLOBS.map((glob) => `"${glob}"`).join(", ")}]`,
      "};"
    ].join("\n");
    expect(patchTailwindConfig(source)).toEqual({ changed: false, source });
  });

  it("inserts content into object configs and rejects non-object configs", () => {
    expect(patchTailwindConfig("module.exports = {\n  theme: {}\n};").source).toContain("content: [");
    expect(() => patchTailwindConfig("export default createConfig();")).toThrow("export an object");
  });
});
