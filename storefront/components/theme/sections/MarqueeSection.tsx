import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function MarqueeSection({ section }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const text = typeof settings.text === "string" ? settings.text : "";
  const speed = typeof settings.speed === "string" ? settings.speed : "normal";
  const bgColor = typeof settings.bgColor === "string" ? settings.bgColor : "#1e1b4b";
  const textColor = typeof settings.textColor === "string" ? settings.textColor : "#fff";
  const duration = speed === "slow" ? "40s" : speed === "fast" ? "15s" : "25s";

  if (!text) return null;

  return (
    <SectionLayout section={section} className="py-0">
      <div className="overflow-hidden rounded-2xl py-3" style={{ background: bgColor, color: textColor }}>
        <div className="flex whitespace-nowrap" style={{ animation: `marquee ${duration} linear infinite` }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="mx-8 text-sm font-medium">{text}</span>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
      </div>
    </SectionLayout>
  );
}