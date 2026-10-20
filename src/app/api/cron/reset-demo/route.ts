import { revalidateTag } from "next/cache";

import { DEMO_MODE } from "@/lib/demo";
import { isValidBearer } from "@/lib/security/bearer";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

import { seedDatabase } from "../../../../../prisma/seed/seed-db";

// Reinicia los datos de la demo pública. Vercel Cron llama a esta ruta cada
// noche con "Authorization: Bearer <CRON_SECRET>". Solo funciona con
// NEXT_PUBLIC_DEMO_MODE=true: en una tienda real esta ruta no hace nada.

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!DEMO_MODE || !isValidBearer(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("No encontrado", { status: 404 });
  }

  const result = await seedDatabase(db);
  for (const tag of Object.values(TAGS)) revalidateTag(tag, "max");
  return Response.json({ ok: true, ...result, at: new Date().toISOString() });
}
