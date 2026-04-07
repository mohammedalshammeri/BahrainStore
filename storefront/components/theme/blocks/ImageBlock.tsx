"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { BlockComponentProps } from "../types";

export default function ImageBlock({ transformedProps }: BlockComponentProps) {
  const src = typeof transformedProps.src === "string" ? transformedProps.src : "";
  const alt = typeof transformedProps.alt === "string" ? transformedProps.alt : "";
  const href = typeof transformedProps.href === "string" ? transformedProps.href : "";

  if (!src) {
    return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Image source is missing</div>;
  }

  const style: CSSProperties = {
    width: typeof transformedProps.width === "string" ? transformedProps.width : "100%",
    height: typeof transformedProps.height === "string" ? transformedProps.height : "auto",
    objectFit: typeof transformedProps.objectFit === "string" ? (transformedProps.objectFit as CSSProperties["objectFit"]) : "cover",
  };

  const content = (
    <Image
      src={src}
      alt={alt}
      width={1200}
      height={800}
      className="rounded-xl"
      style={style}
    />
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}