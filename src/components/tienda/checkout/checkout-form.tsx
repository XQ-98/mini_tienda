"use client";

import { useActionState, useMemo, useState, type FormEvent, type ReactNode, useId } from "react";
import Image from "next/image";
import { BuildingIcon, CreditCardIcon, LandmarkIcon, Loader2Icon, LockIcon, ReceiptIcon } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROVINCES, getProvince } from "@/lib/data/ecuador";
import { validateEcId } from "@/lib/domain/ec-id";
import { formatUSD } from "@/lib/domain/money";
import { CONSUMIDOR_FINAL_MAX, computeOrderTotals, exceedsConsumidorFinal } from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";
import { checkoutSchema } from "@/lib/validations/checkout";
import { placeOrderAction, type CheckoutState } from "@/server/actions/checkout";

type FieldErrors = Record<string, string[] | undefined>;

export interface CheckoutLine {
  variantId: string;
  name: string;
  variantLabel: string;
  image: { url: string; alt: string } | null;
  unitPrice: number;
  quantity: number;
}

interface Props {
  lines: CheckoutLine[];
  rates: Record<string, { cost: number; estimatedDays: string }>;
  taxRateBps: number;
  freeShippingFrom: number | null;
  defaults: {
    shipName: string;
    shipPhone: string;
    shipProvince: string;
    shipCity: string;
    shipAddress: string;
    shipReference: string;
    billEmail: string;
  };
}

