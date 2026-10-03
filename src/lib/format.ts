/**
 * 2026-10-03: every date on the site is an ISO date set in the monospace face, so dates line up in a
 * column like trace timestamps. Dates are calendar dates, kept in UTC.
 */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Axis labels: whole numbers stay whole, halves keep one decimal. */
export function tickLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Section durations in the contents rail: "40 s" in 5 s steps below a minute, "2.1 min" from there up.
 * Whatever rounds to 60 s is written "1 min", so one duration never has two spellings.
 */
export function sectionDuration(seconds: number): string {
  const rounded = Math.max(5, Math.round(seconds / 5) * 5);
  if (rounded < 60) return `${rounded} s`;
  const minutes = Math.round((seconds / 60) * 10) / 10;
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
}

export const pct = (value: number, max: number) => `${max > 0 ? +((value / max) * 100).toFixed(3) : 0}%`;

/**
 * Titles are split after a colon (full-width "：" or ": ") into segments that are set as inline
 * blocks, so a narrow screen breaks the line after the colon instead of inside a phrase.
 */
export function titleSegments(title: string): string[] {
  // A full-width colon stays on its segment; ": " loses the space, which TitleSegments puts back.
  return title.split(/(?<=：)|(?<=:) /).filter((segment) => segment.length > 0);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
