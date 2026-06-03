import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "agendaê — Agendamento online para prestadores de serviço",
  description:
    "Plataforma multi-tenant de agendamento para barbearias, salões, clínicas e profissionais autônomos. Gerencie sua agenda online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}