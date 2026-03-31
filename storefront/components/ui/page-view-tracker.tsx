"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

interface Props {
  storeId: string;
}

export function PageViewTracker({ storeId }: Props) {
  const pathname = usePathname();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    if (!storeId || pathname === lastTracked.current) return;
    lastTracked.current = pathname;

    const referrer = typeof document !== "undefined" ? document.referrer : "";
    // Fire-and-forget; ignore any errors silently
    api.post("/analytics/pageview", {
      storeId,
      path: pathname,
      referrer: referrer || undefined,
    }).catch(() => { /* ignore */ });
  }, [pathname, storeId]);

  return null;
}
