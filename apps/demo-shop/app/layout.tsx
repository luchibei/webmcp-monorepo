import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import { ClientAppShell } from "@/components/client-app-shell";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const headingFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading"
});

export const metadata: Metadata = {
  title: "WebMCP Demo Shop",
  description:
    "Macro-tool-first ecommerce demo: agent can complete shopping in 2-4 WebMCP tool calls."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body>
        <ClientAppShell>{children}</ClientAppShell>
      </body>
    </html>
  );
}
