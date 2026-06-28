export type ShadcnRegistryFramework = "react" | "preact";

export interface ShadcnRegistryFile {
  path: string;
  target: string;
  type: "registry:component";
  content: string;
}

export interface ShadcnRegistryItem {
  name: string;
  title: string;
  description: string;
  framework: ShadcnRegistryFramework;
  type: "registry:block";
  registryDependencies: string[];
  dependencies: string[];
  files: ShadcnRegistryFile[];
}

const reactAuthPanel = `import * as React from "react";
import { createReactAuthAdapter } from "@fa-m8/vite-auth-m8/react-ui";

const authUi = createReactAuthAdapter(React);

function AuthPanelBody() {
  const auth = authUi.useAuth();
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold tracking-normal">Extension account</h2>
        <p className="text-sm text-muted-foreground">Authenticate through fa-auth-m8.</p>
      </div>
      {auth.snapshot.isAuthenticated ? <authUi.AccountView /> : <authUi.LoginView />}
    </div>
  );
}

export function FaAuthM8AuthPanel() {
  return (
    <authUi.AuthProvider>
      <AuthPanelBody />
    </authUi.AuthProvider>
  );
}
`;

const preactAuthPanel = `import { createContext, h } from "preact";
import { createPreactAuthAdapter } from "@fa-m8/vite-auth-m8/preact-ui";
import { useCallback, useContext, useEffect, useMemo, useState } from "preact/hooks";

const authUi = createPreactAuthAdapter({ createContext, h }, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
});

function AuthPanelBody() {
  const auth = authUi.useAuth();
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold tracking-normal">Extension account</h2>
        <p className="text-sm text-muted-foreground">Authenticate through fa-auth-m8.</p>
      </div>
      {auth.snapshot.isAuthenticated ? <authUi.AccountView /> : <authUi.LoginView />}
    </div>
  );
}

export function FaAuthM8AuthPanel() {
  return (
    <authUi.AuthProvider>
      <AuthPanelBody />
    </authUi.AuthProvider>
  );
}
`;

export const shadcnRegistry = [
  {
    name: "fa-auth-m8-react-auth-panel",
    title: "fa-auth-m8 React Auth Panel",
    description: "React shadcn-style extension auth panel backed by @fa-m8/vite-auth-m8 hooks.",
    framework: "react",
    type: "registry:block",
    registryDependencies: [],
    dependencies: ["@fa-m8/vite-auth-m8", "react"],
    files: [
      {
        path: "registry/react/fa-auth-m8-auth-panel.tsx",
        target: "components/fa-auth-m8-auth-panel.tsx",
        type: "registry:component",
        content: reactAuthPanel
      }
    ]
  },
  {
    name: "fa-auth-m8-preact-auth-panel",
    title: "fa-auth-m8 Preact Auth Panel",
    description: "Preact-compatible shadcn-style extension auth panel backed by @fa-m8/vite-auth-m8 hooks.",
    framework: "preact",
    type: "registry:block",
    registryDependencies: [],
    dependencies: ["@fa-m8/vite-auth-m8", "preact"],
    files: [
      {
        path: "registry/preact/fa-auth-m8-auth-panel.tsx",
        target: "components/fa-auth-m8-auth-panel.tsx",
        type: "registry:component",
        content: preactAuthPanel
      }
    ]
  }
] as const satisfies readonly ShadcnRegistryItem[];

export function listShadcnRegistryItems(framework?: ShadcnRegistryFramework): ShadcnRegistryItem[] {
  return shadcnRegistry.filter((item) => framework === undefined || item.framework === framework);
}

export function getShadcnRegistryItem(name: string): ShadcnRegistryItem {
  const item = shadcnRegistry.find((candidate) => candidate.name === name);
  if (!item) {
    throw new Error(`Unknown shadcn registry item "${name}".`);
  }
  return item;
}
