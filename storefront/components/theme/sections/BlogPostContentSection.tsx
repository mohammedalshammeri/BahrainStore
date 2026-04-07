import Link from "next/link";
import { ArrowRight, Calendar, Eye, Tag, User } from "lucide-react";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

function getWidthClass(contentWidth: string) {
  if (contentWidth === "wide") return "max-w-5xl";
  if (contentWidth === "medium") return "max-w-4xl";
  return "max-w-3xl";
}

export default function BlogPostContentSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const post = globalData.blogPost;

  if (!post) {
    return null;
  }

  const showCoverImage = settings.showCoverImage !== false;
  const showBackLink = settings.showBackLink !== false;
  const showMeta = settings.showMeta !== false;
  const showTags = settings.showTags !== false;
  const contentWidth = typeof settings.contentWidth === "string" ? settings.contentWidth : "narrow";
  const content = (post.contentAr || post.content || "").replace(/\n/g, "<br />");

  return (
    <SectionLayout section={section} className="py-0 md:py-0">
      <article className={`mx-auto w-full ${getWidthClass(contentWidth)}`} dir="rtl">
        {showCoverImage && post.coverImage ? (
          <div className="overflow-hidden rounded-[2rem] bg-slate-100">
            <img src={post.coverImage} alt={post.titleAr || post.title} className="h-64 w-full object-cover md:h-96" />
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-10 md:py-10">
          {showBackLink ? (
            <Link href={`/${globalData.subdomain}/blog`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-indigo-600">
              <ArrowRight className="h-4 w-4" />
              العودة للمدونة
            </Link>
          ) : null}

          {showTags && post.tags && post.tags.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <h1 className="text-3xl font-bold leading-tight text-slate-950 md:text-5xl">{post.titleAr || post.title}</h1>

          {showMeta ? (
            <div className="mb-8 mt-5 flex items-center gap-4 border-b border-slate-100 pb-6 text-sm text-slate-400">
              {post.authorName ? (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {post.authorName}
                </span>
              ) : null}
              {post.publishedAt ? (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(post.publishedAt).toLocaleDateString("ar-BH", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              ) : null}
              <span className="mr-auto flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {post.views ?? 0} مشاهدة
              </span>
            </div>
          ) : null}

          <div className="prose prose-lg max-w-none leading-relaxed text-slate-800" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </article>
    </SectionLayout>
  );
}