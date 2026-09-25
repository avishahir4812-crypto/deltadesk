/** IST trading-calendar helpers. All wall-clock logic is UTC-shifted IST. */

const IST_OFFSET_MIN = 330;

export const MKT_OPEN = 9 * 60 + 15; // 09:15 IST
export const MKT_CLOSE = 15 * 60 + 30; // 15:30 IST
export const SESSION_MINUTES = MKT_CLOSE - MKT_OPEN; // 375

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** A Date whose UTC fields equal IST wall clock. */
export function istNow(offsetMs = 0): Date {
  return new Date(Date.now() + offsetMs + IST_OFFSET_MIN * 60000);
}

export function dayKeyOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function minutesOfDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKeyOf(new Date(Date.UTC(y, m - 1, d + delta)));
}

export function weekdayOf(key: string): number {
  return parseKey(key).getUTCDay();
}

export function isTradingDay(key: string): boolean {
  const w = weekdayOf(key);
  return w >= 1 && w <= 5;
}

export function latestTradingDayKey(offsetMs = 0): string {
  let key = dayKeyOf(istNow(offsetMs));
  while (!isTradingDay(key)) key = addDaysKey(key, -1);
  return key;
}

export function prevTradingDayKey(key: string): string {
  let k = addDaysKey(key, -1);
  while (!isTradingDay(k)) k = addDaysKey(k, -1);
  return k;
}

export function dteDays(fromKey: string, toKey: string): number {
  return Math.round((parseKey(toKey).getTime() - parseKey(fromKey).getTime()) / 86_400_000);
}

export function formatDayKey(key: string, withYear = false): string {
  const d = parseKey(key);
  const base = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${base} ${String(d.getUTCFullYear()).slice(2)}` : base;
}

export type MktStatus = "open" | "preopen" | "closed";

export interface StatusInfo {
  status: MktStatus;
  label: string;
  dayKey: string;
  viewingToday: boolean;
  minutes: number;
  timeLabel: string;
  dateLabel: string;
}

export function marketStatus(offsetMs = 0): StatusInfo {
  const now = istNow(offsetMs);
  const mins = minutesOfDay(now);
  const wk = now.getUTCDay();
  const isWkday = wk >= 1 && wk <= 5;
  let status: MktStatus = "closed";
  let label = "Market closed";
  if (isWkday) {
    if (mins >= MKT_OPEN && mins <= MKT_CLOSE) {
      status = "open";
      label = "Live · NSE F&O";
    } else if (mins >= 9 * 60 && mins < MKT_OPEN) {
      status = "preopen";
      label = "Pre-open session";
    }
  }
  const dayKey = latestTradingDayKey(offsetMs);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const d = parseKey(dayKey);
  return {
    status,
    label,
    dayKey,
    viewingToday: isWkday && dayKeyOf(now) === dayKey,
    minutes: mins,
    timeLabel: `${hh}:${mm}:${ss} IST`,
    dateLabel: `${DAYS[d.getUTCDay()]}, ${formatDayKey(dayKey, true)}`,
  };
}

/** Minutes elapsed in the trading session (0 → 375). Pins to close when shut. */
export function liveMinute(offsetMs = 0): number {
  const now = istNow(offsetMs);
  const wk = now.getUTCDay();
  const isWkday = wk >= 1 && wk <= 5;
  if (!isWkday) return SESSION_MINUTES;
  const mins = minutesOfDay(now);
  if (mins < MKT_OPEN) return 0;
  if (mins > MKT_CLOSE) return SESSION_MINUTES;
  return mins - MKT_OPEN;
}

/** Next `count` dates (>= fromKey) falling on `targetWk` (0 Sun … 6 Sat). */
export function nextWeekdayDates(targetWk: number, count: number, fromKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  let guard = 0;
  while (out.length < count && guard < 365) {
    if (isTradingDay(k) && weekdayOf(k) === targetWk) out.push(k);
    k = addDaysKey(k, 1);
    guard++;
  }
  return out;
}

/** Monthly expiry = last `targetWk` of the month. */
export function monthlyExpiryDates(targetWk: number, count: number, fromKey: string): string[] {
  const out: string[] = [];
  const [fy, fm] = fromKey.split("-").map(Number);
  for (let i = 0; out.length < count && i < 12; i++) {
    const y = fy + Math.floor((fm - 1 + i) / 12);
    const m = (fm - 1 + i) % 12;
    let d = new Date(Date.UTC(y, m + 1, 0));
    while (d.getUTCDay() !== targetWk) d = new Date(d.getTime() - 86_400_000);
    const key = dayKeyOf(d);
    if (key >= fromKey) out.push(key);
  }
  return out;
}
