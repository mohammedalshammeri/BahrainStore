import { api } from "@/lib/api";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
}

async function getPage(subdomain: string, slug: string) {
  try {
    const res = await api.get(`/pages/public/${subdomain}/${slug}`);
    return res.data.page;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const page = await getPage(subdomain, slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.titleAr || page.title,
    description: page.seoDesc || page.excerpt,
  };
}

export default async function StorePage({ params }: Props) {
  const { subdomain, slug } = await params;
  const page = await getPage(subdomain, slug);
  if (!page) notFound();

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 pb-6 border-b">
          {page.titleAr || page.title}
        </h1>
        {page.excerpt && (
          <p className="text-lg text-gray-500 mb-8 leading-relaxed">{page.excerpt}</p>
        )}
        <div
          className="prose prose-lg max-w-none text-gray-800 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: (page.contentAr || page.content).replace(/\n/g, "<br />") }}
        />
      </div>
    </div>
  );
}
