/**
 * Utility to convert raw question prompt text into clean, styled HTML elements.
 * Fully supports both Light Mode and Dark Mode with high-contrast, responsive colors.
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
        // Render ASCII bar graph lines cleanly
        if (line.includes("[") && line.includes("]") && (line.includes("█") || line.includes("="))) {
          htmlParts.push(
            `<div class="my-2 p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs font-bold shadow-md flex items-center justify-between border border-slate-700"><span>${line}</span></div>`
          );
        } else {
          // Check if this line is the main question sentence
          const isQuestion = line.endsWith("?") || /^(Which|What|How|Calculate|Determine|Find|Who)\b/i.test(line);

          if (isQuestion) {
            htmlParts.push(
              `<div class="my-3.5 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-bold text-sm leading-relaxed border border-slate-300 dark:border-slate-700/80 shadow-sm">${line}</div>`
            );
          } else {
            // Adaptive text: bold dark navy in light mode, crisp white in dark mode
            htmlParts.push(
              `<p class="my-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 leading-relaxed">${line}</p>`
            );
          }
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
  let html = '<div class="overflow-x-auto my-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1 shadow-md">';
  html += '<table class="w-full text-xs text-left border-collapse">';

  if (headers.length > 0) {
    html += '<thead><tr class="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-amber-400 font-black uppercase tracking-wider border-b border-slate-300 dark:border-slate-700/80">';
    headers.forEach((h) => {
      html += `<th class="p-3 border-r border-slate-300 dark:border-slate-700/50 last:border-r-0">${h}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody class="divide-y divide-slate-200 dark:divide-slate-800/80">';
  rows.forEach((row) => {
    html += '<tr class="hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-medium transition-colors">';
    row.forEach((cell) => {
      html += `<td class="p-3 border-r border-slate-200 dark:border-slate-800/60 last:border-r-0">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
