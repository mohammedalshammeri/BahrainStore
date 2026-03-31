"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Zap, X } from "lucide-react";

interface FlashSale {
  id: string;
  name: string;
  nameAr: string;
  startsAt: string;
  endsAt: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
}

function useCountdown(endsAt: string) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(endsAt).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, new Date(endsAt).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return { h, m, s, done: remaining === 0 };
}

function SaleCountdown({ endsAt }: { endsAt: string }) {
  const { h, m, s, done } = useCountdown(endsAt);
  if (done) return <span className="text-xs opacity-75">انتهى العرض</span>;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="text-sm font-mono font-bold tracking-wider">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}

export function FlashSaleBanner({ subdomain }: { subdomain: string }) {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get(`/flash-sales/public/${subdomain}`)
      .then((res) => setSales(res.data.flashSales ?? []))
      .catch(() => {});
  }, [subdomain]);

  if (dismissed || sales.length === 0) return null;

  const sale = sales[idx];
  const discount = sale.discountType === "PERCENTAGE"
    ? `خصم ${sale.discountValue}%`
    : `خصم ${Number(sale.discountValue).toFixed(3)} د.ب`;

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3" dir="rtl">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Zap className="h-4 w-4 flex-shrink-0 animate-pulse" />
          <span className="text-sm font-bold truncate">{sale.nameAr || sale.name}</span>
          <span className="text-sm opacity-90 hidden sm:inline">—</span>
          <span className="text-sm opacity-90 hidden sm:inline">{discount}</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 text-sm opacity-90">
            <span className="hidden sm:inline text-xs">ينتهي خلال:</span>
            <SaleCountdown endsAt={sale.endsAt} />
          </div>
          {sales.length > 1 && (
            <div className="flex gap-1">
              {sales.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition ${i === idx ? "bg-white" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
          <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
