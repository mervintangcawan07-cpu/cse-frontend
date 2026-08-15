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
          <span class="text-slate-200 font-medium">${item.label}</span>
        </div>
        <span class="font-bold text-white font-mono ml-2">${pct}</span>
      </div>`
    );

    currentAngle = endAngle;
  });

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span>🥧</span><span>${title}</span></div>` : ""}
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
      `<line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />`
    );
    const formattedY = yVal >= 1000 ? `${(yVal / 1000).toFixed(0)}k` : yVal % 1 === 0 ? yVal : yVal.toFixed(1);
    gridLines.push(
      `<text x="${padLeft - 6}" y="${yPos + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${formattedY}</text>`
    );
  }

  const xLabelsSvg: string[] = [];
  allXLabels.forEach((label, idx) => {
    const xPos = getXPos(idx);
    xLabelsSvg.push(
      `<line x1="${xPos}" y1="${padTop + chartH}" x2="${xPos}" y2="${padTop + chartH + 4}" stroke="#64748b" stroke-width="1.5" />`
    );
    xLabelsSvg.push(
      `<text x="${xPos}" y="${padTop + chartH + 18}" fill="#cbd5e1" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">${label}</text>`
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
      seriesSvg.push(
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${color}" stroke="#0f172a" stroke-width="2" />`
      );
      const displayVal = p.val >= 1000 ? `${(p.val / 1000).toFixed(1)}k` : p.val;
      seriesSvg.push(
        `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" fill="#ffffff" font-size="9" font-weight="bold" text-anchor="middle" font-family="monospace">${displayVal}${p.unit}</text>`
      );
    });

    legendItems.push(
      `<div class="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
        <span class="w-3 h-1.5 rounded-full" style="background-color: ${color}"></span>
        <span class="text-slate-200">${s.name}</span>
      </div>`
    );
  });

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5"><span>📈</span><span>${title}</span></div>` : ""}
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
      `<line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" stroke="#334155" stroke-dasharray="3,3" stroke-width="1" />`
    );
    gridSvg.push(
      `<text x="${padLeft - 6}" y="${yPos + 4}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${yVal >= 1000 ? `${(yVal / 1000).toFixed(0)}k` : yVal}</text>`
    );
  }

  // Draw Groups & Bars
  categories.forEach((cat, cIdx) => {
    const groupCenterX = padLeft + cIdx * groupWidth + groupWidth / 2;
    const totalBarsWidth = allKeys.length * barWidth;
    const groupStartX = groupCenterX - totalBarsWidth / 2;

    barsSvg.push(
      `<text x="${groupCenterX}" y="${padTop + chartH + 20}" fill="#cbd5e1" font-size="10" font-weight="bold" text-anchor="middle" font-family="sans-serif">${cat.name}</text>`
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
        <span class="text-slate-200">${key}</span>
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
            ${allKeys.map((k) => `<th class="p-2 border-r border-slate-700 last:border-r-0">${k}</th>`).join("")}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
          ${tableRows.map((row) => `
            <tr class="hover:bg-slate-800/40 transition text-slate-200">
              ${row.map((cell, idx) => `<td class="p-2 border-r border-slate-800 last:border-r-0 ${idx === 0 ? "font-bold text-white" : "font-mono"}">${cell}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="my-4 p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg text-slate-100">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        ${title ? `<div class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5"><span>📊</span><span>${title}</span></div>` : ""}
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
        <span>📑</span><span>${title}</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        ${findings.map((f) => `
          <div class="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-400 font-black text-xs shrink-0 border border-indigo-500/30">#${f.num}</span>
            <p class="text-xs text-slate-200 leading-relaxed font-medium">${f.text}</p>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * 🔍 Universal data interpretation engine that identifies data structures in passages
 * and converts them into interactive visual SVG illustrations & tables.
 */
export function autoEnhanceDataInterpretation(text: string): string {
  if (!text) return "";
  let enhanced = text;

  // Suppress charting for geometric polygon / number logic sequences
  if (/polygon|sequence where|at each step|geometric sequence/i.test(enhanced)) {
    return enhanced;
  }

  // 1. Universal Flattened Markdown Table Detector -> ALWAYS renders clean statistical table (Picture 3) and exits immediately!
  if (enhanced.includes("|---|")) {
    const firstPipe = enhanced.indexOf("|");
    const tablePart = enhanced.substring(firstPipe);
    const sepIdx = tablePart.indexOf("|---|");

    if (sepIdx !== -1) {
      const headerStr = tablePart.substring(0, sepIdx);
      const headerCells = headerStr.split("|").map((c) => c.trim()).filter(Boolean);
      const colCount = headerCells.length;

      if (colCount >= 2) {
        const afterSep = tablePart.substring(sepIdx);
        const dataStartMatch = afterSep.match(/\|[\s:-]+\|\s*\|/);
        const dataStartOffset = dataStartMatch ? dataStartMatch.index! + dataStartMatch[0].length - 1 : sepIdx + 5;
        const rawDataStr = afterSep.substring(dataStartOffset);

        const qMatch = rawDataStr.match(/\|\s*(?:Which|What|How|Calculate|Determine|Find|Who|Based)\b/i);
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

        if (rows.length >= 1) {
          const fullRawTable = tablePart.substring(0, (qMatch ? sepIdx + dataStartOffset + qMatch.index! : tablePart.length));
          const tableHtml = `
            <div class="my-4 overflow-x-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg p-2">
              <div class="text-xs font-black text-amber-400 uppercase tracking-wider px-2 py-1.5 mb-1 flex items-center gap-1.5">
                <span>📋</span><span>STATISTICAL DATASET & MATRIX RECORD</span>
              </div>
              <table class="w-full text-xs text-left text-slate-200 border-collapse">
                <thead>
                  <tr class="bg-slate-800/90 text-amber-300 font-black uppercase tracking-wider border-b border-slate-700">
                    ${headerCells.map((h) => `<th class="p-2.5 border-r border-slate-700/60 last:border-r-0">${h}</th>`).join("")}
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  ${rows
                    .map(
                      (row) => `
                    <tr class="hover:bg-slate-800/50 transition">
                      ${row.map((c, i) => `<td class="p-2.5 border-r border-slate-800/80 last:border-r-0 ${i === 0 ? "font-bold text-white" : "font-mono"}">${c}</td>`).join("")}
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `;

          // Replace the markdown table with the clean HTML table and return immediately!
          return enhanced.replace(fullRawTable, tableHtml);
        }
      }
    }
  }

  // If already contains HTML markup, return immediately to prevent matching CSS classes
  if (enhanced.includes("<svg") || enhanced.includes("<table") || enhanced.includes("<div")) {
    return enhanced;
  }

  // 2. Detect Dual Pie Chart + Underemployment Sector Rates (Screenshot 1: Question #17)
  if (
    /pie\s*chart/i.test(enhanced) &&
    /(?:underemployment|line\s*graph|rate\s*within\s*each\s*sector)/i.test(enhanced)
  ) {
    const pieMatch = enhanced.match(/pie\s*chart[^(]*\(([^)]+)\)/i);
    const rateMatch = enhanced.match(/(?:line\s*graph|underemployment|rate)[^(]*\(([^)]+)\)/i);

    if (pieMatch && rateMatch) {
      const piePairs = Array.from(pieMatch[1].matchAll(/([A-Za-z\s]+)=\s*(\d+(?:\.\d+)?)\s*%/g));
      const ratePairs = Array.from(rateMatch[1].matchAll(/([A-Za-z\s]+)=\s*(\d+(?:\.\d+)?)\s*%/g));

      if (piePairs.length >= 3) {
        const pieData = piePairs.map((p) => ({ label: p[1].trim(), value: parseFloat(p[2]) }));
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
              <span>📊</span><span>Sector Underemployment Rate Matrix</span>
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
                    <td class="p-2 border-r border-slate-800 font-bold text-white">${row[0]}</td>
                    <td class="p-2 border-r border-slate-800 font-mono">${row[1]}</td>
                    <td class="p-2 font-mono text-emerald-400 font-bold">${row[2]}</td>
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
    }
  }

  // 3. Detect Multi-Barangay Household Income Breakdown (Three pie charts / Barangay A, B, C)
  if (/Three\s*pie\s*charts|Barangay\s+[A-Z]\s*\([^)]*\):/i.test(enhanced)) {
    const bMatches = Array.from(enhanced.matchAll(/Barangay\s+([A-Z])(?:\s*\([^)]*\))?:\s*([^.;\n]+)/gi));
    if (bMatches.length >= 3) {
      const categories = bMatches.map((m) => {
        const name = `Barangay ${m[1]}`;
        const pairMatches = Array.from(m[2].matchAll(/([A-Za-z/ -]+?)=\s*(\d+(?:\.\d+)?)\s*%/g));
        const values = pairMatches.map((p) => ({ key: p[1].trim(), val: parseFloat(p[2]), unit: "%" }));
        return { name, values };
      });
      const chartTitle = "Household Income Sources by Barangay (Pie Chart Breakdown)";
      const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
      return `${svgBar}\n\n${enhanced}`;
    }
  }

  // 4. Detect Energy Grid Generation & Renewable Energy Dashboard
  if (/(?:dashboard\s*provides|generation\s*by\s*source)/i.test(enhanced) && /(?:island\s*grid|Renewable\s*Energy)/i.test(enhanced)) {
    const barMatch = enhanced.match(/(?:bar\s*chart|generation\s*by\s*source)[^(]*\(([^)]+)\)/i);
    const lineMatch = enhanced.match(/(?:line\s*graph|loss\s*rate)[^(]*\(([^)]+)\)/i);

    if (barMatch) {
      const pairs = Array.from(barMatch[1].matchAll(/([A-Za-z/ -]+)=\s*([\d,]+(?:\.\d+)?)\s*(GWh|%)/g));
      const sources = pairs
        .filter((p) => !/total/i.test(p[1]))
        .map((p) => ({
          name: p[1].trim(),
          values: [{ key: "Generation", val: parseFloat(p[2].replace(/,/g, "")), unit: ` ${p[3]}` }],
        }));

      if (sources.length >= 3) {
        const barSvg = renderGroupedBarChartSVG("Island Grid Electricity Generation by Source (GWh)", sources);

        let lineSvg = "";
        if (lineMatch) {
          const qPairs = Array.from(lineMatch[1].matchAll(/(Q[1-4])=\s*(\d+(?:\.\d+)?)\s*%/g));
          if (qPairs.length >= 3) {
            const lineData = qPairs.map((qp) => ({ x: qp[1], y: parseFloat(qp[2]), unit: "%" }));
            lineSvg = renderLineGraphSVG("Quarterly Transmission & Distribution Loss Rate (%)", [
              { name: "Loss Rate", data: lineData },
            ]);
          }
        }

        return `${barSvg}\n\n${lineSvg}\n\n${enhanced}`;
      }
    }
  }

  // 5. Detect Multi-Building Monthly Power Consumption (Screenshot 4: Building A: Jan=12,840, Feb=13,210...)
  if (
    /Building\s+[A-Z]:\s*Jan=/i.test(enhanced)
  ) {
    const bMatches = Array.from(enhanced.matchAll(/Building\s+([A-Z]):\s*Jan\s*=\s*([\d,]+),\s*Feb\s*=\s*([\d,]+),\s*Mar\s*=\s*([\d,]+)/gi));
    if (bMatches.length >= 3) {
      const categories = bMatches.map((m) => ({
        name: `Building ${m[1]}`,
        values: [
          { key: "Jan", val: parseFloat(m[2].replace(/,/g, "")), unit: " kWh" },
          { key: "Feb", val: parseFloat(m[3].replace(/,/g, "")), unit: " kWh" },
          { key: "Mar", val: parseFloat(m[4].replace(/,/g, "")), unit: " kWh" },
        ],
      }));
      const chartTitle = "Government Buildings Monthly Power Consumption (kWh)";
      const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
      return `${svgBar}\n\n${enhanced}`;
    }
  }

  // 6. Detect Sitio Communities Household Survey (Screenshot 2: Question #22)
  if (
    /Sitio\s+[A-Za-z]+:\s*Poverty\s*rate/i.test(enhanced)
  ) {
    const sitioMatches = Array.from(
      enhanced.matchAll(/Sitio\s+([A-Za-z]+):\s*Poverty\s*rate\s*(\d+)%,\s*Distance\s*(\d+)\s*km,\s*Population\s*density\s*(\d+)/gi)
    );
    if (sitioMatches.length >= 3) {
      const categories = sitioMatches.map((m) => ({
        name: `Sitio ${m[1]}`,
        values: [
          { key: "Poverty Rate", val: parseFloat(m[2]), unit: "%" },
          { key: "Distance", val: parseFloat(m[3]), unit: " km" },
          { key: "Pop. Density", val: parseFloat(m[4]), unit: "/km²" },
        ],
      }));
      const chartTitle = "Community Survey & Livelihood Center Selection Indicators";
      const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
      return `${svgBar}\n\n${enhanced}`;
    }
  }

  // 7. Detect Single Facility Solar Power Quarterly Output (Screenshot 3: Question #25)
  if (
    /(?:solar\s*power\s*facility|facility|quarterly\s*generation|generation\s*output):/i.test(enhanced) &&
    /Q1\s*=\s*\d+/i.test(enhanced) &&
    /Q4\s*=\s*\d+/i.test(enhanced) &&
    !enhanced.includes("Building")
  ) {
    const qMatches = Array.from(enhanced.matchAll(/(Q[1-4])\s*=\s*(\d+(?:\.\d+)?)/gi));
    if (qMatches.length >= 4) {
      const lineData = qMatches.map((qm) => ({
        x: qm[1].toUpperCase(),
        y: parseFloat(qm[2]),
        unit: " GWh",
      }));
      const chartTitle = "Solar Facility Quarterly Generation Output (GWh)";
      const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Solar Output (GWh)", data: lineData }]);
      return `${svgLine}\n\n${enhanced}`;
    }
  }

  // 8. Detect Commercial Zones Solid Waste Generation (Zone A produces 42.5 MTD of biodegradable, 28.3 MTD of recyclable...)
  if (
    /Zone\s+[A-Z]:?\s+produces\s+\d+/i.test(enhanced) &&
    !enhanced.includes("<svg")
  ) {
    const zoneMatches = Array.from(
      enhanced.matchAll(/Zone\s+([A-Z]):?\s+produces\s+(\d+(?:\.\d+)?)\s*MTD\s+of\s+biodegradable,\s*(\d+(?:\.\d+)?)\s*MTD\s+of\s+recyclable,\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*MTD\s+of\s+residual/gi)
    );
    if (zoneMatches.length >= 3) {
      const categories = zoneMatches.map((m) => ({
        name: `Zone ${m[1]}`,
        values: [
          { key: "Biodegradable", val: parseFloat(m[2]), unit: " MTD" },
          { key: "Recyclable", val: parseFloat(m[3]), unit: " MTD" },
          { key: "Residual", val: parseFloat(m[4]), unit: " MTD" },
        ],
      }));
      const chartTitle = "Commercial Zones Solid Waste Generation (MTD)";
      const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
      return `${svgBar}\n\n${enhanced}`;
    }
  }

  // 9. Detect City Average Daily Temperatures (City A=31.4, City B=28.7, City C=33.2...)
  if (
    /City\s+[A-Z]=/i.test(enhanced) &&
    !enhanced.includes("<svg")
  ) {
    const cityMatches = Array.from(enhanced.matchAll(/City\s+([A-Z])=\s*(\d+(?:\.\d+)?)/gi));
    if (cityMatches.length >= 4) {
      const categories = cityMatches.map((m) => ({
        name: `City ${m[1]}`,
        values: [{ key: "Temperature", val: parseFloat(m[2]), unit: "°C" }],
      }));
      const chartTitle = "City Temperature Comparison (°C)";
      const svgBar = renderGroupedBarChartSVG(chartTitle, categories);
      return `${svgBar}\n\n${enhanced}`;
    }
  }

  // 10. Detect Structured Findings / Disaster Assessment (Finding 1: ... Finding 2: ... Finding 3: ... Finding 4: ...)
  if (
    /Finding\s+1:/i.test(enhanced) &&
    !enhanced.includes("<svg") &&
    !enhanced.includes("📑")
  ) {
    const findingMatches = Array.from(enhanced.matchAll(/Finding\s+(\d+):\s*([^.\n]+\.)/gi));
    if (findingMatches.length >= 3) {
      const findings = findingMatches.map((m) => ({
        num: m[1],
        text: m[2].trim(),
      }));
      const cardTitle = "Disaster Assessment & Damage Findings";
      const findingsCard = renderFindingsCardHTML(cardTitle, findings);
      return `${findingsCard}\n\n${enhanced}`;
    }
  }

  // 11. Detect Pie / Donut Charts
  if (
    /pie\s*chart/i.test(enhanced) &&
    !enhanced.includes("<svg") &&
    /([A-Za-z\s&/]+)[=:]\s*(\d+(?:\.\d+)?)\s*%/i.test(enhanced)
  ) {
    const matches = Array.from(
      enhanced.matchAll(/([A-Za-z\s&/]+)[=:]\s*(\d+(?:\.\d+)?)\s*%/g)
    );
    if (matches.length >= 3) {
      const pieData = matches.map((m) => ({
        label: m[1].replace(/^(?:The\s*chart\s*shows|shows|and|\(1\)\s*A\s*pie\s*chart\s*showing|\(1\)|\(|\n|-)\s*/i, "").trim(),
        value: parseFloat(m[2]),
      })).filter((d) => d.label.length > 0 && d.label.length < 35);

      const sum = pieData.reduce((acc, d) => acc + d.value, 0);
      if (sum >= 70 && sum <= 130) {
        const chartTitle = "Proportional Distribution Breakdown";
        const svgPie = renderPieChartSVG(chartTitle, pieData);
        return `${svgPie}\n\n${enhanced}`;
      }
    }
  }

  // 12. Detect Single-Series Bar Graphs
  if (
    /(?:bar\s*graph|bar\s*values|subject\s*area)/i.test(enhanced) &&
    !enhanced.includes("<svg") &&
    !enhanced.includes("Municipality") &&
    !enhanced.includes("Barangay")
  ) {
    const singleBarMatches = Array.from(
      enhanced.matchAll(/([A-Za-z\s&]+)=\s*(\d+(?:,\d+)?(?:\.\d+)?)/g)
    );
    if (singleBarMatches.length >= 4) {
      const barCategories = singleBarMatches.map((bm) => ({
        name: bm[1].replace(/^(?:The\s*bar\s*values\s*are|values\s*are|The\s*bars\s*show|The\s*chart\s*shows)\s*/i, "").trim(),
        values: [{ key: "Count", val: parseFloat(bm[2].replace(/,/g, "")) }],
      })).filter((c) => c.name.length > 0 && c.name.length < 25);

      if (barCategories.length >= 4) {
        const chartTitle = "Subject Area & Category Distribution (Bar Chart)";
        const svgBar = renderGroupedBarChartSVG(chartTitle, barCategories);
        return `${svgBar}\n\n${enhanced}`;
      }
    }
  }

  // 13. Detect Year-Based / Week-Based / Semicolon-Delimited Trend Line Graphs
  if (
    /(?:line\s*graph|trend\s*data|production\s*output|cases\s*in\s*a\s*city|annual\s*number|weekly)/i.test(enhanced) &&
    !enhanced.includes("<svg") &&
    /(?:20\d\d|Week\s*\d+|Month\s*\d+)[=:]\s*[\d,]+/i.test(enhanced)
  ) {
    const pointMatches = Array.from(
      enhanced.matchAll(/(20\d\d|Week\s*\d+|Month\s*\d+)[=:]\s*([\d,]+(?:\.\d+)?)/gi)
    );
    if (pointMatches.length >= 4) {
      const lineData = pointMatches.map((pm) => ({
        x: pm[1].replace(/Week\s*/i, "Wk "),
        y: parseFloat(pm[2].replace(/,/g, "")),
      }));
      const chartTitle = "Sequential Performance & Trend Trajectory";
      const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Output / Cases", data: lineData }]);
      return `${svgLine}\n\n${enhanced}`;
    }
  }

  // 14. Detect 12-Month / Multi-Month Single-Series Trend Line Graphs (Only when NOT multi-building)
  if (
    /(?:line\s*graph|trend\s*data|monthly|12-month|plotted\s*values)/i.test(enhanced) &&
    !enhanced.includes("<svg") &&
    !enhanced.includes("Building") &&
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)=\s*-?\d+(?:\.\d+)?\s*%?/i.test(enhanced)
  ) {
    const pointMatches = Array.from(
      enhanced.matchAll(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)=\s*(-?\d+(?:\.\d+)?)\s*(%)?/gi)
    );
    if (pointMatches.length >= 4) {
      const lineData = pointMatches.map((pm) => ({
        x: pm[1],
        y: parseFloat(pm[2]),
        unit: pm[3] || "",
      }));
      const chartTitle = "12-Month Performance & Trend Trajectory";
      const svgLine = renderLineGraphSVG(chartTitle, [{ name: "Trend Data", data: lineData }]);
      return `${svgLine}\n\n${enhanced}`;
    }
  }

  // 15. Clean Multi-Entity Comparison Matrix (e.g., Ward A: Month 1=214, Month 2=231; Agency Alpha: TAR=94%...)
  if (!enhanced.includes("<svg") && !enhanced.includes("<table")) {
    const dataPortion = enhanced.replace(/^Passage:\s*[^:.\n]+:\s*/i, "");
    const entityRegex = /(?:^|[\n.;]\s*)([A-Z][A-Za-z0-9\s/-]{1,30}?)\s*:\s*([^.;\n]+)/g;
    const entities: Array<{ name: string; values: Array<{ key: string; val: number; unit?: string }> }> = [];
    const matches = Array.from(dataPortion.matchAll(entityRegex));

    for (const m of matches) {
      let name = m[1].trim();
      name = name.replace(/^(?:The\s+data\s+shows|The\s+bars\s+show|The\s+chart\s+shows|Passage|Note|\(1\)|\(2\)|\s*-\s*)\s*/i, "").trim();

      if (/^(?:Passage|Note|Indicator|Priority|Criteria|Finding|Total|Step\s*\d+|Table\s*\d+|Question)$/i.test(name)) continue;

      const content = m[2];
      const pairMatches = Array.from(content.matchAll(/([A-Za-z0-9\s/]+?)\s*[=:-]\s*(?:PHP\s*)?([\d,]+(?:\.\d+)?)\s*(%|units|members|tons|MT|ha|M|k)?(?=[,;.\s]|$)/g));

      const pairs: Array<{ key: string; val: number; unit?: string }> = [];
      for (const pm of pairMatches) {
        const key = pm[1].replace(/^(?:the\s+values\s+are|and|shows|\s*-\s*)\s*/i, "").trim();
        const val = parseFloat(pm[2].replace(/,/g, ""));
        const unit = pm[3] || "";
        if (key.length > 0 && key.length < 30 && !isNaN(val)) {
          pairs.push({ key, val, unit });
        }
      }

      if (pairs.length >= 1 && name.length >= 2 && name.length <= 35) {
        entities.push({ name, values: pairs });
      }
    }

    if (entities.length >= 2) {
      const chartTitle = "Comparative Data Breakdown & Matrix Analysis";
      const svgMatrix = renderGroupedBarChartSVG(chartTitle, entities);
      return `${svgMatrix}\n\n${enhanced}`;
    }
  }

  return enhanced;
}
