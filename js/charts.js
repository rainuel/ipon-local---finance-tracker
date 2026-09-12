import { formatPeso } from "./money.js";

const CHART_FONT = "font-family: 'Inter', system-ui, sans-serif;";

/** Horizontal bar chart, e.g. "Spending by category". */
export function buildHorizontalBarChart(entries, { width = 560 } = {}) {
  // entries: [{ label, valueCentavos }], already sorted by caller
  if (entries.length === 0) {
    return `<p class="chart-empty">Not enough data yet.</p>`;
  }

  const rowHeight = 34;
  const height = entries.length * rowHeight + 16;
  const maxValue = Math.max(...entries.map((e) => e.valueCentavos), 1);
  const labelWidth = 128;
  const barAreaWidth = width - labelWidth - 90;

  const bars = entries
    .map((entry, i) => {
      const y = i * rowHeight + 8;
      const barWidth = Math.max((entry.valueCentavos / maxValue) * barAreaWidth, 2);
      return `
        <text x="0" y="${y + 17}" style="${CHART_FONT}" font-size="13" fill="var(--ink-soft)">${escapeXml(
        truncate(entry.label, 16)
      )}</text>
        <rect x="${labelWidth}" y="${y + 4}" width="${barWidth}" height="16" rx="4" fill="var(--accent-teal)" />
        <text x="${labelWidth + barWidth + 8}" y="${y + 17}" style="${CHART_FONT}" font-size="12" fill="var(--ink)">${escapeXml(
        formatPeso(entry.valueCentavos)
      )}</text>
      `;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Spending by category bar chart">${bars}</svg>`;
}

/** Line chart for a trend across months, e.g. income vs expenses, or savings. */
export function buildLineChart(series, { width = 560, height = 220 } = {}) {
  // series: [{ name, color, points: [{label, valueCentavos}] }]
  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return `<p class="chart-empty">Not enough data yet.</p>`;
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...allPoints.map((p) => p.valueCentavos), 0);
  const minValue = Math.min(...allPoints.map((p) => p.valueCentavos), 0);
  const range = maxValue - minValue || 1;

  const pointCount = series[0].points.length;
  const stepX = pointCount > 1 ? chartWidth / (pointCount - 1) : 0;

  function toX(index) {
    return padding.left + index * stepX;
  }
  function toY(value) {
    return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  }

  const zeroY = toY(0);
  const axisLine = `<line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" />`;

  const labels = series[0].points
    .map(
      (p, i) =>
        `<text x="${toX(i)}" y="${height - 8}" style="${CHART_FONT}" font-size="11" fill="var(--ink-soft)" text-anchor="middle">${escapeXml(
          p.label
        )}</text>`
    )
    .join("");

  const lines = series
    .map((s) => {
      const pathD = s.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.valueCentavos)}`)
        .join(" ");
      const dots = s.points
        .map(
          (p, i) =>
            `<circle cx="${toX(i)}" cy="${toY(p.valueCentavos)}" r="3.5" fill="${s.color}" />`
        )
        .join("");
      return `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />${dots}`;
    })
    .join("");

  const legend = series
    .map(
      (s, i) =>
        `<circle cx="${padding.left + i * 110}" cy="8" r="4" fill="${s.color}" /><text x="${
          padding.left + i * 110 + 10
        }" y="12" style="${CHART_FONT}" font-size="11" fill="var(--ink-soft)">${escapeXml(s.name)}</text>`
    )
    .join("");

  return `<svg viewBox="0 0 ${width} ${height + 20}" width="100%" height="${height + 20}" role="img" aria-label="Trend line chart">
    ${legend}
    <g transform="translate(0, 20)">
      ${axisLine}
      ${lines}
      ${labels}
    </g>
  </svg>`;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
