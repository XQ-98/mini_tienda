// Fechas en hora de Ecuador continental (UTC-5, sin horario de verano).
// "Ventas de hoy" debe usar el día de Ecuador, no el del servidor (Vercel corre
// en UTC: a las 20:00 en Quito ya es "mañana" en UTC).

const OFFSET_MS = 5 * 60 * 60 * 1000;

/** Fecha "de pared" en Ecuador expresada con los campos UTC de un Date. */
const wall = (d: Date) => new Date(d.getTime() - OFFSET_MS);
const fromWall = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day) + OFFSET_MS);

/** Inicio (00:00 en Ecuador) del día que contiene `date`. */
export function ecuadorDayStart(date: Date): Date {
  const w = wall(date);
  return fromWall(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
}

/** Inicio (día 1, 00:00 en Ecuador) del mes que contiene `date`. */
export function ecuadorMonthStart(date: Date): Date {
  const w = wall(date);
  return fromWall(w.getUTCFullYear(), w.getUTCMonth(), 1);
}

/** "2026-10-20" según el calendario de Ecuador. */
export function ecuadorDateKey(date: Date): string {
  return wall(date).toISOString().slice(0, 10);
}

/** Los últimos `n` días (incluido hoy) como claves YYYY-MM-DD, del más antiguo al más reciente. */
export function lastDays(now: Date, n: number): string[] {
  const today = ecuadorDayStart(now).getTime();
  return Array.from({ length: n }, (_, i) => ecuadorDateKey(new Date(today - (n - 1 - i) * 86_400_000)));
}
