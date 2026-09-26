import { AsyncLocalStorage } from "node:async_hooks";

const store = new AsyncLocalStorage<string>();

export function currentChangeSource(): string {
  return store.getStore() || "application";
}

export function withChangeSource<T>(source: "assistant" | "formulaire", work: () => Promise<T>): Promise<T> {
  return store.run(source, work);
}
