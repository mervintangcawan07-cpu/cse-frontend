/**
 * Utility to convert raw question prompt text into clean, styled HTML elements.
 * Features a vibrant, modern ed-tech theme for Light Mode while retaining clean Dark Mode.
 */
export function formatPromptHTML(promptText: string): string {
  if (!promptText) return "";

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

    if (line.includes("|") && !line.startsWith("<")) {
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
        tableRows = [];

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
      if (inTable) {
        htmlParts.push(renderHTMLTable(tableHeaders, tableRows));
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      if (line) {
        if (line.includes("[") && line.includes("]") && (line.includes("█") || line.includes("="))) {
          htmlParts.push(
            `<div class="my-2.5 p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs font-bold shadow-md flex items-center justify-between border border-slate-700"><span>${line}</span></div>`
          );
        } else {
          const isQuestion = line.endsWith("?") || /^(Which|What|How|Calculate|Determine|Find|Who)\b/i.test(line);

          if (isQuestion) {
            htmlParts.push(
              `<div class="my-4 p-4 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 dark:from-slate-800 dark:to-slate-800/90 text-slate-900 dark:text-slate-100 font-bold text-sm leading-relaxed border-l-4 border-l-blue-600 dark:border-l-indigo-400 border-y border-r border-blue-200/70 dark:border-slate-700/80 shadow-xs">${line}</div>`
            );
          } else {
            htmlParts.push(
              `<p class="my-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">${line}</p>`
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
  let html = '<div class="overflow-x-auto my-4 rounded-2xl border border-blue-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-sm dark:shadow-xl">';
  html += '<table class="w-full text-xs text-left border-collapse">';

  if (headers.length > 0) {
    html += '<thead><tr class="bg-gradient-to-r from-blue-100/80 to-indigo-100/80 dark:from-slate-800 dark:to-slate-800 text-blue-950 dark:text-amber-400 font-black uppercase tracking-wider border-b border-blue-200 dark:border-slate-700/80">';
    headers.forEach((h) => {
      html += `<th class="p-3 border-r border-blue-200/60 dark:border-slate-700/50 last:border-r-0">${h}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody class="divide-y divide-blue-100/80 dark:divide-slate-800/80">';
  rows.forEach((row) => {
    html += '<tr class="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-medium transition-colors">';
    row.forEach((cell) => {
      html += `<td class="p-3 border-r border-blue-100/60 dark:border-slate-800/60 last:border-r-0">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
