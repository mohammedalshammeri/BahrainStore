"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare, CheckCircle2, XCircle, Trash2, Loader2 } from "lucide-react";

interface Review {
  id: string;
  name: string;
  email: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isVerified: boolean;
  createdAt: string;
  product: { id: string; name: string; nameAr: string; slug: string };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { store } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [actionId, setActionId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchReviews = useCallback(async () => {
    if (!store?.id) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ storeId: store.id, limit: "50" });
      if (filter !== "ALL") params.set("status", filter);
      const res = await api.get(`/reviews?${params}`);
      setReviews(res.data.reviews ?? []);
      setTotal(res.data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [store?.id, filter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  async function approve(id: string) {
    setActionId(id);
    try { await api.patch(`/reviews/${id}/approve`); fetchReviews(); } finally { setActionId(null); }
  }

  async function reject(id: string) {
    setActionId(id);
    try { await api.patch(`/reviews/${id}/reject`); fetchReviews(); } finally { setActionId(null); }
  }

  async function deleteReview(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا التقييم؟")) return;
    setActionId(id);
    try { await api.delete(`/reviews/${id}`); fetchReviews(); } finally { setActionId(null); }
  }

  const statusBadge = (status: string) => {
    if (status === "APPROVED") return <Badge variant="success">موافق عليه</Badge>;
    if (status === "REJECTED") return <Badge variant="error">مرفوض</Badge>;
    return <Badge variant="warning">بانتظار المراجعة</Badge>;
  };

  const pending = reviews.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تقييمات المنتجات</h1>
          <p className="text-sm text-gray-500">{total} تقييم {pending > 0 && `· ${pending} بانتظار المراجعة`}</p>
        </div>
      </div>

      {pending > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <Star className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-800">
            لديك <strong>{pending}</strong> تقييم بانتظار الموافقة أو الرفض
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "ALL" ? "الكل" : s === "PENDING" ? "بانتظار المراجعة" : s === "APPROVED" ? "موافق عليها" : "مرفوضة"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="التقييمات" />
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Star className="h-12 w-12 mb-3" />
              <p>لا توجد تقييمات</p>
            </div>
          ) : (
            <div className="divide-y">
              {reviews.map((review) => (
                <div key={review.id} className="p-5 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <StarRating rating={review.rating} />
                        {review.isVerified && (
                          <Badge variant="success">مشتري موثوق</Badge>
                        )}
                        {statusBadge(review.status)}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-gray-900 text-sm">{review.name}</span>
                        {review.email && <span className="text-xs text-gray-400">{review.email}</span>}
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString("ar-BH")}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-600 mb-1">المنتج: {review.product.nameAr}</p>
                      {review.title && <p className="font-medium text-gray-800 text-sm">{review.title}</p>}
                      {review.body && <p className="text-sm text-gray-600 mt-1">{review.body}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {review.status !== "APPROVED" && (
                        <button
                          onClick={() => approve(review.id)}
                          disabled={actionId === review.id}
                          className="p-1.5 rounded hover:bg-green-50 text-green-600"
                          title="موافقة"
                        >
                          {actionId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      )}
                      {review.status !== "REJECTED" && (
                        <button
                          onClick={() => reject(review.id)}
                          disabled={actionId === review.id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
                          title="رفض"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteReview(review.id)}
                        disabled={actionId === review.id}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
