import { auth } from "@/auth";
import { db } from "@/server/db";
import { getPrivateStorage } from "@/server/storage/storage";

// Entrega un comprobante de transferencia SOLO al dueño del pedido o a un
// administrador. Cualquier otro caso responde 404 (no 403), para no confirmar
// que el comprobante existe.

const notFound = () => new Response("No encontrado", { status: 404 });

export async function GET(_request: Request, ctx: RouteContext<"/api/comprobantes/[paymentId]">) {
  const { paymentId } = await ctx.params;
  if (!/^[a-z0-9]{20,40}$/.test(paymentId)) return notFound();

  const session = await auth();
  if (!session?.user) return notFound();

  const [payment, viewer] = await Promise.all([
    db.payment.findUnique({
      where: { id: paymentId },
      select: { proofStorageId: true, order: { select: { userId: true, number: true } } },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
  ]);
  if (!payment?.proofStorageId || !viewer) return notFound();

  const isOwner = payment.order.userId === session.user.id;
  if (!isOwner && viewer.role !== "ADMIN") return notFound();

  const file = await getPrivateStorage().get(payment.proofStorageId);
  if (!file) return notFound();

  const ext = payment.proofStorageId.split(".").pop();
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="comprobante-pedido-${payment.order.number}.${ext}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Un PDF malicioso no puede ejecutar scripts ni cargar recursos
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
