import "server-only";

import type { z } from "zod";

import { getProvince } from "@/lib/data/ecuador";
import type { bankAccountSchema, settingsSchema, shippingRatesSchema } from "@/lib/validations/admin";
import { db } from "@/server/db";

type Settings = z.output<typeof settingsSchema>;
type Rates = z.output<typeof shippingRatesSchema>;
type BankAccount = z.output<typeof bankAccountSchema>;

export async function updateSettings(input: Settings) {
  const { taxRatePercent, ...rest } = input;
  const data = { ...rest, taxRateBps: taxRatePercent };
  await db.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

/** Cambia (o quita) el logo y devuelve la clave del anterior para borrarlo del almacenamiento. */
export async function setLogo(url: string | null, key: string | null): Promise<string | null> {
  const current = await db.storeSettings.findUnique({ where: { id: 1 }, select: { logoStorageId: true } });
  await db.storeSettings.update({ where: { id: 1 }, data: { logoUrl: url, logoStorageId: key } });
  return current?.logoStorageId ?? null;
}

export async function updateShippingRates(rates: Rates) {
  await db.$transaction(
    rates.map((r) =>
      db.shippingRate.upsert({
        where: { provinceCode: r.provinceCode },
        create: { ...r, provinceName: getProvince(r.provinceCode)!.name },
        update: { cost: r.cost, estimatedDays: r.estimatedDays },
      }),
    ),
  );
}

export async function saveBankAccount(input: BankAccount) {
  const { id, ...data } = input;
  if (id) await db.bankAccount.update({ where: { id }, data });
  else await db.bankAccount.create({ data });
}

export async function deleteBankAccount(id: string) {
  await db.bankAccount.deleteMany({ where: { id } });
}
