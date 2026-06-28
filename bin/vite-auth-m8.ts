#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCliArgs, patchTailwindConfig, renderCliUsage } from "../src/cli/index.js";
import { listShadcnRegistryItems } from "../src/shadcn/index.js";

const tailwindConfigNames = [
  "tailwind.config.ts",
  "tailwind.config.js",
  "tailwind.config.mjs",
  "tailwind.config.cjs"
];

function findTailwindConfig(cwd: string): string {
  for (const fileName of tailwindConfigNames) {
    const fullPath = path.join(cwd, fileName);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(cwd, "tailwind.config.ts");
}

function main(): void {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.command === "help") {
    process.stdout.write(`${renderCliUsage()}\n`);
    return;
  }

  if (parsed.tailwind) {
    const configPath = findTailwindConfig(process.cwd());
    const current = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    const patched = patchTailwindConfig(current);
    if (patched.changed || parsed.force) {
      writeFileSync(configPath, patched.source);
    }
    process.stdout.write(`Patched ${path.basename(configPath)} for ${parsed.framework} Tailwind content.\n`);
  }

  if (parsed.shadcn) {
    const items = listShadcnRegistryItems(parsed.framework === "vanilla" ? undefined : parsed.framework);
    process.stdout.write(`Available shadcn registry blocks: ${items.map((item) => item.name).join(", ")}\n`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "vite-auth-m8 failed."}\n`);
  process.exitCode = 1;
}
