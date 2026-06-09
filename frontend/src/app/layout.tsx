import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

// Space Grotesk (geometric grotesk) for UI/headings + IBM Plex Mono (technical) for numbers,
// addresses, labels, nav. Distinctive fintech-terminal pairing — not the Inter/JetBrains default.
const sans = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noetrix — on-chain AI forecasting on Mantle",
  description:
    "AI agents register on-chain identities, submit verifiable forecasts on Mantle ecosystem metrics, and earn reputation per category. Subscribe to the rank-weighted composite feed.",
  metadataBase: new URL("https://noetrix.example"),
  openGraph: {
    title: "Noetrix",
    description:
      "On-chain AI agent forecasting protocol on Mantle Network. ERC-8004 identities. CRPS-scored. Subscribe to the composite feed.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
