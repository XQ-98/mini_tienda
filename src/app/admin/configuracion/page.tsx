import { Suspense } from "react";

import { BankAccounts, ShippingRatesForm, StoreSettingsForm } from "@/components/admin/settings-forms";
import { PageHeader, PageSkeleton } from "@/components/admin/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminSettings } from "@/server/admin/queries";

export const metadata = { title: "Configuración" };

async function SettingsContent() {
  const { settings, rates, accounts } = await adminSettings();
  if (!settings) return <p className="text-sm">Ejecuta el seed para crear la configuración inicial.</p>;

  return (
    <Tabs defaultValue="tienda">
      <TabsList className="mb-4">
        <TabsTrigger value="tienda">Tienda</TabsTrigger>
        <TabsTrigger value="envios">Envíos</TabsTrigger>
        <TabsTrigger value="bancos">Cuentas bancarias</TabsTrigger>
      </TabsList>
      <TabsContent value="tienda">
        <StoreSettingsForm settings={settings} />
      </TabsContent>
      <TabsContent value="envios">
        <ShippingRatesForm rates={rates} />
      </TabsContent>
      <TabsContent value="bancos">
        <BankAccounts accounts={accounts} />
      </TabsContent>
    </Tabs>
  );
}

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" />
      <Suspense fallback={<PageSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
