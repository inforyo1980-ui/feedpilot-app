import {
  getDecisionSignals,
  getOptimizationReasons,
  getPriorityScore,
  getSeverityFromReasons,
  getPrimaryIssueFromReasons,
  buildImpactText,
  buildImpactLevel,
  buildWhyItMatters,
  buildOutcomeText,
  buildRecommendedAction,
  buildEstimatedLift,
  buildCtaLabel,
  type GrowthAutomationRuleShape,
  type QueueSeverity,
  type QueuePrimaryIssue,
  type DecisionSignals,
  type ImpactLevel,
} from "./growth-automation.shared";
import {
  getWeeklyInsight,
  listOptimizationHistory,
} from "../services/optimization-history.server";

export type Product = {
  id: string;
  title: string;
  status: string;
  handle: string;
  price: string;
  descriptionHtml: string;
  seoScore: number;
  issues: string[];
  fixes: string[];
};

export type ScanBaseProduct = {
  id: string;
  title: string;
  status: string;
  handle: string;
  price: string;
  descriptionHtml: string;
  updatedAt?: string | Date | null;
};

export type ProductScanResult = ScanBaseProduct & {
  seoScore: number;
  issues: string[];
  fixes: string[];

  optimizationReasons: string[];
  priorityScore: number;

  severity: QueueSeverity;
  primaryIssue: QueuePrimaryIssue;

  impact: string;
  impactLevel: ImpactLevel;
  whyItMatters: string[];
  outcomeText: string;
  recommendedAction: string;
  estimatedLift: string;
  ctaLabel: string;

  decisionSignals: DecisionSignals;
};

export type DashboardSnapshot = {
  scannedAt: string;
  productsMonitored: number;
  criticalCount: number;
  opportunityCount: number;
  healthyCount: number;
  avgSeoScore: number;
  avgOptimizationLift: number;
  topPriorityOpportunities: ProductScanResult[];
  products: ProductScanResult[];
};

