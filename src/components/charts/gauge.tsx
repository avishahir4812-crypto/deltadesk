"use client";

/** Semicircular regime gauge (VIX, PCR zones, IV rank). */

interface Zone {
  to: number; // fraction of range 0..1 where zone ends
  color: string;
  label: string;
}

export function Gauge({
  value,
  min,
  max,
  zones,
  display,
  sub,
}: {
  value: number;
  min: number;
  max: number;
  zones: Zone[];
  display: string;
  sub?: string;
}) {
  const cx = 70;
  const cy = 66;
  const r = 52;
  const frac = Math.min(Math.max((value - min) / (max - min), 0), 1);

  const polar = (f: number, radius = r) => {
    const a = Math.PI * (1 - f); // 180° → 0°
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const arc = (f0: number, f1: number) => {
    const [x0, y0] = polar(f0);
    const [x1, y1] = polar(f1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const [nx, ny] = polar(frac, r - 14);

  let acc = 0;
  return (
    <svg viewBox="0 0 140 76" className="w-full">
      <path d={arc(0, 1)} fill="none" stroke="var(--color-line)" strokeWidth="9" strokeLinecap="round" />
      {zones.map((z, i) => {
        const start = acc;
        acc = z.to;
        return (
          <path
            key={i}
            d={arc(start, z.to)}
            fill="none"
            stroke={z.color}
            strokeWidth="9"
            strokeLinecap="butt"
            opacity="0.85"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="4.2" fill="var(--color-ink)" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" />
      <text x={cx} y={cy + 0} textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--color-ink)" className="num" dy="-8">
        {display}
      </text>
      {sub ? (
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="var(--color-faint)">
          {sub}
        </text>
      ) : null}
    </svg>
  );
}
