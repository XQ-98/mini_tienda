import { ClockIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatUSD } from "@/lib/domain/money";
import { getBankAccounts } from "@/server/queries/orders";
import type { UserOrder } from "@/server/queries/orders";

import { CopyButton, OrderSecondaryActions, PayWithCardButton, UploadProofForm } from "./payment-actions";

/** Qué puede hacer el cliente para pagar un pedido pendiente. */
export async function PaymentPanel({ order }: { order: UserOrder }) {
  if (order.status !== "PENDING_PAYMENT") return null;

  const latest = order.payments.find((p) => p.method === order.paymentMethod);
  const inReview = order.payments.some((p) => p.status === "IN_REVIEW");
  const approved = order.payments.some((p) => p.status === "APPROVED");
  const canChange = !inReview && !approved;

  // Pago aprobado pero pedido aún pendiente: el admin lo está revisando (p. ej. sin stock)
  if (approved) {
    return (
      <Panel title="Pago recibido">
        <p className="text-sm text-muted-foreground">
          Recibimos tu pago y estamos revisando el pedido. Te contactaremos si hace falta algo más.
        </p>
      </Panel>
    );
  }

  if (order.paymentMethod === "PAYPHONE") {
    return (
      <Panel title="Pagar con tarjeta">
        <p className="mb-4 text-sm text-muted-foreground">
          Tu pedido está reservado. Completa el pago de forma segura con Payphone.
        </p>
        <PayWithCardButton orderNumber={order.number} label={`Pagar ${formatUSD(order.total)}`} />
        <div className="mt-4">
          <OrderSecondaryActions orderNumber={order.number} canCancel={canChange} switchTo={canChange ? "BANK_TRANSFER" : null} />
        </div>
      </Panel>
    );
  }

  const accounts = await getBankAccounts();

  return (
    <Panel title="Pagar por transferencia">
      {inReview ? (
        <div className="flex items-start gap-3 rounded-lg bg-secondary p-4 text-sm" data-testid="proof-in-review">
          <ClockIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Comprobante en revisión</p>
            <p className="text-muted-foreground">Lo verificamos en horario laboral y te avisaremos al confirmar el pago.</p>
            {latest?.proofStorageId && (
              <a
                href={`/api/comprobantes/${latest.id}`}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                <FileTextIcon className="size-4" /> Ver comprobante enviado
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {latest?.status === "REJECTED" && (
            <Alert variant="destructive" className="mb-4">
              <TriangleAlertIcon />
              <AlertDescription>
                Tu comprobante anterior fue rechazado: {latest.rejectionReason ?? "sin detalle"}. Sube uno nuevo.
              </AlertDescription>
            </Alert>
          )}
          <ol className="mb-5 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Transfiere <span className="font-semibold text-foreground">{formatUSD(order.total)}</span> a una de estas cuentas.
            </li>
            <li>
              Usa como referencia <span className="font-semibold text-foreground">Pedido #{order.number}</span>.
            </li>
            <li>Sube aquí la foto o captura del comprobante.</li>
          </ol>
          <ul className="mb-5 grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => (
              <li key={a.id} className="rounded-lg border p-4 text-sm">
                <p className="font-semibold">{a.bankName}</p>
                <p className="text-muted-foreground">Cuenta {a.accountType.toLowerCase()}</p>
                <p className="mt-1 flex items-center gap-2 font-mono text-base">
                  {a.accountNumber} <CopyButton value={a.accountNumber} label="número de cuenta" />
                </p>
                <p className="mt-1 text-muted-foreground">
                  {a.holderName} · RUC {a.holderId}
                </p>
              </li>
            ))}
          </ul>
          <UploadProofForm orderNumber={order.number} retry={latest?.status === "REJECTED"} />
        </>
      )}
      <div className="mt-4">
        <OrderSecondaryActions orderNumber={order.number} canCancel={canChange} switchTo={canChange ? "PAYPHONE" : null} />
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-primary/30 bg-card p-5" aria-label={title}>
      <h2 className="mb-3 font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
