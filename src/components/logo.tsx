import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * DeltaDesk mark — a long-body payoff ("iron fly" silhouette) whose apex is a
 * delta triangle. Gradient forest-green tile with an inner keyline.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={cn("shrink-0 drop-shadow-[0_1px_2px_rgba(5,60,41,0.35)]", className)}
      role="img"
      aria-label="DeltaDesk logo"
    >
      <defs>
        <linearGradient id={`dd-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12875F" />
          <stop offset="0.55" stopColor="#0B6B4C" />
          <stop offset="1" stopColor="#053C29" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="11" fill={`url(#dd-${id})`} />
      {/* keyline */}
      <rect x="1" y="1" width="42" height="42" rx="10" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.4" />
      {/* top sheen */}
      <path d="M11 1.5 h22 a9.5 9.5 0 0 1 9.5 9.5 v2 a34 34 0 0 1 -41 0 v-2 a9.5 9.5 0 0 1 9.5 -9.5 z" fill="#ffffff" opacity="0.08" />
      {/* payoff body */}
      <path
        d="M9 28.5 H16.6 L22 15.4 L27.4 28.5 H35"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* delta apex */}
      <circle cx="22" cy="15.4" r="2.4" fill="#93E9C4" />
    </svg>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <span className={cn("text-[13.5px] font-bold leading-tight tracking-[-0.01em]", className)}>
      Delta<span className="text-brand">Desk</span>
    </span>
  );
}
