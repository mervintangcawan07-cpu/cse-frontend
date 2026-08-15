/**
 * 🧼 sanitizeMath.ts
 * Robust, universal utility to strip and convert raw LaTeX, TeX symbols,
 * math delimiters, and broken TeX fragments into clean, human-readable Unicode text.
 * 
 * IMPORTANT: TeX commands MUST require a backslash (or explicit math context)
 * to avoid corrupting standard English words (e.g., "possible" -> "possib≤", "sample" -> "samp≤").
 */

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  "n": "ⁿ",
  "i": "ⁱ",
  "x": "ˣ",
  "y": "ʸ",
  "k": "ᵏ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  "a": "ₐ",
  "e": "ₑ",
  "o": "ₒ",
  "x": "ₓ",
  "h": "ₕ",
  "k": "ₖ",
  "l": "ₗ",
  "m": "ₘ",
  "n": "ₙ",
  "p": "ₚ",
  "s": "ₛ",
  "t": "ₜ",
};

/**
 * Parses balanced curly braces starting at a given index.
 * Returns the inner content and the end index of the closing brace.
 */
function extractBalancedBrace(str: string, openBraceIdx: number): { content: string; endIdx: number } | null {
  if (str[openBraceIdx] !== "{") return null;
  let depth = 1;
  for (let i = openBraceIdx + 1; i < str.length; i++) {
    if (str[i] === "{") {
      depth++;
    } else if (str[i] === "}") {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(openBraceIdx + 1, i),
          endIdx: i,
        };
      }
    }
  }
  return null;
}

/**
 * Replaces \frac{A}{B}, \dfrac{A}{B}, \tfrac{A}{B}, or bare frac{A}{B}
 * with properly formatted (A)/(B) or A/B handling arbitrarily nested braces.
 */
function replaceFractions(str: string): string {
  let result = str;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 20) {
    changed = false;
    iterations++;

    // Match \frac, \dfrac, \tfrac, or bare frac{...}{...}
    const match = result.match(/\\?(?:d|t)?frac\s*\{/);
    if (match && match.index !== undefined) {
      const fracStart = match.index;
      const firstOpenBrace = fracStart + match[0].length - 1;

      const numRes = extractBalancedBrace(result, firstOpenBrace);
      if (numRes) {
        // Find next non-whitespace character which must be {
        let secondOpenBrace = -1;
        for (let i = numRes.endIdx + 1; i < result.length; i++) {
          if (/\s/.test(result[i])) continue;
          if (result[i] === "{") {
            secondOpenBrace = i;
            break;
          }
          break;
        }

        if (secondOpenBrace !== -1) {
          const denRes = extractBalancedBrace(result, secondOpenBrace);
          if (denRes) {
            const cleanNum = cleanMathText(numRes.content);
            const cleanDen = cleanMathText(denRes.content);

            const numNeedsParens = (cleanNum.includes("+") || cleanNum.includes("-") || cleanNum.includes(" ") || cleanNum.includes("/")) && !cleanNum.startsWith("(");
            const denNeedsParens = (cleanDen.includes("+") || cleanDen.includes("-") || cleanDen.includes(" ") || cleanDen.includes("/")) && !cleanDen.startsWith("(");

            const formattedNum = numNeedsParens ? `(${cleanNum})` : cleanNum;
            const formattedDen = denNeedsParens ? `(${cleanDen})` : cleanDen;

            const replacement = `${formattedNum}/${formattedDen}`;

            result = result.substring(0, fracStart) + replacement + result.substring(denRes.endIdx + 1);
            changed = true;
          }
        }
      }
    }
  }

  return result;
}

