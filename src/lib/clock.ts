/** Client-safe IST clock + market-session state (mirrors server logic). */

export interface ClockInfo {
  time: string; // HH:MM:SS IST
  session: "open" | "preopen" | "closed";
  label: string;
}

export function istClock(nowMs = Date.now()): ClockInfo {
  const ist = new Date(nowMs + 330 * 60000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const day = ist.getUTCDay();
  const wd = day >= 1 && day <= 5;
  let session: ClockInfo["session"] = "closed";
  if (wd && mins >= 555 && mins <= 930) session = "open";
  else if (wd && mins >= 540 && mins < 555) session = "preopen";
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    time: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`,
    session,
    label: session === "open" ? "Market live" : session === "preopen" ? "Pre-open" : "Market closed",
  };
}
