// Relative Path: src/hooks/useDoubleSubmitPreventer.ts
"use client";

import { useState, useCallback } from "react";

/**
 * Wraps an asynchronous action (e.g., form submit or API call) to prevent double submissions.
 * Automatically manages loading state and safely resets state if validation or network errors occur.
 */
export function useDoubleSubmitPreventer<T extends (...args: any[]) => Promise<any>>(
  asyncAction: T
) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (...args: Parameters<T>) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        return await asyncAction(...args);
      } finally {
        setIsSubmitting(false);
      }
    },
    [asyncAction, isSubmitting]
  );

  return { isSubmitting, handleSubmit };
}