"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronLeft, Layers } from "lucide-react";

interface Category {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  image: string | null;
  sortOrder: number;
  _count: { products: number };
  children?: Category[];
}

const emptyForm = { name: "", nameAr: "", slug: "", parentId: "", sortOrder: 0 };

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .slice(0, 40);
}

export default function CategoriesPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [serverError, setServerError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["categories", store?.id],
    queryFn: async () => {
      const res = await api.get(`/categories/store/${store!.id}`);
      return res.data.categories as Category[];
    },
    enabled: !!store?.id,
  });

  const categories: Category[] = data ?? [];

  // Flat list of all cats for parent selector
  const allFlat: Category[] = categories.flatMap((c) => [c, ...(c.children ?? [])]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/categories", {
        storeId: store!.id,
        name: form.name,
        nameAr: form.nameAr,
        slug: form.slug || slugify(form.name),
        parentId: form.parentId || undefined,
        sortOrder: Number(form.sortOrder),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowForm(false);
      setForm(emptyForm);
      setServerError("");
    },
    onError: (err: any) => setServerError(err?.response?.data?.error ?? "حدث خطأ"),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/categories/${editId}`, {
        name: form.name,
        nameAr: form.nameAr,
        slug: form.slug || slugify(form.name),
        sortOrder: Number(form.sortOrder),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditId(null);
      setShowForm(false);
      setForm(emptyForm);
      setServerError("");
    },
    onError: (err: any) => setServerError(err?.response?.data?.error ?? "حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteConfirm(null);
    },
  });

  function openAdd(parentId = "") {
    setEditId(null);
    setForm({ ...emptyForm, parentId });
    setShowForm(true);
    setServerError("");
  }

  function openEdit(cat: Category) {
    setEditId(cat.id);
    setForm({ name: cat.name, nameAr: cat.nameAr, slug: cat.slug, parentId: "", sortOrder: cat.sortOrder });
    setShowForm(true);
    setServerError("");
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col">
      <Header title="التصنيفات" subtitle={`${allFlat.length} تصنيف`} />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex justify-end">
          <Button onClick={() => openAdd()}>
            <Plus className="h-4 w-4" />
            تصنيف جديد
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader
              title={editId ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
              action={
                <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-700" />
                </button>
              }
            />
            <CardBody>
              {serverError && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                  {serverError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="الاسم (عربي) *"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="مثال: ملابس رجالية"
                />
                <Input
                  label="الاسم (إنجليزي) *"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })
                  }
                  placeholder="Men's Clothing"
                />
                <Input
                  label="الرابط (Slug)"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                  placeholder="mens-clothing"
                />
                {!editId && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">التصنيف الأب (اختياري)</label>
                    <select
                      value={form.parentId}
                      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— تصنيف رئيسي —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.nameAr}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Input
                  label="الترتيب"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
                <div className="flex items-end gap-3">
                  <Button
                    className="w-full"
                    onClick={() => editId ? updateMutation.mutate() : createMutation.mutate()}
                    disabled={!form.nameAr || !form.name || isPending}
                    loading={isPending}
                  >
                    <Save className="h-4 w-4" />
                    {editId ? "حفظ التعديلات" : "إضافة التصنيف"}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Categories Tree */}
        <Card>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : !categories.length ? (
            <div className="px-4 py-16 text-center">
              <Layers className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-2 text-slate-500">لا توجد تصنيفات بعد</p>
              <button
                onClick={() => openAdd()}
                className="mt-2 text-sm text-indigo-600 hover:underline"
              >
                أضف أول تصنيف
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {categories.map((cat) => (
                <div key={cat.id}>
                  {/* Parent Row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [cat.id]: !p[cat.id] }))}
                      className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                    >
                      {cat.children?.length ? (
                        expanded[cat.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
                      ) : (
                        <span className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{cat.nameAr}</p>
                      <p className="text-xs text-slate-500">{cat.name} · /{cat.slug}</p>
                    </div>

                    <Badge variant="default">
                      {cat._count.products} منتج
                    </Badge>

                    {cat.children?.length ? (
                      <Badge variant="purple">{cat.children.length} فرعي</Badge>
                    ) : null}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openAdd(cat.id)}
                        title="إضافة تصنيف فرعي"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(cat)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === cat.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(cat.id)}
                            className="rounded px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                          >
                            تأكيد
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                          >
                            لا
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(cat.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Children */}
                  {expanded[cat.id] && cat.children?.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 hover:bg-slate-100/60 transition-colors"
                    >
                      <span className="mr-10 w-4 text-slate-300">└</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{child.nameAr}</p>
                        <p className="text-xs text-slate-400">{child.name} · /{child.slug}</p>
                      </div>
                      <Badge variant="default">{child._count.products} منتج</Badge>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(child)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {deleteConfirm === child.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMutation.mutate(child.id)}
                              className="rounded px-2 py-0.5 text-xs font-medium bg-red-500 text-white hover:bg-red-600"
                            >
                              تأكيد
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="rounded px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                            >
                              لا
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(child.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
