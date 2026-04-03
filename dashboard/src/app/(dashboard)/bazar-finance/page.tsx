"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { Banknote, TrendingUp, CheckCircle, Clock, AlertCircle, Loader2, ChevronRight, RefreshCw } from "lucide-react";

interface Eligibility {
  eligible: boolean;
  maxAmount: number;
  avgMonthlySales: number;
  salesHistory: number[];
  reason?: string;
  currency: string;
  feeRate: number;
  repaymentRate: number;
}

interface Loan {
  id: string;
  requestedAmount: number;
  approvedAmount?: number;
  repaidAmount: number;
  totalOwed: number;
  remainingAmount: number;
  repaymentProgress: number;
  feeRate: number;
  feeAmount?: number;
  status: string;
  createdAt: string;
  disbursedAt?: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  DISBURSED: "bg-indigo-100 text-indigo-700",
  REPAYING: "bg-purple-100 text-purple-700",
  FULLY_REPAID: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "معتمد",
  DISBURSED: "تم الصرف",
  REPAYING: "قيد السداد",
  FULLY_REPAID: "مسدّد بالكامل",
  REJECTED: "مرفوض",
};

export default function BazarFinancePage() {
  const { store, merchant } = useAuthStore();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyAmount, setApplyAmount] = useState("");
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);

  useEffect(() => {
    if (store) {
      loadData();
    }
  }, [store]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eligRes, loansRes] = await Promise.all([
        api.get(`/bazar-finance/eligibility?storeId=${store?.id}`),
        api.get(`/bazar-finance/loans?storeId=${store?.id}`),
      ]);
      setEligibility(eligRes.data);
      setLoans(loansRes.data.loans || []);
    } catch {}
    setLoading(false);
  };

  const applyForLoan = async () => {
    if (!applyAmount || !store || !merchant) return;
    const amount = parseFloat(applyAmount);
    if (isNaN(amount) || amount <= 0) return;

    setApplying(true);
    try {
      await api.post("/bazar-finance/apply", {
        storeId: store.id,
        merchantId: merchant.id,
        requestedAmount: amount,
      });
      alert("✅ تم تقديم طلب التمويل بنجاح. سيتم مراجعته خلال 24 ساعة.");
      setShowApplyForm(false);
      setApplyAmount("");
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل تقديم الطلب");
    }
    setApplying(false);
  };

  const activeLoan = loans.find((l) => ["DISBURSED", "REPAYING"].includes(l.status));
  const pendingLoan = loans.find((l) => l.status === "PENDING");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Banknote className="h-7 w-7 text-indigo-500" />
            بازار فاينانس
          </h1>
          <p className="text-slate-500 mt-1">تمويل مرن للتجار — بدون بنوك، بدون ضمانات</p>
        </div>
        <button onClick={loadData} className="p-2 text-slate-500 hover:text-slate-700 transition-colors">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Active loan progress */}
      {activeLoan && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <p className="text-indigo-200 text-sm mb-1">قرضك النشط</p>
          <p className="text-3xl font-bold mb-4">{activeLoan.approvedAmount?.toFixed(3)} {eligibility?.currency}</p>
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-indigo-200">تم السداد</span>
              <span className="text-white font-medium">{activeLoan.repaidAmount.toFixed(3)} / {activeLoan.totalOwed.toFixed(3)} {eligibility?.currency}</span>
            </div>
            <div className="h-2 bg-indigo-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min(activeLoan.repaymentProgress, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-indigo-200 text-sm">
            متبقي: <span className="text-white font-semibold">{activeLoan.remainingAmount.toFixed(3)} {eligibility?.currency}</span>
            {" "}• يُسدَّد تلقائياً ({(activeLoan.feeRate * 100).toFixed(0)}% من كل بيع)
          </p>
        </div>
      )}

      {/* Eligibility card */}
      {!activeLoan && eligibility && (
        <div className={`rounded-2xl border p-6 ${eligibility.eligible ? "bg-white" : "bg-slate-50"}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">أهليتك للتمويل</h2>
              <p className="text-sm text-slate-500 mt-0.5">بناءً على تاريخ مبيعاتك</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              eligibility.eligible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {eligibility.eligible ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {eligibility.eligible ? "مؤهل" : "غير مؤهل حالياً"}
            </div>
          </div>

          {eligibility.eligible ? (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xl font-bold text-slate-900">{eligibility.maxAmount.toFixed(3)}</p>
                  <p className="text-xs text-slate-500">{eligibility.currency} أقصى مبلغ</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xl font-bold text-slate-900">{(eligibility.feeRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">رسوم التمويل</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-xl font-bold text-slate-900">{(eligibility.repaymentRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-slate-500">من كل بيع للسداد</p>
                </div>
              </div>

              {pendingLoan ? (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700">طلبك قيد المراجعة. سيتم التواصل معك خلال 24 ساعة.</p>
                </div>
              ) : showApplyForm ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      المبلغ المطلوب ({eligibility.currency}) — الحد الأقصى: {eligibility.maxAmount.toFixed(3)}
                    </label>
                    <input
                      type="number"
                      value={applyAmount}
                      onChange={(e) => setApplyAmount(e.target.value)}
                      max={eligibility.maxAmount}
                      min={50}
                      step={0.001}
                      className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {applyAmount && parseFloat(applyAmount) > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        الرسوم: {(parseFloat(applyAmount) * eligibility.feeRate).toFixed(3)} {eligibility.currency} •
                        الإجمالي المسترد: {(parseFloat(applyAmount) * (1 + eligibility.feeRate)).toFixed(3)} {eligibility.currency}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={applyForLoan}
                      disabled={applying || !applyAmount}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      تقديم الطلب
                    </button>
                    <button onClick={() => setShowApplyForm(false)} className="px-6 py-3 border rounded-xl text-slate-600 hover:bg-slate-50">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowApplyForm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Banknote className="h-5 w-5" />
                  اطلب تمويلاً الآن
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-600 mb-2">{eligibility.reason}</p>
              <p className="text-sm text-slate-500">• متوسط مبيعاتك الشهرية: {eligibility.avgMonthlySales.toFixed(3)} {eligibility.currency}</p>
              <p className="text-sm text-slate-500 mt-1">زد مبيعاتك واستمر في النشاط لتصبح مؤهلاً</p>
            </div>
          )}
        </div>
      )}

      {/* Loans history */}
      {loans.length > 0 && (
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">سجل التمويل</h2>
          <div className="space-y-3">
            {loans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-900">{(loan.approvedAmount || loan.requestedAmount).toFixed(3)} {eligibility?.currency}</p>
                  <p className="text-xs text-slate-500">{new Date(loan.createdAt).toLocaleDateString("ar-BH")}</p>
                </div>
                <div className="flex items-center gap-3">
                  {["DISBURSED", "REPAYING"].includes(loan.status) && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">السداد</p>
                      <p className="text-sm font-medium text-slate-700">{loan.repaymentProgress.toFixed(0)}%</p>
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[loan.status] || "bg-slate-100 text-slate-600"}`}>
                    {statusLabels[loan.status] || loan.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">كيف يعمل بازار فاينانس؟</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: "1", title: "قدّم طلبك", desc: "حدد المبلغ المناسب لنمو أعمالك" },
            { step: "2", title: "مراجعة سريعة", desc: "نراجع تاريخ مبيعاتك خلال 24 ساعة" },
            { step: "3", title: "استلم المبلغ", desc: "يُحوَّل المبلغ مباشرة إلى حسابك" },
            { step: "4", title: "سداد تلقائي", desc: "نقتطع نسبة صغيرة من كل بيع تلقائياً" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center mx-auto mb-3">
                {s.step}
              </div>
              <p className="font-semibold text-slate-900 text-sm">{s.title}</p>
              <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
