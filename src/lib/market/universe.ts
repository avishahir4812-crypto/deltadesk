/** Instrument universe — liquid index & stock F&O contracts (NSE / BSE). */

export interface Instrument {
  symbol: string;
  name: string;
  kind: "index" | "stock";
  base: number; // reference price the walk is anchored to
  step: number; // strike interval
  lot: number; // market lot (revised framework, Nov 2024)
  ivBase: number; // baseline annualised IV
  oiScale: number; // relative open-interest magnitude
  volTick: number; // per-bar volatility of the intraday walk
  dayRange: number; // typical day move magnitude
  expiryWkday: number; // weekly/monthly expiry weekday (0 Sun … 6 Sat)
  weekly: boolean; // weekly options available
  exch: "NSE" | "BSE";
}

export const INDICES: Instrument[] = [
  { symbol: "NIFTY", name: "NIFTY 50", kind: "index", base: 24318, step: 50, lot: 75, ivBase: 0.112, oiScale: 100, volTick: 0.0011, dayRange: 0.015, expiryWkday: 4, weekly: true, exch: "NSE" },
  { symbol: "BANKNIFTY", name: "NIFTY BANK", kind: "index", base: 51386, step: 100, lot: 35, ivBase: 0.138, oiScale: 58, volTick: 0.0015, dayRange: 0.019, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "FINNIFTY", name: "NIFTY FIN SERVICE", kind: "index", base: 23748, step: 50, lot: 65, ivBase: 0.128, oiScale: 20, volTick: 0.0013, dayRange: 0.016, expiryWkday: 2, weekly: true, exch: "NSE" },
  { symbol: "MIDCPNIFTY", name: "NIFTY MIDCAP SELECT", kind: "index", base: 12842, step: 50, lot: 140, ivBase: 0.132, oiScale: 15, volTick: 0.0014, dayRange: 0.017, expiryWkday: 1, weekly: true, exch: "NSE" },
  { symbol: "SENSEX", name: "S&P BSE SENSEX", kind: "index", base: 79881, step: 100, lot: 20, ivBase: 0.108, oiScale: 34, volTick: 0.0011, dayRange: 0.015, expiryWkday: 5, weekly: true, exch: "BSE" },
];

export const STOCKS: Instrument[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", kind: "stock", base: 2952, step: 20, lot: 500, ivBase: 0.21, oiScale: 11, volTick: 0.0021, dayRange: 0.024, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "HDFCBANK", name: "HDFC Bank", kind: "stock", base: 1014, step: 20, lot: 550, ivBase: 0.19, oiScale: 9, volTick: 0.0019, dayRange: 0.02, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "ICICIBANK", name: "ICICI Bank", kind: "stock", base: 1287, step: 25, lot: 700, ivBase: 0.2, oiScale: 8, volTick: 0.0019, dayRange: 0.021, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "SBIN", name: "State Bank of India", kind: "stock", base: 782, step: 10, lot: 1500, ivBase: 0.24, oiScale: 10, volTick: 0.0021, dayRange: 0.023, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "TCS", name: "Tata Consultancy Svcs", kind: "stock", base: 4124, step: 40, lot: 175, ivBase: 0.22, oiScale: 6, volTick: 0.0019, dayRange: 0.02, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "INFY", name: "Infosys", kind: "stock", base: 1586, step: 20, lot: 400, ivBase: 0.25, oiScale: 7, volTick: 0.0021, dayRange: 0.023, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "TATAMOTORS", name: "Tata Motors", kind: "stock", base: 962, step: 10, lot: 550, ivBase: 0.31, oiScale: 9, volTick: 0.0026, dayRange: 0.03, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", kind: "stock", base: 918, step: 10, lot: 750, ivBase: 0.27, oiScale: 7, volTick: 0.0022, dayRange: 0.025, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "AXISBANK", name: "Axis Bank", kind: "stock", base: 1118, step: 20, lot: 625, ivBase: 0.22, oiScale: 6, volTick: 0.002, dayRange: 0.021, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "LT", name: "Larsen & Toubro", kind: "stock", base: 3618, step: 40, lot: 150, ivBase: 0.26, oiScale: 5, volTick: 0.0021, dayRange: 0.023, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "MARUTI", name: "Maruti Suzuki", kind: "stock", base: 12416, step: 100, lot: 50, ivBase: 0.24, oiScale: 4, volTick: 0.002, dayRange: 0.02, expiryWkday: 4, weekly: false, exch: "NSE" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", kind: "stock", base: 1982, step: 20, lot: 400, ivBase: 0.21, oiScale: 5, volTick: 0.0019, dayRange: 0.02, expiryWkday: 4, weekly: false, exch: "NSE" },
];

export const ALL: Instrument[] = [...INDICES, ...STOCKS];

const bySymbol = new Map(ALL.map((i) => [i.symbol, i]));

export function instrument(symbol: string): Instrument {
  const hit = bySymbol.get(symbol.toUpperCase());
  if (!hit) throw new Error(`Unknown instrument: ${symbol}`);
  return hit;
}

export function hasInstrument(symbol: string): boolean {
  return bySymbol.has(symbol.toUpperCase());
}

export const EXPIRY_DAY_LABEL: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
};