export function cleanMathText(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);

  // Restore corrupted English words where ≤ or ≥ got attached to letters (e.g. wholesa≤, avera≥, a≥, fema≤)
  text = text.replace(/([a-zA-Z])≤([a-zA-Z]*)/g, "$1le$2");
  text = text.replace(/([a-zA-Z])≥([a-zA-Z]*)/g, "$1ge$2");
  text = text.replace(/\bFemas\b/g, "Female");
  text = text.replace(/\bMas\b/g, "Male");
  text = text.replace(/\bfemas\b/g, "female");
  text = text.replace(/\bmas\b/g, "male");

  // Fix common generation artifacts like "Z - frac" or "E - frac" (should be "Z =" or "E =")
  text = text.replace(/([A-Za-z])\s*-\s*\\?(?:d|t)?frac/g, "$1 = frac");
  text = text.replace(/([A-Za-z])\s*-\s*\\?(?:d|t)?dfrac/g, "$1 = frac");

  // 1. Convert LaTeX fractions (handles arbitrarily nested braces)
  text = replaceFractions(text);

  // 2. Convert \overline{...} / \bar{...} (e.g., repeating decimals like 0.10\overline{6} -> 0.106̄)
  text = text.replace(/\\?(?:overline|bar)\{([^{}]+)\}/g, (_, inner) => {
    return inner.split("").map((c: string) => `${c}\u0305`).join("");
  });

  // 3. Convert \text{...}, \textbf{...}, \textit{...}, \mathrm{...}, \mathbf{...}, \mathbfit{...}
  let prevText = "";
  let iterations = 0;
  while (prevText !== text && iterations < 10) {
    prevText = text;
    iterations++;
    text = text.replace(/\\(?:text|textbf|textit|mathrm|mathbf|mathbfit|mathit|textsf|texttt)\{([^{}]+)\}/g, "$1");
  }

  // 4. Convert Square Roots: \sqrt[n]{x} -> ⁿ√x, \sqrt{x} -> √x
  text = text.replace(/\\sqrt\[(\d+)\]\{([^{}]+)\}/g, (_, root, val) => {
    const supRoot = root.split("").map((c: string) => SUPERSCRIPTS[c] || c).join("");
    return `${supRoot}√${val}`;
  });
  text = text.replace(/\\sqrt\{([^{}]+)\}/g, "√$1");
  text = text.replace(/\\sqrt\s*(\d+|\w+)/g, "√$1");

  // 5. Floor & Ceiling Brackets
  text = text.replace(/\\lfloor\b/g, "⌊");
  text = text.replace(/\\rfloor\b/g, "⌋");
  text = text.replace(/\\lceil\b/g, "⌈");
  text = text.replace(/\\rceil\b/g, "⌉");

  // 6. Greek Letters (Must have leading backslash to prevent mangling English words)
  text = text.replace(/\\alpha\b/g, "α");
  text = text.replace(/\\beta\b/g, "β");
  text = text.replace(/\\gamma\b/g, "γ");
  text = text.replace(/\\theta\b/g, "θ");
  text = text.replace(/\\Delta\b/g, "Δ");
  text = text.replace(/\\delta\b/g, "δ");
  text = text.replace(/\\lambda\b/g, "λ");
  text = text.replace(/\\mu\b/g, "μ");
  text = text.replace(/\\pi\b/g, "π");
  text = text.replace(/\\sigma\b/g, "σ");
  text = text.replace(/\\Sigma\b/g, "Σ");
  text = text.replace(/\\omega\b/g, "ω");
  text = text.replace(/\\Omega\b/g, "Ω");
  text = text.replace(/\\phi\b/g, "φ");
  text = text.replace(/\\psi\b/g, "ψ");

  // 7. Operators & Relations (Must have leading backslash)
  text = text.replace(/\\approx\b/g, "≈");
  text = text.replace(/\\times\b/g, "×");
  text = text.replace(/\\cdot\b/g, "·");
  text = text.replace(/\\div\b/g, "÷");
  text = text.replace(/\\pm\b/g, "±");
  text = text.replace(/\\mp\b/g, "∓");
  text = text.replace(/\\leq\b/g, "≤");
  text = text.replace(/\\le\b/g, "≤");
  text = text.replace(/\\geq\b/g, "≥");
  text = text.replace(/\\ge\b/g, "≥");
  text = text.replace(/\\neq\b/g, "≠");
  text = text.replace(/\\equiv\b/g, "≡");
  text = text.replace(/\\infty\b/g, "∞");
  text = text.replace(/\\sum\b/g, "Σ");
  text = text.replace(/\\prod\b/g, "Π");
  text = text.replace(/\\int\b/g, "∫");

  // 8. Ellipsis & Dots
  text = text.replace(/\\(?:c|l|v)?dots\b/g, "...");

  // 9. Angles & Degrees
  text = text.replace(/\\(?:degree|circ)\b/g, "°");
  text = text.replace(/\^\s*\\(?:circ|degree)\b/g, "°");
  text = text.replace(/\^\{\\?circ\}/g, "°");

  // 10. Spacing Macros
  text = text.replace(/\\(?:qquad|quad)\b/g, " ");
  text = text.replace(/\\[,;:! ]/g, " ");

  // 11. Sizing & Structural Wrappers
  text = text.replace(/\\(?:left|right|big|Big|bigg|Bigg|bigl|bigr|Bigl|Bigr)[()\[\]{}|.]/g, (match) => {
    const char = match.slice(-1);
    return char === "." ? "" : char;
  });
  text = text.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
  text = text.replace(/\\%/g, "%").replace(/\\\$/g, "$");

  // 12. Superscripts: handle ^{exp} including negatives like ^{-2} -> ⁻²
  text = text.replace(/\^\{([^{}]+)\}/g, (_, exp) => {
    return exp
      .split("")
      .map((c: string) => SUPERSCRIPTS[c] || c)
      .join("");
  });
  text = text.replace(/\^([0-9nixy+\-])/g, (_, exp) => SUPERSCRIPTS[exp] || exp);

  // 13. Subscripts: handle _{sub}
  text = text.replace(/_\{([^{}]+)\}/g, (_, sub) => {
    return sub
      .split("")
      .map((c: string) => SUBSCRIPTS[c] || c)
      .join("");
  });
  text = text.replace(/_([0-9aeoxhkmnpst+\-])/g, (_, sub) => SUBSCRIPTS[sub] || sub);

  // 14. Strip remaining $ / $$ math delimiters
  text = text.replace(/\$\$/g, "");
  text = text.replace(/\$/g, "");

  // 15. Clean up stray double backslashes or escape artifacts ONLY for remaining TeX command words
  text = text.replace(/\\([a-zA-Z]+)/g, "$1");

  // 16. Normalize multiple spaces & spaces before punctuation
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\s+([,.:;!])/g, "$1");
  text = text.replace(/,(\?)/g, ", $1");
  text = text.replace(/,\s*,/g, ",");

  return text.trim();
}
