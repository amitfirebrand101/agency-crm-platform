import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoLowLevel",
  description: "Secure multi-tenant CRM for agencies and sub accounts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
