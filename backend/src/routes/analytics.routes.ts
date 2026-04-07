import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";

type HealthSeverity = "low" | "medium" | "high";

interface MerchantHealthIssue {
  key: string;
  title: string;
  severity: HealthSeverity;
  detail: string;
  action: string;
}

type MerchantHealthStage = "launch" | "build" | "scale";
type RecommendationPriority = "urgent" | "high" | "medium";
type RecommendationCategory = "sales" | "conversion" | "retention" | "operations" | "catalog" | "channels";

interface MerchantGrowthRecommendation {
  key: string;
  title: string;
  description: string;
  whyNow: string;
  impact: string;
  href: string;
  ctaLabel: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  issueKeys: string[];
}

interface MerchantGrowthPlaybook {
  key: string;
  title: string;
  summary: string;
  outcome: string;
  href: string;
  ctaLabel: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  steps: string[];
}

function parsePeriodDays(period?: string): number {
  switch (period) {
    case "today":
      return 1;
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "30d":
    default:
      return 30;
  }
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function growthPct(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round((((current - previous) / previous) * 100) * 10) / 10;
}

async function ensureMerchantStore(request: any, storeId: string) {
  const merchantId = (request.user as any).id;

  return prisma.store.findFirst({
    where: { id: storeId, merchantId },
    select: { id: true, currency: true },
  });
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreStatus(score: number): "excellent" | "healthy" | "attention" | "critical" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}

function addHealthIssue(
  issues: MerchantHealthIssue[],
  score: { value: number },
  issue: MerchantHealthIssue,
  penalty: number,
) {
  issues.push(issue);
  score.value -= penalty;
}

function recommendationPriorityWeight(priority: RecommendationPriority): number {
  if (priority === "urgent") return 3;
  if (priority === "high") return 2;
  return 1;
}

function addRecommendation(
  recommendations: MerchantGrowthRecommendation[],
  recommendation: MerchantGrowthRecommendation,
) {
  if (recommendations.some((entry) => entry.key === recommendation.key)) {
    return;
  }

  recommendations.push(recommendation);
}

function addPlaybook(
  playbooks: MerchantGrowthPlaybook[],
  playbook: MerchantGrowthPlaybook,
) {
  if (playbooks.some((entry) => entry.key === playbook.key)) {
    return;
  }

  playbooks.push(playbook);
}

function deriveMerchantStage(params: {
  totalCustomers: number;
  activeProducts: number;
  currentOrders: number;
  revenue: number;
}): MerchantHealthStage {
  const { totalCustomers, activeProducts, currentOrders, revenue } = params;

  if (currentOrders >= 40 || revenue >= 2000 || totalCustomers >= 120) {
    return "scale";
  }

  if (activeProducts >= 8 || currentOrders >= 8 || totalCustomers >= 20) {
    return "build";
  }

  return "launch";
}

function stageSummary(stage: MerchantHealthStage): { label: string; detail: string } {
  switch (stage) {
    case "scale":
      return {
        label: "مرحلة التوسع",
        detail: "المتجر تجاوز التأسيس ويحتاج قرارات نمو وتحويل واستبقاء أدق من مجرد تشغيل يومي.",
      };
    case "build":
      return {
        label: "مرحلة البناء",
        detail: "المتجر يملك قاعدة تشغيلية جيدة، والتركيز الآن يجب أن يكون على رفع التحويل وتكرار الشراء.",
      };
    default:
      return {
        label: "مرحلة الإطلاق",
        detail: "الأولوية الحالية هي تثبيت الأساس التجاري: المنتجات، القنوات، وأول مسار بيع متكرر.",
      };
  }
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.post<{
    Body: { storeId: string; path: string; referrer?: string };
  }>("/pageview", {
    schema: {
      body: {
        type: "object",
        required: ["storeId", "path"],
        properties: {
          storeId: { type: "string" },
          path: { type: "string" },
          referrer: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const { storeId, path, referrer } = req.body;

    function classifySource(ref?: string): string {
      if (!ref || ref === "") return "direct";
      const lower = ref.toLowerCase();
      if (lower.includes("google") || lower.includes("bing") || lower.includes("yahoo")) return "search";
      if (
        lower.includes("facebook") ||
        lower.includes("instagram") ||
        lower.includes("twitter") ||
        lower.includes("tiktok") ||
        lower.includes("snapchat") ||
        lower.includes("linkedin")
      ) return "social";
      if (lower.includes("mail") || lower.includes("email")) return "email";
      return "referral";
    }

    const source = classifySource(referrer);
    const safePath = path.slice(0, 500);
    const safeReferrer = referrer ? referrer.slice(0, 500) : undefined;

    prisma.pageView.create({
      data: { storeId, path: safePath, referrer: safeReferrer, source },
    }).catch(() => {});

    return reply.code(204).send();
  });

  app.get<{ Querystring: { storeId?: string; period?: string } }>(
    "/dashboard",
    { preHandler: authenticate },
    async (req, reply) => {
      const storeId = req.query.storeId;
      if (!storeId) {
        return reply.status(400).send({ error: "storeId مطلوب" });
      }

      const store = await ensureMerchantStore(req, storeId);
      if (!store) {
        return reply.status(403).send({ error: "غير مصرح" });
      }

      const days = parsePeriodDays(req.query.period);
      const today = startOfDay(new Date());
      const currentStart = days === 1 ? today : startOfDay(addDays(today, -(days - 1)));
      const previousStart = startOfDay(addDays(currentStart, -days));

      const [
        revenueCurrent,
        revenuePrevious,
        ordersCurrent,
        ordersPrevious,
        customersTotal,
        customersCurrent,
        customersPrevious,
        productsTotal,
        cancelledOrders,
        recentOrders,
      ] = await Promise.all([
        prisma.order.aggregate({
          where: { storeId, paymentStatus: "PAID", createdAt: { gte: currentStart } },
          _sum: { total: true },
        }),
        prisma.order.aggregate({
          where: {
            storeId,
            paymentStatus: "PAID",
            createdAt: { gte: previousStart, lt: currentStart },
          },
          _sum: { total: true },
        }),
        prisma.order.count({ where: { storeId, createdAt: { gte: currentStart } } }),
        prisma.order.count({ where: { storeId, createdAt: { gte: previousStart, lt: currentStart } } }),
        prisma.customer.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId, createdAt: { gte: currentStart } } }),
        prisma.customer.count({ where: { storeId, createdAt: { gte: previousStart, lt: currentStart } } }),
        prisma.product.count({ where: { storeId, isActive: true } }),
        prisma.order.count({ where: { storeId, status: "CANCELLED", createdAt: { gte: currentStart } } }),
        prisma.order.findMany({
          where: { storeId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            items: { select: { id: true, name: true, nameAr: true, quantity: true, total: true } },
          },
        }),
      ]);

      const revenue = Number(revenueCurrent._sum.total ?? 0);
      const previousRevenue = Number(revenuePrevious._sum.total ?? 0);
      const avgOrderValue = ordersCurrent > 0 ? Math.round((revenue / ordersCurrent) * 1000) / 1000 : 0;
      const conversionRate = customersTotal > 0
        ? Math.round((ordersCurrent / customersTotal) * 100 * 10) / 10
        : 0;

      return reply.send({
        revenue,
        orders: ordersCurrent,
        customers: customersTotal,
        products: productsTotal,
        revenueGrowth: growthPct(revenue, previousRevenue),
        ordersGrowth: growthPct(ordersCurrent, ordersPrevious),
        customersGrowth: growthPct(customersCurrent, customersPrevious),
        avgOrderValue,
        conversionRate,
        cancelledOrders,
        recentOrders: recentOrders.map((order) => ({
          ...order,
          subtotal: Number(order.subtotal),
          shippingCost: Number(order.shippingCost),
          vatAmount: Number(order.vatAmount),
          discountAmount: Number(order.discountAmount),
          total: Number(order.total),
          customer: order.customer
            ? {
                id: order.customer.id,
                name: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ").trim() || order.customer.phone,
                email: order.customer.email,
                phone: order.customer.phone,
              }
            : null,
          items: order.items.map((item) => ({
            ...item,
            total: Number(item.total),
          })),
        })),
      });
    }
  );

  app.get<{ Querystring: { storeId?: string; startDate?: string; endDate?: string } }>(
    "/revenue",
    { preHandler: authenticate },
    async (req, reply) => {
      const { storeId, startDate, endDate } = req.query;
      if (!storeId || !startDate || !endDate) {
        return reply.status(400).send({ error: "storeId و startDate و endDate مطلوبة" });
      }

      const store = await ensureMerchantStore(req, storeId);
      if (!store) {
        return reply.status(403).send({ error: "غير مصرح" });
      }

      const from = startOfDay(new Date(startDate));
      const to = startOfDay(new Date(endDate));
      const inclusiveEnd = addDays(to, 1);

      const orders = await prisma.order.findMany({
        where: {
          storeId,
          paymentStatus: "PAID",
          createdAt: { gte: from, lt: inclusiveEnd },
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const dailyMap = new Map<string, { revenue: number; orders: number }>();
      for (let cursor = new Date(from); cursor < inclusiveEnd; cursor = addDays(cursor, 1)) {
        dailyMap.set(cursor.toISOString().split("T")[0], { revenue: 0, orders: 0 });
      }

      for (const order of orders) {
        const key = order.createdAt.toISOString().split("T")[0];
        const current = dailyMap.get(key) ?? { revenue: 0, orders: 0 };
        current.revenue += Number(order.total);
        current.orders += 1;
        dailyMap.set(key, current);
      }

      const daily = Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        revenue: Math.round(stats.revenue * 1000) / 1000,
        orders: stats.orders,
      }));

      return reply.send({
        totalRevenue: daily.reduce((sum, item) => sum + item.revenue, 0),
        totalOrders: daily.reduce((sum, item) => sum + item.orders, 0),
        daily,
      });
    }
  );

  app.get<{ Querystring: { storeId?: string; limit?: string } }>(
    "/top-products",
    { preHandler: authenticate },
    async (req, reply) => {
      const { storeId, limit = "10" } = req.query;
      if (!storeId) {
        return reply.status(400).send({ error: "storeId مطلوب" });
      }

      const store = await ensureMerchantStore(req, storeId);
      if (!store) {
        return reply.status(403).send({ error: "غير مصرح" });
      }

      const take = Math.min(Math.max(Number(limit) || 10, 1), 25);
      const grouped = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            storeId,
            paymentStatus: "PAID",
          },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take,
      });

      const products = await prisma.product.findMany({
        where: { id: { in: grouped.map((item) => item.productId) } },
        select: { id: true, name: true, nameAr: true },
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      return reply.send({
        products: grouped.map((item) => {
          const product = productMap.get(item.productId);
          return {
            id: item.productId,
            name: product?.nameAr || product?.name || item.productId,
            totalSold: item._sum.quantity ?? 0,
            revenue: Number(item._sum.total ?? 0),
          };
        }),
      });
    }
  );

  app.get<{ Params: { storeId: string }; Querystring: { days?: string } }>(
    "/:storeId/traffic",
    { preHandler: authenticate },
    async (req, reply) => {
      const { storeId } = req.params;
      const store = await ensureMerchantStore(req, storeId);
      if (!store) {
        return reply.status(403).send({ error: "غير مصرح" });
      }

      const days = Math.min(Number(req.query.days ?? 30), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [total, bySource, topPages] = await Promise.all([
        prisma.pageView.count({ where: { storeId, createdAt: { gte: since } } }),
        prisma.pageView.groupBy({
          by: ["source"],
          where: { storeId, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
        prisma.pageView.groupBy({
          by: ["path"],
          where: { storeId, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
      ]);

      const sourceLabels: Record<string, string> = {
        direct: "مباشر",
        search: "محركات البحث",
        social: "التواصل الاجتماعي",
        email: "البريد الإلكتروني",
        referral: "إحالة",
      };

      return reply.send({
        total,
        bySource: bySource.map((source) => ({
          source: source.source ?? "direct",
          label: sourceLabels[source.source ?? "direct"] ?? source.source,
          count: source._count.id,
          pct: total > 0 ? Math.round((source._count.id / total) * 100) : 0,
        })),
        topPages: topPages.map((page) => ({
          path: page.path,
          count: page._count.id,
        })),
        days,
      });
    }
  );

  app.get<{ Querystring: { storeId?: string } }>(
    "/merchant-health",
    { preHandler: authenticate },
    async (req, reply) => {
      const storeId = req.query.storeId;
      if (!storeId) {
        return reply.status(400).send({ error: "storeId مطلوب" });
      }

      const store = await ensureMerchantStore(req, storeId);
      if (!store) {
        return reply.status(403).send({ error: "غير مصرح" });
      }

      const now = new Date();
      const thirtyDaysAgo = addDays(startOfDay(now), -29);
      const previousThirtyDaysAgo = addDays(thirtyDaysAgo, -30);
      const sevenDaysAgo = addDays(startOfDay(now), -6);

      const [
        currentRevenue,
        previousRevenue,
        currentOrders,
        cancelledOrders,
        activeProducts,
        totalCustomers,
        repeatCustomers,
        lowStockProducts,
        outOfStockProducts,
        abandonedCarts,
        whatsappConfig,
        liveStreams,
        activeCoupons,
        trafficCount,
        trafficSources,
      ] = await Promise.all([
        prisma.order.aggregate({
          where: { storeId, paymentStatus: "PAID", createdAt: { gte: thirtyDaysAgo } },
          _sum: { total: true },
        }),
        prisma.order.aggregate({
          where: {
            storeId,
            paymentStatus: "PAID",
            createdAt: { gte: previousThirtyDaysAgo, lt: thirtyDaysAgo },
          },
          _sum: { total: true },
        }),
        prisma.order.count({ where: { storeId, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.order.count({ where: { storeId, status: "CANCELLED", createdAt: { gte: thirtyDaysAgo } } }),
        prisma.product.count({ where: { storeId, isActive: true } }),
        prisma.customer.count({ where: { storeId } }),
        prisma.customer.count({ where: { storeId, totalOrders: { gte: 2 } } }),
        prisma.product.count({ where: { storeId, isActive: true, stock: { gt: 0, lte: 5 } } }),
        prisma.product.count({ where: { storeId, isActive: true, stock: { lte: 0 } } }),
        prisma.abandonedCart.count({ where: { storeId, recoveredAt: null, updatedAt: { gte: sevenDaysAgo } } }),
        prisma.whatsappCommerceConfig.findUnique({
          where: { storeId },
          select: { isActive: true, updatedAt: true },
        }),
        prisma.liveStream.findMany({
          where: { storeId, createdAt: { gte: thirtyDaysAgo } },
          select: { status: true, updatedAt: true },
          take: 5,
        }),
        prisma.coupon.count({ where: { storeId, isActive: true } }),
        prisma.pageView.count({ where: { storeId, createdAt: { gte: thirtyDaysAgo } } }),
        prisma.pageView.groupBy({
          by: ["source"],
          where: { storeId, createdAt: { gte: thirtyDaysAgo } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
      ]);

      const revenue = Number(currentRevenue._sum.total ?? 0);
      const previousRevenueValue = Number(previousRevenue._sum.total ?? 0);
      const revenueGrowth = growthPct(revenue, previousRevenueValue);
      const cancelRate = currentOrders > 0 ? Math.round((cancelledOrders / currentOrders) * 1000) / 10 : 0;
      const lowStockRate = activeProducts > 0 ? Math.round((lowStockProducts / activeProducts) * 1000) / 10 : 0;
      const outOfStockRate = activeProducts > 0 ? Math.round((outOfStockProducts / activeProducts) * 1000) / 10 : 0;
      const trafficToOrderRate = trafficCount > 0 ? Math.round((currentOrders / trafficCount) * 1000) / 10 : 0;
      const repeatCustomerRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;
      const socialTraffic = trafficSources.find((entry) => entry.source === "social")?._count.id ?? 0;
      const searchTraffic = trafficSources.find((entry) => entry.source === "search")?._count.id ?? 0;
      const stage = deriveMerchantStage({ totalCustomers, activeProducts, currentOrders, revenue });
      const stageInfo = stageSummary(stage);

      const issues: MerchantHealthIssue[] = [];
      const score = { value: 100 };

      if (revenueGrowth <= -20) {
        addHealthIssue(issues, score, {
          key: "revenue_decline",
          title: "هبوط واضح في الإيرادات",
          severity: "high",
          detail: `الإيرادات انخفضت ${Math.abs(revenueGrowth).toFixed(1)}% مقارنة بالفترة السابقة.`,
          action: "راجع قنوات الزيارات والمنتجات الأعلى مشاهدة ثم فعّل حملة استعادة أو عرضاً سريعاً.",
        }, 20);
      } else if (revenueGrowth < 0) {
        addHealthIssue(issues, score, {
          key: "revenue_soft_decline",
          title: "تباطؤ في النمو",
          severity: "medium",
          detail: `الإيرادات أقل ${Math.abs(revenueGrowth).toFixed(1)}% من الفترة السابقة.`,
          action: "ارفع التحويل بعرض محدود أو رسائل استعادة للسلات المهجورة خلال هذا الأسبوع.",
        }, 10);
      }

      if (cancelRate >= 12) {
        addHealthIssue(issues, score, {
          key: "cancellation_rate_high",
          title: "معدل إلغاء مرتفع",
          severity: "high",
          detail: `${cancelRate.toFixed(1)}% من الطلبات أُلغيت خلال 30 يوماً.`,
          action: "تحقق من أسباب الإلغاء في الطلبات الأخيرة واضبط المخزون ووضوح أوقات الشحن وطرق الدفع.",
        }, 18);
      } else if (cancelRate >= 6) {
        addHealthIssue(issues, score, {
          key: "cancellation_rate_watch",
          title: "معدل الإلغاء يحتاج متابعة",
          severity: "medium",
          detail: `${cancelRate.toFixed(1)}% من الطلبات أُلغيت مؤخراً.`,
          action: "راجع آخر الطلبات الملغاة وحدد إن كانت المشكلة في الدفع أو المخزون أو التوصيل.",
        }, 8);
      }

      if (outOfStockProducts >= 5 || outOfStockRate >= 20) {
        addHealthIssue(issues, score, {
          key: "out_of_stock",
          title: "نفاد مخزون يضر بالمبيعات",
          severity: "high",
          detail: `${outOfStockProducts} منتج نشط نفد مخزونه حالياً.`,
          action: "أعد طلب المنتجات الأعلى طلباً أولاً وفعّل تنبيهات العودة للمخزون أو بدائل مباشرة.",
        }, 15);
      }

      if (lowStockRate >= 25) {
        addHealthIssue(issues, score, {
          key: "low_stock_ratio",
          title: "جزء كبير من الكتالوج منخفض المخزون",
          severity: "medium",
          detail: `${lowStockProducts} منتجاً منخفض المخزون من أصل ${activeProducts}.`,
          action: "خطط لإعادة التوريد قبل انتهاء المنتجات الرابحة حتى لا يتأثر التحويل.",
        }, 10);
      }

      if (abandonedCarts >= 15) {
        addHealthIssue(issues, score, {
          key: "abandoned_carts_high",
          title: "فرصة استرداد مبيعات قائمة",
          severity: "high",
          detail: `${abandonedCarts} سلة مهجورة غير مستردة خلال آخر 7 أيام.`,
          action: "فعّل رسائل الاستعادة عبر واتساب أو البريد مع عرض محدود المدة.",
        }, 12);
      } else if (abandonedCarts >= 5) {
        addHealthIssue(issues, score, {
          key: "abandoned_carts_watch",
          title: "سلات مهجورة قابلة للاسترداد",
          severity: "medium",
          detail: `${abandonedCarts} سلات مهجورة ما زالت بدون استرداد.`,
          action: "أرسل تذكيراً سريعاً أو حسّن صفحة الدفع لتقليل التسرب.",
        }, 6);
      }

      if (!whatsappConfig || !whatsappConfig.isActive) {
        addHealthIssue(issues, score, {
          key: "whatsapp_not_ready",
          title: "واتساب التجاري غير مفعّل",
          severity: "low",
          detail: "قناة استعادة وتحويل مهمة ما زالت غير جاهزة أو غير مفعّلة.",
          action: "أكمل إعداد WhatsApp Commerce لتفعيل رسائل الاستعادة والبث للعملاء.",
        }, 5);
      }

      const liveStreamsCount = liveStreams.length;
      const hadLiveRecently = liveStreams.some((stream) => stream.status === "LIVE" || stream.status === "ENDED");
      if (liveStreamsCount > 0 && !hadLiveRecently) {
        addHealthIssue(issues, score, {
          key: "live_streams_idle",
          title: "جلسات البث لم تُستخدم بعد",
          severity: "low",
          detail: "تم إعداد جلسات بث لكن لم يظهر نشاط مباشر فعلي خلال الفترة الأخيرة.",
          action: "ابدأ جلسة بث حقيقية واربطها بمنتجات رائجة لتعزيز التحويل اللحظي.",
        }, 4);
      }

      const recommendations: MerchantGrowthRecommendation[] = [];
      const playbooks: MerchantGrowthPlaybook[] = [];

      if (issues.some((issue) => issue.key === "revenue_decline" || issue.key === "revenue_soft_decline")) {
        addRecommendation(recommendations, {
          key: "recover-demand",
          title: "أعد تنشيط الطلب خلال 72 ساعة",
          description: "أطلق عرضاً سريعاً أو حملة إعادة تنشيط على المنتجات الأعلى مشاهدة لإيقاف هبوط الإيرادات.",
          whyNow: `الإيرادات الحالية ${revenueGrowth < 0 ? `أقل ${Math.abs(revenueGrowth).toFixed(1)}%` : "تحتاج دعماً"} من الفترة السابقة، وكل يوم تأخير يصعّب الاسترداد السريع.`,
          impact: "تحسين الإيرادات على المدى القصير وعودة الحركة إلى الطلبات الجديدة.",
          href: "/promotions",
          ctaLabel: "أنشئ عرضاً الآن",
          category: "sales",
          priority: revenueGrowth <= -20 ? "urgent" : "high",
          issueKeys: ["revenue_decline", "revenue_soft_decline"],
        });

        addPlaybook(playbooks, {
          key: "revenue-recovery-playbook",
          title: "Playbook استرداد الإيرادات",
          summary: "مسار سريع لإيقاف هبوط المبيعات عبر عرض محدود وتنشيط القنوات القريبة من الشراء.",
          outcome: "رفع الطلبات خلال الأسبوع الحالي بدلاً من الاكتفاء بمراقبة الهبوط.",
          href: "/promotions",
          ctaLabel: "ابدأ Playbook الاسترداد",
          category: "sales",
          priority: revenueGrowth <= -20 ? "urgent" : "high",
          steps: [
            "أنشئ عرضاً على المنتجات الأعلى طلباً أو الأعلى مشاهدة خلال آخر 30 يوماً.",
            "وجّه الحملة إلى الزوار الحاليين عبر القنوات الجاهزة مثل واتساب أو البريد.",
            "راجع الأداء بعد 48 ساعة وقارن أثر العرض على الطلبات والإيرادات.",
          ],
        });
      }

      if (issues.some((issue) => issue.key === "cancellation_rate_high" || issue.key === "cancellation_rate_watch")) {
        addRecommendation(recommendations, {
          key: "reduce-cancellations",
          title: "راجع أسباب الإلغاء من آخر الطلبات",
          description: "معدل الإلغاء الحالي يستهلك التحويل المكتسب، لذلك الأولوية هنا هي إزالة الاحتكاك التشغيلي وليس زيادة الزيارات فقط.",
          whyNow: `${cancelRate.toFixed(1)}% من الطلبات أُلغيت خلال آخر 30 يوماً.`,
          impact: "خفض الإلغاءات يرفع صافي الإيراد بسرعة ويمنع فقدان الثقة.",
          href: "/orders",
          ctaLabel: "افتح الطلبات الملغاة",
          category: "operations",
          priority: cancelRate >= 12 ? "urgent" : "high",
          issueKeys: ["cancellation_rate_high", "cancellation_rate_watch"],
        });
      }

      if (issues.some((issue) => issue.key === "out_of_stock" || issue.key === "low_stock_ratio")) {
        addRecommendation(recommendations, {
          key: "protect-bestsellers-stock",
          title: "احمِ المخزون قبل أن يضرب التحويل",
          description: "حدد المنتجات النافدة والمنخفضة المخزون الآن، وأوقف الترويج لما لا يمكن بيعه سريعاً.",
          whyNow: `${outOfStockProducts} منتج نافد و${lowStockProducts} منخفض المخزون داخل الكتالوج النشط.`,
          impact: "منع فقدان الطلبات على المنتجات الرابحة وتقليل الإلغاء بسبب المخزون.",
          href: "/products",
          ctaLabel: "راجع الكتالوج",
          category: "catalog",
          priority: outOfStockProducts >= 5 || outOfStockRate >= 20 ? "urgent" : "high",
          issueKeys: ["out_of_stock", "low_stock_ratio"],
        });

        addPlaybook(playbooks, {
          key: "inventory-protection-playbook",
          title: "Playbook حماية المنتجات الرابحة",
          summary: "نظّف المنتجات النافدة والمنخفضة المخزون قبل أن يهبط التحويل أو ترتفع الإلغاءات.",
          outcome: "الحفاظ على جاهزية الكتالوج ورفع ثبات المبيعات اليومية.",
          href: "/products",
          ctaLabel: "ابدأ مراجعة المخزون",
          category: "catalog",
          priority: outOfStockProducts >= 5 || outOfStockRate >= 20 ? "urgent" : "high",
          steps: [
            "رتّب المنتجات حسب المخزون والحالة وحدد أفضل المنتجات التي يجب حمايتها أولاً.",
            "أوقف أي حملة أو صفحة تعتمد على منتجات نافدة أو قريبة من النفاد.",
            "أعد التوريد أو جهّز بدائل واضحة على المنتجات المتأثرة.",
          ],
        });
      }

      if (issues.some((issue) => issue.key === "abandoned_carts_high" || issue.key === "abandoned_carts_watch")) {
        addRecommendation(recommendations, {
          key: "recover-abandoned-carts",
          title: "استرد السلات المهجورة فوراً",
          description: "هذه مبيعات شبه جاهزة، ولذلك استردادها أسرع من البحث عن زيارات جديدة بالكامل.",
          whyNow: `${abandonedCarts} سلة مهجورة غير مستردة خلال آخر 7 أيام.`,
          impact: "رفع الإيرادات السريعة بأقل تكلفة اكتساب إضافية.",
          href: whatsappConfig?.isActive ? "/abandoned-carts" : "/whatsapp-commerce",
          ctaLabel: whatsappConfig?.isActive ? "افتح السلات المهجورة" : "فعّل واتساب أولاً",
          category: "retention",
          priority: abandonedCarts >= 15 ? "urgent" : "high",
          issueKeys: ["abandoned_carts_high", "abandoned_carts_watch", "whatsapp_not_ready"],
        });

        addPlaybook(playbooks, {
          key: "cart-recovery-playbook",
          title: "Playbook استرداد السلات",
          summary: "حوّل السلات المتروكة إلى طلبات عبر متابعة سريعة ورسالة مقنعة وعرض محدود.",
          outcome: "استعادة جزء من الطلبات المفقودة خلال أيام لا أسابيع.",
          href: whatsappConfig?.isActive ? "/abandoned-carts" : "/whatsapp-commerce",
          ctaLabel: whatsappConfig?.isActive ? "ابدأ الاسترداد" : "أكمل إعداد واتساب",
          category: "retention",
          priority: abandonedCarts >= 15 ? "urgent" : "high",
          steps: [
            "راجع أعلى السلات قيمة وحدد أول من يجب التواصل معه.",
            "أرسل تذكيراً سريعاً أو عرضاً محدود الوقت للعملاء الأقرب للشراء.",
            "قارن نسبة الاسترداد بعد 24 و72 ساعة لتحسين الرسائل لاحقاً.",
          ],
        });
      }

      if (!whatsappConfig || !whatsappConfig.isActive) {
        addRecommendation(recommendations, {
          key: "activate-whatsapp-channel",
          title: "فعّل قناة واتساب التجارية",
          description: "واتساب ليست مجرد قناة دعم هنا، بل أداة استرداد ورفع تحويل يومية داخل الخليج.",
          whyNow: "القناة غير مفعلة حالياً، وهذا يحرم المتجر من أسرع أداة متابعة للعملاء المترددين.",
          impact: "تحسين الاسترداد والرد السريع وزيادة التحويل من العملاء الحاليين.",
          href: "/whatsapp-commerce",
          ctaLabel: "أكمل الإعداد",
          category: "channels",
          priority: abandonedCarts >= 5 ? "urgent" : "high",
          issueKeys: ["whatsapp_not_ready"],
        });
      }

      if (trafficCount >= 200 && trafficToOrderRate < 1.5) {
        addRecommendation(recommendations, {
          key: "improve-conversion-surface",
          title: "ارفع التحويل من نفس الزيارات الحالية",
          description: "الزيارات موجودة لكن نسبة تحولها إلى طلبات ضعيفة، وهذا يشير إلى فرصة مباشرة في صفحة المنتج والثقة والعروض.",
          whyNow: `${trafficCount} زيارة خلال 30 يوماً مقابل معدل تحويل تقريبي ${trafficToOrderRate.toFixed(1)}% فقط من الزيارة إلى الطلب.`,
          impact: "رفع المبيعات بدون الحاجة لرفع الإنفاق على الزيارات أولاً.",
          href: "/builder",
          ctaLabel: "حسّن صفحات البيع",
          category: "conversion",
          priority: trafficToOrderRate < 0.8 ? "urgent" : "high",
          issueKeys: [],
        });

        addPlaybook(playbooks, {
          key: "conversion-surface-playbook",
          title: "Playbook رفع التحويل",
          summary: "اعمل على صفحات البيع الحالية قبل زيادة الترافيك: الثقة، العرض، والوضوح أهم من الزيارة وحدها.",
          outcome: "رفع نسبة الطلبات من نفس حجم الزيارات الحالية.",
          href: "/builder",
          ctaLabel: "افتح منشئ الثيم",
          category: "conversion",
          priority: trafficToOrderRate < 0.8 ? "urgent" : "high",
          steps: [
            "راجع صفحة المنتج وأظهر trust badges ووعود الشحن والوضوح السعري.",
            "أضف عرضاً أو حافزاً بسيطاً للشراء مثل شحن مجاني أو خصم محدود.",
            "تابع أثر التعديل على الطلبات خلال 7 أيام قبل إطلاق حملة زيارات جديدة.",
          ],
        });
      }

      if (repeatCustomerRate < 15 && totalCustomers >= 20) {
        addRecommendation(recommendations, {
          key: "grow-repeat-revenue",
          title: "ابنِ مسار عودة للعملاء الحاليين",
          description: "نسبة العملاء العائدين ما زالت منخفضة مقارنة بحجم قاعدة العملاء الحالية.",
          whyNow: `${repeatCustomers} فقط من أصل ${totalCustomers} عميل لديهم أكثر من طلب واحد.`,
          impact: "رفع قيمة العميل بمرور الوقت وتقليل الاعتماد على اكتساب جديد مستمر.",
          href: "/loyalty",
          ctaLabel: "فعّل برامج الولاء",
          category: "retention",
          priority: repeatCustomerRate < 8 ? "high" : "medium",
          issueKeys: [],
        });
      }

      if (activeCoupons === 0 && currentOrders >= 10) {
        addRecommendation(recommendations, {
          key: "launch-targeted-offer",
          title: "أطلق عرضاً موجهاً بدل الخصم العشوائي",
          description: "يوجد طلب فعلي بالفعل، لكن لا توجد عروض نشطة تساعد على رفع السلة أو تنشيط الشرائح المترددة.",
          whyNow: "المتجر يحقق طلبات، ما يجعل العرض الموجه أكثر فاعلية من إطلاق خصومات عامة بلا بيانات.",
          impact: "رفع متوسط السلة أو تحريك شريحة مترددة دون الإضرار بهامش الربح بشكل عشوائي.",
          href: "/coupons",
          ctaLabel: "أنشئ كوبوناً",
          category: "sales",
          priority: "medium",
          issueKeys: [],
        });
      }

      if (activeProducts < 5) {
        addRecommendation(recommendations, {
          key: "expand-catalog-foundation",
          title: "وسّع الكتالوج قبل تعميق الحملات",
          description: "الكتالوج الحالي صغير، وهذا يضع سقفاً منخفضاً للنمو مهما حسّنت الترافيك أو العروض.",
          whyNow: `عدد المنتجات النشطة الحالي ${activeProducts} فقط.`,
          impact: "توسيع فرص البيع، التوصيات، والشراء المتكرر داخل المتجر.",
          href: "/products/new",
          ctaLabel: "أضف منتجاً جديداً",
          category: "catalog",
          priority: stage === "launch" ? "high" : "medium",
          issueKeys: [],
        });
      }

      if (trafficCount < 50 && activeProducts >= 5) {
        addRecommendation(recommendations, {
          key: "increase-qualified-traffic",
          title: "ارفع الزيارات المؤهلة قبل أي تحسينات أدق",
          description: "الكتالوج موجود لكن الحركة على المتجر ما زالت ضعيفة، لذلك أول مكسب هنا هو زيادة الزيارات الجيدة القابلة للتحويل.",
          whyNow: `${trafficCount} زيارة فقط خلال 30 يوماً، مع ${searchTraffic} من البحث و${socialTraffic} من السوشال.`,
          impact: "توسيع أعلى القمع قبل تحسين التحويل في المراحل التالية.",
          href: "/marketing",
          ctaLabel: "افتح التسويق",
          category: "channels",
          priority: "medium",
          issueKeys: [],
        });
      }

      recommendations.sort((left, right) => recommendationPriorityWeight(right.priority) - recommendationPriorityWeight(left.priority));
      playbooks.sort((left, right) => recommendationPriorityWeight(right.priority) - recommendationPriorityWeight(left.priority));

      const finalScore = clampScore(score.value);

      return reply.send({
        score: finalScore,
        status: scoreStatus(finalScore),
        stage: {
          key: stage,
          label: stageInfo.label,
          detail: stageInfo.detail,
        },
        summary: issues.length === 0
          ? `أداء المتجر مستقر حالياً، والمرحلة الحالية هي ${stageInfo.label}.`
          : `تم رصد ${issues.length} نقطة تحتاج متابعة لتحسين صحة المتجر التجارية في ${stageInfo.label}.`,
        metrics: {
          revenue,
          revenueGrowth,
          orders: currentOrders,
          cancelRate,
          activeProducts,
          totalCustomers,
          repeatCustomers,
          repeatCustomerRate,
          lowStockProducts,
          outOfStockProducts,
          abandonedCarts,
          activeCoupons,
          trafficCount,
          trafficToOrderRate,
        },
        dimensions: [
          {
            key: "sales",
            label: "المبيعات",
            score: clampScore(100 - (revenueGrowth <= -20 ? 30 : revenueGrowth < 0 ? 15 : 0)),
          },
          {
            key: "operations",
            label: "العمليات",
            score: clampScore(100 - (cancelRate >= 12 ? 35 : cancelRate >= 6 ? 15 : 0)),
          },
          {
            key: "inventory",
            label: "المخزون",
            score: clampScore(100 - (outOfStockProducts >= 5 || outOfStockRate >= 20 ? 30 : 0) - (lowStockRate >= 25 ? 15 : 0)),
          },
          {
            key: "recovery",
            label: "الاسترداد",
            score: clampScore(100 - (abandonedCarts >= 15 ? 25 : abandonedCarts >= 5 ? 10 : 0) - (!whatsappConfig || !whatsappConfig.isActive ? 10 : 0)),
          },
        ],
        issues,
        recommendations: recommendations.slice(0, 6),
        playbooks: playbooks.slice(0, 3),
      });
    }
  );
}
