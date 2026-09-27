export const PAGE_SIZES = [10, 25, 50, 100] as const;

export function pageSizeOf(raw: string | undefined): number {
  const size = Number(raw);
  return PAGE_SIZES.some((value) => value === size) ? size : 25;
}

export function pageOf(raw: string | undefined): number {
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, 10000);
}

export function slicePage<T>(rows: T[], page: number, size: number): {
  rows: T[];
  page: number;
  pages: number;
} {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pages };
}

export function periodGap(left: number, right: number): { gap: number; percent: string } {
  const gap = right - left;
  if (left === 0) return { gap, percent: right === 0 ? "0 %" : "—" };
  const ratio = Math.round((gap / left) * 1000) / 10;
  const text = Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1).replace(".", ",");
  return { gap, percent: `${text} %` };
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function inDayRange(date: Date, from: string, to: string): boolean {
  const day = dayKey(date);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function monthBounds(anchor: Date, offset: number): { from: string; to: string } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + offset + 1, 0);
  return { from: dayKey(start), to: dayKey(end) };
}

export function csvTable(headers: string[], rows: string[][]): string {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = [headers, ...rows].map((row) => row.map(cell).join(";"));
  return `\uFEFF${lines.join("\n")}`;
}
