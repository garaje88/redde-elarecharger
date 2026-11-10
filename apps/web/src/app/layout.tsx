import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { connection } from "next/server";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Elacharger", template: "%s · Elacharger" },
  description:
    "Calcula el consumo de batería de tu trayecto y el tiempo de carga de tu carro eléctrico.",
  applicationName: "Elacharger",
  appleWebApp: { capable: true, title: "Elacharger", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request: the CSP nonce set in proxy.ts must reach Next's scripts,
  // and a prerendered page would carry none.
  await connection();
  return (
    <html lang="es-CO" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
