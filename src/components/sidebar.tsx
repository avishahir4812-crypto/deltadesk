"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  FlaskConical,
  LayoutGrid,
  NotebookPen,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { istClock } from "@/lib/clock";
import { useNow } from "@/lib/hooks";
import { LogoMark, LogoWord } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV: { heading: string; items: { href: string; label: string; icon: typeof LayoutGrid }[] }[] = [
  {
    heading: "Terminal",
    items: [
      { href: "/", label: "Overview", icon: LayoutGrid },
      { href: "/chain", label: "Option Chain", icon: Waypoints },
      { href: "/analytics", label: "Analytics", icon: ChartColumn },
      { href: "/strategy", label: "Strategy Lab", icon: FlaskConical },
    ],
  },
  {
    heading: "Intelligence",
    items: [
      { href: "/research", label: "AI Research", icon: Sparkles },
      { href: "/notes", label: "Desk Notes", icon: NotebookPen },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const now = useNow(1000);
  const clock = istClock(now);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[64px] flex-col border-r border-line bg-panel lg:w-[224px]">
      {/* brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-line px-3 lg:px-4">
        <LogoMark size={32} />
        <div className="hidden min-w-0 lg:block">
          <LogoWord />
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-faint">F&amp;O Research</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 lg:px-3">
        {NAV.map((section) => (
          <div key={section.heading} className="mb-4">
            <p className="mb-1.5 hidden px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-faint lg:block">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                        "max-lg:justify-center max-lg:px-0",
                        active ? "bg-brand-soft text-brand-deep" : "text-sub hover:bg-black/[0.045] hover:text-ink"
                      )}
                    >
                      <item.icon size={17} strokeWidth={active ? 2.3 : 2} className="shrink-0" />
                      <span className="hidden lg:inline">{item.label}</span>
                      {active && <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-brand max-lg:hidden" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* session footer */}
      <div className="border-t border-line p-3 max-lg:hidden">
        <div className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              clock.session === "open" ? "bg-up animate-pulse-dot" : clock.session === "preopen" ? "bg-warn" : "bg-faint"
            )}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight">{clock.label}</p>
            <p className="num text-[10px] text-faint">{clock.time} IST</p>
          </div>
        </div>
        <p className="mt-2 px-1 text-[9.5px] leading-snug text-faint">
          Deterministic simulation. Not investment advice.
        </p>
      </div>
    </aside>
  );
}
