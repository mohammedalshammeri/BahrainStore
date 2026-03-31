"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface CountdownTimer {
  id: string;
  title: string | null;
  titleAr: string | null;
  endsAt: string;
  style: string;
  targetUrl: string | null;
}

function useCountdown(endsAt: string) {
  const [diff, setDiff] = useState(new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(new Date(endsAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

function TimerUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] opacity-70 mt-0.5">{label}</span>
    </div>
  );
}

function SingleTimer({ timer }: { timer: CountdownTimer }) {
  const time = useCountdown(timer.endsAt);
  if (!time) return null;

  const content = (
    <div className="flex items-center gap-4 justify-center w-full">
      <span className="font-semibold text-sm">{timer.titleAr ?? timer.title ?? "ينتهي العرض خلال:"}</span>
      <div className="flex items-center gap-2">
        {time.d > 0 && <><TimerUnit value={time.d} label="يوم" /><span className="opacity-60">:</span></>}
        <TimerUnit value={time.h} label="ساعة" />
        <span className="opacity-60">:</span>
        <TimerUnit value={time.m} label="دقيقة" />
        <span className="opacity-60">:</span>
        <TimerUnit value={time.s} label="ثانية" />
      </div>
    </div>
  );

  if (timer.targetUrl) {
    return <a href={timer.targetUrl} className="flex items-center gap-3 justify-center w-full">{content}</a>;
  }
  return content;
}

export function CountdownTimerBanner({ storeId }: { storeId: string }) {
  const [timers, setTimers] = useState<CountdownTimer[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get(`/countdown/public?storeId=${storeId}`)
      .then(r => setTimers(r.data as CountdownTimer[]))
      .catch(() => {});
  }, [storeId]);

  const barTimers = timers
    .filter(t => t.style === "BAR" && !dismissed.has(t.id))
    .slice(0, 1);

  if (!barTimers.length) return null;

  const timer = barTimers[0];

  return (
    <div className="relative bg-gradient-to-r from-red-600 to-pink-600 text-white py-2 px-4">
      <SingleTimer timer={timer} />
      <button
        onClick={() => setDismissed(p => new Set([...p, timer.id]))}
        className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 text-lg leading-none"
        aria-label="إغلاق"
      >
        ×
      </button>
    </div>
  );
}
