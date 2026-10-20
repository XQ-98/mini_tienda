"use client";

import { useState, useId } from "react";
import { CheckIcon, Loader2Icon, PackageCheckIcon, TruckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatusValue } from "@/lib/domain/order-status";
import {
  approvePaymentAction,
  confirmReviewedAction,
  rejectPaymentAction,
  transitionOrderAction,
} from "@/server/actions/admin";

import { useAdminAction } from "./use-admin-action";

type DialogKind = "ship" | "deliver" | "cancel" | null;

/** Botones para avanzar el pedido. Solo muestra las transiciones permitidas. */
export function OrderStatusActions({
  orderNumber,
  status,
  allowed,
}: {
  orderNumber: number;
  status: OrderStatusValue;
  allowed: readonly OrderStatusValue[];
}) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const { pending, run } = useAdminAction();
  const [open, setOpen] = useState<DialogKind>(null);
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

  const transition = (to: OrderStatusValue, extra: { trackingCode?: string; note?: string } = {}) =>
    run(() => transitionOrderAction({ orderNumber, to, ...extra }), () => setOpen(null));

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.includes("SHIPPED") && (
        <Button onClick={() => setOpen("ship")} className="h-10">
          <TruckIcon /> Marcar como enviado
        </Button>
      )}
      {allowed.includes("DELIVERED") && (
        <Button onClick={() => setOpen("deliver")} className="h-10">
          <PackageCheckIcon /> Marcar como entregado
        </Button>
      )}
      {allowed.includes("CANCELLED") && (
        <Button variant="outline" onClick={() => setOpen("cancel")} className="h-10 text-destructive">
          <XIcon /> Cancelar pedido
        </Button>
      )}

      <Dialog open={open === "ship"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pedido #{orderNumber} como enviado</DialogTitle>
            <DialogDescription>El cliente verá el número de guía en su pedido.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("tracking")}>Número de guía</Label>
            <Input id={fid("tracking")} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ej. Servientrega 123456789" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Volver
            </Button>
            <Button disabled={pending || tracking.trim().length < 3} onClick={() => transition("SHIPPED", { trackingCode: tracking.trim() })}>
              {pending && <Loader2Icon className="animate-spin" />} Confirmar envío
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "deliver"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿El pedido #{orderNumber} fue entregado?</DialogTitle>
            <DialogDescription>Este es el estado final del pedido.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Volver
            </Button>
            <Button disabled={pending} onClick={() => transition("DELIVERED")}>
              {pending && <Loader2Icon className="animate-spin" />} Sí, entregado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "cancel"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar pedido #{orderNumber}</DialogTitle>
            <DialogDescription>
              {status === "PAID"
                ? "El pedido ya está pagado: las unidades vuelven al stock y debes reembolsar el pago al cliente."
                : "El cliente ya no podrá pagar este pedido."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("cancel-note")}>Motivo (opcional, queda en el historial)</Label>
            <Textarea id={fid("cancel-note")} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Volver
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => transition("CANCELLED", { note: note.trim() || undefined })}>
              {pending && <Loader2Icon className="animate-spin" />} Cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Aprobar o rechazar un comprobante de transferencia en revisión. */
export function PaymentReviewActions({ paymentId }: { paymentId: string }) {
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const { pending, run } = useAdminAction();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setMode("approve")} className="h-10">
        <CheckIcon /> Aprobar pago
      </Button>
      <Button variant="outline" onClick={() => setMode("reject")} className="h-10">
        <XIcon /> Rechazar
      </Button>

      <Dialog open={mode === "approve"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Aprobar este pago?</DialogTitle>
            <DialogDescription>
              Confirma que el dinero llegó a la cuenta. El pedido pasará a Pagado y se descontará el stock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Volver
            </Button>
            <Button disabled={pending} onClick={() => run(() => approvePaymentAction(paymentId), () => setMode(null))}>
              {pending && <Loader2Icon className="animate-spin" />} Aprobar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "reject"} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar comprobante</DialogTitle>
            <DialogDescription>El cliente verá el motivo y podrá subir un comprobante nuevo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fid("reject-reason")}>Motivo</Label>
            <Textarea
              id={fid("reject-reason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej. El monto transferido no coincide con el total del pedido"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim().length < 5}
              onClick={() => run(() => rejectPaymentAction({ paymentId, reason: reason.trim() }), () => setMode(null))}
            >
              {pending && <Loader2Icon className="animate-spin" />} Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ConfirmReviewedButton({ orderNumber }: { orderNumber: number }) {
  const { pending, run } = useAdminAction();
  return (
    <Button disabled={pending} onClick={() => run(() => confirmReviewedAction(orderNumber))} className="h-10">
      {pending && <Loader2Icon className="animate-spin" />} Reintentar confirmación
    </Button>
  );
}
