"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearStoredUser, useStoredUser } from "@/lib/session";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useStoredUser();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const isActive = (name: "biblioteca" | "salon" | "auth") => {
    if (name === "biblioteca") return pathname === "/" || pathname.startsWith("/game");
    if (name === "salon") return pathname === "/hall-of-fame";
    return pathname === "/login";
  };

  const handleSignOut = () => {
    clearStoredUser();
    router.push("/");
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("biblioteca") ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={() => setOpen(false)}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isActive("biblioteca") ? "active" : ""} onClick={() => setOpen(false)}>
          Biblioteca
        </Link>
        <Link href="/hall-of-fame" className={isActive("salon") ? "active" : ""} onClick={() => setOpen(false)}>
          Salón de la Fama
        </Link>
        {user ? (
          <a
            className={isActive("auth") ? "active" : ""}
            onClick={() => {
              setOpen(false);
              handleSignOut();
            }}
          >
            Cuenta
          </a>
        ) : (
          <Link href="/login" className={isActive("auth") ? "active" : ""} onClick={() => setOpen(false)}>
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
