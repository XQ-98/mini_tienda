import type { ReactNode } from "react";

export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Cargando formulario">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-11 animate-pulse rounded-lg bg-muted" />
        </div>
      ))}
      <div className="h-11 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
