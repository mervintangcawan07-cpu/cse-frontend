// Relative Path: src/components/common/LoadingButton.tsx
"use client";

import React from "react";

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export default function LoadingButton({
  isLoading = false,
  loadingText = "Processing...",
  children,
  disabled,
  className = "",
  variant = "primary",
  type = "submit",
  ...props
}: LoadingButtonProps) {
  const baseStyles = "relative inline-flex items-center justify-center font-bold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none";
  
  let variantStyles = "bg-blue-600 hover:bg-blue-500 text-white shadow-md";
  if (variant === "secondary") {
    variantStyles = "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700";
  } else if (variant === "danger") {
    variantStyles = "bg-rose-600 hover:bg-rose-500 text-white shadow-md";
  } else if (variant === "ghost") {
    variantStyles = "bg-transparent hover:bg-slate-900 text-slate-300 hover:text-white";
  }

  return (
    <button
      type={type}
      disabled={isLoading || disabled}
      className={`${baseStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-current shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}