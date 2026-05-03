export const CURRENCIES = ["GBP", "MYR", "NTD", "USD", "EUR"] as const;

// Map app currency codes to ISO codes used by the rates API.
const ISO_CODE: Record<string, string> = { NTD: "TWD" };

let ratesCache: Record<string, number> | null = null;
let ratesPromise: Promise<Record<string, number> | null> | null = null;

export function getCachedRates(): Record<string, number> | null {
  return ratesCache;
}

export function fetchRates(): Promise<Record<string, number> | null> {
  if (ratesCache) return Promise.resolve(ratesCache);
  if (ratesPromise) return ratesPromise;
  ratesPromise = fetch("https://open.er-api.com/v6/latest/USD")
    .then((r) => r.json())
    .then((data) => {
      if (data?.result === "success" && data.rates) {
        ratesCache = data.rates as Record<string, number>;
        return ratesCache;
      }
      return null;
    })
    .catch(() => null);
  return ratesPromise;
}

export function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number | null {
  const fromIso = ISO_CODE[fromCurrency] ?? fromCurrency;
  const toIso = ISO_CODE[toCurrency] ?? toCurrency;
  const fromRate = rates[fromIso];
  const toRate = rates[toIso];
  if (!fromRate || !toRate) return null;
  return Math.round(cents * (toRate / fromRate));
}
