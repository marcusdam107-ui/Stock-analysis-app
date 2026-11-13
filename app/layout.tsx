import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Malachi Wealth",
  description: "Private options desk for weekly, bi-weekly and monthly expirations.",
  manifest: "/manifest.webmanifest",
  applicationName: "Malachi Wealth",
  appleWebApp: { capable: true, title: "Malachi Wealth", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#070B18" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@700&family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
