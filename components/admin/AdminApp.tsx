"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { wedding } from "@/content/wedding";
import { ApiError, UNAUTHORIZED_EVENT, adminApi, errMsg } from "./api";
import { UiProvider } from "./ui";

type AuthState = "checking" | "authed" | "anon";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/admin/guests", label: "Guests", icon: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-12 9c0-3.3 3.6-6 8-6s8 2.7 8 6" },
  { href: "/admin/rsvps", label: "RSVPs", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { href: "/admin/analytics", label: "Analytics", icon: "M5 20V10m7 10V4m7 16v-7" },
  { href: "/admin/email", label: "Email", icon: "M3 11l18-8-8 18-2-8z" },
  { href: "/admin/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Logo({ size }: { size: number }) {
  return <Image src="/logo-sea.png" alt="" width={size} height={size} className="adm-logo" priority />;
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminApi.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Incorrect password" : errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-login-wrap">
      <form className="adm-card adm-login" onSubmit={submit}>
        <div className="adm-login-logo"><Logo size={72} /></div>
        <div className="adm-eyebrow">Admin</div>
        <h1>{wedding.couple.display}</h1>
        <p className="adm-muted">{wedding.date.display}</p>
        <label className="adm-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        {error && <div className="adm-error" role="alert">{error}</div>}
        <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function AdminApp({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("checking");
  const pathname = usePathname();
  const router = useRouter();

  const check = useCallback(async () => {
    try {
      await adminApi.me();
      setAuth("authed");
    } catch {
      setAuth("anon");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const h = () => setAuth("anon");
    window.addEventListener(UNAUTHORIZED_EVENT, h);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, h);
  }, []);

  useEffect(() => {
    if (auth === "authed" && pathname === "/admin") router.replace("/admin/guests");
  }, [auth, pathname, router]);

  async function logout() {
    try {
      await adminApi.logout();
    } catch {
      /* ignore */
    }
    setAuth("anon");
    router.replace("/admin");
  }

  if (auth === "checking") return <div className="adm-root"><div className="adm-loading adm-center">Loading&hellip;</div></div>;

  if (auth === "anon") {
    return (
      <div className="adm-root">
        <Login onSuccess={() => setAuth("authed")} />
      </div>
    );
  }

  return (
    <div className="adm-root">
      <UiProvider>
        <div className="adm-shell">
          <aside className="adm-side">
            <div className="adm-brand">
              <Logo size={40} />
              <div className="adm-brand-name">{wedding.couple.display}</div>
              <div className="adm-brand-sub">{wedding.date.display}</div>
            </div>
            <nav className="adm-nav" aria-label="Admin">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className={`adm-nav-link${pathname.startsWith(n.href) ? " active" : ""}`}>
                  <Icon d={n.icon} />
                  <span>{n.label}</span>
                </Link>
              ))}
              <Link href="/winners" className="adm-nav-link">
                <Icon d="M12 3l2.4 5.6L20 9.3l-4.3 4 1.1 5.9L12 16.4l-4.8 2.8 1.1-5.9-4.3-4 5.6-.7z" />
                <span>Decor portal</span>
              </Link>
            </nav>
            <button className="adm-nav-link adm-logout" onClick={logout}>
              <Icon d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
              <span>Log out</span>
            </button>
          </aside>
          <main className="adm-main">{children}</main>
        </div>
      </UiProvider>
    </div>
  );
}
