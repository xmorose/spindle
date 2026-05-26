export class MemoCache {
  private store = new Map<string, unknown>();

  get<T>(key: string, compute: () => T): T {
    if (this.store.has(key)) return this.store.get(key) as T;
    const value = compute();
    this.store.set(key, value);
    return value;
  }

  invalidateAll(): void {
    this.store.clear();
  }
}
