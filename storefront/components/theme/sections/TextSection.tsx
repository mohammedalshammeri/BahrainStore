import { BlockRenderer } from "../BlockRenderer";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function TextSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const text = typeof settings.text === "string" ? settings.text : typeof settings.textAr === "string" ? settings.textAr : "";
  const align = typeof settings.align === "string" ? settings.align : "center";

  return (
    <SectionLayout section={section}>
      <section className="mx-auto w-full max-w-4xl">
        {text && <p className="leading-relaxed text-gray-700" style={{ textAlign: align as "left" | "center" | "right" }}>{text}</p>}
        {section.blocks.length > 0 && <div className="mt-6"><BlockRenderer blocks={section.blocks} globalData={globalData} context="text" /></div>}
      </section>
    </SectionLayout>
  );
}