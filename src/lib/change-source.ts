import { AsyncLocalStorage } from "node:async_hooks";

const globalForSource = globalThis as unknown as {
  changeSource?: AsyncLocalStorage<string>;
};

const store = globalForSource.changeSource ?? new AsyncLocalStorage<string>();
globalForSource.changeSource = store;

export function currentChangeSource(): string {
  return store.getStore() || "application";
}

export function withChangeSource<T>(source: "assistant" | "formulaire", work: () => Promise<T>): Promise<T> {
  return store.run(source, work);
}
