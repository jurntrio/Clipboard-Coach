import type { Metadata } from "next";
import { Anton, Space_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/client";
import { defaultLocale } from "@/i18n/config";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  metadataBase: new URL("https://app.sportvisualsystems.com"),
  title: {
    default: "Sport Visual Systems",
    template: "%s | Sport Visual Systems"
  },
  description: "Sportanalyse, teambeheer, videoreview en communicatie in één platform.",
  applicationName: "Sport Visual Systems",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/svs-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/svs-192.png", type: "image/png", sizes: "192x192" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Sport Visual Systems",
    description: "Sportanalyse, teambeheer, videoreview en communicatie in één platform.",
    siteName: "Sport Visual Systems",
    locale: "nl_BE",
    images: [{ url: "/branding/svs-square-dark.png", width: 887, height: 887, alt: "Sport Visual Systems" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} className={`${anton.variable} ${spaceMono.variable} ${manrope.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`
          }}
        />
      </head>
      <body className="font-sans"><I18nProvider initialLocale={defaultLocale}>{children}</I18nProvider></body>
    </html>
  );
}
