"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import {
  UtensilsCrossed, Plus, QrCode, Loader2, RefreshCw, Clock,
  ChefHat, CheckCircle, XCircle, Trash2, Edit3, TableProperties
} from "lucide-react";

interface TableRow {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  qrCode?: string;
  currentStatus: string | null;
}

interface KDSOrder {
  id: string;
  tableId: string;
  tableName: string;
  guestCount: number;
  notes?: string;
  status: string;
  waitingMinutes: number;
  items: { name: string; quantity: number; price: number }[];
}

interface DayStats {
  totalTables: number;
  activeOrders: number;
  dailyRevenue: number;
  currency: string;
}

const statusLabels: Record<string, string> = {
  PENDING:    "انتظار",
  CONFIRMED:  "مؤكد",
  PREPARING:  "يُحضَّر",
  READY:      "جاهز",
  SERVED:     "تم التقديم",
  PAID:       "مدفوع",
  CANCELLED:  "ملغى",
};

const statusColors: Record<string, string> = {
  PENDING:    "bg-amber-100 text-amber-700",
  CONFIRMED:  "bg-blue-100 text-blue-700",
  PREPARING:  "bg-orange-100 text-orange-700",
  READY:      "bg-green-100 text-green-700",
  SERVED:     "bg-teal-100 text-teal-700",
  PAID:       "bg-slate-100 text-slate-500",
  CANCELLED:  "bg-red-100 text-red-500",
};

const nextStatus: Record<string, string | null> = {
  PENDING:    "CONFIRMED",
  CONFIRMED:  "PREPARING",
  PREPARING:  "READY",
  READY:      "SERVED",
  SERVED:     "PAID",
  PAID:       null,
  CANCELLED:  null,
};

const nextStatusLabel: Record<string, string> = {
  PENDING:   "تأكيد",
  CONFIRMED: "بدء التحضير",
  PREPARING: "جاهز",
  READY:     "تم التقديم",
  SERVED:    "تم الدفع",
};

