import Link from "next/link";
import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import { Calendar, User, Eye, Tag } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

async function getBlogData(subdomain: string) {
  try {
    const [storeRes, postsRes] = await Promise.all([
      api.get(`/stores/s/${subdomain}`),
      api.get(`/blog/public/${subdomain}`).catch(() => ({ data: { posts: [] } })),
    ]);
    return {
      store: storeRes.data.store,
      posts: postsRes.data.posts ?? [],
      total: postsRes.data.total ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function BlogPage({ params }: Props) {
  const { subdomain } = await params;
  const data = await getBlogData(subdomain);
  if (!data) notFound();

  const { store, posts, total } = data;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">المدونة</h1>
          <p className="text-gray-500 mt-1">{total} مقال</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">لا توجد مقالات بعد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/${subdomain}/blog/${post.slug}`}
                className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {post.coverImage && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.titleAr || post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5">
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <h2 className="font-bold text-gray-900 text-lg leading-snug mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {post.titleAr || post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{post.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {post.authorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {post.authorName}
                      </span>
                    )}
                    {post.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString("ar-BH")}
                      </span>
                    )}
                    <span className="flex items-center gap-1 mr-auto">
                      <Eye className="h-3.5 w-3.5" />
                      {post.views}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
