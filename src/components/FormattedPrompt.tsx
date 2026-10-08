"use client";

import React from "react";
import { formatPromptHTML } from "@/lib/formatPrompt";

interface FormattedPromptProps {
  text: string;
  className?: string;
}

export default function FormattedPrompt({ text, className = "" }: FormattedPromptProps) {
  if (!text) return null;
  const formattedHtml = formatPromptHTML(text);

  return (
    <div
      className={`w-full max-w-full leading-relaxed whitespace-normal break-words [overflow-wrap:anywhere] ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}
