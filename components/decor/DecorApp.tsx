"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Monogram } from "@/components/site/Monogram";
import { wedding } from "@/content/wedding";
import { ApiError, UNAUTHORIZED_EVENT, decorApi, errMsg } from "./api";
import { ICONS, Icon, UiProvider } from "./ui";

type AuthState = "checking" | "authed" | "anon";

export const BASE = "/winners";
const TABS: { href: string; label: string }[] = [
  { href: `${BASE}/inspiration`, label: "Inspiration" },
  { href: `${BASE}/selections`, label: "Selections" },
];

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await decorApi.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Incorrect password" : errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dec-login-wrap">
      <form className="dec-card dec-login" onSubmit={submit}>
        <div className="dec-login-logo">
          <Monogram size={84} priority />
        </div>
        <div className="dec-eyebrow">Decor portal</div>
        <h1>Decorators &amp; planners</h1>
        <p className="dec-muted">
          {wedding.couple.display} &middot; {wedding.date.display}
        </p>
        <label className="dec-field">
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
        {error && (
          <div className="dec-error" role="alert">
            {error}
          </div>
        )}
        <button className="dec-btn dec-btn-primary dec-btn-block" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="dec-muted dec-small dec-login-hint">Ask Marly or Michael for the password</p>
      </form>
    </div>
  );
}

export default function DecorApp({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("checking");
  const pathname = usePathname();
  const router = useRouter();

  const check = useCallback(async () => {
    try {
      const r = await decorApi.me();
      setAuth(r.authenticated === false ? "anon" : "authed");
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
    if (auth === "authed" && (pathname === BASE || pathname === `${BASE}/`)) router.replace(`${BASE}/inspiration`);
  }, [auth, pathname, router]);

  async function logout() {
    try {
      await decorApi.logout();
    } catch {
      /* ignore */
    }
    setAuth("anon");
    router.replace(BASE);
  }

  if (auth === "checking") {
    return (
      <div className="dec-root">
        <div className="dec-center">
          <span className="dec-spinner" aria-hidden="true" />
          <span className="visually-hidden">Loading</span>
        </div>
      </div>
    );
  }

  if (auth === "anon") {
    return (
      <div className="dec-root">
        <Login onSuccess={() => setAuth("authed")} />
      </div>
    );
  }

  return (
    <div className="dec-root">
      <UiProvider>
        <header className="dec-top">
          <div className="dec-top-inner">
            <Link href={`${BASE}/inspiration`} className="dec-brand" aria-label="Decor portal home">
              <Monogram size={40} decorative priority />
              <span className="dec-brand-text">
                <span className="dec-brand-name">Decor portal</span>
                <span className="dec-brand-sub">{wedding.couple.display}</span>
              </span>
            </Link>
            <nav className="dec-tabs" aria-label="Decor portal">
              {TABS.map((t) => {
                const active = pathname.startsWith(t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`dec-tab${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            <button type="button" className="dec-btn dec-btn-ghost dec-logout" onClick={logout}>
              <Icon d={ICONS.logout} />
              <span>Log out</span>
            </button>
          </div>
        </header>
        <main className="dec-main">{children}</main>
      </UiProvider>
    </div>
  );
}
