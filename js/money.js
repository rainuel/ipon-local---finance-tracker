/** Converts a peso amount typed by the user (e.g. 820.5) into centavos. */
export function pesosToCentavos(pesos) {
  return Math.round(Number(pesos) * 100);
}

/** Converts centavos back into a plain number of pesos (for editing forms). */
export function centavosToPesos(centavos) {
  return centavos / 100;
}

/** Formats centavos as a Philippine peso string, e.g. 82050 -> "₱820.50". */
export function formatPeso(centavos) {
  const pesos = centavos / 100;
  const isNegative = pesos < 0;
  const formatted = Math.abs(pesos).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? "-" : ""}₱${formatted}`;
}

/** Formats a signed change, e.g. +₱2,380.00 or -₱1,250.00. */
export function formatSignedPeso(centavos) {
  const sign = centavos > 0 ? "+" : centavos < 0 ? "-" : "";
  return `${sign}${formatPeso(Math.abs(centavos))}`;
}

/** Formats a percentage safely, never producing NaN% or Infinity%. */
export function formatPercent(numerator, denominator, digits = 0) {
  if (!denominator) return "—";
  const value = (numerator / denominator) * 100;
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
