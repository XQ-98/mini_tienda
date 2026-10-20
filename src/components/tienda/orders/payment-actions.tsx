"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckIcon, CopyIcon, CreditCardIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  cancelOrderAction,
  changePaymentMethodAction,
  payWithCardAction,
  uploadProofAction,
  type UploadProofState,
} from "@/server/actions/orders";

export function PayWithCardButton({ orderNumber, label }: { orderNumber: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="h-12 w-full text-base sm:w-auto"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await payWithCardAction(orderNumber);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <CreditCardIcon />} {label}
    </Button>
  );
}

export function UploadProofForm({ orderNumber, retry }: { orderNumber: number; retry?: boolean }) {
  const [state, action, pending] = useActionState<UploadProofState, FormData>(
    uploadProofAction.bind(null, orderNumber),
    { status: "idle" },
  );
  const [fileName, setFileName] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.status === "error" && (
        <Alert variant="destructive" role="alert" data-testid="upload-error">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <UploadIcon className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">{fileName || (retry ? "Sube un nuevo comprobante" : "Toca para subir tu comprobante")}</span>
        <span className="text-xs text-muted-foreground">Foto o captura (JPG, PNG, WEBP) o PDF · máx. 5 MB</span>
        <input
          type="file"
          name="proof"
          required
          // En iPhone, limitar a JPEG/PNG hace que las fotos HEIC se conviertan a JPEG
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </label>
      <Button type="submit" size="lg" className="h-11" disabled={pending || !fileName}>
        {pending && <Loader2Icon className="animate-spin" />} Enviar comprobante
      </Button>
    </form>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
      aria-label={`Copiar ${label}`}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export function OrderSecondaryActions({
  orderNumber,
  canCancel,
  switchTo,
}: {
  orderNumber: number;
  canCancel: boolean;
  switchTo: "PAYPHONE" | "BANK_TRANSFER" | null;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error: string } | void>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else toast.success(success);
    });

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {switchTo && (
        <button
          type="button"
          disabled={pending}
          className="text-primary hover:underline disabled:opacity-50"
          onClick={() => run(() => changePaymentMethodAction(orderNumber, switchTo), "Método de pago actualizado")}
        >
          {switchTo === "BANK_TRANSFER" ? "Prefiero pagar por transferencia" : "Prefiero pagar con tarjeta"}
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
          onClick={() => {
            if (confirm("¿Cancelar este pedido?")) run(() => cancelOrderAction(orderNumber), "Pedido cancelado");
          }}
        >
          Cancelar pedido
        </button>
      )}
    </div>
  );
}
