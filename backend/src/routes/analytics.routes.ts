import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

export async function analyticsRoutes(app: FastifyInstance) {
  // POST /api/v1/analytics/pageview — fire-and-forget tracking from storefront
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

    // Classify traffic source from referrer
    function classifySource(ref?: string): string {
      if (!ref || ref === "") return "direct";
      const lower = ref.toLowerCase();
      if (lower.includes("google") || lower.includes("bing") || lower.includes("yahoo")) return "search";
      if (lower.includes("facebook") || lower.includes("instagram") || lower.includes("twitter") ||
          lower.includes("tiktok") || lower.includes("snapchat") || lower.includes("linkedin")) return "social";
      if (lower.includes("mail") || lower.includes("email")) return "email";
      return "referral";
    }

    const source = classifySource(referrer);

    // Truncate path to avoid overly long values
    const safePath = path.slice(0, 500);
    const safeReferrer = referrer ? referrer.slice(0, 500) : undefined;

    // Fire-and-forget: don't block the response
    prisma.pageView.create({
      data: { storeId, path: safePath, referrer: safeReferrer, source },
    }).catch(() => { /* ignore */ });

    return reply.code(204).send();
  });

  // GET /api/v1/analytics/:storeId/traffic — traffic sources summary (last 30 days)
  app.get<{ Params: { storeId: string }; Querystring: { days?: string } }>(
    "/:storeId/traffic",
    async (req, reply) => {
      const { storeId } = req.params;
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

      return {
        total,
        bySource: bySource.map((s: { source: string | null; _count: { id: number } }) => ({
          source: s.source ?? "direct",
          label: sourceLabels[s.source ?? "direct"] ?? s.source,
          count: s._count.id,
          pct: total > 0 ? Math.round((s._count.id / total) * 100) : 0,
        })),
        topPages: topPages.map((p: { path: string; _count: { id: number } }) => ({
          path: p.path,
          count: p._count.id,
        })),
        days,
      };
    }
  );
}
