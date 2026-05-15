import prisma from "../db.server";

export type GrowthAutomationRuleShape = {
  id: string;
  shopDomain: string;

  optimizeBelowScore: number;
  optimizeShortTitle: boolean;
  optimizeWeakDescription: boolean;
  optimizeNewProductsOnly: boolean;

  prioritizeLowScore: boolean;
  prioritizeNewProducts: boolean;
  prioritizeWeakDescription: boolean;

  maxProductsPerRun: number;
  runMode: string;
  runFrequencyDays: number;

  focusMode: string;

  createdAt: Date;
  updatedAt: Date;
};

export type DecisionProduct = {
  id: string;
  title: string;
  descriptionHtml: string;
  seoScore?: number | null;
  score?: number | null;
  status?: string;
  handle?: string;
  price?: string;
  updatedAt?: string | Date | null;
  issues?: string[];
  fixes?: string[];
};

export type DecisionSignals = {
  lowScore: boolean;
  shortTitle: boolean;
  weakDescription: boolean;
  staleContent: boolean;
  recentlyUpdated: boolean;
  softOpportunity: boolean;
  daysSinceUpdate: number | null;
  titleLength: number;
  descriptionLength: number;
  keywordCount: number;
};

export type QueueSeverity = "critical" | "opportunity" | "healthy";

export type QueuePrimaryIssue =
  | "lowScore"
  | "weakDescription"
  | "shortTitle"
  | "staleContent"
  | "softOpportunity"
  | "generalOpportunity";

export type QueueProduct = DecisionProduct & {
  optimizationReasons: string[];
  priorityScore: number;
  decisionSignals: DecisionSignals;
  severity: QueueSeverity;
  primaryIssue: QueuePrimaryIssue;
  impact: string;
  recommendedAction: string;
  estimatedLift: string;
  ctaLabel: string;
};

