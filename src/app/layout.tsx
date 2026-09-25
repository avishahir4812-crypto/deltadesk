import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/topbar";
import CommandPalette from "@/components/palette";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: "DeltaDesk — F&O Derivatives Research Terminal",
  description:
    "A production-grade derivatives research terminal: live option chains, OI analytics, strategy payoff lab and an AI research copilot for Indian F&O markets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jbmono.variable}`}>
      <body>
        <Sidebar />
        <div className="pl-16 lg:pl-56">
          <TopBar />
          <main className="mx-auto max-w-[1440px] px-5 py-5 lg:px-8">{children}</main>
          <footer className="mx-auto max-w-[1440px] border-t border-line px-5 py-5 lg:px-8">
            <p className="text-[10.5px] leading-relaxed text-faint">
              DeltaDesk is a self-contained product demonstration. All quotes, OI, Greeks and flows are produced
              by a deterministic market simulation — no exchange feed is connected. Nothing here is investment
              advice or a solicitation to trade. Derivatives involve substantial risk of loss.
            </p>
          </footer>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
