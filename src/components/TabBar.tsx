"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function TabBar() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Home" },
    { href: "/practices", label: "Practices" },
  ];
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="flex gap-1 rounded-2xl border border-black/10 bg-white/80 backdrop-blur-md px-2 py-2 shadow-lg">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "px-4 py-2 rounded-xl text-sm font-medium " +
                (active ? "bg-black text-white" : "text-black hover:bg-black/5")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