function cleanText(html: string | undefined | null) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getKeywordCount(title: string) {
  return String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getProductScore(product: DecisionProduct) {
  const raw =
    typeof product.seoScore === "number"
      ? product.seoScore
      : typeof product.score === "number"
        ? product.score
        : null;

  return typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
}

export function getDecisionSignals(
  product: DecisionProduct,
  optimizeBelowScore: number,
): DecisionSignals {
  const cleanDesc = cleanText(product.descriptionHtml);
  const cleanTitle = String(product.title || "").trim();
  const productScore = getProductScore(product);

  let daysSinceUpdate: number | null = null;

  if (product.updatedAt) {
    const updatedAt = new Date(product.updatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      daysSinceUpdate =
        (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    }
  }

  const titleLength = cleanTitle.length;
  const descriptionLength = cleanDesc.length;
  const keywordCount = getKeywordCount(cleanTitle);

    return {
    lowScore: productScore < optimizeBelowScore,
    shortTitle: titleLength < 50,
    weakDescription: descriptionLength < 120,
    staleContent: daysSinceUpdate !== null && daysSinceUpdate >= 3,
    recentlyUpdated: daysSinceUpdate !== null && daysSinceUpdate <= 14,
    softOpportunity:
      productScore >= 85 &&
      productScore < 95 &&
      titleLength >= 50 &&
      descriptionLength >= 120,
    daysSinceUpdate,
    titleLength,
    descriptionLength,
    keywordCount,
  };
}
export function getOptimizationReasons(
  product: DecisionProduct,
  rule: Pick<
    GrowthAutomationRuleShape,
    | "optimizeBelowScore"
    | "optimizeShortTitle"
    | "optimizeWeakDescription"
    | "optimizeNewProductsOnly"
  >,
) {
  const signals = getDecisionSignals(product, rule.optimizeBelowScore);
  const reasons: string[] = [];

  if (signals.lowScore) {
    reasons.push("lowScore");
  }

  if (rule.optimizeShortTitle && signals.shortTitle) {
    reasons.push("shortTitle");
  }

  if (rule.optimizeWeakDescription && signals.weakDescription) {
    reasons.push("weakDescription");
  }

  if (rule.optimizeNewProductsOnly === true && !signals.recentlyUpdated) {
  return [];
}

  return [...new Set(reasons)];
}

export function shouldOptimizeProduct(
  product: DecisionProduct,
  rule: Pick<
    GrowthAutomationRuleShape,
    | "optimizeBelowScore"
    | "optimizeShortTitle"
    | "optimizeWeakDescription"
    | "optimizeNewProductsOnly"
  >,
) {
  return getOptimizationReasons(product, rule).length > 0;
}

export function getPriorityScore(
  product: DecisionProduct,
  rule: Pick<
    GrowthAutomationRuleShape,
    "prioritizeLowScore" | "prioritizeNewProducts" | "prioritizeWeakDescription"
  > & {
    optimizeBelowScore: number;
  },
) {
  const signals = getDecisionSignals(product, rule.optimizeBelowScore);
  const productScore = getProductScore(product);
  let score = 0;

  if (signals.lowScore) {
    score += 1000;
    score += (rule.optimizeBelowScore - productScore) * 20;
  }

  if (signals.lowScore && signals.weakDescription) {
    score += 100;
  }

  if (signals.lowScore && signals.shortTitle) {
    score += 80;
  }

  if (signals.staleContent) {
    score += 40;
  }

  if (signals.softOpportunity) {
    score += 20;
  }

  if (rule.prioritizeWeakDescription && signals.weakDescription) {
    score += 15;
  }

  if (rule.prioritizeNewProducts && signals.recentlyUpdated) {
    score += 5;
  }

  return score;
}

export function buildOptimizationQueue(
  products: Array<
    DecisionProduct & {
      optimizationReasons?: string[];
      priorityScore?: number;
      decisionSignals?: DecisionSignals;
      severity?: QueueSeverity;
      primaryIssue?: QueuePrimaryIssue;
      impact?: string;
      recommendedAction?: string;
      estimatedLift?: string;
      ctaLabel?: string;
    }
  >,
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
): QueueProduct[] {
  return products
    .map((product) => {
      const optimizationReasons = getOptimizationReasons(product, rule);
      const decisionSignals =
        product.decisionSignals ||
        getDecisionSignals(product, rule.optimizeBelowScore);

      const priorityScore =
        typeof product.priorityScore === "number"
          ? product.priorityScore
          : getPriorityScore(product, {
              ...rule,
              optimizeBelowScore: rule.optimizeBelowScore,
            });

      return {
        ...product,
        optimizationReasons,
        decisionSignals,
        priorityScore,
        severity: product.severity || "opportunity",
        primaryIssue: product.primaryIssue || "generalOpportunity",
        impact: product.impact || "",
        recommendedAction: product.recommendedAction || "",
        estimatedLift: product.estimatedLift || "",
        ctaLabel: product.ctaLabel || "Optimize Now",
      };
    })
    .filter((product) => product.optimizationReasons.length > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, rule.maxProductsPerRun);
}

export function buildFocusInstruction(focusMode: string) {
  if (focusMode === "seo") {
    return "Prioritize search visibility, keyword targeting, and discoverability.";
  }

  if (focusMode === "conversion") {
    return "Prioritize persuasive language, buyer intent, and conversion-focused copy.";
  }

  return "Balance search visibility and conversion performance.";
}

export async function getGrowthAutomationRule(shopDomain: string) {
  const rule = await prisma.autoOptimizeSettings.findUnique({
    where: { shopDomain },
  });

  if (!rule) {
    return {
      optimizeBelowScore: 70,
      optimizeShortTitle: true,
      optimizeWeakDescription: true,
      prioritizeLowScore: true,
      prioritizeWeakDescription: true,
      maxProductsPerRun: 5,
      runMode: "suggest",
      runFrequencyDays: 7,
      focusMode: "balanced",
    };
  }

  return {
    optimizeBelowScore: rule.optimizeBelowScore ?? 70,
    optimizeShortTitle: rule.optimizeShortTitle ?? true,
    optimizeWeakDescription: rule.optimizeWeakDescription ?? true,
    prioritizeLowScore: rule.prioritizeLowScore ?? true,
    prioritizeWeakDescription: rule.prioritizeWeakDescription ?? true,
    maxProductsPerRun: rule.maxProductsPerRun ?? 5,
    runMode: rule.mode ?? "suggest",
    runFrequencyDays: rule.runFrequencyDays ?? 7,
    focusMode: "balanced",
  };
}

export async function upsertGrowthAutomationRule(
  shopDomain: string,
  data: {
    optimizeBelowScore: number;
    optimizeShortTitle: boolean;
    optimizeWeakDescription: boolean;
    prioritizeLowScore: boolean;
    prioritizeWeakDescription: boolean;
    maxProductsPerRun: number;
    runMode: string;
    runFrequencyDays: number;
    focusMode: string;
  },
) {
  return prisma.autoOptimizeSettings.upsert({
    where: { shopDomain },
    update: {
      optimizeBelowScore: data.optimizeBelowScore,
      optimizeShortTitle: data.optimizeShortTitle,
      optimizeWeakDescription: data.optimizeWeakDescription,
      prioritizeLowScore: data.prioritizeLowScore,
      prioritizeWeakDescription: data.prioritizeWeakDescription,
      maxProductsPerRun: data.maxProductsPerRun,
      mode: data.runMode,
      runFrequencyDays: data.runFrequencyDays,
    },
    create: {
      shopDomain,
      enabled: true,
      mode: data.runMode,
      optimizeBelowScore: data.optimizeBelowScore,
      optimizeShortTitle: data.optimizeShortTitle,
      optimizeWeakDescription: data.optimizeWeakDescription,
      prioritizeLowScore: data.prioritizeLowScore,
      prioritizeWeakDescription: data.prioritizeWeakDescription,
      maxProductsPerRun: data.maxProductsPerRun,
      runFrequencyDays: data.runFrequencyDays,
      lastRunAt: null,
    },
  });
}