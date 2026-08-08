// Relative Path: src/lib/fetchWithTimeout.ts

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // Timeout duration in milliseconds (default: 10000ms / 10s)
}

/**
 * Standard fetch wrapper that automatically aborts requests exceeding the specified timeout duration.
 * Prevents UI components from hanging indefinitely on sluggish mobile networks or dropped sockets.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(input, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeout / 1000}s. Please check your connection and retry.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}