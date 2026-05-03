"use client";

import { useState, useEffect } from "react";
import {
  CURRENCIES,
  fetchRates,
  convertCents,
  getCachedRates,
} from "@/lib/rates";
import { formatCents } from "@/lib/calc";

export default function ConvertedAmount({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  const [rates, setRates] = useState<Record<string, number> | null>(
    getCachedRates()
  );

  useEffect(() => {
    if (rates) return;
    let cancelled = false;
    fetchRates().then((r) => {
      if (!cancelled && r) setRates(r);
    });
    return () => {
      cancelled = true;
    };
  }, [rates]);

  const conversions: { code: string; cents: number }[] = [];
  if (rates) {
    for (const c of CURRENCIES) {
      if (c === currency) continue;
      const converted = convertCents(cents, currency, c, rates);
      if (converted !== null) conversions.push({ code: c, cents: converted });
    }
  }

  return (
    <span className={`relative inline-block group ${className || ""}`}>
      <span className={conversions.length > 0 ? "cursor-help" : ""}>
        {formatCents(cents, currency)}
      </span>
      {conversions.length > 0 && (
        <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg pointer-events-none">
          <span className="block opacity-70 mb-1">Approx. equivalents</span>
          {conversions.map((c) => (
            <span key={c.code} className="block">
              {formatCents(c.cents, c.code)}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
