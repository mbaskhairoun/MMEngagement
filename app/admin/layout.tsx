import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminApp from "@/components/admin/AdminApp";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin | Marly & Michael",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminApp>{children}</AdminApp>;
}
