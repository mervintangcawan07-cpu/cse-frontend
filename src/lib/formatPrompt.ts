/**
 * Utility to convert raw question prompt text containing pipe-delimited data (|)
 * or markdown tables into styled, responsive HTML tables for exam players.
 */
export function formatPromptHTML(promptText: string): string {
  if (!promptText) return "";

  // Return immediately if no pipe table delimiters exist
  if (!promptText.includes("|")) {
    return promptText;
  }

  // Handle multi-line markdown tables (| Header | ... \n |---|...)
  if (promptText.includes("\n")) {
    const lines = promptText.split(/\r?\n/);
    const hasTableLines = lines.filter((l) => l.trim().includes("|")).length >= 2;

    if (hasTableLines) {
      let html = "";
      let inTable = false;
      let isHeader = true;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes("|")) {
          // Skip markdown table alignment dividers (|---|---|)
          if (/^\|?[\s:-]+(\|+[\s:-]+)+\|?$/.test(trimmed)) {
            continue;
          }

          const cells = trimmed
            .split("|")
            .map((c) => c.trim())
            .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length <= 2);

          if (!inTable) {
            inTable = true;
            isHeader = true;
            html += '<div className="overflow-x-auto my-4 rounded-2xl border border-slate-700 bg-slate-900/90 p-1 shadow-lg"><table className="w-full text-xs text-left border-collapse">';
          }

          if (isHeader) {
            html += '<thead><tr className="bg-slate-800 text-amber-400 font-black uppercase border-b border-slate-700">';
            cells.forEach((cell) => {
              html += `<th className="p-3 border-r border-slate-700/50 last:border-r-0">${cell}</th>`;
            });
            html += "</tr></thead><tbody>";
            isHeader = false;
          } else {
            html += '<tr className="border-b border-slate-800/80 hover:bg-slate-800/50 text-slate-200 font-medium">';
            cells.forEach((cell) => {
              html += `<td className="p-3 border-r border-slate-800 last:border-r-0">${cell}</td>`;
            });
            html += "</tr>";
          }
        } else {
          if (inTable) {
            html += "tbody></table></div>";
            inTable = false;
          }
          if (trimmed) html += `<p className="my-2">${trimmed}</p>`;
        }
      }

      if (inTable) {
        html += "</tbody></table></div>";
      }

      return html;
    }
  }

  // Handle single-line continuous pipe records (e.g., Question #51 format)
  const pipeParts = promptText.split("|").map((p) => p.trim());
  if (pipeParts.length >= 3) {
    const firstPart = pipeParts[0];
    const lastPart = pipeParts[pipeParts.length - 1];

    // Detect intro text before table
    const colonIdx = firstPart.indexOf(":");
    const introText = colonIdx !== -1 ? firstPart.substring(0, colonIdx + 1) : "";
    const col1Header = colonIdx !== -1 ? firstPart.substring(colonIdx + 1).trim() : firstPart;

    // Detect trailing question phrase after table
    const questionMatch = lastPart.match(/(Which|What|How|Calculate|Determine|Find|Who)[^?]*\?/i);
    const questionText = questionMatch ? questionMatch[0] : "";
    const lastCellVal = questionMatch ? lastPart.replace(questionText, "").trim() : lastPart;

    const allCells = [col1Header, ...pipeParts.slice(1, pipeParts.length - 1), lastCellVal].filter(Boolean);

    let html = "";
    if (introText) html += `<p className="font-bold mb-3 text-slate-100">${introText}</p>`;

    html += '<div className="overflow-x-auto my-3 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-1 shadow-md"><table className="w-full text-xs text-left border-collapse"><tbody className="divide-y divide-slate-800">';
    allCells.forEach((cell, idx) => {
      const isHeaderRow = idx === 0 || idx % 3 === 0;
      html += `<tr className="${isHeaderRow ? "bg-slate-800/90 text-amber-300 font-bold uppercase" : "text-slate-200 hover:bg-slate-800/40"}">`;
      html += `<td className="p-2.5 font-semibold">${cell}</td></tr>`;
    });
    html += '</tbody></table></div>';

    if (questionText) html += `<p className="font-extrabold mt-3 text-slate-100 text-sm">${questionText}</p>`;

    return html;
  }

  return promptText;
}
