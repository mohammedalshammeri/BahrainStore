"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

const CURRENCIES = [
  { code: "BHD", flag: "🇧🇭", name: "BHD" },
  { code: "SAR", flag: "🇸🇦", name: "SAR" },
  { code: "AED", flag: "🇦🇪", name: "AED" },
  { code: "KWD", flag: "🇰🇼", name: "KWD" },
  { code: "QAR", flag: "🇶🇦", name: "QAR" },
  { code: "USD", flag: "🇺🇸", name: "USD" },
  { code: "EUR", flag: "🇪🇺", name: "EUR" },
];

const CURRENCY_KEY = "selected_currency";
const RATES_KEY = "currency_rates";
const RATES_TTL = 1000 * 60 * 60; // 1 hour

export function CurrencySelector({ storeSubdomain }: { storeSubdomain?: string }) {
  const [selected, setSelected] = useState("BHD");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (saved) setSelected(saved);

    // Fetch and cache exchange rates
    const cachedRates = localStorage.getItem(RATES_KEY);
    const cachedTime = localStorage.getItem(RATES_KEY + "_time");
    const isStale = !cachedTime || Date.now() - parseInt(cachedTime) > RATES_TTL;

    if (!cachedRates || isStale) {
      fetch(`/api/currencies/rates?base=BHD`)
        .then(r => r.json())
        .then(data => {
          if (data.rates) {
            localStorage.setItem(RATES_KEY, JSON.stringify(data.rates));
            localStorage.setItem(RATES_KEY + "_time", Date.now().toString());
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectCurrency = (code: string) => {
    setSelected(code);
    localStorage.setItem(CURRENCY_KEY, code);
    setOpen(false);
    // Dispatch event so price components can update
    window.dispatchEvent(new CustomEvent("currencyChange", { detail: { currency: code } }));
  };

  const current = CURRENCIES.find(c => c.code === selected) || CURRENCIES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span>{current.flag}</span>
        <span className="text-gray-700 dark:text-gray-200">{current.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[120px]">
          {CURRENCIES.map(currency => (
            <button
              key={currency.code}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                selected === currency.code ? "text-indigo-600 dark:text-indigo-400 font-medium" : "text-gray-700 dark:text-gray-200"
              }`}
              onClick={() => selectCurrency(currency.code)}
            >
              <span>{currency.flag}</span>
              <span>{currency.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook to convert price based on selected currency
export function useConvertedPrice(priceBHD: number): { price: number; currency: string; symbol: string } {
  const [currency, setCurrency] = useState("BHD");
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    const saved = localStorage.getItem(CURRENCY_KEY) || "BHD";
    setCurrency(saved);
    const cachedRates = localStorage.getItem(RATES_KEY);
    if (cachedRates) setRates(JSON.parse(cachedRates));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setCurrency(detail.currency);
    };
    window.addEventListener("currencyChange", handler);
    return () => window.removeEventListener("currencyChange", handler);
  }, []);

  const SYMBOLS: Record<string, string> = {
    BHD: "د.ب", SAR: "ر.س", AED: "د.إ", KWD: "د.ك",
    QAR: "ر.ق", USD: "$", EUR: "€", OMR: "ر.ع", EGP: "ج.م",
  };

  const rate = rates[currency] || 1;
  const converted = currency === "BHD" ? priceBHD : priceBHD * rate;

  return {
    price: Math.round(converted * 1000) / 1000,
    currency,
    symbol: SYMBOLS[currency] || currency,
  };
}
