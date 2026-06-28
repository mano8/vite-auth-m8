import type { AuthM8ExtensionFramework } from "../plugin/types.js";

export const DEFAULT_TAILWIND_CONTENT_GLOBS = [
  "./src/**/*.{js,jsx,ts,tsx}",
  "./components/**/*.{js,jsx,ts,tsx}",
  "./node_modules/@fa-m8/vite-auth-m8/dist/src/**/*.{js,d.ts}"
] as const;

export interface TailwindPatchResult {
  changed: boolean;
  source: string;
}

export interface InitCliOptions {
  command: "init";
  framework: AuthM8ExtensionFramework;
  tailwind: boolean;
  shadcn: boolean;
  force: boolean;
}

export interface HelpCliOptions {
  command: "help";
}

export type ParsedCliOptions = InitCliOptions | HelpCliOptions;

const frameworks = new Set<AuthM8ExtensionFramework>(["vanilla", "preact", "react"]);

function quoteContentGlob(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function renderContentArray(values: readonly string[], indent: string): string {
  const itemIndent = `${indent}  `;
  return `content: [\n${values.map((value) => `${itemIndent}${quoteContentGlob(value)}`).join(",\n")}\n${indent}]`;
}

function readExistingContentGlobs(contentBody: string): string[] {
  return [...contentBody.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function mergeContentGlobs(existing: readonly string[], required: readonly string[]): string[] {
  return [...new Set([...existing, ...required])];
}

export function patchTailwindConfig(source: string, requiredGlobs: readonly string[] = DEFAULT_TAILWIND_CONTENT_GLOBS): TailwindPatchResult {
  if (source.trim().length === 0) {
    return {
      changed: true,
      source: [
        'import type { Config } from "tailwindcss";',
        "",
        "export default {",
        `  ${renderContentArray(requiredGlobs, "  ")},`,
        "  theme: {",
        "    extend: {}",
        "  },",
        "  plugins: []",
        "} satisfies Config;",
        ""
      ].join("\n")
    };
  }

  const contentMatch = /(?<indent>\s*)content\s*:\s*\[(?<body>[\s\S]*?)\]/m.exec(source);
  if (contentMatch?.groups) {
    const existing = readExistingContentGlobs(contentMatch.groups.body);
    if (requiredGlobs.every((glob) => existing.includes(glob))) {
      return {
        changed: false,
        source
      };
    }
    const merged = mergeContentGlobs(existing, requiredGlobs);
    const replacement = `${contentMatch.groups.indent}${renderContentArray(merged, contentMatch.groups.indent)}`;
    const patched = `${source.slice(0, contentMatch.index)}${replacement}${source.slice(contentMatch.index + contentMatch[0].length)}`;
    return {
      changed: patched !== source,
      source: patched
    };
  }

  const objectMatch = /(?:export\s+default|module\.exports\s*=)\s*\{/m.exec(source);
  if (!objectMatch) {
    throw new Error("Tailwind config must export an object so vite-auth-m8 can patch content globs.");
  }

  const insertAt = objectMatch.index + objectMatch[0].length;
  const insertion = `\n  ${renderContentArray(requiredGlobs, "  ")},`;
  return {
    changed: true,
    source: `${source.slice(0, insertAt)}${insertion}${source.slice(insertAt)}`
  };
}

export function parseCliArgs(args: readonly string[]): ParsedCliOptions {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    return { command: "help" };
  }
  if (command !== "init") {
    throw new Error(`Unsupported command "${command}". Use "vite-auth-m8 init".`);
  }

  let framework: AuthM8ExtensionFramework = "vanilla";
  let tailwind = false;
  let shadcn = false;
  let force = false;
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--framework") {
      const next = rest[index + 1];
      if (!frameworks.has(next as AuthM8ExtensionFramework)) {
        throw new Error("--framework must be vanilla, preact, or react.");
      }
      framework = next as AuthM8ExtensionFramework;
      index += 1;
    } else if (value === "--tailwind") {
      tailwind = true;
    } else if (value === "--shadcn") {
      shadcn = true;
      tailwind = true;
    } else if (value === "--force") {
      force = true;
    } else {
      throw new Error(`Unsupported option "${value}".`);
    }
  }

  return {
    command: "init",
    framework,
    tailwind,
    shadcn,
    force
  };
}

export function renderCliUsage(): string {
  return [
    "Usage:",
    "  vite-auth-m8 init --framework vanilla",
    "  vite-auth-m8 init --framework preact --tailwind --shadcn",
    "  vite-auth-m8 init --framework react --tailwind --shadcn"
  ].join("\n");
}
