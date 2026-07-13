/** Deterministic day-first date formatting — never depends on browser/ICU locale data. */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function fmtDate(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtDateTime(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${fmtDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtTime(input: string | number | Date): string {
  const d = new Date(input);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
