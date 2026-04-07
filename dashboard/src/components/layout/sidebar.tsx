"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Tag,
  BarChart2,
  Settings,
  LogOut,
  Store,
  ChevronLeft,
  ChevronDown,
  Layers,
  ShieldAlert,
  PanelLeft,
  ShoppingBag,
  CreditCard,
  LayoutGrid,
  FileText,
  LayoutList,
  Star,
  Zap,
  Webhook,
  Gift,
  Users2,
  BellRing,
  Megaphone,
  Mail,
  Layers3,
  HeadphonesIcon,
  Rocket,
  Globe,
  Warehouse,
  MessageSquare,
  Smartphone,
  Bell,
  Monitor,
  Upload,
  Palette,
  Video,
  Receipt,
  Building2,
  DollarSign,
  Truck,
  RefreshCw,
  Sparkles,
  Percent,
  Handshake,
  Bot,
  Banknote,
  UtensilsCrossed,
  Award,
  AlertCircle,
  TrendingUp,
  Timer,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { label: string; icon: React.ElementType; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "الأساسيات",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "الرئيسية", icon: LayoutDashboard },
      { href: "/onboarding", label: "إعداد المتجر", icon: Rocket },
      { href: "/products", label: "المنتجات", icon: Package },
      { href: "/categories", label: "التصنيفات", icon: Layers },
      { href: "/orders", label: "الطلبات", icon: ShoppingCart },
      { href: "/customers", label: "العملاء", icon: Users },
      { href: "/staff", label: "الفريق والموظفون", icon: Users },
      { href: "/inventory", label: "إدارة المخزون", icon: BarChart2 },
      { href: "/warehouses", label: "المستودعات", icon: Warehouse },
    ],
  },
  {
    label: "الذكاء الاصطناعي",
    icon: Bot,
    items: [
      { href: "/ai", label: "بازار AI", icon: Bot },
      { href: "/alerts", label: "التنبيهات الذكية", icon: AlertCircle },
      { href: "/recommendations", label: "التوصيات الذكية", icon: Sparkles },
    ],
  },
  {
    label: "المالية",
    icon: CreditCard,
    items: [
      { href: "/finance", label: "التقارير المالية", icon: BarChart2 },
      { href: "/bazar-finance", label: "تمويل التاجر", icon: Banknote },
      { href: "/b2b-invoices", label: "فواتير B2B", icon: Building2 },
      { href: "/zatca", label: "الفوترة الإلكترونية", icon: Receipt },
      { href: "/billing", label: "خطة الاشتراك والفواتير", icon: CreditCard },
    ],
  },
  {
    label: "التجارة",
    icon: ShoppingBag,
    items: [
      { href: "/coupons", label: "الكوبونات", icon: Tag },
      { href: "/advanced-coupons", label: "الكوبونات المتقدمة", icon: Percent },
      { href: "/gift-cards", label: "كروت الهدية", icon: Gift },
      { href: "/flash-sales", label: "التخفيضات السريعة", icon: Zap },
      { href: "/promotions", label: "التخفيضات الفورية", icon: Zap },
      { href: "/countdown-timers", label: "مؤقتات العد التنازلي", icon: Timer },
      { href: "/loyalty", label: "برنامج الولاء", icon: Star },
      { href: "/upsell", label: "البيع الإضافي", icon: TrendingUp },
      { href: "/reviews", label: "التقييمات", icon: Star },
      { href: "/referral", label: "برنامج الإحالة", icon: Users2 },
      { href: "/back-in-stock", label: "إشعارات المخزون", icon: BellRing },
      { href: "/abandoned-carts", label: "العربات المتروكة", icon: ShoppingBag },
      { href: "/subscriptions", label: "اشتراكات المنتجات", icon: RefreshCw },
    ],
  },
  {
    label: "التسويق",
    icon: Megaphone,
    items: [
      { href: "/marketing", label: "التسويق والبكسلات", icon: Megaphone },
      { href: "/email-marketing", label: "التسويق الإلكتروني", icon: Mail },
      { href: "/sms", label: "حملات SMS", icon: Smartphone },
      { href: "/push-notifications", label: "الإشعارات الفورية", icon: Bell },
      { href: "/whatsapp-commerce", label: "واتساب شوب", icon: MessageSquare },
      { href: "/live-commerce", label: "البث المباشر", icon: Video },
      { href: "/popups", label: "النوافذ المنبثقة", icon: Layers3 },
      { href: "/partners", label: "برنامج الشركاء", icon: Handshake },
      { href: "/badges", label: "شارات التاجر", icon: Award },
    ],
  },
  {
    label: "المحتوى",
    icon: FileText,
    items: [
      { href: "/blog", label: "المدونة", icon: FileText },
      { href: "/pages", label: "الصفحات", icon: LayoutList },
      { href: "/builder", label: "منشئ الصفحات", icon: PanelLeft },
      { href: "/theme-store", label: "متجر القوالب", icon: Palette },
    ],
  },
  {
    label: "التشغيل",
    icon: Monitor,
    items: [
      { href: "/pos", label: "نقطة البيع", icon: Monitor },
      { href: "/restaurant", label: "وضع المطعم", icon: UtensilsCrossed },
      { href: "/import", label: "استيراد البيانات", icon: Upload },
      { href: "/apps", label: "متجر التطبيقات", icon: LayoutGrid },
      { href: "/support", label: "الدعم الفني", icon: HeadphonesIcon },
    ],
  },
  {
    label: "البنية التحتية",
    icon: Globe,
    items: [
      { href: "/shipping", label: "الشحن والتوصيل", icon: Truck },
      { href: "/domain", label: "النطاق المخصص", icon: Globe },
      { href: "/currencies", label: "العملات", icon: DollarSign },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { merchant, store, logout } = useAuthStore();

  // Auto-open the group that contains the active route
  const activeGroupIndex = navGroups.findIndex((g) =>
    g.items.some((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    )
  );
  const [openGroups, setOpenGroups] = useState<number[]>(
    activeGroupIndex >= 0 ? [activeGroupIndex] : [0]
  );

  function toggleGroup(idx: number) {
    setOpenGroups((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  return (
    <aside
      className="flex h-screen w-64 flex-col text-white overflow-hidden gradient-sidebar"
      style={{ boxShadow: '1px 0 0 rgba(255,255,255,0.05)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white font-bold text-lg shadow-brand-sm shrink-0">
          ب
        </div>
        <div>
          <p className="font-bold text-white text-base leading-tight tracking-tight">بزار</p>
          <p className="text-[10px] text-indigo-400 font-medium tracking-widest">BSMC.BH</p>
        </div>
      </div>

      {/* Store info */}
      {store && (
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Store className="h-4 w-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{store.name}</p>
              <p className="text-[10px] text-indigo-400/80">{store.subdomain}.bazar.bh</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navGroups.map((group, idx) => {
            const isOpen = openGroups.includes(idx);
            const GroupIcon = group.icon;
            const hasActive = group.items.some((item) =>
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            );

            return (
              <li key={group.label}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(idx)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                    hasActive
                      ? "text-white"
                      : "text-[#9896d4] hover:bg-white/5 hover:text-white"
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-right">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isOpen ? "rotate-180" : ""
                    )}
                  />
                </button>

                {/* Group items */}
                {isOpen && (
                  <ul className="mt-1 space-y-0.5 border-r border-white/8 mr-4 pr-2">
                    {group.items.map(({ href, label, icon: Icon }) => {
                      const isActive =
                        href === "/" ? pathname === "/" : pathname.startsWith(href);
                      return (
                        <li key={href}>
                          <Link
                            href={href}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                              isActive
                                ? "text-white"
                                : "text-[#a8a5e3] hover:bg-white/6 hover:text-white"
                            )}
                            style={isActive ? {
                              background: 'rgba(99,102,241,0.18)',
                              boxShadow: '0 0 0 1px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.06)'
                            } : undefined}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{label}</span>
                            {isActive && (
                              <ChevronLeft className="mr-auto h-3.5 w-3.5 opacity-70" />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}

          {/* Settings standalone */}
          <li className="pt-1">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                pathname.startsWith("/settings")
                  ? "text-white"
                  : "text-[#9896d4] hover:bg-white/5 hover:text-white"
              )}
              style={pathname.startsWith("/settings") ? {
                background: 'rgba(99,102,241,0.18)',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.25)'
              } : undefined}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>الإعدادات</span>
              {pathname.startsWith("/settings") && (
                <ChevronLeft className="mr-auto h-3.5 w-3.5 opacity-70" />
              )}
            </Link>
          </li>

          {/* Analytics standalone */}
          <li>
            <Link
              href="/analytics"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                pathname.startsWith("/analytics")
                  ? "text-white"
                  : "text-[#9896d4] hover:bg-white/5 hover:text-white"
              )}
              style={pathname.startsWith("/analytics") ? {
                background: 'rgba(99,102,241,0.18)',
                boxShadow: '0 0 0 1px rgba(99,102,241,0.25)'
              } : undefined}
            >
              <BarChart2 className="h-4 w-4 shrink-0" />
              <span>التحليلات</span>
              {pathname.startsWith("/analytics") && (
                <ChevronLeft className="mr-auto h-3.5 w-3.5 opacity-70" />
              )}
            </Link>
          </li>

          {(merchant as any)?.isAdmin && (merchant as any)?.platformAccess && (
            <li className="pt-2 mt-2 border-t border-indigo-900">
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-amber-500 text-white"
                    : "text-amber-300 hover:bg-amber-900/40 hover:text-amber-100"
                )}
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>لوحة الإدارة</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/5 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
            {merchant?.name?.[0] ?? "م"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{merchant?.name ?? "تاجر"}</p>
            <p className="truncate text-xs text-indigo-400">{merchant?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
