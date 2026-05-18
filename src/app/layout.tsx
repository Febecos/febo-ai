import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Febo AI",
  description: "Inbox interno de WhatsApp y agente comercial de FEBECOS",
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
