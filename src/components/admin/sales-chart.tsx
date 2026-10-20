"use client";

import { useState } from "react";

import { formatUSD } from "@/lib/domain/money";

interface Point {
  date: string; // YYYY-MM-DD (Ecuador)
  total: number; // centavos
}

const dayLabel = new Intl.DateTimeFormat("es-EC", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortLabel = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", timeZone: "UTC" });
const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

/** Tope "redondo" del eje: 0, 50, 100… en dólares. */
function niceMax(maxCents: number): number {
  const max = Math.max(maxCents / 100, 1);
  const step = 10 ** Math.floor(Math.log10(max));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= max) ?? 10 * step;
  return nice * 100;
}

const compact = (cents: number) => {
  const d = cents / 100;
  return d >= 1000 ? `$${(d / 1000).toLocaleString("es-EC", { maximumFractionDigits: 1 })}K` : `$${d.toLocaleString("es-EC")}`;
};

/**
 * Columnas de ventas diarias. Una sola serie: un solo color (el de la marca),
 * sin leyenda (el título dice qué se grafica). Cada columna es su propia zona
 * de hover/foco con tooltip; los mismos datos están en la tabla accesible.
 */
export function SalesChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...data.map((d) => d.total)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const total = data.reduce((n, d) => n + d.total, 0);
  const current = active !== null ? data[active] : null;

  return (
    <figure>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <figcaption className="font-heading text-lg font-semibold">Ventas de los últimos 30 días</figcaption>
        <p className="text-sm text-muted-foreground">
          Total <span className="font-semibold text-foreground">{formatUSD(total)}</span>
        </p>
      </div>

      {/* pt-2: la etiqueta superior del eje no choca con el título */}
      <div className="flex gap-2 pt-2">
        {/* Eje Y */}
        <div className="relative h-48 w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Líneas guía: finas y recesivas */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>

          <ul className="relative flex h-48 items-end gap-0.5" aria-label="Ventas por día">
            {data.map((d, i) => (
              <li key={d.date} className="flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  className="group flex h-full w-full items-end justify-center outline-none"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${dayLabel.format(asDate(d.date))}: ${formatUSD(d.total)}`}
                >
                  <span
                    className="block w-full max-w-6 rounded-t bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                    style={{ height: d.total > 0 ? `max(${(d.total / top) * 100}%, 3px)` : 0 }}
                  />
                </button>
              </li>
            ))}
          </ul>

          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-md"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            >
              <p className="text-muted-foreground capitalize">{dayLabel.format(asDate(current.date))}</p>
              <p className="text-sm font-semibold tabular-nums">{formatUSD(current.total)}</p>
            </div>
          )}

          {/* Eje X: una etiqueta cada 7 días para no saturar */}
          <div className="mt-2 flex text-[11px] text-muted-foreground" aria-hidden>
            {data.map((d, i) => (
              <span key={d.date} className="flex-1 text-center whitespace-nowrap">
                {(data.length - 1 - i) % 7 === 0 ? shortLabel.format(asDate(d.date)) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver como tabla</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">Día</th>
              <th className="py-1 text-right font-medium">Ventas</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((d) => (
              <tr key={d.date} className="border-t">
                <td className="py-1 capitalize">{dayLabel.format(asDate(d.date))}</td>
                <td className="py-1 text-right">{formatUSD(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
