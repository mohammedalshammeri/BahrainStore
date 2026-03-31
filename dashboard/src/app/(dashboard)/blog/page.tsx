"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Eye, Edit, Trash2, Loader2, Globe, EyeOff } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  titleAr: string | null;
  slug: string;
  isPublished: boolean;
  publishedAt: string | null;
  coverImage: string | null;
  views: number;
  tags: string[];
  createdAt: string;
}

export default function BlogPage() {
  const { store } = useAuthStore();
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchPosts = useCallback(async () => {
    if (!store?.id) return;
    try {
      setLoading(true);
      const res = await api.get(`/blog?storeId=${store.id}`);
      setPosts(res.data.posts ?? []);
      setTotal(res.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function togglePublish(post: BlogPost) {
    await api.put(`/blog/${post.id}`, { isPublished: !post.isPublished });
    fetchPosts();
  }

  async function deletePost(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المقال؟")) return;
    setDeleting(id);
    try {
      await api.delete(`/blog/${id}`);
      fetchPosts();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">المدونة</h1>
            <p className="text-sm text-gray-500">{total} مقال</p>
          </div>
        </div>
        <Link href="/blog/new">
          <Button variant="primary" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            مقال جديد
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="المقالات" />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText className="h-12 w-12 mb-3" />
              <p>لا توجد مقالات بعد</p>
              <Link href="/blog/new">
                <Button variant="primary" className="mt-4">ابدأ بكتابة أول مقال</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-right">المقال</th>
                  <th className="px-6 py-3 text-center">الحالة</th>
                  <th className="px-6 py-3 text-center">المشاهدات</th>
                  <th className="px-6 py-3 text-center">التاريخ</th>
                  <th className="px-6 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{post.title}</p>
                        {post.titleAr && <p className="text-xs text-gray-500">{post.titleAr}</p>}
                        <p className="text-xs text-gray-400 mt-1 font-mono">{post.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={post.isPublished ? "success" : "default"}>
                        {post.isPublished ? "منشور" : "مسودة"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-600">
                      <span className="flex items-center justify-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> {post.views}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-500">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString("ar-BH")
                        : new Date(post.createdAt).toLocaleDateString("ar-BH")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => togglePublish(post)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                          title={post.isPublished ? "إلغاء النشر" : "نشر"}
                        >
                          {post.isPublished ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                        </button>
                        <Link href={`/blog/${post.id}/edit`}>
                          <button className="p-1.5 rounded hover:bg-gray-100 text-indigo-500">
                            <Edit className="h-4 w-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => deletePost(post.id)}
                          disabled={deleting === post.id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        >
                          {deleting === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
