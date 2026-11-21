import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost, Pinyon_Script } from "next/font/google";
import { wedding } from "@/content/wedding";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
  variable: "--font-jost",
});

const pinyon = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-pinyon",
});

export const metadata: Metadata = {
  metadataBase: new URL(wedding.site.url),
  title: {
    default: wedding.site.title,
    template: `%s · ${wedding.couple.display}`,
  },
  description: wedding.site.description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: wedding.couple.display,
    title: wedding.site.title,
    description: wedding.site.description,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: `${wedding.couple.display} on a balcony at golden hour`,
      },
      {
        url: "/og-logo.jpg",
        width: 1200,
        height: 630,
        alt: `${wedding.couple.display} monogram`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: wedding.site.title,
    description: wedding.site.description,
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F1",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} ${pinyon.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
