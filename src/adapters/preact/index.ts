import {
  createFrameworkAuthAdapter,
  type FrameworkAuthAdapter,
  type FrameworkContext,
  type FrameworkRuntime
} from "../framework.js";

export interface PreactCoreRuntime {
  createContext<T>(defaultValue: T): FrameworkContext<T>;
  h(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

export interface PreactHooksRuntime {
  useCallback<T>(callback: T, dependencies: readonly unknown[]): T;
  useContext<T>(context: FrameworkContext<T>): T;
  useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void;
  useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
}

export type PreactAuthAdapter = FrameworkAuthAdapter;

export function createPreactAuthAdapter(preact: PreactCoreRuntime, hooks: PreactHooksRuntime): PreactAuthAdapter {
  const runtime: FrameworkRuntime = {
    createContext: preact.createContext,
    createElement: preact.h,
    useCallback: hooks.useCallback,
    useContext: hooks.useContext,
    useEffect: hooks.useEffect,
    useMemo: hooks.useMemo,
    useState: hooks.useState
  };
  return createFrameworkAuthAdapter(runtime);
}
