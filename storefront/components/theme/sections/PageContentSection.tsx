import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

function getSurfaceClasses(surfaceStyle: string) {
  if (surfaceStyle === "card") {
    return "rounded-3xl border border-gray-200 bg-white shadow-sm px-6 py-8 md:px-10 md:py-10";
  }

  return "";
}

function getWidthClass(contentWidth: string) {
  if (contentWidth === "wide") {
    return "max-w-5xl";
  }

  if (contentWidth === "medium") {
    return "max-w-4xl";
  }

  return "max-w-3xl";
}

export default function PageContentSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const page = globalData.page;

  if (!page) {
    return null;
  }

  const showTitle = settings.showTitle !== false;
  const showExcerpt = settings.showExcerpt !== false;
  const contentWidth = typeof settings.contentWidth === "string" ? settings.contentWidth : "narrow";
  const surfaceStyle = typeof settings.surfaceStyle === "string" ? settings.surfaceStyle : "plain";
  const content = (page.contentAr || page.content || "").trim();
  const title = page.titleAr || page.title;
  const excerpt = page.excerpt || "";

  return (
    <SectionLayout section={section}>
      <section className={`mx-auto w-full ${getWidthClass(contentWidth)}`} dir="rtl">
        <div className={getSurfaceClasses(surfaceStyle)}>
          {showTitle ? (
            <header className="border-b border-gray-100 pb-6">
              <h1 className="text-3xl font-bold tracking-tight text-gray-950 md:text-4xl">{title}</h1>
              {showExcerpt && excerpt ? (
                <p className="mt-4 text-base leading-8 text-gray-500 md:text-lg">{excerpt}</p>
              ) : null}
            </header>
          ) : showExcerpt && excerpt ? (
            <p className="mb-8 text-base leading-8 text-gray-500 md:text-lg">{excerpt}</p>
          ) : null}

          <div
            className={`prose prose-lg mt-8 max-w-none text-gray-800 ${surfaceStyle === "card" ? "prose-headings:mt-8" : ""}`}
            dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br />") }}
          />
        </div>
      </section>
    </SectionLayout>
  );
}