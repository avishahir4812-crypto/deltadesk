/** Domain types shared between API routes, DB JSON payloads, and the UI. */

export interface StrategyLeg {
  kind: "CE" | "PE" | "FUT";
  side: "BUY" | "SELL";
  strike?: number;
  lots: number;
  entry: number; // premium per unit (or futures price)
}

export interface SavedStrategy {
  id: string;
  name: string;
  symbol: string;
  expiry: string;
  legs: StrategyLeg[];
  thesis?: string | null;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WatchItem {
  id: number;
  symbol: string;
  label: string;
  kind: string;
}
