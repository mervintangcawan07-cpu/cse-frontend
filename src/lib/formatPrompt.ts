/**
 * Utility to convert raw question prompt text into clean, styled HTML elements.
 * Uncluttered design optimized for high contrast in both Light and Dark mode.
 */
export function formatPromptHTML(promptText: string): string {
  if (!promptText) return "";

  if (promptText.includes("<svg") || (promptText.includes("<div") && !promptText.includes("my-"))) {
    return promptText;
  }

  const lines = promptText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const htmlParts: string[] = [];

  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const isPassageItem = (line: string) => /^\([A-D0-9]\)/i.test(line) || /^Table \d+:/i.test(line);

  const isQuestionDirective = (line: string) =>
    line.endsWith("?") ||
    line.includes("___") ||
    /^(Which|What|How|Calculate|Determine|Find|Who|Choose|Select|Identify|Complete|Fill|In the sentence|Based on)\b/i.test(line);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("|") && !line.startsWith("<")) {
      if (!inTable) {
        inTable = true;
        tableHeaders = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
        tableRows = [];

        if (i + 1 < lines.length && /^\|?[\s:-]+(\|+[\s:-]+)+\|?$/.test(lines[i + 1])) {
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

      if (line.includes("[") && line.includes("]") && (line.includes("█") || line.includes("="))) {
        htmlParts.push(
          `<div class="my-3 p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs font-bold shadow-md flex items-center justify-between border border-slate-800"><span>${line}</span></div>`
        );
      } else {
        if (isPassageItem(line)) {
          // Clean, unboxed passage options
          htmlParts.push(
            `<p class="my-1.5 pl-2 text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed font-mono">${line}</p>`
          );
        } else if (isQuestionDirective(line) || lines.length === 1 || i === lines.length - 1) {
          // Main Question Prompt: Clean, prominent text with a subtle left indigo accent bar
          htmlParts.push(
            `<div class="my-3.5 pl-3 py-1 border-l-3 border-indigo-500 text-slate-900 dark:text-white font-bold text-sm leading-relaxed">${line}</div>`
          );
        } else {
          // Context / Reading passage paragraph
          htmlParts.push(
            `<p class="my-2 text-xs font-normal text-slate-700 dark:text-slate-300 leading-relaxed">${line}</p>`
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
  let html = '<div class="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-1 shadow-xs">';
  html += '<table class="w-full text-xs text-left border-collapse">';

  if (headers.length > 0) {
    html += '<thead><tr class="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">';
    headers.forEach((h) => {
      html += `<th class="p-2.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0">${h}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">';
  rows.forEach((row) => {
    html += '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200 font-medium transition-colors">';
    row.forEach((cell) => {
      html += `<td class="p-2.5 border-r border-slate-100 dark:border-slate-800/60 last:border-r-0">${cell}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
