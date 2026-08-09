"use client";

import React from "react";

interface FormattedPromptProps {
  text: string;
  className?: string;
}

export default function FormattedPrompt({ text, className = "" }: FormattedPromptProps) {
  if (!text) return null;

  // If text does not contain pipe character '|', render standard text
  if (!text.includes("|")) {
    return <div className={`whitespace-pre-line ${className}`}>{text}</div>;
  }

  // Parse text containing tables or pipe-delimited rows
  const lines = text.split(/\r?\n/);
  const hasMultiplePipeLines = lines.filter((l) => l.includes("|")).length >= 2;

  if (hasMultiplePipeLines) {
    const beforeTable: string[] = [];
    const tableRows: string[][] = [];
    const afterTable: string[] = [];
    let state: "BEFORE" | "TABLE" | "AFTER" = "BEFORE";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("|")) {
        if (state === "BEFORE") state = "TABLE";
        if (trimmed.replace(/[\s|:\-]/g, "") === "") continue; // Skip Markdown separator line |---|
        
        const cells = trimmed
          .split("|")
          .map((c) => c.trim())
          .filter((cell, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2);
          
        if (cells.length > 0) tableRows.push(cells);
      } else {
        if (state === "TABLE") state = "AFTER";
        if (state === "BEFORE") beforeTable.push(line);
        if (state === "AFTER") afterTable.push(line);
      }
    }

    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);

      return (
        <div className={`space-y-4 ${className}`}>
          {beforeTable.length > 0 && (
            <p className="whitespace-pre-line text-slate-100 font-medium">{beforeTable.join("\n")}</p>
          )}
          <div className="overflow-x-auto my-3 border border-slate-700/60 rounded-2xl shadow-lg bg-slate-900/80 p-1">
            <table className="w-full text-xs text-left text-slate-200 border-collapse">
              <thead>
                <tr className="bg-slate-800/90 border-b border-slate-700 text-amber-400 font-black uppercase tracking-wider">
                  {header.map((cell, idx) => (
                    <th key={idx} className="p-3 border-r border-slate-700/50 last:border-r-0">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/50 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3 font-medium border-r border-slate-800/80 last:border-r-0 text-slate-200">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {afterTable.length > 0 && (
            <p className="whitespace-pre-line font-bold text-slate-100">{afterTable.join("\n")}</p>
          )}
        </div>
      );
    }
  }

  // Handle single-line pipe strings (e.g. Question #51 format without newlines)
  const pipeParts = text.split("|").map((p) => p.trim());
  if (pipeParts.length >= 3) {
    const firstPart = pipeParts[0];
    const lastPart = pipeParts[pipeParts.length - 1];

    // Detect question prompt intro before table
    const colonIdx = firstPart.indexOf(":");
    const intro = colonIdx !== -1 ? firstPart.substring(0, colonIdx + 1) : "";
    const col1Header = colonIdx !== -1 ? firstPart.substring(colonIdx + 1).trim() : firstPart;

    // Detect question prompt outro after table
    const questionMatch = lastPart.match(/(Which|What|How|Calculate|Determine|Find|Who)[^?]*\?/i);
    const questionText = questionMatch ? questionMatch[0] : "";
    const lastCellVal = questionMatch ? lastPart.replace(questionText, "").trim() : lastPart;

    const middleCells = [col1Header, ...pipeParts.slice(1, pipeParts.length - 1), lastCellVal].filter(Boolean);

    return (
      <div className={`space-y-4 ${className}`}>
        {intro && <p className="text-slate-100 font-bold">{intro}</p>}
        <div className="overflow-x-auto my-3 border border-slate-700/60 rounded-2xl shadow-lg bg-slate-900/80 p-1">
          <table className="w-full text-xs text-left text-slate-200 border-collapse">
            <tbody className="divide-y divide-slate-800">
              {middleCells.map((cell, idx) => (
                <tr key={idx} className={idx === 0 ? "bg-slate-800/90 text-amber-400 font-black uppercase" : "hover:bg-slate-800/40"}>
                  <td className="p-3 font-semibold">{cell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {questionText && <p className="text-slate-100 font-bold text-sm pt-1">{questionText}</p>}
      </div>
    );
  }

  return <div className={`whitespace-pre-line ${className}`}>{text}</div>;
}
