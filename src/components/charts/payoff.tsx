"use client";

import { useId, useState } from "react";
import { fmtCr } from "@/lib/format";
import { useSize } from "@/lib/hooks";

export interface PayoffPoint {
  x: number;
  y: number;
}

const UP = "var(--color-up)";
const DOWN = "var(--color-down)";

/** Expiry payoff diagram with breakevens, shading and hover readout. */
export function Payoff({
  pts,
  spot,
  breakevens,
  height = 250,
}: {
  pts: PayoffPoint[];
  spot: number;
  breakevens: number[];
  height?: number;
}) {
  const id = useId();
  const [ref, w] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 8;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const n = pts.length;
  if (n < 2) return null;

  const x0 = pts[0].x;
  const x1 = pts[n - 1].x;
  let yLo = Math.min(...pts.map((p) => p.y), 0);
  let yHi = Math.max(...pts.map((p) => p.y), 0);
  const ySpan = yHi - yLo || 1;
  yLo -= ySpan * 0.08;
  yHi += ySpan * 0.1;

  const X = (x: number) => padL + ((x - x0) / (x1 - x0)) * (w - padL - padR);
  const Y = (y: number) => padT + ((yHi - y) / (yHi - yLo)) * (height - padT - padB);
  const zeroY = Y(0);

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const areaPath = `${line} L${X(x1)} ${zeroY} L${X(x0)} ${zeroY} Z`;
  const zeroFrac = (yHi / (yHi - yLo)) * 100;

  const xticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(x0 + (x1 - x0) * f));

  return (
    <div ref={ref} className="relative w-full select-none">
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-ink px-2 py-1 text-center shadow-pop"
          style={{ left: Math.min(Math.max(X(pts[hover].x), 52), w - 52), top: 0 }}
        >
          <div className={`num text-[11px] font-bold ${pts[hover].y >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {fmtCr(Math.round(pts[hover].y))}
          </div>
          <div className="num text-[9px] font-medium text-white/60">@ {pts[hover].x.toLocaleString("en-IN")}</div>
        </div>
      )}
      {w > 0 && (
        <svg width={w} height={height} className="block cursor-crosshair" onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.round(((e.clientX - rect.left - padL) / (w - padL - padR)) * (n - 1));
            setHover(i >= 0 && i < n ? i : null);
          }}
        >
          <defs>
            <linearGradient id={`pf-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={UP} stopOpacity="0.22" />
              <stop offset={`${zeroFrac}%`} stopColor={UP} stopOpacity="0" />
              <stop offset={`${zeroFrac}%`} stopColor={DOWN} stopOpacity="0" />
              <stop offset="100%" stopColor={DOWN} stopOpacity="0.22" />
            </linearGradient>
          </defs>

          <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke="var(--color-line2)" strokeDasharray="3 4" />
          <path d={areaPath} fill={`url(#pf-${id})`} />
          <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* spot marker */}
          <line x1={X(spot)} x2={X(spot)} y1={padT} y2={height - padB} stroke="var(--color-faint)" strokeDasharray="4 3" />
          <text x={X(spot)} y={height - padB + 13} fontSize="9" fontWeight="700" textAnchor="middle" fill="var(--color-sub)" className="num">
            spot
          </text>

          {/* breakevens */}
          {breakevens.map((be) => (
            <g key={be}>
              <circle cx={X(be)} cy={zeroY} r="3.4" fill="#fff" stroke="var(--color-ink)" strokeWidth="1.6" />
              <text x={X(be)} y={zeroY - 8} fontSize="9" fontWeight="600" textAnchor="middle" fill="var(--color-sub)" className="num">
                {be.toLocaleString("en-IN")}
              </text>
            </g>
          ))}

          {xticks.map((x) => (
            <text key={x} x={X(x)} y={height - 5} fontSize="9.5" textAnchor="middle" fill="var(--color-faint)" className="num">
              {x.toLocaleString("en-IN")}
            </text>
          ))}

          {hover !== null && (
            <g>
              <line x1={X(pts[hover].x)} x2={X(pts[hover].x)} y1={padT} y2={height - padB} stroke="var(--color-faint)" strokeDasharray="3 3" />
              <circle cx={X(pts[hover].x)} cy={Y(pts[hover].y)} r="3.4" fill={pts[hover].y >= 0 ? UP : DOWN} stroke="#fff" strokeWidth="1.4" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
