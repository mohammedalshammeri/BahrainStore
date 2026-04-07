import Link from "next/link";
import Image from "next/image";
import { BlockRenderer } from "../BlockRenderer";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

export default function BannerSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const title = typeof settings.title === "string" ? settings.title : typeof settings.titleAr === "string" ? settings.titleAr : "";
  const imageUrl = typeof settings.imageUrl === "string" ? settings.imageUrl : "";
  const buttonText = typeof settings.buttonTextAr === "string" ? settings.buttonTextAr : typeof settings.buttonText === "string" ? settings.buttonText : "";
  const buttonLink = typeof settings.buttonLink === "string" ? settings.buttonLink : `/${globalData.subdomain}/products`;
  const overlayOpacity = typeof settings.overlayOpacity === "number" ? settings.overlayOpacity : 0.45;
  const height = typeof settings.height === "number" ? settings.height : 400;

  return (
    <SectionLayout section={section} className="py-0">
      <section className="relative overflow-hidden rounded-[2rem]" style={{ height }}>
        {imageUrl && <Image src={imageUrl} alt={title} fill className="object-cover" />}
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlayOpacity})` }} />
        <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
          {title && <h2 className="mb-4 text-3xl font-bold text-white md:text-5xl">{title}</h2>}
          {buttonText && (
            <Link href={buttonLink} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold text-gray-900 transition hover:opacity-90">
              {buttonText}
            </Link>
          )}
          {section.blocks.length > 0 && (
            <div className="mt-6 w-full max-w-3xl">
              <BlockRenderer blocks={section.blocks} globalData={globalData} context="banner" layout={{ align: "center" }} />
            </div>
          )}
        </div>
      </section>
    </SectionLayout>
  );
}