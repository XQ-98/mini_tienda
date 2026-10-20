"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  name?: string;
  className?: string;
}

export function QuantityStepper({ value, min = 1, max, onChange, disabled, label = "Cantidad", name, className }: Props) {
  return (
    <div className={cn("inline-flex h-11 items-center rounded-lg border bg-card", className)} role="group" aria-label={label}>
      <button
        type="button"
        className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label="Disminuir cantidad"
      >
        <MinusIcon className="size-4" />
      </button>
      <output className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {value}
      </output>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label="Aumentar cantidad"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
