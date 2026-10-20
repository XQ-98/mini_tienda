"use client";

import { useActionState, useState, type FormEvent, useId } from "react";
import Link from "next/link";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { loginAction, registerAction, type AuthFormState } from "@/server/actions/auth";

type FieldErrors = Record<string, string[] | undefined>;

/**
 * Valida en el navegador con el mismo esquema Zod que usa el servidor:
 * respuesta inmediata para el usuario, sin confiar en ella para la seguridad.
 */
function useClientValidation(schema: z.ZodType) {
  const [errors, setErrors] = useState<FieldErrors>({});
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const result = schema.safeParse(data);
    if (!result.success) {
      e.preventDefault();
      setErrors(z.flattenError(result.error).fieldErrors as FieldErrors);
    } else {
      setErrors({});
    }
  }
  return { errors, onSubmit };
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.[0] && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="h-11 pr-11 text-base sm:text-sm" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

const inputClass = "h-11 text-base sm:text-sm";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  const client = useClientValidation(loginSchema);
  const errors = { ...state.fieldErrors, ...client.errors };

  return (
    <form action={action} onSubmit={client.onSubmit} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert variant="destructive" role="alert" data-testid="form-error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <Field id={fid("email")} label="Correo electrónico" error={errors.email}>
        <Input
          id={fid("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state.values?.email}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${fid("email")}-error` : undefined}
          className={inputClass}
        />
      </Field>
      <Field id={fid("password")} label="Contraseña" error={errors.password}>
        <PasswordInput
          id={fid("password")}
          name="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? `${fid("password")}-error` : undefined}
        />
      </Field>

      <Button type="submit" size="lg" className="mt-2 h-11 text-base" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />} Ingresar
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link
          href={callbackUrl ? `/registro?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/registro"}
          className="font-medium text-primary hover:underline"
        >
          Crea una
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  const client = useClientValidation(registerSchema);
  const errors = { ...state.fieldErrors, ...client.errors };
  const v = state.values ?? {};

  return (
    <form action={action} onSubmit={client.onSubmit} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert variant="destructive" role="alert" data-testid="form-error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <Field id={fid("name")} label="Nombre completo" error={errors.name}>
        <Input id={fid("name")} name="name" autoComplete="name" defaultValue={v.name} aria-invalid={!!errors.name} className={inputClass} />
      </Field>
      <Field id={fid("email")} label="Correo electrónico" error={errors.email}>
        <Input
          id={fid("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={v.email}
          aria-invalid={!!errors.email}
          className={inputClass}
        />
      </Field>
      <Field id={fid("phone")} label="Celular (opcional)" error={errors.phone}>
        <Input
          id={fid("phone")}
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="numeric"
          placeholder="09XXXXXXXX"
          defaultValue={v.phone}
          aria-invalid={!!errors.phone}
          className={inputClass}
        />
      </Field>
      <Field id={fid("password")} label="Contraseña" error={errors.password}>
        <PasswordInput id={fid("password")} name="password" autoComplete="new-password" aria-invalid={!!errors.password} />
        {!errors.password && (
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, con al menos una letra y un número.</p>
        )}
      </Field>
      <Field id={fid("confirmPassword")} label="Confirmar contraseña" error={errors.confirmPassword}>
        <PasswordInput
          id={fid("confirmPassword")}
          name="confirmPassword"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
        />
      </Field>

      <Button type="submit" size="lg" className="mt-2 h-11 text-base" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />} Crear cuenta
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={callbackUrl ? `/ingresar?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/ingresar"}
          className="font-medium text-primary hover:underline"
        >
          Ingresa
        </Link>
      </p>
    </form>
  );
}
