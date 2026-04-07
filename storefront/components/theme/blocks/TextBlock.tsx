"use client";

import clsx from "clsx";
import type { BlockComponentProps } from "../types";

export default function TextBlock({ transformedProps }: BlockComponentProps) {
  const content = typeof transformedProps.content === "string" ? transformedProps.content : "";
  const align = typeof transformedProps.align === "string" ? transformedProps.align : "start";
  const tone = typeof transformedProps.tone === "string" ? transformedProps.tone : "default";
  const allowHtml = transformedProps.html === true;

  const toneClass = {
    default: "text-gray-700",
    muted: "text-gray-500",
    accent: "text-[var(--store-primary,#111827)]",
  }[tone] ?? "text-gray-700";

  const alignClass = {
    start: "text-start",
    center: "text-center",
    end: "text-end",
  }[align] ?? "text-start";

  if (allowHtml) {
    return <div className={clsx("leading-7", toneClass, alignClass)} dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return <p className={clsx("leading-7 whitespace-pre-wrap", toneClass, alignClass)}>{content}</p>;
}