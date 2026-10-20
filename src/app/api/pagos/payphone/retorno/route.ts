import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { TAGS } from "@/server/cache-tags";
import { handlePayphoneReturn } from "@/server/payments/payphone-flow";

// Payphone redirige aquí al cliente con ?id=…&clientTransactionId=…
// La confirmación es un efecto (cobro, stock): por eso va en un Route Handler
// y no al renderizar una página, que Next.js podría ejecutar más de una vez.

const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const CLIENT_TX_PATTERN = /^TA-\d{1,10}-[a-f0-9]{12}$/;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const clientTxId = request.nextUrl.searchParams.get("clientTransactionId") ?? "";

  if (!ID_PATTERN.test(id) || !CLIENT_TX_PATTERN.test(clientTxId)) {
    return NextResponse.redirect(new URL("/cuenta", request.url));
  }

  const { outcome, orderNumber, stockChanged } = await handlePayphoneReturn(id, clientTxId);
  if (stockChanged) revalidateTag(TAGS.products, "max");

  const target = orderNumber ? `/cuenta/pedidos/${orderNumber}?pago=${outcome}` : "/cuenta";
  return NextResponse.redirect(new URL(target, request.url));
}
