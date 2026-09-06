export const AUTH_ACTIVITY_THROTTLE_MS = 2 * 60 * 1000;
export const AUTH_SNAPSHOT_STALE_MS = 2 * 60 * 1000;

export class AuthRequestInvalidatedError extends Error {
  constructor() {
    super("Auth request was invalidated.");
    this.name = "AuthRequestInvalidatedError";
  }
}

export interface AuthRequestGate<T> {
  run(request: (signal: AbortSignal) => Promise<T>): Promise<T>;
  invalidate(): void;
  hasInFlightRequest(): boolean;
}

/**
 * Owns the single in-flight auth snapshot request for one client provider.
 * Invalidation prevents a late response from restoring cleared auth state.
 */
export function createAuthRequestGate<T>(): AuthRequestGate<T> {
  let generation = 0;
  let controller: AbortController | null = null;
  let inFlight: Promise<T> | null = null;

  return {
    run(request) {
      if (inFlight) return inFlight;

      const requestGeneration = generation;
      const requestController = new AbortController();
      controller = requestController;

      const promise: Promise<T> = Promise.resolve()
        .then(() => request(requestController.signal))
        .then((result) => {
          if (generation !== requestGeneration) {
            throw new AuthRequestInvalidatedError();
          }
          return result;
        })
        .finally(() => {
          if (inFlight === promise) inFlight = null;
          if (controller === requestController) controller = null;
        });

      inFlight = promise;
      return promise;
    },

    invalidate() {
      generation += 1;
      controller?.abort();
      controller = null;
      inFlight = null;
    },

    hasInFlightRequest() {
      return inFlight !== null;
    },
  };
}
