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
 * Sanitizes existing trusted HTML fragments (e.g. charts/SVGs) by stripping
 * malicious tags, event handlers, and unsafe URL protocols.
 */
export function sanitizeHTML(html: string): string {
  if (!html) return "";

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/(?:[\s/]|^)on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "")
    .replace(
      /(?:href|src|action|formaction)\s*=\s*(?:'[\s]*(?:javascript|vbscript|data):[^']*'|"[\s]*(?:javascript|vbscript|data):[^"]*"|[^\s>]+)/gi,
      ""
    )
    .replace(/<\/?(?:applet|meta|link|base|form|input|button|textarea|select|details|dialog)\b[^>]*>/gi, "");
}

/**
 * Checks if a line is a genuine Markdown table separator row
 * (e.g. |---|---| or |:---:|---:|).
 */
function isTableSeparator(line: string): boolean {
  if (!line || !line.includes("|")) return false;
  return /^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(line.trim());
}

/**
 * Checks if a line is part of a real Markdown table rather than a math formula
 * with absolute values such as |x|.
 */
function isTableCandidate(
  line: string,
  nextLine?: string,
  inTable = false
): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  // A separator immediately after this line confirms a Markdown table header.
  if (nextLine && isTableSeparator(nextLine)) {
    return true;
  }

  // Once a table has started, continue accepting pipe-delimited body rows.
  if (inTable) {
    return trimmed.includes("|") && !trimmed.endsWith("?");
  }

  // Support explicit pipe-wrapped tables even when no separator was supplied.
  return (
    trimmed.startsWith("|") &&
    trimmed.endsWith("|") &&
    trimmed.split("|").filter(Boolean).length >= 2 &&
    !!nextLine &&
    nextLine.trim().startsWith("|")
  );
}

/**
 * Splits a Markdown table row into clean cell values.
 */
function getTableCells(line: string): string[] {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell !== "");
}

/**
 * Identifies enumerated passage items.
 *
 * Examples:
 * (A) ...
 * (1) ...
 * Table 1: ...
 */
function isPassageItem(line: string): boolean {
  return /^\([A-D0-9]\)/i.test(line) || /^Table \d+:/i.test(line);
}

/**
 * Identifies data-sufficiency statement lines so they remain supporting text
 * rather than receiving the main-question emphasis.
 *
 * Examples:
 * Statement (1): ...
 * Statement (2): ...
 */
function isStatementLine(line: string): boolean {
  return /^Statement\s*\(\d+\)\s*:/i.test(line);
}

/**
 * Identifies the actual question/directive portion of a prompt.
 *
 * This is position-independent: a question may appear before or after a long
 * passage. Statement lines are handled before this check so a statement ending
 * in a question mark is not accidentally styled as the main question.
 */
function isQuestionDirective(line: string): boolean {
  return (
    line.endsWith("?") ||
    line.includes("___") ||
    /^(Which|What|How|Calculate|Determine|Find|Who|Whose|When|Where|Why|Choose|Select|Identify|Complete|Fill|Question\b|In the sentence|Based on|According to|From the passage|From the information|From the data)\b/i.test(
      line
    )
  );
}

/**
 * Identifies specially formatted data/diagram-style lines.
 */
function isSpecialDataLine(line: string): boolean {
  return (
    line.includes("[") &&
    line.includes("]") &&
    (line.includes("█") || line.includes("="))
  );
}

/**
 * Renders one non-table prompt line.
 *
 * Typography rules:
 * - actual question/directive: bold + blue left border
 * - statements, passages, and supporting text: normal weight, no left border
 * - font family and font size: inherited from the consuming question view
 */
function renderPromptLine(rawLine: string, totalLines: number): string {
  const escapedLine = escapeHTML(rawLine);

  if (isSpecialDataLine(rawLine)) {
    return (
      `<div class="my-3 p-3 max-w-full rounded-xl ` +
      `bg-slate-900 text-amber-300 shadow-md ` +
      `flex items-center justify-between border border-slate-800 ` +
      `font-normal whitespace-normal break-words [overflow-wrap:anywhere]">` +
      `<span class="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">` +
      `${escapedLine}` +
      `</span>` +
      `</div>`
    );
  }

  if (isPassageItem(rawLine)) {
    return (
      `<p class="my-1.5 pl-2 max-w-full ` +
      `font-normal text-slate-700 dark:text-slate-300 leading-relaxed ` +
      `whitespace-normal break-words [overflow-wrap:anywhere]">` +
      `${escapedLine}` +
      `</p>`
    );
  }

  if (isStatementLine(rawLine)) {
    return (
      `<p class="my-3 max-w-full ` +
      `font-normal text-slate-900 dark:text-white leading-relaxed ` +
      `whitespace-normal break-words [overflow-wrap:anywhere]">` +
      `${escapedLine}` +
      `</p>`
    );
  }

  if (isQuestionDirective(rawLine) || totalLines === 1) {
    return (
      `<div class="my-3.5 pl-3 py-1 max-w-full ` +
      `border-l-3 border-indigo-500 ` +
      `font-bold text-slate-900 dark:text-white leading-relaxed ` +
      `whitespace-normal break-words [overflow-wrap:anywhere]">` +
      `${escapedLine}` +
      `</div>`
    );
  }

  return (
    `<p class="my-2 max-w-full ` +
    `font-normal text-slate-700 dark:text-slate-300 leading-relaxed ` +
    `whitespace-normal break-words [overflow-wrap:anywhere]">` +
    `${escapedLine}` +
    `</p>`
  );
}

