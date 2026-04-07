import type { CSSProperties } from "react";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function DividerSection({ section }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const style: CSSProperties = {
    height: typeof settings.height === "number" ? `${settings.height}px` : typeof settings.height === "string" ? settings.height : "40px",
    background: typeof settings.color === "string" ? settings.color : "transparent",
  };

  return (
    <SectionLayout section={section} className="py-0">
      <div style={style} />
    </SectionLayout>
  );
}