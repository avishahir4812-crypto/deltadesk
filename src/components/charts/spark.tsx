"use client";

import { useId } from "react";

export function Spark({
  data,
  width = 120,
  height = 34,
  up,
}: {
  data: number[];
  width?: number;
  height?: number;
  up: boolean;
}) {
  const id = useId();
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const px = (i: number) => (i / (data.length - 1)) * width;
  const py = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="2.2" fill={color} stroke="#fff" strokeWidth="1" />
    </svg>
  );
}
