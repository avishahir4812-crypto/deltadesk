"use client";

import { useState } from "react";
import type { Candle } from "@/lib/market/engine";
import { fmtIN, fmtOi } from "@/lib/format";
import { useSize } from "@/lib/hooks";
import { Skeleton } from "@/components/ui";

const UP = "var(--color-up)";
const DOWN = "var(--color-down)";

function istLabel(minsFromOpen: number): string {
  const total = 9 * 60 + 15 + minsFromOpen;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function Candles({ candles, height = 330 }: { candles: Candle[]; height?: number }) {
  const [ref, w] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (!candles.length) return <Skeleton className="w-full" />;
  const H = height;
  const padL = 6;
  const padR = 58;
  const padT = 12;
  const padB = 20;
  const volH = Math.round(H * 0.15);
  const plotH = H - padT - padB - volH - 6;

  const n = candles.length;
  let lo = Infinity;
  let hi = -Infinity;
  let vmax = 1;
  for (const c of candles) {
    lo = Math.min(lo, c.l);
    hi = Math.max(hi, c.h);
    vmax = Math.max(vmax, c.v);
  }
  const span = hi - lo || 1;
  lo -= span * 0.04;
  hi += span * 0.05;

  const X = (i: number) => padL + ((i + 0.5) / n) * (w - padL - padR);
  const bodyW = Math.max(2.4, ((w - padL - padR) / n) * 0.64);
  const Y = (p: number) => padT + ((hi - p) / (hi - lo)) * plotH;
  const VY = (v: number) => H - padB + 1 - (v / vmax) * volH;

  const last = candles[n - 1];
  const hc = hover !== null ? candles[hover] : null;
  const shown = hc ?? last;
  const lastUp = last.c >= last.o;

  const ticks = [0.08, 0.36, 0.64, 0.92].map((f) => hi - (hi - lo) * f);
  const xtickIdx = [0, 12, 24, 36, 48, 60, 74].filter((i) => i < n);

  return (
    <div ref={ref} className="relative w-full select-none">
      {/* OHLC readout */}
      <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex items-center gap-3 text-[10.5px] font-medium text-faint">
        <span className="num">O <b className={shown.c >= shown.o ? "text-up" : "text-down"}>{fmtIN(shown.o)}</b></span>
        <span className="num">H <b className="text-up">{fmtIN(shown.h)}</b></span>
        <span className="num">L <b className="text-down">{fmtIN(shown.l)}</b></span>
        <span className="num">C <b className={shown.c >= shown.o ? "text-up" : "text-down"}>{fmtIN(shown.c)}</b></span>
        <span className="num hidden sm:inline">Vol <b className="text-sub">{fmtOi(shown.v)}</b></span>
        <span className="text-[10px]">{istLabel(shown.t)}</span>
      </div>

      {w > 0 && (
        <svg width={w} height={H + 4} className="block cursor-crosshair" onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const i = Math.round(((x - padL) / (w - padL - padR)) * n - 0.5);
            if (i >= 0 && i < n) setHover(i);
            else setHover(null);
          }}
        >
          {/* grid */}
          {ticks.map((p, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={Y(p)} y2={Y(p)} stroke="var(--color-line)" strokeDasharray="2 4" />
              <text x={w - padR + 6} y={Y(p) + 3} fontSize="9.5" fill="var(--color-faint)" className="num">
                {fmtIN(p, 0)}
              </text>
            </g>
          ))}
          {/* time ticks */}
          {xtickIdx.map((i) => (
            <text key={i} x={X(i)} y={H - 5} fontSize="9.5" textAnchor="middle" fill="var(--color-faint)" className="num">
              {istLabel(candles[i].t)}
            </text>
          ))}

          {/* volume */}
          {candles.map((c, i) => (
            <rect key={`v${i}`} x={X(i) - bodyW / 2} width={bodyW} y={VY(c.v)} height={H - padB + 1 - VY(c.v)}
              fill={c.c >= c.o ? UP : DOWN} opacity="0.16" rx={1} />
          ))}

          {/* candles */}
          {candles.map((c, i) => {
            const up = c.c >= c.o;
            const color = up ? UP : DOWN;
            const yO = Y(c.o);
            const yC = Y(c.c);
            return (
              <g key={i} opacity={hover !== null && hover !== i ? 0.55 : 1}>
                <line x1={X(i)} x2={X(i)} y1={Y(c.h)} y2={Y(c.l)} stroke={color} strokeWidth="1.1" />
                <rect
                  x={X(i) - bodyW / 2}
                  width={bodyW}
                  y={Math.min(yO, yC)}
                  height={Math.max(Math.abs(yC - yO), 1)}
                  fill={color}
                  rx={0.8}
                />
              </g>
            );
          })}

          {/* last price marker */}
          <line x1={padL} x2={w - padR} y1={Y(last.c)} y2={Y(last.c)} stroke={lastUp ? UP : DOWN} strokeDasharray="4 3" strokeWidth="1" />
          <rect x={w - padR + 1} y={Y(last.c) - 8.5} width={padR - 4} height="17" rx="4" fill={lastUp ? UP : DOWN} />
          <text x={w - padR + 6} y={Y(last.c) + 3.5} fontSize="9.5" fontWeight="700" fill="#fff" className="num">
            {fmtIN(last.c, 0)}
          </text>

          {/* crosshair */}
          {hc && hover !== null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={padT} y2={H - padB + 1} stroke="var(--color-faint)" strokeDasharray="3 3" />
              <line x1={padL} x2={w - padR} y1={Y(hc.c)} y2={Y(hc.c)} stroke="var(--color-faint)" strokeDasharray="3 3" />
              <circle cx={X(hover)} cy={Y(hc.c)} r="3" fill={hc.c >= hc.o ? UP : DOWN} stroke="#fff" strokeWidth="1.2" />
              <rect x={w - padR + 1} y={Y(hc.c) - 8.5} width={padR - 4} height="17" rx="4" fill="var(--color-ink)" />
              <text x={w - padR + 6} y={Y(hc.c) + 3.5} fontSize="9.5" fontWeight="600" fill="#fff" className="num">
                {fmtIN(hc.c, 0)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
