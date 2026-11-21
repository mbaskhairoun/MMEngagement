import type { Metadata } from "next";
import type { ReactNode } from "react";
import DecorApp from "@/components/decor/DecorApp";
import "./decor.css";

export const metadata: Metadata = {
  title: "Decor portal",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function DecorLayout({ children }: { children: ReactNode }) {
  return <DecorApp>{children}</DecorApp>;
}
