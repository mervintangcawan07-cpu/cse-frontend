/**
 * 📊 chartRenderer.ts
 * Generates beautiful, responsive, pure SVG/HTML visualizations for:
 * - Pie Charts / Donut Charts
 * - Multi-Line & Single-Line Trend Graphs (Monthly, Yearly, Weekly, Quarterly, Multi-Series)
 * - Grouped & Single Bar Charts (Horizontal / Vertical)
 * - Structured Findings & Disaster Assessment Infographic Cards
 * - Styled Data Tables & Multi-Display Visuals
 */

const PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
  "#14b8a6", // Teal
  "#6366f1", // Indigo
];

// Hoisted Non-Backtracking Regular Expressions (ReDoS & S5852 / S5843 Guarded)
const POLYGON_SEQUENCE_REGEX = /polygon|sequence where|at each step|geometric sequence/i;
const TABLE_DATA_START_REGEX = /\|[\s:-]+\|\s*\|/;
const QUESTION_START_REGEX = /\|\s*(?:Which|What|How|Calculate|Determine|Find|Who|Based)\b/i;

const PIE_HEADER_REGEX = /pie\s*chart[^(]*\(([^)]+)\)/i;
const RATE_HEADER_REGEX = /(?:line\s*graph|underemployment|rate)[^(]*\(([^)]+)\)/i;
// Avoids space in class overlapping with \s*
const SECTOR_PERCENT_PAIR_REGEX = /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*=\s*(\d+(?:\.\d+)?)\s*%/g;

const BARANGAY_HEADER_REGEX = /Three\s*pie\s*charts|Barangay\s+[A-Z]\s*\([^)]*\):/i;
const BARANGAY_ROW_REGEX = /Barangay\s+([A-Z])(?:\s*\([^)]*\))?:\s*([^.;\n]+)/gi;
const PERCENT_PAIR_REGEX = /([A-Za-z0-9/_-]+(?:\s+[A-Za-z0-9/_-]+)*)\s*=\s*(\d+(?:\.\d+)?)\s*%/g;

const ENERGY_BAR_HEADER_REGEX = /(?:bar\s*chart|generation\s*by\s*source)[^(]*\(([^)]+)\)/i;
const ENERGY_LINE_HEADER_REGEX = /(?:line\s*graph|loss\s*rate)[^(]*\(([^)]+)\)/i;
const ENERGY_PAIR_REGEX = /([A-Za-z0-9/_-]+(?:\s+[A-Za-z0-9/_-]+)*)\s*=\s*([\d,]+(?:\.\d+)?)\s*(GWh|%)/g;
const QUARTER_PERCENT_PAIR_REGEX = /(Q[1-4])=\s*(\d+(?:\.\d+)?)\s*%/g;

const BUILDING_POWER_ROW_REGEX = /Building\s+([A-Z]):\s*Jan\s*=\s*([\d,]+),\s*Feb\s*=\s*([\d,]+),\s*Mar\s*=\s*([\d,]+)/gi;
// Fixed duplicate [A-Za-z] under /i flag
const SITIO_SURVEY_ROW_REGEX = /Sitio\s+([a-z]+):\s*Poverty\s*rate\s*(\d+)%,\s*Distance\s*(\d+)\s*km,\s*Population\s*density\s*(\d+)/gi;
const SOLAR_QUARTER_ROW_REGEX = /(Q[1-4])\s*=\s*(\d+(?:\.\d+)?)/gi;
const WASTE_ZONE_ROW_REGEX = /Zone\s+([A-Z]):?\s+produces\s+(\d+(?:\.\d+)?)\s*MTD\s+of\s+biodegradable,\s*(\d+(?:\.\d+)?)\s*MTD\s+of\s+recyclable,\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*MTD\s+of\s+residual/gi;
const CITY_TEMP_ROW_REGEX = /City\s+([A-Z])=\s*(\d+(?:\.\d+)?)/gi;

// \S boundary prevents catastrophic space backtracking
const FINDINGS_ROW_REGEX = /Finding\s+(\d+):\s*(\S[^.\r\n]*\.)/gi;
const GENERIC_PIE_PAIR_REGEX = /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*[=:]\s*(\d+(?:\.\d+)?)\s*%/g;
const SINGLE_BAR_ROW_REGEX = /([A-Za-z&]+(?:\s+[A-Za-z&]+)*)\s*=\s*([\d,]+(?:\.\d+)?)/g;
const PERIOD_TREND_ROW_REGEX = /(20\d\d|Week\s*\d+|Month\s*\d+)[=:]\s*([\d,]+(?:\.\d+)?)/gi;
const MONTH_TREND_ROW_REGEX = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)=\s*(-?\d+(?:\.\d+)?)\s*(%)?/gi;

