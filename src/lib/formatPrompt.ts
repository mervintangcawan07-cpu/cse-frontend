import { cleanMathText } from "@/lib/sanitizeMath";
import { autoEnhanceDataInterpretation } from "@/lib/chartRenderer";

export { cleanMathText };

/**
 * Safely escapes untrusted text to prevent XSS.
 */
export function escapeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes existing trusted HTML fragments (e.g. charts/SVGs) by stripping any malicious tags/attributes.
 */
export function sanitizeHTML(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'href="#"')
    .replace(/src\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'src=""');
}

/**
 * Checks if a line is a genuine Markdown table separator row (e.g., |---|---| or |:---:|---:|)
 */
function isTableSeparator(line: string): boolean {
  if (!line || !line.includes("|")) return false;
  return /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(line.trim());
}

/**
 * Checks if a line is part of a real Markdown table rather than a math formula with absolute values |x|
 */
function isTableCandidate(line: string, nextLine?: string, prevLine?: string, inTable: boolean = false): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  // If next line is a markdown separator (|---|---|), this is definitely a table header
  if (nextLine && isTableSeparator(nextLine)) {
    return true;
  }

  // If previous line was a separator or header and we are in a table
  if (inTable) {
    return trimmed.includes("|") && !trimmed.endsWith("?");
  }

  // If line starts and ends with pipe (| A | B | C |) and next line also starts and ends with pipe
  if (
    trimmed.startsWith("|") &&
    trimmed.endsWith("|") &&
    trimmed.split("|").filter(Boolean).length >= 2 &&
    nextLine &&
    nextLine.trim().startsWith("|")
  ) {
    return true;
  }

  return false;
}

/**
 * Utility to convert raw question prompt text into clean, styled HTML elements.
 * Uncluttered design optimized for high contrast in both Light and Dark mode.
 * Enforces strict XSS prevention by escaping text before wrapping in safe HTML nodes.
 */
export function formatPromptHTML(rawPromptText: string): string {
  if (!rawPromptText) return "";

  let promptText = cleanMathText(rawPromptText);

  // Auto-enhance questions containing Pie Charts, Line Graphs, Bar Charts, or Data Tables into SVGs
  promptText = autoEnhanceDataInterpretation(promptText);

  if (
    promptText.includes("<svg") ||
    promptText.includes("<table") ||
    promptText.includes("rounded-2xl") ||
    promptText.includes("📑")
  ) {
    return sanitizeHTML(promptText);
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
    const rawLine = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;
    const prevLine = i > 0 ? lines[i - 1] : undefined;

    // Check if this line is part of a real Markdown table
    if (isTableCandidate(rawLine, nextLine, prevLine, inTable)) {
      if (!inTable) {
        inTable = true;
        tableHeaders = rawLine.split("|").map((c) => c.trim()).filter((c) => c !== "");
        tableRows = [];

        // Skip separator row if it's the next line
        if (nextLine && isTableSeparator(nextLine)) {
          i++;
        }
      } else {
        if (!isTableSeparator(rawLine)) {
          const cells = rawLine.split("|").map((c) => c.trim()).filter((c) => c !== "");
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

      const escapedLine = escapeHTML(rawLine);

      if (rawLine.includes("[") && rawLine.includes("]") && (rawLine.includes("█") || rawLine.includes("="))) {
        htmlParts.push(
          `<div class="my-3 p-3 rounded-xl bg-slate-900 text-amber-300 font-mono text-xs font-bold shadow-md flex items-center justify-between border border-slate-800"><span>${escapedLine}</span></div>`
        );
      } else {
        if (isPassageItem(rawLine)) {
          // Clean, unboxed passage options
          htmlParts.push(
            `<p class="my-1.5 pl-2 text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed font-mono">${escapedLine}</p>`
          );
        } else if (isQuestionDirective(rawLine) || lines.length === 1 || i === lines.length - 1) {
          // Main Question Prompt: Clean, prominent text with a subtle left indigo accent bar
          htmlParts.push(
            `<div class="my-3.5 pl-3 py-1 border-l-3 border-indigo-500 text-slate-900 dark:text-white font-bold text-sm leading-relaxed">${escapedLine}</div>`
          );
        } else {
          // Context / Reading passage paragraph
          htmlParts.push(
            `<p class="my-2 text-xs font-normal text-slate-700 dark:text-slate-300 leading-relaxed">${escapedLine}</p>`
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
      html += `<th class="p-2.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0">${escapeHTML(h)}</th>`;
    });
    html += '</tr></thead>';
  }

  html += '<tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">';
  rows.forEach((row) => {
    html += '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200 font-medium transition-colors">';
    row.forEach((cell) => {
      html += `<td class="p-2.5 border-r border-slate-100 dark:border-slate-800/60 last:border-r-0">${escapeHTML(cell)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  return html;
}