interface TableBuffer {
  active: boolean;
  headers: string[];
  rows: string[][];
}

function createEmptyTableBuffer(): TableBuffer {
  return {
    active: false,
    headers: [],
    rows: [],
  };
}

function startTable(line: string): TableBuffer {
  return {
    active: true,
    headers: getTableCells(line),
    rows: [],
  };
}

function appendTableRow(buffer: TableBuffer, line: string): TableBuffer {
  if (isTableSeparator(line)) return buffer;

  const cells = getTableCells(line);
  if (cells.length === 0) return buffer;

  return {
    ...buffer,
    rows: [...buffer.rows, cells],
  };
}

function flushTableBuffer(htmlParts: string[], buffer: TableBuffer): TableBuffer {
  if (!buffer.active) return buffer;

  htmlParts.push(renderHTMLTable(buffer.headers, buffer.rows));
  return createEmptyTableBuffer();
}

/**
 * Utility to convert raw question prompt text into safe, structured HTML.
 * Untrusted text is escaped before it is wrapped in controlled GovStudyX markup.
 */
export function formatPromptHTML(rawPromptText: string): string {
  if (!rawPromptText) return "";

  const promptText = cleanMathText(rawPromptText);

  // Auto-enhance supported data-interpretation questions into generated SVGs.
  const enhanced = autoEnhanceDataInterpretation(promptText);

  let chartPrefix = "";
  let textToFormat = promptText;

  if (enhanced !== promptText) {
    const textIdx = enhanced.lastIndexOf(promptText);

    if (textIdx !== -1) {
      chartPrefix = enhanced.substring(0, textIdx).trim();
      textToFormat = promptText;
    } else {
      chartPrefix = enhanced;
      textToFormat = "";
    }
  }

  const formattedBody = formatStructuredPromptLines(textToFormat);

  if (chartPrefix) {
    return `${sanitizeHTML(chartPrefix)}${formattedBody}`;
  }

  return formattedBody;
}

/**
 * Formats untrusted prompt lines into controlled GovStudyX markup.
 * Table parsing and line rendering are delegated to helpers to keep this
 * coordinator simple and maintainable.
 */
function formatStructuredPromptLines(promptText: string): string {
  if (!promptText) return "";

  const lines = promptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const htmlParts: string[] = [];
  let tableBuffer = createEmptyTableBuffer();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;

    const belongsToTable = isTableCandidate(
      rawLine,
      nextLine,
      tableBuffer.active
    );

    if (belongsToTable) {
      if (!tableBuffer.active) {
        tableBuffer = startTable(rawLine);

        // Skip the Markdown separator directly after a header.
        if (nextLine && isTableSeparator(nextLine)) {
          i += 1;
        }
      } else {
        tableBuffer = appendTableRow(tableBuffer, rawLine);
      }

      continue;
    }

    tableBuffer = flushTableBuffer(htmlParts, tableBuffer);
    htmlParts.push(renderPromptLine(rawLine, lines.length));
  }

  flushTableBuffer(htmlParts, tableBuffer);

  return htmlParts.join("");
}

/**
 * Renders a responsive Markdown table.
 * Horizontal scrolling is scoped to the table itself, not to the whole prompt.
 */
function renderHTMLTable(headers: string[], rows: string[][]): string {
  let html =
    '<div class="w-full max-w-full overflow-x-auto my-3 rounded-xl ' +
    'border border-slate-200 dark:border-slate-800 ' +
    'bg-white dark:bg-slate-900/60 p-1 shadow-xs">';

  html += '<table class="w-full min-w-max text-left border-collapse font-normal">';

  if (headers.length > 0) {
    html +=
      '<thead><tr class="bg-slate-100 dark:bg-slate-800/80 ' +
      'text-slate-900 dark:text-slate-100 uppercase tracking-wider ' +
      'border-b border-slate-200 dark:border-slate-800 font-normal">';

    headers.forEach((header) => {
      html +=
        '<th class="p-2.5 border-r border-slate-200 ' +
        'dark:border-slate-800 last:border-r-0 font-normal">' +
        `${escapeHTML(header)}</th>`;
    });

    html += "</tr></thead>";
  }

  html +=
    '<tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">';

  rows.forEach((row) => {
    html +=
      '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 ' +
      'text-slate-800 dark:text-slate-200 transition-colors font-normal">';

    row.forEach((cell) => {
      html +=
        '<td class="p-2.5 border-r border-slate-100 ' +
        'dark:border-slate-800/60 last:border-r-0 font-normal ' +
        'whitespace-normal break-words [overflow-wrap:anywhere]">' +
        `${escapeHTML(cell)}</td>`;
    });

    html += "</tr>";
  });

  html += "</tbody></table></div>";

  return html;
}
