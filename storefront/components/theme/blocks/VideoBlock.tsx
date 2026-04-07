"use client";

import type { CSSProperties } from "react";
import type { BlockComponentProps } from "../types";

function getEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }

    return url;
  } catch {
    return url;
  }
}

export default function VideoBlock({ transformedProps }: BlockComponentProps) {
  const src = typeof transformedProps.src === "string" ? transformedProps.src : "";
  const title = typeof transformedProps.title === "string" ? transformedProps.title : "الفيديو";
  const aspectRatio = typeof transformedProps.aspectRatio === "string" ? transformedProps.aspectRatio : "16 / 9";
  const mode = typeof transformedProps.mode === "string" ? transformedProps.mode : "embed";
  const autoPlay = transformedProps.autoPlay === true;
  const muted = transformedProps.muted === true;
  const controls = transformedProps.controls !== false;

  if (!src) {
    return <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Video source is missing</div>;
  }

  const style: CSSProperties = { aspectRatio };

  if (mode === "file") {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm" style={style}>
        <video className="h-full w-full" controls={controls} autoPlay={autoPlay} muted={muted} playsInline>
          <source src={src} />
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm" style={style}>
      <iframe
        src={getEmbedUrl(src)}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}