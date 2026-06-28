export type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

export type StorageChanges = Record<string, StorageChange>;

export type StorageChangeListener = (changes: StorageChanges, areaName: string) => void;

export interface StorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface StorageDriver {
  local: StorageArea;
  session: StorageArea;
  addChangeListener?(listener: StorageChangeListener): void;
  removeChangeListener?(listener: StorageChangeListener): void;
}

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void;
  set(items: Record<string, unknown>, callback?: () => void): void;
  remove(keys: string | string[], callback?: () => void): void;
};

type ChromeStorageApi = {
  local: ChromeStorageArea;
  session: ChromeStorageArea;
  onChanged: {
    addListener(listener: StorageChangeListener): void;
    removeListener(listener: StorageChangeListener): void;
  };
};

export type ChromeLikeApi = {
  storage: ChromeStorageApi;
};

function wrapChromeArea(area: ChromeStorageArea): StorageArea {
  return {
    get(keys) {
      return new Promise((resolve) => {
        area.get(keys ?? null, resolve);
      });
    },
    set(items) {
      return new Promise((resolve) => {
        area.set(items, resolve);
      });
    },
    remove(keys) {
      return new Promise((resolve) => {
        area.remove(keys, resolve);
      });
    }
  };
}

export function createChromeStorageDriver(chromeApi: ChromeLikeApi): StorageDriver {
  return {
    local: wrapChromeArea(chromeApi.storage.local),
    session: wrapChromeArea(chromeApi.storage.session),
    addChangeListener(listener) {
      chromeApi.storage.onChanged.addListener(listener);
    },
    removeChangeListener(listener) {
      chromeApi.storage.onChanged.removeListener(listener);
    }
  };
}

export function getGlobalChromeStorageDriver(): StorageDriver {
  const chromeApi = (globalThis as { chrome?: ChromeLikeApi }).chrome;
  if (!chromeApi?.storage?.local || !chromeApi.storage.session) {
    throw new Error("Chrome storage is unavailable. Provide a StorageDriver explicitly.");
  }
  return createChromeStorageDriver(chromeApi);
}
