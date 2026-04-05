"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { formatDate, getInitials } from "@/lib/utils";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  ShieldOff,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";

interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  acceptedAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير",
  STAFF: "موظف",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-indigo-100 text-indigo-700",
  STAFF: "bg-slate-100 text-slate-600",
};

/* ─── Invite Modal ─── */
function InviteModal({
  storeId,
  onClose,
  onSuccess,
}: {
  storeId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "STAFF",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/staff/${storeId}/invite`, form),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error ?? "حدث خطأ، حاول مجدداً");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">دعوة موظف جديد</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                الاسم الأول
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="محمد"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                اسم العائلة
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="الأحمد"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="staff@example.com"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              الصلاحية
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["STAFF", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    form.role === r
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {r === "ADMIN" ? "🛡 مدير" : "👤 موظف"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {form.role === "ADMIN"
                ? "المدير يمكنه إدارة المنتجات والطلبات والموظفين"
                : "الموظف يمكنه إدارة المنتجات والطلبات فقط"}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending ||
              !form.email ||
              !form.firstName ||
              !form.lastName
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            إرسال الدعوة
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function StaffPage() {
  const { store } = useAuthStore();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", store?.id],
    queryFn: async () => {
      const res = await api.get(`/staff/${store!.id}`);
      return res.data.staff as StaffMember[];
    },
    enabled: !!store?.id,
  });

  const staff: StaffMember[] = data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({
      staffId,
      payload,
    }: {
      staffId: string;
      payload: { role?: string; isActive?: boolean };
    }) => api.patch(`/staff/${store!.id}/${staffId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff", store?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (staffId: string) =>
      api.delete(`/staff/${store!.id}/${staffId}`),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["staff", store?.id] });
    },
  });

  const activeCount = staff.filter((s) => s.isActive).length;
  const pendingCount = staff.filter((s) => !s.acceptedAt).length;

  return (
    <div className="flex flex-col">
      <Header
        title="إدارة الفريق"
        subtitle={`${staff.length} عضو`}
        action={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            دعوة موظف
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{staff.length}</p>
              <p className="text-xs text-slate-500">إجمالي الفريق</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{activeCount}</p>
              <p className="text-xs text-slate-500">نشط</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{pendingCount}</p>
              <p className="text-xs text-slate-500">دعوة معلقة</p>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-right">
                  <th className="px-4 py-3 font-medium text-slate-500">الموظف</th>
                  <th className="px-4 py-3 font-medium text-slate-500">البريد الإلكتروني</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الصلاحية</th>
                  <th className="px-4 py-3 font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 font-medium text-slate-500">تاريخ الانضمام</th>
                  <th className="px-4 py-3 font-medium text-slate-500">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : !staff.length
                  ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center">
                        <Users className="mx-auto h-12 w-12 text-slate-300" />
                        <p className="mt-2 font-medium text-slate-500">لا يوجد موظفون بعد</p>
                        <p className="mt-1 text-xs text-slate-400">
                          ابدأ بدعوة موظف عبر الزر في الأعلى
                        </p>
                      </td>
                    </tr>
                  )
                  : staff.map((member) => (
                      <tr
                        key={member.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        {/* Avatar + Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                              {getInitials(`${member.firstName} ${member.lastName}`)}
                            </div>
                            <span className="font-medium text-slate-800">
                              {member.firstName} {member.lastName}
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 text-slate-500 dir-ltr text-right" dir="ltr">
                          {member.email}
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role]}`}
                          >
                            {ROLE_LABELS[member.role]}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {!member.acceptedAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                              <Clock className="h-3 w-3" />
                              دعوة معلقة
                            </span>
                          ) : member.isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-500">
                              <ShieldOff className="h-3 w-3" />
                              موقوف
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {member.acceptedAt
                            ? formatDate(member.acceptedAt)
                            : `دُعي ${formatDate(member.createdAt)}`}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Toggle Role */}
                            <button
                              title={member.role === "ADMIN" ? "تحويل لموظف" : "ترقية لمدير"}
                              onClick={() =>
                                updateMutation.mutate({
                                  staffId: member.id,
                                  payload: {
                                    role: member.role === "ADMIN" ? "STAFF" : "ADMIN",
                                  },
                                })
                              }
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                              <Shield className="h-4 w-4" />
                            </button>

                            {/* Toggle Active */}
                            <button
                              title={member.isActive ? "إيقاف الوصول" : "تفعيل الوصول"}
                              onClick={() =>
                                updateMutation.mutate({
                                  staffId: member.id,
                                  payload: { isActive: !member.isActive },
                                })
                              }
                              className={`rounded-lg p-1.5 transition-colors ${
                                member.isActive
                                  ? "text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                                  : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                              }`}
                            >
                              <ShieldOff className="h-4 w-4" />
                            </button>

                            {/* Delete */}
                            <button
                              title="إزالة من الفريق"
                              onClick={() => setConfirmDelete(member)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Info Box */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm">
          <p className="font-medium text-indigo-800 mb-2">صلاحيات الأدوار</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-indigo-700">
            <div>
              <span className="font-semibold">🛡 مدير: </span>
              إدارة المنتجات، الطلبات، العملاء، والموظفين
            </div>
            <div>
              <span className="font-semibold">👤 موظف: </span>
              إدارة المنتجات والطلبات — بدون صلاحية الموظفين والإعدادات
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && store && (
        <InviteModal
          storeId={store.id}
          onClose={() => setShowInvite(false)}
          onSuccess={() =>
            queryClient.invalidateQueries({ queryKey: ["staff", store.id] })
          }
        />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">تأكيد الإزالة</h2>
            <p className="mt-2 text-sm text-slate-500">
              هل تريد إزالة{" "}
              <span className="font-semibold text-slate-700">
                {confirmDelete.firstName} {confirmDelete.lastName}
              </span>{" "}
              من فريق المتجر؟ لن يتمكن من الوصول بعد ذلك.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                إزالة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
