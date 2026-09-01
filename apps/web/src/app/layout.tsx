import type { Metadata } from "next";
import { Sora, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nodpeak — reviews, SEO & trust for any website",
    template: "%s · Nodpeak",
  },
  description:
    "Open-source review widget and SEO rich-snippet engine. Self-host it free forever, or let Nodpeak run it for $15/mo.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Nodpeak",
    description: "Collect reviews, route the happy ones to Google, keep the rest private.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${sora.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