export function calculateSeoScore(title: string, description: string) {
  let score = 20;

  const cleanTitle = (title || "").trim();
  const cleanDescription = (description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const titleWords = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const uniqueTitleWords = new Set(titleWords);
  const keywordCount = titleWords.length;
  const uniqueKeywordCount = uniqueTitleWords.size;

  if (cleanTitle.length >= 25) score += 8;
  if (cleanTitle.length >= 40) score += 8;
  if (cleanTitle.length >= 60) score += 6;

  if (cleanDescription.length >= 80) score += 8;
  if (cleanDescription.length >= 160) score += 8;
  if (cleanDescription.length >= 300) score += 6;

  if (keywordCount >= 4) score += 6;
  if (keywordCount >= 7) score += 4;
  if (uniqueKeywordCount >= 4) score += 6;
  if (uniqueKeywordCount >= 7) score += 4;

  const conversionWords = [
    "premium",
    "ultimate",
    "ideal",
    "perfect",
    "durable",
    "lightweight",
    "comfortable",
    "performance",
    "high-performance",
    "versatile",
  ];

  const conversionHits = conversionWords.filter(
    (w) => cleanTitle.toLowerCase().includes(w) || cleanDescription.includes(w),
  ).length;
  score += Math.min(conversionHits * 2, 8);

  const categoryWords = [
    "snowboard",
    "gift card",
    "all-mountain",
    "winter",
    "terrain",
    "digital",
    "delivery",
  ];

  const categoryHits = categoryWords.filter(
    (w) => cleanTitle.toLowerCase().includes(w) || cleanDescription.includes(w),
  ).length;
  score += Math.min(categoryHits * 2, 8);

  if (cleanTitle.length < 20) score -= 12;
  if (cleanDescription.length < 50) score -= 12;

  const repetitionPenalty = keywordCount - uniqueKeywordCount;
  if (repetitionPenalty >= 2) score -= repetitionPenalty * 2;

  if (cleanDescription.length > 0 && cleanDescription.length < 120) score -= 4;

  return Math.max(10, Math.min(score, 95));
}

export function auditProduct(product: Omit<Product, "issues" | "fixes">): Product {
  const issues: string[] = [];
  const fixes: string[] = [];

  const title = product.title || "";
  const desc = (product.descriptionHtml || "").replace(/<[^>]*>/g, " ").trim();

  if (title.length < 50) {
    issues.push(`Title is too short (${title.length})`);
    fixes.push("Expand title with stronger keywords");
  }

  const keywordCount = title.split(/\s+/).filter(Boolean).length;
  if (keywordCount < 5) {
    issues.push(`Title lacks strong buyer-intent keywords (${keywordCount})`);
    fixes.push("Add more relevant buyer-intent keywords");
  }

  if (desc.length < 120) {
    issues.push(`Description is too weak (${desc.length})`);
    fixes.push("Improve description with features and benefits");
  }

  if (
    !/benefit|ideal|perfect|durable|lightweight|comfortable|performance/i.test(
      desc,
    )
  ) {
    issues.push("Description lacks persuasive conversion language");
    fixes.push("Add benefit-driven copy to improve conversion");
  }

  if (issues.length === 0) {
    issues.push("Keyword targeting can still be improved");
    fixes.push("Fine-tune title and description for stronger search intent");
  }

  return {
    ...product,
    issues,
    fixes,
  };
}

export function buildRevenueStats(
  items: Array<{ scoreBefore: number; scoreAfter: number }>,
) {
  const optimizedCount = items.length;
  const improvements = items.map((item) => item.scoreAfter - item.scoreBefore);
  const positiveImprovements = improvements.filter((v) => v > 0);

  const avgImprovement =
    positiveImprovements.length > 0
      ? Math.round(
          positiveImprovements.reduce((a, b) => a + b, 0) /
            positiveImprovements.length,
        )
      : 0;

  const bestImprovement =
    positiveImprovements.length > 0 ? Math.max(...positiveImprovements) : 0;

  const successRate =
    improvements.length > 0
      ? Math.round((positiveImprovements.length / improvements.length) * 100)
      : 0;

  let visibilityLevel = "Low";
  if (avgImprovement >= 10) visibilityLevel = "High";
  else if (avgImprovement >= 5) visibilityLevel = "Moderate";

  return {
    optimizedCount,
    avgImprovement,
    bestImprovement,
    successRate,
    visibilityLevel,
  };
}

export function scanProduct(
  product: ScanBaseProduct,
  rule: Pick<
    GrowthAutomationRuleShape,
    | "optimizeBelowScore"
    | "optimizeShortTitle"
    | "optimizeWeakDescription"
    | "optimizeNewProductsOnly"
    | "prioritizeLowScore"
    | "prioritizeNewProducts"
    | "prioritizeWeakDescription"
  >,
): ProductScanResult {
  const seoScore = calculateSeoScore(product.title, product.descriptionHtml);

  const audited = auditProduct({
    ...product,
    seoScore,
  });

  const decisionSignals = getDecisionSignals(
    {
      ...product,
      seoScore,
    },
    rule.optimizeBelowScore,
  );

  const optimizationReasons = getOptimizationReasons(
    {
      ...product,
      seoScore,
    },
    rule,
  );

  const priorityScore = getPriorityScore(
    {
      ...product,
      seoScore,
    },
    {
      ...rule,
      optimizeBelowScore: rule.optimizeBelowScore,
    },
  );

  const severity = getSeverityFromReasons(optimizationReasons);
  const primaryIssue = getPrimaryIssueFromReasons(optimizationReasons);

  return {
    ...product,
    seoScore,
    issues: audited.issues,
    fixes: audited.fixes,

    optimizationReasons,
    priorityScore,

    severity,
    primaryIssue,

    impact: buildImpactText(
      primaryIssue,
      {
        ...product,
        seoScore,
      },
      decisionSignals,
      optimizationReasons,
    ),
    impactLevel: buildImpactLevel(
      primaryIssue,
      {
        ...product,
        seoScore,
      },
      decisionSignals,
    ),
    whyItMatters: buildWhyItMatters(
      primaryIssue,
      {
        ...product,
        seoScore,
      },
      decisionSignals,
    ),
    outcomeText: buildOutcomeText(
      primaryIssue,
      {
        ...product,
        seoScore,
      },
      decisionSignals,
    ),
    recommendedAction: buildRecommendedAction(primaryIssue, decisionSignals),
    estimatedLift: buildEstimatedLift(primaryIssue),
    ctaLabel: buildCtaLabel(primaryIssue, severity, true),

    decisionSignals,
  };
}

export function buildDashboardSnapshot(
  products: ScanBaseProduct[],
  rule: Pick<
    GrowthAutomationRuleShape,
    | "optimizeBelowScore"
    | "optimizeShortTitle"
    | "optimizeWeakDescription"
    | "optimizeNewProductsOnly"
    | "prioritizeLowScore"
    | "prioritizeNewProducts"
    | "prioritizeWeakDescription"
    | "maxProductsPerRun"
  >,
  history: Array<{ scoreBefore: number; scoreAfter: number }>,
): DashboardSnapshot {
  const scannedProducts = products.map((product) => scanProduct(product, rule));

  const sortedQueue = [...scannedProducts]
    .filter((product) => product.optimizationReasons.length > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "critical" ? -1 : 1;
      }

      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }

      return a.seoScore - b.seoScore;
    });

  const revenueStats = buildRevenueStats(history);

  const criticalCount = scannedProducts.filter(
    (p) => p.severity === "critical",
  ).length;

  const opportunityCount = scannedProducts.filter(
    (p) => p.severity === "opportunity",
  ).length;

  const healthyCount = scannedProducts.filter(
    (p) => p.severity === "healthy",
  ).length;

  const avgSeoScore =
    scannedProducts.length > 0
      ? Math.round(
          scannedProducts.reduce((sum, p) => sum + p.seoScore, 0) /
            scannedProducts.length,
        )
      : 0;

  return {
    scannedAt: new Date().toISOString(),
    productsMonitored: scannedProducts.length,
    criticalCount,
    opportunityCount,
    healthyCount,
    avgSeoScore,
    avgOptimizationLift: revenueStats.avgImprovement,
    topPriorityOpportunities: sortedQueue.slice(0, rule.maxProductsPerRun),
    products: scannedProducts,
  };
}
export async function getEnhancedDashboardData(
  shopDomain: string,
  products: ScanBaseProduct[],
  rule: Pick<
    GrowthAutomationRuleShape,
    | "optimizeBelowScore"
    | "optimizeShortTitle"
    | "optimizeWeakDescription"
    | "optimizeNewProductsOnly"
    | "prioritizeLowScore"
    | "prioritizeNewProducts"
    | "prioritizeWeakDescription"
    | "maxProductsPerRun"
  >,
  history: Array<{ scoreBefore: number; scoreAfter: number }>
) {
  const snapshot = buildDashboardSnapshot(products, rule, history);

  const [weeklyInsight, optimizationHistory] = await Promise.all([
    getWeeklyInsight(shopDomain),
    listOptimizationHistory(shopDomain, 20),
  ]);

  return {
    ...snapshot,

    // 👉 新增层（商业化核心）
    weeklyInsight,
    optimizationHistory,
  };
}