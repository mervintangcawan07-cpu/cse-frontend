"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Wraps an asynchronous action (e.g., form submit or API call) to prevent double submissions.
 * Uses a synchronous ref lock to prevent rapid multi-clicks, while exposing reactive `isSubmitting`
 * state for disabling buttons and showing loaders.
 */
export function useDoubleSubmitPreventer<
  Args extends readonly unknown[],
  ReturnVal,
>(
  asyncAction: (...args: Args) => Promise<ReturnVal>
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSubmit = useCallback(
    async (...args: Args): Promise<ReturnVal | undefined> => {
      // Synchronous lock: instantly blocks concurrent clicks before React re-renders
      if (isSubmittingRef.current) {
        return undefined;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);

      try {
        return await asyncAction(...args);
      } finally {
        isSubmittingRef.current = false;
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [asyncAction]
  );

  return { isSubmitting, handleSubmit };
}