"use client";

import { useId, useState } from "react";
import { fmtIN } from "@/lib/format";
import { useSize } from "@/lib/hooks";

/** Annotated line/area series with hover crosshair (PCR intraday, IV smile). */
export function LineSeries({
  xs,
  ys,
  height = 180,
  refLine,
  refLabel,
  yFmt,
  color = "var(--color-brand)",
  dots = false,
  area = true,
}: {
  xs: string[];
  ys: number[];
  height?: number;
  refLine?: number;
  refLabel?: string;
  yFmt?: (n: number) => string;
  color?: string;
  dots?: boolean;
  area?: boolean;
}) {
  const id = useId();
  const [ref, w] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const fmt = yFmt ?? ((n) => fmtIN(n, 2));
  const padL = 8;
  const padR = 46;
  const padT = 12;
  const padB = 18;
  const n = ys.length;
  if (n < 2) return <div style={{ height }} />;

  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (refLine !== undefined) {
    lo = Math.min(lo, refLine);
    hi = Math.max(hi, refLine);
  }
  const span = hi - lo || 1;
  lo -= span * 0.18;
  hi += span * 0.18;

  const X = (i: number) => padL + (i / (n - 1)) * (w - padL - padR);
  const Y = (v: number) => padT + ((hi - v) / (hi - lo)) * (height - padT - padB);
  const line = ys.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const areaPath = `${line} L${X(n - 1)} ${height - padB} L${X(0)} ${height - padB} Z`;

  const labelEvery = Math.max(1, Math.floor(n / 5));

  return (
    <div ref={ref} className="relative w-full select-none">
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-ink px-2 py-1 text-center shadow-pop"
          style={{ left: Math.min(Math.max(X(hover), 44), w - 44), top: 0 }}
        >
          <div className="num text-[11px] font-bold text-white">{fmt(ys[hover])}</div>
          <div className="text-[9px] font-medium text-white/60">{xs[hover]}</div>
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
            <linearGradient id={`ls-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.15, 0.5, 0.85].map((f) => {
            const y = padT + f * (height - padT - padB);
            return (
              <g key={f}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="2 4" />
                <text x={w - padR + 6} y={y + 3} fontSize="9.5" fill="var(--color-faint)" className="num">
                  {fmt(hi - f * (hi - lo))}
                </text>
              </g>
            );
          })}
          {xs.map((x, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={X(i)} y={height - 4} fontSize="9.5" textAnchor="middle" fill="var(--color-faint)" className="num">
                {x}
              </text>
            ) : null
          )}
          {refLine !== undefined && (
            <g>
              <line x1={padL} x2={w - padR} y1={Y(refLine)} y2={Y(refLine)} stroke="var(--color-warn)" strokeWidth="1" strokeDasharray="5 3" />
              {refLabel ? (
                <text x={padL + 2} y={Y(refLine) - 4} fontSize="9" fontWeight="700" fill="var(--color-warn)">
                  {refLabel}
                </text>
              ) : null}
            </g>
          )}
          {area && <path d={areaPath} fill={`url(#ls-${id})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          {dots &&
            ys.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="2.4" fill="#fff" stroke={color} strokeWidth="1.6" />)}
          {hover !== null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={padT} y2={height - padB} stroke="var(--color-faint)" strokeDasharray="3 3" />
              <circle cx={X(hover)} cy={Y(ys[hover])} r="3.4" fill={color} stroke="#fff" strokeWidth="1.4" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
