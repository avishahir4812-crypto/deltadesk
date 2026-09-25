/**
 * Black–Scholes pricing & Greeks. Pure + client-safe (shared with the
 * strategy payoff lab in the browser).
 */

const SQRT2 = Math.SQRT2;
const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

export const normCdf = (x: number): number => 0.5 * (1 + erf(x / SQRT2));
export const normPdf = (x: number): number => INV_SQRT_2PI * Math.exp(-0.5 * x * x);

export type OptionSide = "CE" | "PE";

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per calendar day
  vega: number; // per 1 vol point
}

export function bs(
  side: OptionSide,
  S: number,
  K: number,
  T: number, // years
  sigma: number,
  r = 0.065
): Greeks {
  const t = Math.max(T, 0.5 / 365); // floor at half a day
  const vol = Math.max(sigma, 0.01);
  const sd = vol * Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * t) / sd;
  const d2 = d1 - sd;
  const pdf = normPdf(d1);
  const disc = Math.exp(-r * t);

  let price: number;
  let delta: number;
  let theta: number;
  if (side === "CE") {
    price = S * normCdf(d1) - K * disc * normCdf(d2);
    delta = normCdf(d1);
    theta = -(S * pdf * vol) / (2 * Math.sqrt(t)) - r * K * disc * normCdf(d2);
  } else {
    price = K * disc * normCdf(-d2) - S * normCdf(-d1);
    delta = normCdf(d1) - 1;
    theta = -(S * pdf * vol) / (2 * Math.sqrt(t)) + r * K * disc * normCdf(-d2);
  }

  const gamma = pdf / (S * sd);
  const vega = (S * pdf * sd) / 100;

  return { price: Math.max(price, 0.05), delta, gamma, theta: theta / 365, vega };
}

/** Probability the underlying finishes above K at expiry (lognormal, driftless). */
export function probAbove(S: number, K: number, T: number, sigma: number): number {
  const t = Math.max(T, 1e-6);
  const sd = sigma * Math.sqrt(t);
  const d2 = (Math.log(S / K) - 0.5 * sigma * sigma * t) / sd;
  return normCdf(d2);
}
