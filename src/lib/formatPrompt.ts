/**
 * Utility to convert raw question prompt text into clean, styled HTML elements.
 * Correctly parses Markdown tables (| Header | ... \n |---|...) and highlights
 * ASCII bar charts and trailing question prompts.
 */
export function formatPromptHTML(promptText: string): string {
  if (!promptText) return "";

  // Return embedded HTML/SVG blocks directly if present
  if (promptText.includes("<svg") || (promptText.includes("<div") && !promptText.includes("my-"))) {
    return promptText;
  }

  const lines = promptText.split(/\r?\n/);
  const htmlParts: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect Markdown Table row (contains pipe '|')
    if (line.includes("|") && !line.startsWith("<")) {
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
        tableRows = [];

        // Skip markdown alignment divider line (|---|---|) if present next
        if (i + 1 < lines.length && /^\|?[\s:-]+(\|+[\s:-]+)+\|?$/.test(lines[i + 1].trim())) {
          i++;
        }
      } else {
        if (!/^\|?[\s:-]+(\|+[\s:-]+)+\|?$/.test(line)) {
          const cells = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
          if (cells.length > 0) {
            tableRows.push(cells);
          }
        }
      }
    } else {
      // If exiting a table block, render HTML table
      if (inTable) {
        htmlParts.push(renderHTMLTable(tableHeaders, tableRows));
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      if (line) {
        // Render ASCII bar graph lines cleanly (e.g., Quarter 1: [████████] 160 MT)
        if (line.includes("[") && line.includes("]") && (line.includes("█") || line.includes("="))) {
          htmlParts.push(
            `<div class="my-1.5 p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between text-xs font-mono text-amber-300 font-bold shadow-sm"><span>${line}</span></div>`
          );
        } else {
          // Highlight trailing question sentences prominently
          const isQuestion = line.endsWith("?") || /^(Which|What|How|Calculate|Determine|Find|Who)\b/i.test(line);
          htmlParts.push(
            `<p class="${
              isQuestion
                ? "my-3 text-sm font-extrabold text-slate-100 leading-relaxed bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/80 shadow-md"
                : "my-2 text-xs font-medium text-slate-200 leading-relaxed"
            }">${line}</p>`
          );
        }
      }
    }
  }

  if (inTable) {
    htmlParts.push(renderHTMLTable(tableHeaders, tableRows));
  }

  return htmlParts.join("");
}

function renderHTMLTable(headers: string[], rows: string[][]): string {
  let html = '<div class="overflow-x-auto my-4 rounded-2xl border border-slate-700 bg-slate-900/95 p-1 shadow-xl">';
  html += '<table class="w-full text-xs text-left border-collapse">';

  if (headers.length > 0) {
    html += '<thead><tr class="bg-slate-800/90 text-amber-400 font-black uppercase tracking-wider border-b border-slate-700/80">';
    headers.forEach((h) => {
      html += `<th class="p-3 border-r border-slate-700/50 last:border-r-0">${h}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody class="divide-y divide-slate-800/80">';
  rows.forEach((row) => {
    html += '<tr class="hover:bg-slate-800/50 text-slate-200 font-medium transition-colors">';
    row.forEach((cell) => {
      html += `<td class="p-3 border-r border-slate-800/60 last:border-r-0">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