// Bounded words prevent multi-token exponential explosion
const MATRIX_ENTITY_ROW_REGEX = /(?:^|[\r\n.;])\s*([A-Z][A-Za-z0-9/-]*(?:\s+[A-Za-z0-9/-]+)*)\s*:\s*(\S[^.;\r\n]*)/g;
const MATRIX_PAIR_ROW_REGEX = /([A-Za-z0-9/]+(?:\s+[A-Za-z0-9/]+)*)\s*[=:-]\s*(?:PHP\s*)?([\d,]+(?:\.\d+)?)\s*(%|units|members|tons|MT|ha|M|k)?(?=[,;.\s]|$)/g;

const PASSAGE_HEADER_STRIP_REGEX = /^Passage:\s*\S[^:.\r\n]*:\s*/i;
const ENTITY_PREFIX_PATTERNS = [
  /^The\s+(?:data|bars?|chart)\s+shows?\s*/i,
  /^(?:Passage|Note|\([12]\)|-)\s*/i,
];

function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return "";
  if (typeof str !== "string" && typeof str !== "number" && typeof str !== "boolean") {
    return "";
  }
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTickValue(val: number): string {
  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}k`;
  }
  if (val % 1 === 0) {
    return String(val);
  }
  return val.toFixed(1);
}

function cleanEntityName(rawName: string): string {
  let result = rawName.trim();
  for (const pattern of ENTITY_PREFIX_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result.trim();
}

/**
 * 🥧 Renders an SVG Pie / Donut Chart with slice labels & legend
 */
export function renderPieChartSVG(title: string, data: Array<{ label: string; value: number }>): string {
  if (!data || data.length === 0) return "";

  const total = data.reduce((sum, d) => sum + d.value, 0) || 100;
  const width = 480;
  const height = 280;
  const cx = 140;
  const cy = 135;
  const radius = 100;
  const innerRadius = 45;

  let currentAngle = -Math.PI / 2;
  const slices: string[] = [];
  const legendItems: string[] = [];

  data.forEach((item, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(currentAngle);
    const y1 = cy + radius * Math.sin(currentAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const x1Inner = cx + innerRadius * Math.cos(currentAngle);
    const y1Inner = cy + innerRadius * Math.sin(currentAngle);
    const x2Inner = cx + innerRadius * Math.cos(endAngle);
    const y2Inner = cy + innerRadius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x2Inner} ${y2Inner}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1Inner} ${y1Inner}`,
      "Z",
    ].join(" ");

    const midAngle = currentAngle + sliceAngle / 2;
    const labelRadius = (radius + innerRadius) / 2;
    const lx = cx + labelRadius * Math.cos(midAngle);
    const ly = cy + labelRadius * Math.sin(midAngle) + 4;

    const percentStr = `${Math.round((item.value / total) * 100)}%`;

    slices.push(
      `<path d="${pathData}" fill="${color}" stroke="#1e293b" stroke-width="2" class="hover:opacity-90 transition-opacity" />`
    );

    if (sliceAngle > 0.25) {
      slices.push(
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle" font-family="sans-serif">${percentStr}</text>`
      );
    }

    const pct = `${item.value % 1 === 0 ? item.value : item.value.toFixed(1)}%`;
    legendItems.push(
      `<div class="flex items-center justify-between text-xs py-1 px-1.5 rounded-lg hover:bg-slate-800/40">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${color}"></span>
          <span class="text-slate-200 font-medium">${escapeHTML(item.label)}</span>
        </div>
        <span class="font-bold text-white font-mono ml-2">${pct}</span>
      </div>`
    );

    currentAngle = endAngle;
  });

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span aria-hidden="true">🥧</span><span>${escapeHTML(title)}</span></div>` : ""}
      <div class="flex flex-col sm:flex-row items-center gap-4">
        <div class="shrink-0 w-full sm:w-auto flex justify-center">
          <svg viewBox="0 0 ${width * 0.6} ${height}" class="w-56 h-56 max-w-full">
            ${slices.join("")}
            <circle cx="${cx}" cy="${cy}" r="${innerRadius - 4}" fill="#0f172a" />
            <text x="${cx}" y="${cy - 4}" fill="#94a3b8" font-size="9" font-weight="bold" text-anchor="middle" font-family="sans-serif">TOTAL</text>
            <text x="${cx}" y="${cy + 12}" fill="#38bdf8" font-size="12" font-weight="900" text-anchor="middle" font-family="sans-serif">100%</text>
          </svg>
        </div>
        <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-1 border-t sm:border-t-0 sm:border-l border-slate-700/60 pt-3 sm:pt-0 sm:pl-4">
          ${legendItems.join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * 📈 Renders an SVG Multi-Line Chart
 */
export function renderLineGraphSVG(
  title: string,
  series: Array<{ name: string; data: Array<{ x: string; y: number; unit?: string }> }>
): string {
  if (!series || series.length === 0) return "";

  const allXLabels = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.x))));
  const allYValues = series.flatMap((s) => s.data.map((d) => d.y));

  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const yPadding = (maxY - minY) * 0.18 || 1;
  const effectiveMinY = Math.min(0, Math.floor(minY - (minY < 0 ? yPadding : 0)));
  const effectiveMaxY = Math.ceil(maxY + yPadding);

  const svgWidth = 580;
  const svgHeight = 260;
  const padLeft = 55;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const getXPos = (idx: number) => padLeft + (idx / Math.max(1, allXLabels.length - 1)) * chartW;
  const getYPos = (val: number) =>
    padTop + chartH - ((val - effectiveMinY) / (effectiveMaxY - effectiveMinY || 1)) * chartH;

  const gridLines: string[] = [];
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = effectiveMinY + (i / yTicks) * (effectiveMaxY - effectiveMinY);
    const yPos = getYPos(yVal);
    gridLines.push(
      `<line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />`,
      `<text x="${padLeft - 6}" y="${yPos + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${formatTickValue(yVal)}</text>`
    );
  }

  const xLabelsSvg: string[] = [];
  allXLabels.forEach((label, idx) => {
    const xPos = getXPos(idx);
    xLabelsSvg.push(
      `<line x1="${xPos}" y1="${padTop + chartH}" x2="${xPos}" y2="${padTop + chartH + 4}" stroke="#64748b" stroke-width="1.5" />`,
      `<text x="${xPos}" y="${padTop + chartH + 18}" fill="#cbd5e1" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">${escapeHTML(label)}</text>`
    );
  });

  const seriesSvg: string[] = [];
  const legendItems: string[] = [];

  series.forEach((s, sIdx) => {
    const color = PALETTE[sIdx % PALETTE.length];
    const points = s.data.map((d) => {
      const xIdx = allXLabels.indexOf(d.x);
      return { x: getXPos(xIdx !== -1 ? xIdx : 0), y: getYPos(d.y), val: d.y, unit: d.unit || "" };
    });

    const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    seriesSvg.push(
      `<polyline points="${polylinePoints}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`
    );

    points.forEach((p) => {
      const displayVal = p.val >= 1000 ? `${(p.val / 1000).toFixed(1)}k` : p.val;
      seriesSvg.push(
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${color}" stroke="#0f172a" stroke-width="2" />`,
        `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle" font-family="monospace">${displayVal}${p.unit}</text>`
      );
    });

    legendItems.push(
      `<div class="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
        <span class="w-3 h-1.5 rounded-full" style="background-color: ${color}"></span>
        <span class="text-slate-200">${escapeHTML(s.name)}</span>
      </div>`
    );
  });

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5"><span aria-hidden="true">📈</span><span>${escapeHTML(title)}</span></div>` : ""}
        <div class="flex flex-wrap items-center gap-2">
          ${legendItems.join("")}
        </div>
      </div>
      <div class="overflow-x-auto">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full min-w-[340px] max-h-64">
          <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" stroke="#64748b" stroke-width="1.5" />
          <line x1="${padLeft}" y1="${padTop + chartH}" x2="${svgWidth - padRight}" y2="${padTop + chartH}" stroke="#64748b" stroke-width="1.5" />
          ${gridLines.join("")}
          ${xLabelsSvg.join("")}
          ${seriesSvg.join("")}
        </svg>
      </div>
    </div>
  `;
}

/**
 * 📊 Renders an SVG Grouped Bar Chart with matching styled HTML Table
 */
export function renderGroupedBarChartSVG(
  title: string,
  categories: Array<{ name: string; values: Array<{ key: string; val: number; unit?: string }> }>
): string {
  if (!categories || categories.length === 0) return "";

  const allKeys = Array.from(new Set(categories.flatMap((c) => c.values.map((v) => v.key))));
  const allValues = categories.flatMap((c) => c.values.map((v) => v.val));
  const maxVal = Math.max(...allValues, 10);

  const svgWidth = 580;
  const svgHeight = 260;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 40;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const groupWidth = chartW / categories.length;
  const barWidth = Math.min(24, (groupWidth * 0.8) / allKeys.length);

  const barsSvg: string[] = [];
  const legendItems: string[] = [];

  // Y Grid
  const gridSvg: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((i / 4) * maxVal);
    const yPos = padTop + chartH - (i / 4) * chartH;
    gridSvg.push(
      `<line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />`,
      `<text x="${padLeft - 6}" y="${yPos + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${formatTickValue(yVal)}</text>`
    );
  }

  // Draw Groups & Bars
  categories.forEach((cat, cIdx) => {
    const groupCenterX = padLeft + cIdx * groupWidth + groupWidth / 2;
    const totalBarsWidth = allKeys.length * barWidth;
    const groupStartX = groupCenterX - totalBarsWidth / 2;

    barsSvg.push(
      `<text x="${groupCenterX}" y="${padTop + chartH + 20}" fill="#cbd5e1" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">${escapeHTML(cat.name)}</text>`
    );

    allKeys.forEach((key, kIdx) => {
      const color = PALETTE[kIdx % PALETTE.length];
      const valObj = cat.values.find((v) => v.key === key);
      const val = valObj ? valObj.val : 0;
      const unit = valObj?.unit || "";

      const barHeight = (val / maxVal) * chartH;
      const barX = groupStartX + kIdx * barWidth;
      const barY = padTop + chartH - barHeight;

      barsSvg.push(
        `<rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="${barWidth - 2}" height="${barHeight.toFixed(1)}" rx="3" fill="${color}" stroke="#0f172a" stroke-width="1" class="hover:opacity-80 transition-opacity" />`
      );

      if (barHeight > 16) {
        const displayVal = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val;
        barsSvg.push(
          `<text x="${(barX + (barWidth - 2) / 2).toFixed(1)}" y="${(barY - 4).toFixed(1)}" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle" font-family="monospace">${displayVal}${unit}</text>`
        );
      }
    });
  });

  allKeys.forEach((key, kIdx) => {
    const color = PALETTE[kIdx % PALETTE.length];
    legendItems.push(
      `<div class="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-800/80 border border-slate-700">
        <span class="w-3 h-3 rounded-sm" style="background-color: ${color}"></span>
        <span class="text-slate-200">${escapeHTML(key)}</span>
      </div>`
    );
  });

  const tableRows = categories.map((cat) => {
    const cells = allKeys.map((k) => {
      const v = cat.values.find((item) => item.key === k);
      return v ? `${v.val}${v.unit || ""}` : "-";
    });
    return [cat.name, ...cells];
  });

  const tableHtml = `
    <div class="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-1">
      <table class="w-full text-xs text-left border-collapse">
        <thead>
          <tr class="bg-slate-800/90 text-amber-300 font-bold uppercase tracking-wider border-b border-slate-700">
            <th class="p-2 border-r border-slate-700 last:border-r-0">Category / Entity</th>
            ${allKeys.map((k) => `<th class="p-2 border-r border-slate-700 last:border-r-0">${escapeHTML(k)}</th>`).join("")}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${tableRows.map((row) => `
            <tr class="hover:bg-slate-800/40 transition text-slate-200">
              ${row.map((cell, idx) => `<td class="p-2 border-r border-slate-800 last:border-r-0 ${idx === 0 ? "font-bold text-white" : "font-mono"}">${escapeHTML(cell)}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5"><span aria-hidden="true">📊</span><span>${escapeHTML(title)}</span></div>` : ""}
        <div class="flex flex-wrap items-center gap-2">
          ${legendItems.join("")}
        </div>
      </div>
      <div class="overflow-x-auto">
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full min-w-[340px] max-h-64">
          <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" stroke="#64748b" stroke-width="1.5" />
          <line x1="${padLeft}" y1="${padTop + chartH}" x2="${svgWidth - padRight}" y2="${padTop + chartH}" stroke="#64748b" stroke-width="1.5" />
          ${gridSvg.join("")}
          ${barsSvg.join("")}
        </svg>
      </div>
      ${tableHtml}
    </div>
  `;
}

/**
 * 📑 Renders an Infographic Findings / Disaster Assessment Card
 */
export function renderFindingsCardHTML(title: string, findings: Array<{ num: string; text: string }>): string {
  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      <div class="text-xs font-black text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span aria-hidden="true">📑</span><span>${escapeHTML(title)}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        ${findings.map((f) => `
          <div class="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-400 font-black text-xs shrink-0 border border-indigo-500/30">#${escapeHTML(f.num)}</span>
            <p class="text-xs text-slate-200 leading-relaxed font-medium">${escapeHTML(f.text)}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 🔍 Individual Interpretation Handlers (Keeps Complexity <= 6 Each)
// ---------------------------------------------------------------------------

function tryEnhanceMarkdownTable(enhanced: string): string | null {
  if (!enhanced.includes("|---|")) return null;

  const firstPipe = enhanced.indexOf("|");
  const tablePart = enhanced.substring(firstPipe);
  const sepIdx = tablePart.indexOf("|---|");
  if (sepIdx === -1) return null;

  const headerStr = tablePart.substring(0, sepIdx);
  const headerCells = headerStr.split("|").map((c) => c.trim()).filter(Boolean);
  const colCount = headerCells.length;
  if (colCount < 2) return null;

  const afterSep = tablePart.substring(sepIdx);
  const dataStartMatch = TABLE_DATA_START_REGEX.exec(afterSep);
  const dataStartOffset = dataStartMatch ? dataStartMatch.index + dataStartMatch[0].length - 1 : sepIdx + 5;
  const rawDataStr = afterSep.substring(dataStartOffset);

  const qMatch = QUESTION_START_REGEX.exec(rawDataStr);
  const tableDataSection = qMatch ? rawDataStr.substring(0, qMatch.index) : rawDataStr;

  const allDataCells = tableDataSection
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "" && !/^[:\-]+$/.test(c));

  const rows: string[][] = [];
  for (let i = 0; i < allDataCells.length; i += colCount) {
    const row = allDataCells.slice(i, i + colCount);
    if (row.length === colCount) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return null;

  const fullRawTable = tablePart.substring(0, qMatch ? sepIdx + dataStartOffset + qMatch.index : tablePart.length);
  const tableHtml = `
    <div class="my-4 overflow-x-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg p-2">
      <div class="text-xs font-black text-amber-400 uppercase tracking-wider px-2 py-1.5 mb-1 flex items-center gap-1.5">
        <span aria-hidden="true">📋</span><span>STATISTICAL DATASET & MATRIX RECORD</span>
      </div>
      <table class="w-full text-xs text-left text-slate-200 border-collapse">
        <thead>
          <tr class="bg-slate-800/90 text-amber-300 font-black uppercase tracking-wider border-b border-slate-700">
            ${headerCells.map((h) => `<th class="p-2.5 border-r border-slate-700/60 last:border-r-0">${escapeHTML(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${rows
            .map(
              (row) => `
            <tr class="hover:bg-slate-800/50 transition">
              ${row.map((c, i) => `<td class="p-2.5 border-r border-slate-800/80 last:border-r-0 ${i === 0 ? "font-bold text-white" : "font-mono"}">${escapeHTML(c)}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  return enhanced.replace(fullRawTable, tableHtml);
}

function tryEnhanceDualPieAndUnderemployment(enhanced: string): string | null {
  if (!/pie\s*chart/i.test(enhanced) || !/(?:underemployment|line\s*graph|rate\s*within\s*each\s*sector)/i.test(enhanced)) {
    return null;
  }

  const pieMatch = PIE_HEADER_REGEX.exec(enhanced);
  const rateMatch = RATE_HEADER_REGEX.exec(enhanced);
  if (!pieMatch || !rateMatch) return null;

  const piePairs = Array.from(pieMatch[1].matchAll(SECTOR_PERCENT_PAIR_REGEX));
  const ratePairs = Array.from(rateMatch[1].matchAll(SECTOR_PERCENT_PAIR_REGEX));
  if (piePairs.length < 3) return null;

  const pieData = piePairs.map((p) => ({ label: p[1].trim(), value: Number.parseFloat(p[2]) }));
  const pieSvg = renderPieChartSVG("Labor Force Distribution (500,000 Persons)", pieData);

  const rateTableRows = ratePairs.map((r) => {
    const sector = r[1].trim();
    const rateVal = `${r[2]}%`;
    const shareObj = pieData.find((p) => p.label.toLowerCase() === sector.toLowerCase());
    const shareVal = shareObj ? `${shareObj.value}%` : "-";
    return [sector, shareVal, rateVal];
  });

  const rateTableHtml = `
    <div class="my-4 overflow-x-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg p-3">
      <div class="text-xs font-black text-amber-400 uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
        <span aria-hidden="true">📊</span><span>Sector Underemployment Rate Matrix</span>
      </div>
      <table class="w-full text-xs text-left border-collapse">
        <thead>
          <tr class="bg-slate-800/90 text-amber-300 font-bold uppercase tracking-wider border-b border-slate-700">
            <th class="p-2 border-r border-slate-700">Economic Sector</th>
            <th class="p-2 border-r border-slate-700">Labor Force Share (%)</th>
            <th class="p-2">Underemployment Rate (%)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${rateTableRows
            .map(
              (row) => `
            <tr class="hover:bg-slate-800/40 transition text-slate-200">
              <td class="p-2 border-r border-slate-800 font-bold text-white">${escapeHTML(row[0])}</td>
              <td class="p-2 border-r border-slate-800 font-mono">${escapeHTML(row[1])}</td>
              <td class="p-2 font-mono text-emerald-400 font-bold">${escapeHTML(row[2])}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  return `${pieSvg}\n\n${rateTableHtml}\n\n${enhanced}`;
}

function tryEnhanceBarangayIncome(enhanced: string): string | null {
  if (!BARANGAY_HEADER_REGEX.test(enhanced)) return null;

  const bMatches = Array.from(enhanced.matchAll(BARANGAY_ROW_REGEX));
  if (bMatches.length < 3) return null;

  const categories = bMatches.map((m) => {
    const name = `Barangay ${m[1]}`;
    const pairMatches = Array.from(m[2].matchAll(PERCENT_PAIR_REGEX));
    const values = pairMatches.map((p) => ({ key: p[1].trim(), val: Number.parseFloat(p[2]), unit: "%" }));
    return { name, values };
  });

  const chartTitle = "Household Income Sources by Barangay (Pie Chart Breakdown)";
  const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceEnergyGrid(enhanced: string): string | null {
  if (!/(?:dashboard\s*provides|generation\s*by\s*source)/i.test(enhanced) || !/(?:island\s*grid|Renewable\s*Energy)/i.test(enhanced)) {
    return null;
  }

  const barMatch = ENERGY_BAR_HEADER_REGEX.exec(enhanced);
  const lineMatch = ENERGY_LINE_HEADER_REGEX.exec(enhanced);
  if (!barMatch) return null;

  const pairs = Array.from(barMatch[1].matchAll(ENERGY_PAIR_REGEX));
  const sources = pairs
    .filter((p) => !/total/i.test(p[1]))
    .map((p) => ({
      name: p[1].trim(),
      values: [{ key: "Generation", val: Number.parseFloat(p[2].replace(/,/g, "")), unit: ` ${p[3]}` }],
    }));

  if (sources.length < 3) return null;

  const barSvg = renderGroupedBarChartSVG("Island Grid Electricity Generation by Source (GWh)", sources);
  let lineSvg = "";

  if (lineMatch) {
    const qPairs = Array.from(lineMatch[1].matchAll(QUARTER_PERCENT_PAIR_REGEX));
    if (qPairs.length >= 3) {
      const lineData = qPairs.map((qp) => ({ x: qp[1], y: Number.parseFloat(qp[2]), unit: "%" }));
      lineSvg = renderLineGraphSVG("Quarterly Transmission & Distribution Loss Rate (%)", [
        { name: "Loss Rate", data: lineData },
      ]);
    }
  }

  return `${barSvg}\n\n${lineSvg}\n\n${enhanced}`;
}

function tryEnhanceBuildingPower(enhanced: string): string | null {
  if (!/Building\s+[A-Z]:\s*Jan=/i.test(enhanced)) return null;

  const bMatches = Array.from(enhanced.matchAll(BUILDING_POWER_ROW_REGEX));
  if (bMatches.length < 3) return null;

  const categories = bMatches.map((m) => ({
    name: `Building ${m[1]}`,
    values: [
      { key: "Jan", val: Number.parseFloat(m[2].replace(/,/g, "")), unit: " kWh" },
      { key: "Feb", val: Number.parseFloat(m[3].replace(/,/g, "")), unit: " kWh" },
      { key: "Mar", val: Number.parseFloat(m[4].replace(/,/g, "")), unit: " kWh" },
    ],
  }));

  const chartTitle = "Government Buildings Monthly Power Consumption (kWh)";
  const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceSitioSurvey(enhanced: string): string | null {
  if (!/Sitio\s+[A-Za-z]+:\s*Poverty\s*rate/i.test(enhanced)) return null;

  const sitioMatches = Array.from(enhanced.matchAll(SITIO_SURVEY_ROW_REGEX));
  if (sitioMatches.length < 3) return null;

  const categories = sitioMatches.map((m) => ({
    name: `Sitio ${m[1]}`,
    values: [
      { key: "Poverty Rate", val: Number.parseFloat(m[2]), unit: "%" },
      { key: "Distance", val: Number.parseFloat(m[3]), unit: " km" },
      { key: "Pop. Density", val: Number.parseFloat(m[4]), unit: "/km²" },
    ],
  }));

  const chartTitle = "Community Survey & Livelihood Center Selection Indicators";
  const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceSolarQuarterly(enhanced: string): string | null {
  if (
    !/(?:solar\s*power\s*facility|facility|quarterly\s*generation|generation\s*output):/i.test(enhanced) ||
    !/Q1\s*=\s*\d+/i.test(enhanced) ||
    !/Q4\s*=\s*\d+/i.test(enhanced) ||
    enhanced.includes("Building")
  ) {
    return null;
  }

  const qMatches = Array.from(enhanced.matchAll(SOLAR_QUARTER_ROW_REGEX));
  if (qMatches.length < 4) return null;

  const lineData = qMatches.map((qm) => ({
    x: qm[1].toUpperCase(),
    y: Number.parseFloat(qm[2]),
    unit: " GWh",
  }));

  const chartTitle = "Solar Facility Quarterly Generation Output (GWh)";
  const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Solar Output (GWh)", data: lineData }]);
  return `${svgLine}\n\n${enhanced}`;
}

function tryEnhanceWasteGeneration(enhanced: string): string | null {
  if (!/Zone\s+[A-Z]:?\s+produces\s+\d+/i.test(enhanced)) return null;

  const zoneMatches = Array.from(enhanced.matchAll(WASTE_ZONE_ROW_REGEX));
  if (zoneMatches.length < 3) return null;

  const categories = zoneMatches.map((m) => ({
    name: `Zone ${m[1]}`,
    values: [
      { key: "Biodegradable", val: Number.parseFloat(m[2]), unit: " MTD" },
      { key: "Recyclable", val: Number.parseFloat(m[3]), unit: " MTD" },
      { key: "Residual", val: Number.parseFloat(m[4]), unit: " MTD" },
    ],
  }));

  const chartTitle = "Commercial Zones Solid Waste Generation (MTD)";
  const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceCityTemperature(enhanced: string): string | null {
  if (!/City\s+[A-Z]=/i.test(enhanced)) return null;

  const cityMatches = Array.from(enhanced.matchAll(CITY_TEMP_ROW_REGEX));
  if (cityMatches.length < 4) return null;

  const categories = cityMatches.map((m) => ({
    name: `City ${m[1]}`,
    values: [{ key: "Temperature", val: Number.parseFloat(m[2]), unit: "°C" }],
  }));

  const chartTitle = "City Temperature Comparison (°C)";
  const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceFindings(enhanced: string): string | null {
  if (!/Finding\s+1:/i.test(enhanced) || enhanced.includes("📑")) return null;

  const findingMatches = Array.from(enhanced.matchAll(FINDINGS_ROW_REGEX));
  if (findingMatches.length < 3) return null;

  const findings = findingMatches.map((m) => ({
    num: m[1],
    text: m[2].trim(),
  }));

  const cardTitle = "Disaster Assessment & Damage Findings";
  const findingsCard = renderFindingsCardHTML(cardTitle, findings);
  return `${findingsCard}\n\n${enhanced}`;
}

function tryEnhancePieChart(enhanced: string): string | null {
  if (!/pie\s*chart/i.test(enhanced) || !/([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*[=:]\s*(\d+(?:\.\d+)?)\s*%/i.test(enhanced)) {
    return null;
  }

  const matches = Array.from(enhanced.matchAll(GENERIC_PIE_PAIR_REGEX));
  if (matches.length < 3) return null;

  const pieData = matches
    .map((m) => ({
      label: m[1].replace(/^(?:The\s*chart\s*shows|shows|and|\(1\)\s*A\s*pie\s*chart\s*showing|\(1\)|\(|\n|-)\s*/i, "").trim(),
      value: Number.parseFloat(m[2]),
    }))
    .filter((d) => d.label.length > 0 && d.label.length < 35);

  const sum = pieData.reduce((acc, d) => acc + d.value, 0);
  if (sum < 70 || sum > 130) return null;

  const chartTitle = "Proportional Distribution Breakdown";
  const svgPie = renderPieChartSVG(chartTitle, pieData);
  return `${svgPie}\n\n${enhanced}`;
}

function tryEnhanceSingleBar(enhanced: string): string | null {
  if (
    !/(?:bar\s*graph|bar\s*values|subject\s*area)/i.test(enhanced) ||
    enhanced.includes("Municipality") ||
    enhanced.includes("Barangay")
  ) {
    return null;
  }

  const singleBarMatches = Array.from(enhanced.matchAll(SINGLE_BAR_ROW_REGEX));
  if (singleBarMatches.length < 4) return null;

  const barCategories = singleBarMatches
    .map((bm) => ({
      name: bm[1].replace(/^(?:The\s*bar\s*values\s*are|values\s*are|The\s*bars\s*show|The\s*chart\s*shows)\s*/i, "").trim(),
      values: [{ key: "Count", val: Number.parseFloat(bm[2].replace(/,/g, "")) }],
    }))
    .filter((c) => c.name.length > 0 && c.name.length < 25);

  if (barCategories.length < 4) return null;

  const chartTitle = "Subject Area & Category Distribution (Bar Chart)";
  const svgBar = renderGroupedBarChartSVG(chartTitle, barCategories);
  return `${svgBar}\n\n${enhanced}`;
}

function tryEnhanceSequentialTrend(enhanced: string): string | null {
  if (
    !/(?:line\s*graph|trend\s*data|production\s*output|cases\s*in\s*a\s*city|annual\s*number|weekly)/i.test(enhanced) ||
    !/(?:20\d\d|Week\s*\d+|Month\s*\d+)[=:]\s*[\d,]+/i.test(enhanced)
  ) {
    return null;
  }

  const pointMatches = Array.from(enhanced.matchAll(PERIOD_TREND_ROW_REGEX));
  if (pointMatches.length < 4) return null;

  const lineData = pointMatches.map((pm) => ({
    x: pm[1].replace(/Week\s*/i, "Wk "),
    y: Number.parseFloat(pm[2].replace(/,/g, "")),
  }));

  const chartTitle = "Sequential Performance & Trend Trajectory";
  const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Output / Cases", data: lineData }]);
  return `${svgLine}\n\n${enhanced}`;
}

function tryEnhanceMonthlyTrend(enhanced: string): string | null {
  if (
    !/(?:line\s*graph|trend\s*data|monthly|12-month|plotted\s*values)/i.test(enhanced) ||
    enhanced.includes("Building") ||
    !/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)=\s*-?\d+(?:\.\d+)?\s*%?/i.test(enhanced)
  ) {
    return null;
  }

  const pointMatches = Array.from(enhanced.matchAll(MONTH_TREND_ROW_REGEX));
  if (pointMatches.length < 4) return null;

  const lineData = pointMatches.map((pm) => ({
    x: pm[1],
    y: Number.parseFloat(pm[2]),
    unit: pm[3] || "",
  }));

  const chartTitle = "12-Month Performance & Trend Trajectory";
  const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Trend Data", data: lineData }]);
  return `${svgLine}\n\n${enhanced}`;
}

function tryEnhanceComparativeMatrix(enhanced: string): string | null {
  const dataPortion = enhanced.replace(PASSAGE_HEADER_STRIP_REGEX, "");
  const matches = Array.from(dataPortion.matchAll(MATRIX_ENTITY_ROW_REGEX));
  const entities: Array<{ name: string; values: Array<{ key: string; val: number; unit?: string }> }> = [];

  for (const m of matches) {
    const rawName = m[1].trim();
    const name = cleanEntityName(rawName);

    if (/^(?:Passage|Note|Indicator|Priority|Criteria|Finding|Total|Step\s*\d+|Table\s*\d+|Question)$/i.test(name)) {
      continue;
    }

    const content = m[2];
    const pairMatches = Array.from(content.matchAll(MATRIX_PAIR_ROW_REGEX));
    const pairs: Array<{ key: string; val: number; unit?: string }> = [];

    for (const pm of pairMatches) {
      const key = cleanEntityName(pm[1]);
      const val = Number.parseFloat(pm[2].replace(/,/g, ""));
      const unit = pm[3] || "";
      if (key.length > 0 && key.length < 30 && !Number.isNaN(val)) {
        pairs.push({ key, val, unit });
      }
    }

    if (pairs.length >= 1 && name.length >= 2 && name.length <= 35) {
      entities.push({ name, values: pairs });
    }
  }

  if (entities.length < 2) return null;

  const chartTitle = "Comparative Data Breakdown & Matrix Analysis";
  const svgMatrix = renderGroupedBarChartSVG(chartTitle, entities);
  return `${svgMatrix}\n\n${enhanced}`;
}

type InterpretationHandler = (text: string) => string | null;

const ENHANCEMENT_HANDLERS: readonly InterpretationHandler[] = [
  tryEnhanceMarkdownTable,
  tryEnhanceDualPieAndUnderemployment,
  tryEnhanceBarangayIncome,
  tryEnhanceEnergyGrid,
  tryEnhanceBuildingPower,
  tryEnhanceSitioSurvey,
  tryEnhanceSolarQuarterly,
  tryEnhanceWasteGeneration,
  tryEnhanceCityTemperature,
  tryEnhanceFindings,
  tryEnhancePieChart,
  tryEnhanceSingleBar,
  tryEnhanceSequentialTrend,
  tryEnhanceMonthlyTrend,
  tryEnhanceComparativeMatrix,
];

/**
 * 🔍 Universal data interpretation engine that identifies data structures in passages
 * and converts them into interactive visual SVG illustrations & tables.
 * Cognitive Complexity: 3 (SonarQube limit: 15)
 */
export function autoEnhanceDataInterpretation(text: string): string {
  if (!text) return "";
  if (POLYGON_SEQUENCE_REGEX.test(text)) {
    return text;
  }

  // If already contains HTML markup, return immediately to prevent matching CSS classes
  if (text.includes("<svg") || text.includes("<table") || text.includes("<div")) {
    return text;
  }

  for (const handler of ENHANCEMENT_HANDLERS) {
    const result = handler(text);
    if (result !== null) {
      return result;
    }
  }

  return text;
}