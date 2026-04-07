import Link from "next/link";
import { Calendar, Eye, Tag, User } from "lucide-react";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

function clampColumns(input: unknown) {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return "lg:grid-cols-3";
  }

  if (input <= 1) return "lg:grid-cols-1";
  if (input === 2) return "lg:grid-cols-2";
  if (input >= 4) return "lg:grid-cols-4";
  return "lg:grid-cols-3";
}

export default function BlogPostsSection({ section, globalData }: SectionProps) {
  const settings = section.settings as Record<string, unknown>;
  const posts = globalData.blogPosts ?? [];
  const count = typeof settings.count === "number" && settings.count > 0 ? settings.count : 6;
  const title = typeof settings.titleAr === "string" && settings.titleAr.trim()
    ? settings.titleAr
    : globalData.blogPost
      ? "مقالات أخرى"
      : "المدونة";
  const showExcerpt = settings.showExcerpt !== false;
  const showMeta = settings.showMeta !== false;
  const showImages = settings.showImages !== false;
  const visiblePosts = posts.slice(0, count);

  if (visiblePosts.length === 0 && !globalData.blogPost) {
    return (
      <SectionLayout section={section}>
        <div className="w-full py-16 text-center text-gray-400" dir="rtl">
          <p className="text-lg">لا توجد مقالات بعد</p>
        </div>
      </SectionLayout>
    );
  }

  if (visiblePosts.length === 0) {
    return null;
  }

  return (
    <SectionLayout section={section}>
      <div className="w-full" dir="rtl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stories</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h2>
          </div>
          {!globalData.blogPost ? <span className="text-sm text-slate-500">{posts.length} مقال</span> : null}
        </div>

        <div className={`grid grid-cols-1 gap-6 md:grid-cols-2 ${clampColumns(settings.columns)}`}>
          {visiblePosts.map((post) => (
            <Link
              key={post.id}
              href={`/${globalData.subdomain}/blog/${post.slug}`}
              className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              {showImages && post.coverImage ? (
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={post.coverImage}
                    alt={post.titleAr || post.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
              ) : null}
              <div className="p-5">
                {post.tags && post.tags.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <h3 className="text-lg font-bold leading-snug text-slate-950 transition-colors group-hover:text-indigo-600">
                  {post.titleAr || post.title}
                </h3>
                {showExcerpt && post.excerpt ? (
                  <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{post.excerpt}</p>
                ) : null}
                {showMeta ? (
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                    {post.authorName ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {post.authorName}
                      </span>
                    ) : null}
                    {post.publishedAt ? (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString("ar-BH")}
                      </span>
                    ) : null}
                    <span className="mr-auto flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {post.views ?? 0}
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SectionLayout>
  );
}