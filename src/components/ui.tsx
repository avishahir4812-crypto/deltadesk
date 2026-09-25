import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------- card ---------------------------------- */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-line bg-panel shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  right,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
        {sub ? <p className="mt-0.5 text-[11.5px] leading-snug text-faint">{sub}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------------------------- chip ---------------------------------- */

type Tone = "up" | "down" | "warn" | "brand" | "flat";

const chipTone: Record<Tone, string> = {
  up: "bg-up-soft text-up",
  down: "bg-down-soft text-down",
  warn: "bg-warn-soft text-warn",
  brand: "bg-brand-soft text-brand",
  flat: "bg-[#efeee9] text-sub",
};

export function Chip({ tone = "flat", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold", chipTone[tone], className)}>
      {children}
    </span>
  );
}

/* ---------------------------------- stat ---------------------------------- */

export function Stat({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn("text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint", hint && "tip w-fit cursor-help")}
        data-tip={hint}
      >
        {label}
      </p>
      <div
        className={cn(
          "num mt-1 text-[19px] font-semibold leading-none tracking-tight",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "warn" && "text-warn",
          tone === "brand" && "text-brand",
          (!tone || tone === "flat") && "text-ink"
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-[11px] leading-snug text-faint">{sub}</div> : null}
    </div>
  );
}

/* --------------------------------- buttons --------------------------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost" | "dark";
  size?: "sm" | "md";
};

export function Btn({ variant = "outline", size = "md", className, ...rest }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all duration-150 ease-[cubic-bezier(.2,.65,.25,1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7.5 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]",
        variant === "solid" && "bg-brand text-white shadow-sm hover:bg-brand-deep",
        variant === "dark" && "bg-ink text-paper shadow-sm hover:bg-black",
        variant === "outline" && "border border-line2 bg-panel text-ink hover:border-faint hover:shadow-card",
        variant === "ghost" && "text-sub hover:bg-black/[0.045] hover:text-ink",
        className
      )}
      {...rest}
    />
  );
}

/* -------------------------------- segmented -------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg border border-line bg-paper p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[7px] px-2.5 py-1 text-[12px] font-medium transition-all duration-150",
            value === o.value ? "bg-panel text-ink shadow-card" : "text-faint hover:text-sub"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- inputs ---------------------------------- */

export function Select({ className, ...rest }: React.ComponentPropsWithRef<"select">) {
  return (
    <select
      className={cn(
        "h-9 cursor-pointer appearance-none rounded-lg border border-line2 bg-panel pl-3 pr-8 text-[13px] font-medium text-ink shadow-card transition-colors hover:border-faint",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2398a098%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-no-repeat",
        className
      )}
      {...rest}
    />
  );
}

export function Input({ className, ...rest }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-line2 bg-panel px-3 text-[13px] text-ink shadow-card transition-colors placeholder:text-faint hover:border-faint focus:border-brand",
        className
      )}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: React.ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-line2 bg-panel px-3 py-2.5 text-[13px] leading-relaxed text-ink shadow-card transition-colors placeholder:text-faint hover:border-faint focus:border-brand",
        className
      )}
      {...rest}
    />
  );
}

/* ---------------------------------- misc ----------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper text-faint">{icon}</div> : null}
      <p className="text-[13.5px] font-semibold text-ink">{title}</p>
      {sub ? <p className="max-w-sm text-[12px] leading-relaxed text-faint">{sub}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.13em] text-faint">{children}</h2>
      {right}
    </div>
  );
}
