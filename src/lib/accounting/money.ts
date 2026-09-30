// Relative Path: src/lib/accounting/money.ts

/**
 * Pure integer centavo arithmetic and deterministic rounding policies.
 * 
 * 🚨 CRITICAL PRODUCTION RULES:
 * 1. JavaScript floating-point arithmetic is STRICTLY PROHIBITED for money amounts.
 * 2. All amounts in DB and calculations are stored as integer centavos.
 * 3. Rounding uses centralized deterministic policy (Math.round).
 * 4. ₱1.00 = 100 centavos, ₱299.00 = 29900 centavos.
 */

export function sanitizePercentage(rate: unknown, fallback = 0.0): number {
  let numericRate: number;

  if (typeof rate === "number" && !Number.isNaN(rate) && Number.isFinite(rate)) {
    numericRate = rate;
  } else {
    const parsed = Number.parseFloat(String(rate));
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return fallback;
    }
    numericRate = parsed;
  }

  return Math.min(100.0, Math.max(0.0, Math.round(numericRate * 100) / 100));
}

export function deterministicRound(centavos: number): number {
  if (Number.isNaN(centavos) || !Number.isFinite(centavos)) {
    return 0;
  }
  return Math.round(centavos);
}

export function calculatePercentageShareCentavos(
  baseAmountCentavos: number,
  percentageRate: number
): number {
  if (baseAmountCentavos <= 0 || percentageRate <= 0) return 0;
  const safeRate = sanitizePercentage(percentageRate);
  return deterministicRound((baseAmountCentavos * safeRate) / 100);
}

export function formatCentavosToPesos(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || Number.isNaN(centavos) || !Number.isFinite(centavos)) {
    return "₱0.00";
  }
  const isNegative = centavos < 0;
  const absPesos = Math.abs(centavos) / 100;
  const formatted = `₱${absPesos.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function centavosToPesosNumber(centavos: number | null | undefined): number {
  if (centavos === null || centavos === undefined || Number.isNaN(centavos) || !Number.isFinite(centavos)) {
    return 0;
  }
  return Math.round(centavos) / 100;
}

export function pesosToCentavos(pesos: number | null | undefined): number {
  if (pesos === null || pesos === undefined || Number.isNaN(pesos) || !Number.isFinite(pesos)) {
    return 0;
  }
  return Math.round(pesos * 100);
}