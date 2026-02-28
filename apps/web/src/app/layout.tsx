import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaArchive",
  description: "Media Archive Search System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
