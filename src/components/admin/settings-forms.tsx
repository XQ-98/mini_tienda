"use client";

import { useState, type ReactNode, useId } from "react";
import Image from "next/image";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { bankAccountSchema, settingsSchema } from "@/lib/validations/admin";
import { issueMap } from "@/lib/validations/issues";
import {
  deleteBankAccountAction,
  removeLogoAction,
  saveBankAccountAction,
  saveSettingsAction,
  saveShippingRatesAction,
  uploadLogoAction,
} from "@/server/actions/admin";

import { Card } from "./ui";
import { useAdminAction } from "./use-admin-action";

type Errors = Record<string, string[] | undefined>;
const dollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));

function Field({ id, label, error, hint, className, children }: { id: string; label: string; error?: string[]; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error?.[0] && <p className="text-xs text-destructive">{error[0]}</p>}
    </div>
  );
}

// ─── Datos de la tienda ─────────────────────────────────────────────────────

export function StoreSettingsForm({
  settings,
}: {
  settings: {
    storeName: string;
    tagline: string | null;
    whatsappNumber: string;
    contactEmail: string;
    address: string | null;
    taxRateBps: number;
    lowStockThreshold: number;
    freeShippingFrom: number | null;
    logoUrl: string | null;
  };
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const { pending, run } = useAdminAction();
  const [errors, setErrors] = useState<Errors>({});

  function submit(formData: FormData) {
    const data = Object.fromEntries(formData);
    const check = settingsSchema.safeParse(data);
    if (!check.success) {
      setErrors(issueMap(check.error));
      return;
    }
    setErrors({});
    run(async () => {
      const result = await saveSettingsAction(data);
      if (!result.ok) setErrors(result.fieldErrors ?? {});
      return result;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LogoForm logoUrl={settings.logoUrl} storeName={settings.storeName} />
      <Card title="Datos de la tienda">
        <form action={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id={fid("storeName")} label="Nombre de la tienda" error={errors.storeName}>
            <Input id={fid("storeName")} name="storeName" defaultValue={settings.storeName} />
          </Field>
          <Field id={fid("tagline")} label="Eslogan" error={errors.tagline}>
            <Input id={fid("tagline")} name="tagline" defaultValue={settings.tagline ?? ""} />
          </Field>
          <Field id={fid("whatsappNumber")} label="WhatsApp" error={errors.whatsappNumber} hint="Formato internacional: 5939XXXXXXXX">
            <Input id={fid("whatsappNumber")} name="whatsappNumber" inputMode="numeric" defaultValue={settings.whatsappNumber} />
          </Field>
          <Field id={fid("contactEmail")} label="Correo de contacto" error={errors.contactEmail}>
            <Input id={fid("contactEmail")} name="contactEmail" type="email" defaultValue={settings.contactEmail} />
          </Field>
          <Field id={fid("address")} label="Dirección" error={errors.address} className="sm:col-span-2">
            <Input id={fid("address")} name="address" defaultValue={settings.address ?? ""} />
          </Field>
          <Field id={fid("taxRatePercent")} label="IVA (%)" error={errors.taxRatePercent} hint="Solo afecta a pedidos nuevos.">
            <Input id={fid("taxRatePercent")} name="taxRatePercent" inputMode="decimal" defaultValue={settings.taxRateBps / 100} />
          </Field>
          <Field id={fid("freeShippingFrom")} label="Envío gratis desde (USD)" error={errors.freeShippingFrom} hint="Déjalo vacío para no ofrecer envío gratis.">
            <Input id={fid("freeShippingFrom")} name="freeShippingFrom" inputMode="decimal" defaultValue={dollars(settings.freeShippingFrom)} />
          </Field>
          <Field id={fid("lowStockThreshold")} label="Alerta de poco stock (unidades)" error={errors.lowStockThreshold}>
            <Input id={fid("lowStockThreshold")} name="lowStockThreshold" type="number" min={0} defaultValue={settings.lowStockThreshold} />
          </Field>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" disabled={pending} className="h-10">
              {pending && <Loader2Icon className="animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function LogoForm({ logoUrl, storeName }: { logoUrl: string | null; storeName: string }) {
  const { pending, run } = useAdminAction();
  return (
    <Card title="Logo">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-16 w-40 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {logoUrl ? (
            <Image src={logoUrl} alt={`Logo de ${storeName}`} fill sizes="160px" className="object-contain p-2" />
          ) : (
            <span className="text-xs text-muted-foreground">Sin logo (se usa el nombre)</span>
          )}
        </div>
        <form action={(fd) => run(() => uploadLogoAction(fd))} className="flex items-center gap-2">
          <Input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="max-w-56" aria-label="Archivo del logo" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Subir
          </Button>
        </form>
        {logoUrl && (
          <Button variant="ghost" disabled={pending} onClick={() => run(() => removeLogoAction())}>
            Quitar logo
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Envíos ─────────────────────────────────────────────────────────────────

export function ShippingRatesForm({
  rates,
}: {
  rates: { provinceCode: string; provinceName: string; cost: number; estimatedDays: string }[];
}) {
  const { pending, run } = useAdminAction();
  const [rows, setRows] = useState(() => rates.map((r) => ({ ...r, cost: dollars(r.cost) })));
  const [bulk, setBulk] = useState("");

  return (
    <Card
      title="Costos de envío por provincia"
      actions={
        <div className="flex items-center gap-2">
          <Input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="Ej. 5.00" className="h-8 w-24" aria-label="Costo para todas" inputMode="decimal" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulk && setRows((r) => r.map((row) => ({ ...row, cost: bulk })))}
          >
            Aplicar a todas
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Provincia</th>
              <th className="py-2 font-medium">Costo (USD, IVA incl.)</th>
              <th className="py-2 font-medium">Tiempo de entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={r.provinceCode}>
                <td className="py-1.5 pr-3">{r.provinceName}</td>
                <td className="py-1.5 pr-3">
                  <Input
                    value={r.cost}
                    inputMode="decimal"
                    aria-label={`Costo ${r.provinceName}`}
                    className="h-8 w-28"
                    onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))}
                  />
                </td>
                <td className="py-1.5">
                  <Input
                    value={r.estimatedDays}
                    aria-label={`Tiempo de entrega ${r.provinceName}`}
                    className="h-8"
                    onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, estimatedDays: e.target.value } : x)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          disabled={pending}
          onClick={() => run(() =>
              saveShippingRatesAction(
                rows.map((r) => ({ provinceCode: r.provinceCode, cost: r.cost, estimatedDays: r.estimatedDays })),
              ),
            )}
          className="h-10"
        >
          {pending && <Loader2Icon className="animate-spin" />} Guardar tarifas
        </Button>
      </div>
    </Card>
  );
}

// ─── Cuentas bancarias ──────────────────────────────────────────────────────

interface Account {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderId: string;
  isActive: boolean;
  sortOrder: number;
}

export function BankAccounts({ accounts }: { accounts: Account[] }) {
  const { pending, run } = useAdminAction();
  return (
    <Card title="Cuentas para transferencias" actions={<BankAccountDialog />}>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Agrega al menos una cuenta para recibir transferencias.</p>
      ) : (
        <ul className="divide-y text-sm" data-testid="bank-accounts">
          {accounts.map((a) => (
            <li key={a.id} className={cn("flex items-center gap-3 py-3", !a.isActive && "opacity-60")}>
              <div className="flex-1">
                <p className="font-medium">
                  {a.bankName} · {a.accountType} {a.isActive ? "" : "(oculta)"}
                </p>
                <p className="font-mono text-muted-foreground">{a.accountNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {a.holderName} · {a.holderId}
                </p>
              </div>
              <BankAccountDialog account={a} />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={`Eliminar cuenta ${a.bankName}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => confirm(`¿Eliminar la cuenta de ${a.bankName}?`) && run(() => deleteBankAccountAction(a.id))}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BankAccountDialog({ account }: { account?: Account }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [active, setActive] = useState(account?.isActive ?? true);
  const { pending, run } = useAdminAction();

  function submit(formData: FormData) {
    const data = { ...Object.fromEntries(formData), id: account?.id, isActive: active };
    const check = bankAccountSchema.safeParse(data);
    if (!check.success) {
      setErrors(issueMap(check.error));
      toast.error("Revisa los campos marcados.");
      return;
    }
    run(async () => {
      const result = await saveBankAccountAction(data);
      if (!result.ok) setErrors(result.fieldErrors ?? {});
      return result;
    }, () => setOpen(false));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {account ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar cuenta ${account.bankName}`}>
            <PencilIcon />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PlusIcon /> Agregar cuenta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>
        <form action={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field id={fid("bankName")} label="Banco" error={errors.bankName}>
            <Input id={fid("bankName")} name="bankName" defaultValue={account?.bankName} placeholder="Banco Pichincha" />
          </Field>
          <Field id={fid("accountType")} label="Tipo" error={errors.accountType}>
            <select id={fid("accountType")} name="accountType" defaultValue={account?.accountType ?? "Ahorros"} className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm">
              <option>Ahorros</option>
              <option>Corriente</option>
            </select>
          </Field>
          <Field id={fid("accountNumber")} label="Número de cuenta" error={errors.accountNumber}>
            <Input id={fid("accountNumber")} name="accountNumber" inputMode="numeric" defaultValue={account?.accountNumber} />
          </Field>
          <Field id={fid("sortOrder")} label="Orden" error={errors.sortOrder}>
            <Input id={fid("sortOrder")} name="sortOrder" type="number" min={0} defaultValue={account?.sortOrder ?? 0} />
          </Field>
          <Field id={fid("holderName")} label="Titular" error={errors.holderName}>
            <Input id={fid("holderName")} name="holderName" defaultValue={account?.holderName} />
          </Field>
          <Field id={fid("holderId")} label="Cédula o RUC del titular" error={errors.holderId}>
            <Input id={fid("holderId")} name="holderId" inputMode="numeric" defaultValue={account?.holderId} />
          </Field>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <Switch checked={active} onCheckedChange={setActive} aria-label="Mostrar a los clientes" /> Mostrar a los clientes
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