export default function RestaurantPage() {
  const { store } = useAuthStore();
  const [tab, setTab] = useState<"tables" | "kds" | "stats">("tables");
  const [tables, setTables] = useState<TableRow[]>([]);
  const [kdsOrders, setKdsOrders] = useState<KDSOrder[]>([]);
  const [stats, setStats] = useState<DayStats | null>(null);
  const [loading, setLoading] = useState(true);

  // New table form
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCap, setNewTableCap] = useState(4);
  const [addingTable, setAddingTable] = useState(false);

  const loadData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [tablesRes, kdsRes, statsRes] = await Promise.all([
        api.get(`/restaurant/tables?storeId=${store.id}`),
        api.get(`/restaurant/kitchen?storeId=${store.id}`),
        api.get(`/restaurant/stats?storeId=${store.id}`),
      ]);
      setTables(tablesRes.data.tables || []);
      setKdsOrders(kdsRes.data.orders || []);
      setStats(statsRes.data);
    } catch {}
    setLoading(false);
  }, [store]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (tab === "kds") loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData, tab]);

  const addTable = async () => {
    if (!store || !newTableName.trim()) return;
    setAddingTable(true);
    try {
      await api.post("/restaurant/tables", {
        storeId: store.id, name: newTableName.trim(), capacity: newTableCap,
      });
      setShowAddTable(false);
      setNewTableName("");
      setNewTableCap(4);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل إضافة الطاولة");
    }
    setAddingTable(false);
  };

  const deleteTable = async (id: string) => {
    if (!confirm("هل تريد حذف هذه الطاولة؟")) return;
    try {
      await api.delete(`/restaurant/tables/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || "فشل الحذف");
    }
  };

  const advanceOrderStatus = async (orderId: string, newStat: string) => {
    try {
      await api.patch(`/restaurant/orders/${orderId}/status`, { status: newStat });
      loadData();
    } catch {}
  };

  const tabs = [
    { id: "tables", label: "الطاولات", icon: TableProperties },
    { id: "kds",    label: "المطبخ (KDS)", icon: ChefHat },
    { id: "stats",  label: "إحصائيات اليوم", icon: CheckCircle },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <UtensilsCrossed className="h-7 w-7 text-orange-500" />
            وضع المطعم
          </h1>
          <p className="text-slate-500 mt-1">طلبيات الطاولات وشاشة المطبخ</p>
        </div>
        <button onClick={loadData} className="p-2 text-slate-500 hover:text-slate-700">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === "kds" && kdsOrders.filter(o => o.status !== "PAID" && o.status !== "CANCELLED").length > 0 && (
              <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">
                {kdsOrders.filter(o => o.status !== "PAID" && o.status !== "CANCELLED").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tables tab */}
      {tab === "tables" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{tables.length} طاولة مسجلة</p>
            <button
              onClick={() => setShowAddTable(true)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              إضافة طاولة
            </button>
          </div>

          {showAddTable && (
            <div className="bg-white rounded-2xl border p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">طاولة جديدة</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">اسم الطاولة</label>
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="طاولة 1"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">عدد المقاعد</label>
                  <input
                    type="number"
                    value={newTableCap}
                    onChange={(e) => setNewTableCap(parseInt(e.target.value) || 1)}
                    min={1}
                    max={20}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addTable} disabled={addingTable || !newTableName.trim()} className="flex items-center gap-2 bg-orange-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                  {addingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  إضافة
                </button>
                <button onClick={() => setShowAddTable(false)} className="px-6 py-2 border rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {tables.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <TableProperties className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">لا توجد طاولات بعد. أضف طاولتك الأولى!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table) => (
                <div key={table.id} className={`bg-white rounded-2xl border p-5 transition-all ${
                  table.currentStatus ? "border-orange-300 shadow-md" : ""
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{table.name}</p>
                      <p className="text-xs text-slate-500">{table.capacity} مقاعد</p>
                    </div>
                    <button onClick={() => deleteTable(table.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {table.currentStatus ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[table.currentStatus] || "bg-slate-100 text-slate-600"}`}>
                      {statusLabels[table.currentStatus] || table.currentStatus}
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      فارغة
                    </span>
                  )}

                  {table.qrCode && (
                    <div className="mt-3 pt-3 border-t">
                      <a
                        href={table.qrCode}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-orange-600 hover:underline"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        عرض QR
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KDS tab */}
      {tab === "kds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {kdsOrders.filter(o => !["PAID", "CANCELLED"].includes(o.status)).length} طلب نشط
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              يتحدث كل 15 ثانية
            </p>
          </div>

          {kdsOrders.filter(o => !["PAID", "CANCELLED"].includes(o.status)).length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <ChefHat className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">لا توجد طلبيات نشطة الآن</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kdsOrders
                .filter(o => !["PAID", "CANCELLED"].includes(o.status))
                .map((order) => (
                  <div key={order.id} className={`bg-white rounded-2xl border p-5 ${
                    order.waitingMinutes > 15 ? "border-red-300" :
                    order.waitingMinutes > 8 ? "border-amber-300" : ""
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{order.tableName}</p>
                        <p className="text-xs text-slate-500">{order.guestCount} أشخاص</p>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${
                        order.waitingMinutes > 15 ? "text-red-600" :
                        order.waitingMinutes > 8 ? "text-amber-600" : "text-slate-500"
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                        {order.waitingMinutes} دقيقة
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">
                            <span className="font-bold text-orange-600 ml-2">×{item.quantity}</span>
                            {item.name}
                          </span>
                        </div>
                      ))}
                      {order.notes && (
                        <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg">
                          📝 {order.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-slate-100 text-slate-600"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                      {nextStatus[order.status] && (
                        <button
                          onClick={() => advanceOrderStatus(order.id, nextStatus[order.status]!)}
                          className="text-xs font-medium text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {nextStatusLabel[order.status]}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && stats && (
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { label: "إجمالي الطاولات", value: stats.totalTables, icon: TableProperties, color: "bg-blue-50 text-blue-600" },
            { label: "طلبيات نشطة", value: stats.activeOrders, icon: ChefHat, color: "bg-orange-50 text-orange-600" },
            { label: `إيرادات اليوم (${stats.currency})`, value: stats.dailyRevenue.toFixed(3), icon: CheckCircle, color: "bg-green-50 text-green-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border p-6 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
