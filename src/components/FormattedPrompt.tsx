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
      className={`leading-relaxed overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}
