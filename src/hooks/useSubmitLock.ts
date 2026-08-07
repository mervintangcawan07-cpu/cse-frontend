// Relative Path: src/hooks/useSubmitLock.ts

import { useState, useCallback, useRef } from "react";

interface UseSubmitLockReturn<T> {
  isSubmitting: boolean;
  execute: (...args: any[]) => Promise<T | undefined>;
}

/**
 * React hook that prevents rapid double-clicking and concurrent submissions on UI controls.
 */
export function useSubmitLock<T = void>(
  asyncSubmitFn: (...args: any[]) => Promise<T>
): UseSubmitLockReturn<T> {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false);

  const execute = useCallback(
    async (...args: any[]): Promise<T | undefined> => {
      if (lockRef.current) {
        return undefined; // Block duplicate execution attempt
      }

      lockRef.current = true;
      setIsSubmitting(true);

      try {
        const result = await asyncSubmitFn(...args);
        return result;
      } finally {
        lockRef.current = false;
        setIsSubmitting(false);
      }
    },
    [asyncSubmitFn]
  );

  return { isSubmitting, execute };
}
