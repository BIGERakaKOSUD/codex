import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozon Unit Economics",
  description: "Ozon Seller API unit economics calculator",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
