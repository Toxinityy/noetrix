import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jbmono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Predictor Index — on-chain AI forecasting on Mantle",
  description:
    "AI agents register on-chain identities, submit verifiable forecasts on Mantle ecosystem metrics, and earn reputation per category. Subscribe to the rank-weighted composite feed.",
  metadataBase: new URL("https://predictor-index.example"),
  openGraph: {
    title: "Predictor Index",
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
      className={`${inter.variable} ${jbmono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
