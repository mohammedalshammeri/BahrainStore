"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { X } from "lucide-react";

interface PopupData {
  id: string;
  titleAr: string | null;
  title: string | null;
  bodyAr: string | null;
  body: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  trigger: "ON_LOAD" | "ON_EXIT" | "ON_SCROLL" | "AFTER_DELAY";
  delaySeconds: number;
  couponCode: string | null;
  imageUrl: string | null;
  showOnce: boolean;
}

function PopupModal({ popup, onClose }: { popup: PopupData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (popup.couponCode) {
      navigator.clipboard.writeText(popup.couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {popup.imageUrl && (
          <div className="relative h-48">
            <img src={popup.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6" dir="rtl">
          <div className="flex items-start justify-between gap-3 mb-3">
            {(popup.titleAr || popup.title) && (
              <h2 className="text-xl font-bold text-gray-900">{popup.titleAr || popup.title}</h2>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>

          {(popup.bodyAr || popup.body) && (
            <p className="text-gray-600 text-sm leading-relaxed mb-4">{popup.bodyAr || popup.body}</p>
          )}

          {popup.couponCode && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">كوبون الخصم</p>
                <code className="font-mono font-bold text-gray-900 text-lg">{popup.couponCode}</code>
              </div>
              <button
                onClick={handleCopy}
                className={`text-xs px-3 py-1.5 rounded-lg transition ${copied ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}
              >
                {copied ? "✓ تم النسخ" : "نسخ"}
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {popup.buttonText && popup.buttonUrl && (
              <a
                href={popup.buttonUrl}
                className="flex-1 bg-[var(--store-primary,#2563eb)] text-white text-sm font-semibold py-2.5 px-4 rounded-xl text-center hover:opacity-90 transition"
              >
                {popup.buttonText}
              </a>
            )}
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PopupDisplay({ subdomain }: { subdomain: string }) {
  const [popups, setPopups] = useState<PopupData[]>([]);
  const [current, setCurrent] = useState<PopupData | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get(`/popups/public/${subdomain}`)
      .then(res => setPopups((res.data as { popups: PopupData[] }).popups))
      .catch(() => {});
  }, [subdomain]);

  const show = useCallback((popup: PopupData) => {
    if (shown.has(popup.id)) return;
    if (popup.showOnce) {
      const key = `popup_shown_${popup.id}`;
      if (typeof window !== "undefined" && localStorage.getItem(key)) return;
      if (typeof window !== "undefined") localStorage.setItem(key, "1");
    }
    setShown(prev => new Set([...prev, popup.id]));
    setCurrent(popup);
  }, [shown]);

  useEffect(() => {
    if (!popups.length) return;

    popups.forEach(popup => {
      if (popup.trigger === "ON_LOAD") {
        setTimeout(() => show(popup), 500);
      } else if (popup.trigger === "AFTER_DELAY") {
        setTimeout(() => show(popup), (popup.delaySeconds ?? 5) * 1000);
      } else if (popup.trigger === "ON_EXIT") {
        const handler = (e: MouseEvent) => { if (e.clientY < 10) show(popup); };
        document.addEventListener("mouseleave", handler);
        return () => document.removeEventListener("mouseleave", handler);
      } else if (popup.trigger === "ON_SCROLL") {
        const handler = () => { if (window.scrollY > 300) { show(popup); window.removeEventListener("scroll", handler); } };
        window.addEventListener("scroll", handler);
        return () => window.removeEventListener("scroll", handler);
      }
    });
  }, [popups, show]);

  if (!current) return null;

  return (
    <PopupModal
      popup={current}
      onClose={() => setCurrent(null)}
    />
  );
}
