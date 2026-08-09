/**
 * Advanced Prompt Formatter: Converts raw pipe-delimited data into styled 
 * responsive HTML tables AND automatically generates inline visual bar graphs
 * for numeric comparative data (percentages, capacities, census stats).
 */

function generateBarChartHTML(data: { label: string; value: number; subtext?: string }[]): string {
  if (data.length === 0) return "";

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const colorStyles = [
    { bar: "bg-blue-500", text: "text-blue-400" },
    { bar: "bg-emerald-500", text: "text-emerald-400" },
    { bar: "bg-amber-500", text: "text-amber-400" },
    { bar: "bg-purple-500", text: "text-purple-400" },
    { bar: "bg-rose-500", text: "text-rose-400" }
  ];

  let chartHtml = `
    <div class="my-4 p-4 rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-xl text-slate-100">
      <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <span class="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          📊 Visual Data Graph
        </span>
        <span class="text-[10px] text-slate-400 font-mono">Auto-Generated Chart</span>
      </div>
      <div class="space-y-3">
  `;

  data.forEach((item, index) => {
    const percentage = Math.min(Math.round((item.value / maxValue) * 100), 100);
    const color = colorStyles[index % colorStyles.length];

    chartHtml += `
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-semibold">
          <span class="text-slate-200">${item.label}</span>
          <span class="${color.text} font-mono font-bold">${item.value}% ${item.subtext ? `(${item.subtext})` : ""}</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/50 p-0.5">
          <div class="${color.bar} h-full rounded-full transition-all duration-500 ease-out" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });

  chartHtml += `
      </div>
    </div>
  `;

  return chartHtml;
}

export function formatPromptHTML(promptText: string): string {
  if (!promptText) return "";

  if (!promptText.includes("|")) {
    return promptText;
  }

  // Handle pipe-delimited data records (e.g., Question #51 format)
  const pipeParts = promptText.split("|").map((p) => p.trim());
  
  if (pipeParts.length >= 3) {
    const firstPart = pipeParts[0];
    const lastPart = pipeParts[pipeParts.length - 1];

    const colonIdx = firstPart.indexOf(":");
    const introText = colonIdx !== -1 ? firstPart.substring(0, colonIdx + 1) : "";
    const col1Header = colonIdx !== -1 ? firstPart.substring(colonIdx + 1).trim() : firstPart;

    const questionMatch = lastPart.match(/(Which|What|How|Calculate|Determine|Find|Who)[^?]*\?/i);
    const questionText = questionMatch ? questionMatch[0] : "";
    const lastCellVal = questionMatch ? lastPart.replace(questionText, "").trim() : lastPart;

    const allCells = [col1Header, ...pipeParts.slice(1, pipeParts.length - 1), lastCellVal].filter(Boolean);

    let html = "";
    if (introText) html += `<p class="font-bold mb-3 text-slate-100">${introText}</p>`;

    // 1. Render Structured Data Table
    html += '<div class="overflow-x-auto my-3 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-1 shadow-md"><table class="w-full text-xs text-left border-collapse"><tbody class="divide-y divide-slate-800">';
    allCells.forEach((cell, idx) => {
      const isHeaderRow = idx === 0 || idx % 3 === 0;
      html += `<tr class="${isHeaderRow ? "bg-slate-800/90 text-amber-300 font-bold uppercase" : "text-slate-200 hover:bg-slate-800/40"}">`;
      html += `<td class="p-2.5 font-semibold">${cell}</td></tr>`;
    });
    html += '</tbody></table></div>';

    // 2. Parse Numeric Cells to Generate Chart
    const chartData: { label: string; value: number; subtext?: string }[] = [];
    
    for (let i = 0; i < allCells.length; i++) {
      const cell = allCells[i];
      const numbers = cell.match(/\b\d+(\.\d+)?\b/g);
      
      if (numbers && numbers.length >= 2) {
        const val1 = parseFloat(numbers[0]);
        const val2 = parseFloat(numbers[1]);
        
        if (val1 > 0 && val2 > 0) {
          const rate = Math.round((val2 / val1) * 100);
          const entityLabel = cell.replace(/\d+/g, "").replace(/[|:,]/g, "").trim() || `Item ${chartData.length + 1}`;
          chartData.push({
            label: entityLabel,
            value: rate,
            subtext: `${val2}/${val1}`
          });
        }
      }
    }

    if (chartData.length >= 2) {
      html += generateBarChartHTML(chartData);
    }

    if (questionText) html += `<p class="font-extrabold mt-3 text-slate-100 text-sm">${questionText}</p>`;

    return html;
  }

  return promptText;
}
