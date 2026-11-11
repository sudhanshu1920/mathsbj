export interface AsyncCache<T> {
  get(forceRefresh?: boolean): Promise<T>;
  clear(): void;
}

/** Small in-memory stale-while-valid cache with request de-duplication. */
export function createAsyncCache<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
): AsyncCache<T> {
  let hasValue = false;
  let value: T;
  let expiresAt = 0;
  let generation = 0;
  let pending: Promise<T> | null = null;

  return {
    get(forceRefresh = false): Promise<T> {
      if (!forceRefresh && hasValue && now() < expiresAt) {
        return Promise.resolve(value);
      }
      if (pending) return pending;

      const requestGeneration = generation;
      const request = Promise.resolve()
        .then(load)
        .then((nextValue) => {
          if (generation === requestGeneration) {
            value = nextValue;
            hasValue = true;
            expiresAt = now() + Math.max(0, ttlMs);
          }
          return nextValue;
        })
        .finally(() => {
          if (pending === request) pending = null;
        });

      pending = request;
      return request;
    },

    clear(): void {
      generation += 1;
      hasValue = false;
      expiresAt = 0;
      pending = null;
    },
  };
}
