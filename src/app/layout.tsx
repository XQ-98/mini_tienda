import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { getStoreSettings } from "@/server/queries/settings";

import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreSettings();
  const description =
    store.tagline ?? `Compra en línea en ${store.storeName}. Envíos a todo el Ecuador.`;

  return {
    metadataBase: new URL(siteUrl),
    title: { default: store.storeName, template: `%s | ${store.storeName}` },
    description,
    applicationName: store.storeName,
    openGraph: {
      type: "website",
      locale: "es_EC",
      siteName: store.storeName,
      description,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#b5452b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-EC" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster theme="light" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
