import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GDGoC Team 1",
  description: "Bridge Hackathon 2026 — Korea·Japan GDGoC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
