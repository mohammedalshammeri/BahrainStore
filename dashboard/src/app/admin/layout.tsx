"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import Link from "next/link";
import {
  LayoutDashboard, Users, Store, BarChart2,
  CreditCard, FileText, Package, Layers,
  Headphones, Activity, Bell, ChevronRight,
  LogOut, ShieldAlert, PanelLeftClose, PanelLeftOpen, Zap, Clock,
  BookOpen, Mail, Users2, Shield, ClipboardList,
  Handshake, Ticket, UserPlus, TrendingUp, ShieldCheck, Server, MessageSquare, Key, Globe,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "نظرة عامة",
    items: [
      { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics", label: "الإحصائيات", icon: BarChart2 },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { href: "/admin/merchants", label: "التجار", icon: Users },
      { href: "/admin/stores", label: "المتاجر", icon: Store },
    ],
  },
  {
    label: "المالية",
    items: [
      { href: "/admin/plans", label: "الباقات", icon: CreditCard },
      { href: "/admin/billing", label: "الفواتير", icon: FileText },
      { href: "/admin/subscriptions", label: "الاشتراكات", icon: Clock },
      { href: "/admin/subscription-payments", label: "مدفوعات الاشتراك", icon: CreditCard },
      { href: "/admin/financial-reports", label: "التقارير المالية", icon: TrendingUp },
    ],
  },
  {
    label: "السوق",
    items: [
      { href: "/admin/apps", label: "التطبيقات", icon: Package },
      { href: "/admin/themes", label: "الثيمات", icon: Layers },
    ],
  },
  {
    label: "المنصة",
    items: [
      { href: "/admin/support", label: "الدعم الفني", icon: Headphones },
      { href: "/admin/health", label: "صحة النظام", icon: Activity },
      { href: "/admin/governance", label: "الحوكمة والامتثال", icon: ShieldCheck },
      { href: "/admin/infrastructure", label: "البنية التحتية", icon: Server },
      { href: "/admin/communications", label: "التواصل مع التجار", icon: MessageSquare },
      { href: "/admin/api-management", label: "إدارة API", icon: Key },
      { href: "/admin/security", label: "الأمان المتقدم", icon: Shield },
      { href: "/admin/localization", label: "التوطين والتوسع", icon: Globe },
    ],
  },
  {
    label: "المحتوى",
    items: [
      { href: "/admin/announcements", label: "الإعلانات", icon: Bell },
      { href: "/admin/blog", label: "المدونة", icon: BookOpen },
      { href: "/admin/email-templates", label: "قوالب الإيميل", icon: Mail },
    ],
  },
  {
    label: "الفريق",
    items: [
      { href: "/admin/team", label: "الموظفون", icon: Users2 },
      { href: "/admin/roles", label: "الأدوار", icon: Shield },
      { href: "/admin/audit", label: "سجل العمليات", icon: ClipboardList },
    ],
  },
  {
    label: "النمو",
    items: [
      { href: "/admin/partners", label: "الشركاء", icon: Handshake },
      { href: "/admin/subscription-coupons", label: "كوبونات الاشتراك", icon: Ticket },
      { href: "/admin/merchant-referrals", label: "إحالات التجار", icon: UserPlus },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { merchant, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (merchant !== null && !(merchant as any).isAdmin) {
      router.replace("/");
    }
  }, [merchant, router]);

  if (!merchant || !(merchant as any).isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#060b18" }}>
        <div className="text-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: "#0c1526", border: "1px solid #1e2d45" }}
          >
            <ShieldAlert className="w-7 h-7" style={{ color: "#3b82f6" }} />
          </div>
          <p className="text-sm" style={{ color: "#64748b" }}>جارٍ التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const W = collapsed ? 64 : 224;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
        .admin-root * { font-family: 'Cairo', sans-serif; }
        .scrollbar-hide { scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .nav-item:hover { background: rgba(59,130,246,0.06); color: #c0d4ea; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
      `}</style>
      <div
        className="admin-root flex h-screen overflow-hidden"
        dir="rtl"
        style={{ background: "#060b18", color: "#dce8f5" }}
      >
        {/* ═══ SIDEBAR ═══ */}
        <aside
          className="flex-shrink-0 flex flex-col scrollbar-hide"
          style={{
            width: W,
            background: "#07101e",
            borderLeft: "1px solid #1a2840",
            transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {/* Logo */}
          <div
            className="flex items-center gap-3 px-3 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid #1a2840" }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)",
                boxShadow: "0 0 20px rgba(59,130,246,.35)",
              }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm leading-none tracking-tight" style={{ color: "#e2eef8" }}>Bazar</p>
                <span
                  className="text-[10px] font-semibold flex items-center gap-1 mt-0.5"
                  style={{ color: "#3b82f6" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 pulse-dot" />
                  Platform Admin
                </span>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
              style={{ color: "#334155" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
            >
              {collapsed
                ? <PanelLeftOpen className="w-3.5 h-3.5" />
                : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Nav sections */}
          <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 space-y-4 px-2">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <p
                    className="text-[9px] font-black uppercase tracking-[.2em] mb-1.5 px-2"
                    style={{ color: "#2a3d54" }}
                  >
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(({ href, label, icon: Icon, exact }) => {
                    const active = isActive(href, exact);
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        className="nav-item flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm relative transition-all duration-150"
                        style={{
                          background: active ? "rgba(59,130,246,.12)" : "transparent",
                          color: active ? "#e2eef8" : "#4a6480",
                        }}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full"
                            style={{ background: "#3b82f6" }}
                          />
                        )}
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: active ? "#3b82f6" : "inherit" }}
                        />
                        {!collapsed && (
                          <span className="font-semibold text-[13px]">{label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-2 space-y-1 flex-shrink-0" style={{ borderTop: "1px solid #1a2840" }}>
            {!collapsed && (
              <div
                className="px-3 py-2.5 rounded-xl mb-2"
                style={{ background: "#0c1526", border: "1px solid #1a2840" }}
              >
                <p className="font-bold text-xs truncate" style={{ color: "#c8ddf0" }}>
                  {(merchant as any).firstName} {(merchant as any).lastName}
                </p>
                <p className="text-[10px] truncate mt-0.5" style={{ color: "#2d4560" }}>
                  {merchant.email}
                </p>
              </div>
            )}
            <Link
              href="/"
              className="nav-item flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all"
              style={{ color: "#4a6480" }}
            >
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-[13px]">الداشبورد</span>}
            </Link>
            <button
              onClick={() => { logout(); router.replace("/auth/login"); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all"
              style={{ color: "#4a6480" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,.05)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4a6480"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="font-medium text-[13px]">تسجيل الخروج</span>}
            </button>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </>
  );
}
