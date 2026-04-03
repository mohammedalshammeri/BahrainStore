"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator && !swRegistered) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then(() => setSwRegistered(true))
        .catch(() => {});
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed) setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [swRegistered]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
    if (outcome === "dismissed") {
      localStorage.setItem("pwa-install-dismissed", "1");
    }
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 dark:text-white">تثبيت التطبيق</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">تجربة أسرع وأفضل</div>
      </div>
      <button
        onClick={install}
        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
      >
        تثبيت
      </button>
      <button onClick={dismiss} className="text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
