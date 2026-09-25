/** Display formatting — Indian number conventions (K / L / Cr). */

export function fmtIN(n: number, dec = 2): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export function fmtPrice(n: number, step = 1): string {
  const dec = step < 1 ? 2 : n >= 10000 ? 2 : 2;
  return fmtIN(n, dec);
}

/** OI / volume in K, Lakh, Crore. */
export function fmtOi(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return `${n}`;
}

/** Compact money (₹ Cr) for institutional flows. */
export function fmtCr(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}₹${fmtIN(Math.abs(n), 0)} Cr`;
}

export function fmtSigned(n: number, dec = 2): string {
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${fmtIN(Math.abs(n), dec)}`;
}

export function fmtPct(n: number, dec = 2): string {
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(dec)}%`;
}

export function fmtGreek(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