export function CheckoutForm({ lines, rates, taxRateBps, freeShippingFrom, defaults }: Props) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrderAction, {});
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const errors: FieldErrors = { ...state.fieldErrors, ...clientErrors };

  const [province, setProvince] = useState(defaults.shipProvince);
  const [city, setCity] = useState(defaults.shipCity);
  const [billingType, setBillingType] = useState<"consumidor_final" | "datos">("consumidor_final");
  const [paymentMethod, setPaymentMethod] = useState<"PAYPHONE" | "BANK_TRANSFER">("PAYPHONE");
  const [billId, setBillId] = useState("");

  const rate = rates[province];
  const totals = useMemo(
    () =>
      computeOrderTotals({
        lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
        rateCost: rate?.cost ?? 0,
        freeShippingFrom,
        taxRateBps,
      }),
    [lines, rate, freeShippingFrom, taxRateBps],
  );
  const mustInvoice = exceedsConsumidorFinal(totals.total);
  const effectiveBilling = mustInvoice ? "datos" : billingType;
  const idCheck = billId.length >= 10 ? validateEcId(billId) : null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const result = checkoutSchema.safeParse(data);
    if (!result.success) {
      e.preventDefault();
      setClientErrors(z.flattenError(result.error).fieldErrors as FieldErrors);
      // Lleva al primer campo con error (importante en celular)
      const first = Object.keys(z.flattenError(result.error).fieldErrors)[0];
      const field = e.currentTarget.elements.namedItem(first);
      if (field instanceof HTMLElement) field.focus();
    } else {
      setClientErrors({});
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col gap-8">
        {state.error && (
          <Alert variant="destructive" role="alert" data-testid="checkout-error">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <Section number={1} title="Datos de envío">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={fid("shipName")} label="Nombre de quien recibe" error={errors.shipName} className="sm:col-span-2">
              <Input id={fid("shipName")} name="shipName" autoComplete="name" defaultValue={defaults.shipName} className="h-11" />
            </Field>
            <Field id={fid("shipPhone")} label="Celular" error={errors.shipPhone}>
              <Input
                id={fid("shipPhone")}
                name="shipPhone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="09XXXXXXXX"
                defaultValue={defaults.shipPhone}
                className="h-11"
              />
            </Field>
            <Field id={fid("shipProvince")} label="Provincia" error={errors.shipProvince}>
              <NativeSelect
                id={fid("shipProvince")}
                name="shipProvince"
                value={province}
                onChange={(v) => {
                  setProvince(v);
                  setCity("");
                }}
              >
                <option value="">Elige una provincia</option>
                {PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id={fid("shipCity")} label="Ciudad / cantón" error={errors.shipCity}>
              <NativeSelect id={fid("shipCity")} name="shipCity" value={city} onChange={setCity} disabled={!province}>
                <option value="">{province ? "Elige una ciudad" : "Primero elige la provincia"}</option>
                {getProvince(province)?.cantons.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {rate && (
              <p className="self-end pb-3 text-sm text-muted-foreground">
                Entrega estimada: <span className="text-foreground">{rate.estimatedDays}</span>
              </p>
            )}
            <Field id={fid("shipAddress")} label="Dirección" error={errors.shipAddress} className="sm:col-span-2">
              <Input
                id={fid("shipAddress")}
                name="shipAddress"
                autoComplete="street-address"
                placeholder="Calle principal, número y calle secundaria"
                defaultValue={defaults.shipAddress}
                className="h-11"
              />
            </Field>
            <Field id={fid("shipReference")} label="Referencia (opcional)" error={errors.shipReference} className="sm:col-span-2">
              <Textarea
                id={fid("shipReference")}
                name="shipReference"
                rows={2}
                placeholder="Casa blanca de dos pisos, frente al parque"
                defaultValue={defaults.shipReference}
              />
            </Field>
          </div>
        </Section>

        <Section number={2} title="Factura">
          <input type="hidden" name="billingType" value={effectiveBilling} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              name="billingChoice"
              checked={effectiveBilling === "consumidor_final"}
              disabled={mustInvoice}
              onSelect={() => setBillingType("consumidor_final")}
              icon={<ReceiptIcon />}
              title="Consumidor final"
              description={
                mustInvoice
                  ? `No disponible en compras mayores a ${formatUSD(CONSUMIDOR_FINAL_MAX)} (norma del SRI)`
                  : "Sin datos personales en la factura"
              }
            />
            <ChoiceCard
              name="billingChoice"
              checked={effectiveBilling === "datos"}
              onSelect={() => setBillingType("datos")}
              icon={<BuildingIcon />}
              title="Con cédula o RUC"
              description="Para deducir gastos o facturar a tu empresa"
            />
          </div>

          {effectiveBilling === "datos" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id={fid("billId")} label="Cédula o RUC" error={errors.billId}>
                <Input
                  id={fid("billId")}
                  name="billId"
                  inputMode="numeric"
                  maxLength={13}
                  value={billId}
                  onChange={(e) => setBillId(e.target.value.replace(/\D/g, ""))}
                  aria-invalid={idCheck ? !idCheck.valid : undefined}
                  className="h-11"
                />
                {idCheck && !errors.billId && (
                  <p className={cn("text-xs", idCheck.valid ? "text-success" : "text-destructive")}>
                    {idCheck.valid
                      ? idCheck.type === "CEDULA"
                        ? "Cédula válida"
                        : "RUC válido"
                      : idCheck.reason}
                  </p>
                )}
              </Field>
              <Field id={fid("billName")} label="Nombre o razón social" error={errors.billName}>
                <Input id={fid("billName")} name="billName" autoComplete="organization" defaultValue={defaults.shipName} className="h-11" />
              </Field>
              <Field id={fid("billEmail")} label="Correo para la factura electrónica" error={errors.billEmail} className="sm:col-span-2">
                <Input
                  id={fid("billEmail")}
                  name="billEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  defaultValue={defaults.billEmail}
                  className="h-11"
                />
              </Field>
            </div>
          )}
        </Section>

        <Section number={3} title="Pago">
          <input type="hidden" name="paymentMethod" value={paymentMethod} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              name="paymentChoice"
              checked={paymentMethod === "PAYPHONE"}
              onSelect={() => setPaymentMethod("PAYPHONE")}
              icon={<CreditCardIcon />}
              title="Tarjeta de crédito o débito"
              description="Pago seguro con Payphone. Visa, Mastercard, Diners."
            />
            <ChoiceCard
              name="paymentChoice"
              checked={paymentMethod === "BANK_TRANSFER"}
              onSelect={() => setPaymentMethod("BANK_TRANSFER")}
              icon={<LandmarkIcon />}
              title="Transferencia bancaria"
              description="Te mostramos las cuentas y subes tu comprobante."
            />
          </div>
          {errors.paymentMethod?.[0] && <p className="mt-2 text-sm text-destructive">{errors.paymentMethod[0]}</p>}
        </Section>
      </div>

      <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-24" aria-label="Resumen del pedido">
        <h2 className="font-heading text-lg font-semibold">Tu pedido</h2>
        <ul className="mt-4 divide-y">
          {lines.map((l) => (
            <li key={l.variantId} className="flex gap-3 py-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {l.image && <Image src={l.image.url} alt={l.image.alt} fill sizes="56px" className="object-cover" />}
                <span className="absolute -top-0 -right-0 rounded-bl-md bg-foreground/80 px-1.5 text-[11px] text-background">
                  ×{l.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-1 font-medium">{l.name}</p>
                <p className="text-muted-foreground">{l.variantLabel}</p>
              </div>
              <p className="text-sm tabular-nums">{formatUSD(l.unitPrice * l.quantity)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-2 space-y-2 border-t pt-4 text-sm" data-testid="checkout-totals">
          <Row label="Productos" value={formatUSD(totals.itemsTotal)} />
          <Row
            label="Envío"
            value={!rate ? "Elige la provincia" : totals.shipping === 0 ? "Gratis" : formatUSD(totals.shipping)}
          />
          <Row label="Subtotal sin IVA" value={formatUSD(totals.subtotal)} muted />
          <Row label={`IVA ${taxRateBps / 100}%`} value={formatUSD(totals.tax)} muted />
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="checkout-total">
              {formatUSD(totals.total)}
            </dd>
          </div>
        </dl>

        <Button type="submit" size="lg" className="mt-5 h-12 w-full text-base" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
          {paymentMethod === "PAYPHONE" ? "Pagar" : "Confirmar pedido"} · {formatUSD(totals.total)}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Los precios incluyen IVA. Al confirmar aceptas los términos de compra.
        </p>
      </aside>
    </form>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-heading text-lg font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error?.[0] && (
        <p className="text-sm text-destructive" data-field-error={id}>
          {error[0]}
        </p>
      )}
    </div>
  );
}

// Select nativo: en celular abre el selector del sistema, más cómodo que un menú propio.
function NativeSelect({
  id,
  name,
  value,
  onChange,
  disabled,
  children,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm"
    >
      {children}
    </select>
  );
}

function ChoiceCard({
  name,
  checked,
  disabled,
  onSelect,
  icon,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border p-4 transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary bg-primary/5" : "hover:border-foreground/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onSelect} className="sr-only" />
      <span className={cn("mt-0.5 [&_svg]:size-5", checked ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", muted && "text-xs text-muted-foreground")}>
      <dt className={muted ? undefined : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
