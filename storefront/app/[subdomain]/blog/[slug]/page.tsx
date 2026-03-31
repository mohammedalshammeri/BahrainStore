import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, User, ArrowRight, Tag, Eye } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
}

async function getPost(subdomain: string, slug: string) {
  try {
    const [storeRes, postRes] = await Promise.all([
      api.get(`/stores/s/${subdomain}`),
      api.get(`/blog/public/${subdomain}/${slug}`),
    ]);
    return { store: storeRes.data.store, post: postRes.data.post };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const data = await getPost(subdomain, slug);
  if (!data) return {};
  const { post } = data;
  return {
    title: post.seoTitle || post.titleAr || post.title,
    description: post.seoDesc || post.excerpt,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { subdomain, slug } = await params;
  const data = await getPost(subdomain, slug);
  if (!data) notFound();

  const { store, post } = data;

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      {/* Cover */}
      {post.coverImage && (
        <div className="w-full h-64 md:h-96 overflow-hidden">
          <img src={post.coverImage} alt={post.titleAr || post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Back */}
        <Link href={`/${subdomain}/blog`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 mb-6">
          <ArrowRight className="h-4 w-4" />
          العودة للمدونة
        </Link>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag: string) => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
          {post.titleAr || post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-gray-400 mb-8 pb-6 border-b">
          {post.authorName && (
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {post.authorName}
            </span>
          )}
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(post.publishedAt).toLocaleDateString("ar-BH", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1.5 mr-auto">
            <Eye className="h-4 w-4" />
            {post.views} مشاهدة
          </span>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none text-gray-800 leading-relaxed">
          {(post.contentAr || post.content).split('\n').map((para: string, i: number) =>
            para.trim() ? <p key={i} className="mb-4">{para}</p> : <br key={i} />
          )}
        </div>
      </div>
    </div>
  );
}
