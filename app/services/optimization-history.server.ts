import db from "../db.server";

export type RecordOptimizationHistoryInput = {
  shopDomain: string;
  productId: string;
  productTitleBefore: string;
  productTitleAfter: string;

  seoScoreBefore?: number | null;
  seoScoreAfter?: number | null;
  impactDelta?: number | null;
  issueCountBefore?: number | null;
  issueCountAfter?: number | null;

  changeType?: "title" | "description" | "tags";
  source?: "manual" | "automation" | "weekly";
  decisionMode?: "suggest" | "auto";
  status?: "applied" | "skipped" | "failed";

  whyText?: string | null;
  outcomeText?: string | null;
  actionText?: string | null;
  rawIssuesJson?: string | null;
  rawDecisionJson?: string | null;
};

export async function recordOptimizationHistory(
  input: RecordOptimizationHistoryInput
) {
  return db.optimizationHistory.create({
    data: {
      shopDomain: input.shopDomain,
      productId: input.productId,
      productTitleBefore: input.productTitleBefore,
      productTitleAfter: input.productTitleAfter,

      seoScoreBefore: input.seoScoreBefore ?? null,
      seoScoreAfter: input.seoScoreAfter ?? null,
      impactDelta:
        input.impactDelta ??
        deriveImpactDelta(input.seoScoreBefore, input.seoScoreAfter),
      issueCountBefore: input.issueCountBefore ?? null,
      issueCountAfter: input.issueCountAfter ?? null,

      changeType: input.changeType ?? "title",
      source: input.source ?? "manual",
      decisionMode: input.decisionMode ?? "suggest",
      status: input.status ?? "applied",

      whyText: input.whyText ?? null,
      outcomeText: input.outcomeText ?? null,
      actionText: input.actionText ?? null,
      rawIssuesJson: input.rawIssuesJson ?? null,
      rawDecisionJson: input.rawDecisionJson ?? null,
    },
  });
}

export async function listOptimizationHistory(shopDomain: string, limit = 20) {
  return db.optimizationHistory.findMany({
    where: { shopDomain },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getWeeklyInsight(shopDomain: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const items = await db.optimizationHistory.findMany({
    where: {
      shopDomain,
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const applied = items.filter((x) => x.status === "applied");
  const failed = items.filter((x) => x.status === "failed");
  const automated = items.filter((x) => x.source === "automation");
  const manual = items.filter((x) => x.source === "manual");

  const totalImpactDelta = applied.reduce(
    (sum, item) => sum + (item.impactDelta ?? 0),
    0
  );

  const avgImpactDelta =
    applied.length > 0 ? Number((totalImpactDelta / applied.length).toFixed(1)) : 0;

  const avgSeoBefore = average(
    applied.map((x) => x.seoScoreBefore).filter(isNumber)
  );

  const avgSeoAfter = average(
    applied.map((x) => x.seoScoreAfter).filter(isNumber)
  );

  const improvedProducts = applied.filter((x) => {
    if (!isNumber(x.seoScoreBefore) || !isNumber(x.seoScoreAfter)) return false;
    return x.seoScoreAfter > x.seoScoreBefore;
  }).length;

  const topProducts = applied
    .slice()
    .sort((a, b) => (b.impactDelta ?? 0) - (a.impactDelta ?? 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      productId: item.productId,
      titleBefore: item.productTitleBefore,
      titleAfter: item.productTitleAfter,
      impactDelta: item.impactDelta ?? 0,
      seoScoreBefore: item.seoScoreBefore,
      seoScoreAfter: item.seoScoreAfter,
      createdAt: item.createdAt,
    }));

  return {
    windowDays: 7,
    totalOptimizations: items.length,
    appliedCount: applied.length,
    failedCount: failed.length,
    automatedCount: automated.length,
    manualCount: manual.length,
    improvedProducts,
    totalImpactDelta,
    avgImpactDelta,
    avgSeoBefore,
    avgSeoAfter,
    topProducts,
    summaryText: buildWeeklySummary({
      appliedCount: applied.length,
      improvedProducts,
      avgImpactDelta,
      automatedCount: automated.length,
    }),
  };
}

function deriveImpactDelta(
  before?: number | null,
  after?: number | null
): number | null {
  if (!isNumber(before) || !isNumber(after)) return null;
  return after - before;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function buildWeeklySummary(input: {
  appliedCount: number;
  improvedProducts: number;
  avgImpactDelta: number;
  automatedCount: number;
}) {
  if (input.appliedCount === 0) {
    return "No optimization changes were applied in the last 7 days.";
  }

  return `${input.appliedCount} optimizations were applied in the last 7 days. ${input.improvedProducts} products showed measurable score improvement, with an average impact delta of ${input.avgImpactDelta}. ${input.automatedCount} of those changes came from automation.`;
}