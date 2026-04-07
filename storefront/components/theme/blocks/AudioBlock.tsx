"use client";

import { Headphones, Volume2 } from "lucide-react";
import type { BlockComponentProps } from "../types";

export default function AudioBlock({ transformedProps }: BlockComponentProps) {
  const src = typeof transformedProps.src === "string" ? transformedProps.src : "";
  const title = typeof transformedProps.title === "string" ? transformedProps.title : "مقطع صوتي";
  const description = typeof transformedProps.description === "string" ? transformedProps.description : "";
  const autoPlay = transformedProps.autoPlay === true;
  const loop = transformedProps.loop === true;

  if (!src) {
    return <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Audio source is missing</div>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--store-primary,#111827),white_88%)] text-[var(--store-primary,#111827)]">
          <Volume2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-gray-400" />
            <h3 className="truncate text-sm font-semibold text-gray-900">{title}</h3>
          </div>
          {description && <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>}
        </div>
      </div>

      <audio className="w-full" controls autoPlay={autoPlay} loop={loop} preload="metadata">
        <source src={src} />
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}