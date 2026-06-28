import type { StorageArea, StorageChangeListener, StorageDriver } from "../src/runtime/chrome/storage.js";

class MemoryArea implements StorageArea {
  readonly data: Record<string, unknown> = {};

  async get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    if (typeof keys === "string") {
      return { [keys]: this.data[keys] };
    }
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, this.data[key]]));
    }
    if (keys && typeof keys === "object") {
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, this.data[key] ?? fallback]));
    }
    return { ...this.data };
  }

  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, items);
  }

  async remove(keys: string | string[]): Promise<void> {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete this.data[key];
    }
  }
}

export class MemoryStorageDriver implements StorageDriver {
  readonly local = new MemoryArea();
  readonly session = new MemoryArea();
  readonly listeners = new Set<StorageChangeListener>();

  addChangeListener(listener: StorageChangeListener): void {
    this.listeners.add(listener);
  }

  removeChangeListener(listener: StorageChangeListener): void {
    this.listeners.delete(listener);
  }

  emitAuthChanged(newValue: unknown): void {
    for (const listener of this.listeners) {
      listener({ auth: { newValue } }, "local");
    }
  }
}
