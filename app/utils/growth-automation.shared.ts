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
  seoScore: number;
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

export type ImpactLevel = "High" | "Medium" | "Low";

export type QueueProduct = DecisionProduct & {
  optimizationReasons: string[];
  priorityScore: number;
  decisionSignals: DecisionSignals;
  severity: QueueSeverity;
  primaryIssue: QueuePrimaryIssue;
  impact: string;
  impactLevel: ImpactLevel;
  whyItMatters: string[];
  outcomeText: string;
  recommendedAction: string;
  estimatedLift: string;
  ctaLabel: string;
};

function getStaleThreshold(score: number) {
  if (score < 70) return 7;      // 低质量：快速优化
  if (score < 85) return 14;     // 中等：正常节奏
  return 30;                     // 高分：很稳定，不轻易打扰
}

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

export function getDecisionSignals(
  product: DecisionProduct,
  optimizeBelowScore: number,
): DecisionSignals {
  const cleanDesc = cleanText(product.descriptionHtml);
  const cleanTitle = String(product.title || "").trim();

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
  const staleThreshold = getStaleThreshold(product.seoScore);

  return {
    lowScore: product.seoScore < optimizeBelowScore,
    shortTitle: titleLength < 50,
    weakDescription: descriptionLength < 120,
    staleContent:
      daysSinceUpdate !== null && daysSinceUpdate >= staleThreshold,
    recentlyUpdated:
      daysSinceUpdate !== null && daysSinceUpdate <= 3,
    softOpportunity:
      product.seoScore >= 85 &&
      product.seoScore < 95 &&
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

  if (rule.optimizeNewProductsOnly && !signals.recentlyUpdated) {
    return [];
  }

  if (!rule.optimizeNewProductsOnly && signals.staleContent) {
    reasons.push("staleContent");
  }

  if (!rule.optimizeNewProductsOnly && signals.softOpportunity) {
    reasons.push("softOpportunity");
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

export function getSeverityFromReasons(
  reasons: string[],
): QueueSeverity {
  if (reasons.includes("lowScore")) return "critical";
  if (reasons.length > 0) return "opportunity";
  return "healthy";
}

export function getPrimaryIssueFromReasons(
  reasons: string[],
): QueuePrimaryIssue {
  if (reasons.includes("lowScore")) {
    return "lowScore";
  }

  if (reasons.includes("weakDescription")) {
    return "weakDescription";
  }

  if (reasons.includes("shortTitle")) {
    return "shortTitle";
  }

  if (reasons.includes("staleContent")) {
    return "staleContent";
  }

  if (reasons.includes("softOpportunity")) {
    return "softOpportunity";
  }

  return "generalOpportunity";
}

export function buildImpactLevel(
  primaryIssue: QueuePrimaryIssue,
  product: DecisionProduct,
  signals: DecisionSignals,
): ImpactLevel {
  if (primaryIssue === "lowScore") return "High";

  if (primaryIssue === "weakDescription") {
    return signals.descriptionLength < 80 ? "High" : "Medium";
  }

  if (primaryIssue === "shortTitle") {
    return signals.titleLength < 35 ? "High" : "Medium";
  }

  if (primaryIssue === "staleContent") {
    return "Medium";
  }

  if (primaryIssue === "softOpportunity") {
    return "Low";
  }

  return "Medium";
}

export function buildWhyItMatters(
  primaryIssue: QueuePrimaryIssue,
  product: DecisionProduct,
  signals: DecisionSignals,
): string[] {
  if (primaryIssue === "lowScore") {
    return [
      `SEO score ${product.seoScore} is below the optimization threshold.`,
      `Keyword coverage appears weaker than stronger-performing listings.`,
      `Listing quality may be limiting search visibility.`,
    ];
  }

  if (primaryIssue === "weakDescription") {
    return [
      `Description length is only ${signals.descriptionLength} characters.`,
      `Thin content can reduce buyer confidence and search relevance.`,
      `Key product benefits may not be clearly communicated.`,
    ];
  }

  if (primaryIssue === "shortTitle") {
    return [
      `Title length is only ${signals.titleLength} characters.`,
      `The title currently uses ${signals.keywordCount} keyword terms.`,
      `Short titles often capture less search intent.`,
    ];
  }

  if (primaryIssue === "staleContent") {
    return [
      `This listing has not been refreshed recently.`,
      `Older content can lose relevance against updated competitors.`,
      `A refresh may improve relevance and engagement quality.`,
    ];
  }

  if (primaryIssue === "softOpportunity") {
    return [
      `This product already performs relatively well.`,
      `There is still room to improve content precision and search alignment.`,
      `Incremental refinement may strengthen catalog consistency.`,
    ];
  }

  return [
    `This listing still has room for content improvement.`,
    `Search visibility and product clarity may be improved further.`,
  ];
}

export function buildImpactText(
  primaryIssue: QueuePrimaryIssue,
  product: DecisionProduct,
  signals: DecisionSignals,
  reasons: string[],
) {
  if (primaryIssue === "lowScore") {
    return `Low SEO score (${product.seoScore}) indicates weaker search visibility and listing competitiveness.`;
  }

  if (primaryIssue === "weakDescription") {
    return `Thin product content may be limiting conversion confidence and search relevance.`;
  }

  if (primaryIssue === "shortTitle") {
    return `A short title may be limiting keyword targeting and buyer-intent coverage.`;
  }

  if (primaryIssue === "staleContent") {
    return `Content freshness may be limiting relevance against more recently updated listings.`;
  }

  if (primaryIssue === "softOpportunity") {
    return `This listing is already strong, but still has room for incremental performance gains.`;
  }

  return `This product still has room to improve search visibility and content quality.`;
}

export function buildOutcomeText(
  primaryIssue: QueuePrimaryIssue,
  product: DecisionProduct,
  signals: DecisionSignals,
): string {
  if (primaryIssue === "lowScore") {
    return "Expected outcome: stronger keyword coverage and better visibility readiness.";
  }

  if (primaryIssue === "weakDescription") {
    return "Expected outcome: better content quality and stronger conversion support.";
  }

  if (primaryIssue === "shortTitle") {
    return "Expected outcome: clearer search intent alignment and stronger title relevance.";
  }

  if (primaryIssue === "staleContent") {
    return "Expected outcome: refreshed relevance and stronger catalog consistency.";
  }

  if (primaryIssue === "softOpportunity") {
    return "Expected outcome: incremental listing quality gains without changing the core offer.";
  }

  return "Expected outcome: improved listing quality and optimization readiness.";
}

export function buildRecommendedAction(
  primaryIssue: QueuePrimaryIssue,
  signals: DecisionSignals,
) {
  if (primaryIssue === "lowScore") {
    return `Improve the listing’s core SEO structure, including title relevance, keyword coverage, and supporting content quality.`;
  }

  if (primaryIssue === "weakDescription") {
    return `Expand the description beyond ${signals.descriptionLength} characters with stronger features, benefits, and buyer-intent language.`;
  }

  if (primaryIssue === "shortTitle") {
    return `Strengthen the title beyond ${signals.titleLength} characters by adding more high-intent search terms and clearer product specificity.`;
  }

  if (primaryIssue === "staleContent") {
    return `Refresh the content to maintain ranking relevance, stronger engagement, and more current search matching.`;
  }

  if (primaryIssue === "softOpportunity") {
    return `Fine-tune the title and description to unlock additional performance gains without changing the core offer.`;
  }

  return `Review and improve product content quality.`;
}

export function buildEstimatedLift(
  primaryIssue: QueuePrimaryIssue,
) {
  if (primaryIssue === "lowScore") {
    return "Visibility potential";
  }

  if (primaryIssue === "weakDescription") {
    return "Content quality potential";
  }

  if (primaryIssue === "shortTitle") {
    return "Search intent potential";
  }

  if (primaryIssue === "staleContent") {
    return "Freshness potential";
  }

  if (primaryIssue === "softOpportunity") {
    return "Incremental improvement";
  }

  return "Optimization potential";
}

export function buildCtaLabel(
  primaryIssue: QueuePrimaryIssue,
  severity: QueueSeverity,
  isProView = true,
) {
  if (severity === "critical") {
    return isProView ? "Improve Visibility" : "Fix Critical Issue";
  }

  if (primaryIssue === "weakDescription") {
    return isProView ? "Improve Description" : "Unlock This Opportunity";
  }

  if (primaryIssue === "shortTitle") {
    return isProView ? "Improve Title" : "Unlock This Opportunity";
  }

  if (primaryIssue === "staleContent") {
    return isProView ? "Refresh Content" : "Unlock This Opportunity";
  }

  if (primaryIssue === "softOpportunity") {
    return isProView ? "Boost Performance" : "Unlock This Opportunity";
  }

  return isProView ? "Optimize Listing" : "Unlock This Opportunity";
}
/**
 * 商业排序修正版：
 * 1. critical 永远最前
 * 2. 机会内部：
 *    weakDescription > shortTitle > staleContent > softOpportunity
 * 3. staleContent / softOpportunity 不能把高分商品抬到真正低质商品前面
 */
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
  let score = 0;

  // 第一层：critical 永远最高
  if (signals.lowScore) {
    score += 10000;

    // 分数越低越靠前
    score += Math.max(0, rule.optimizeBelowScore - product.seoScore) * 100;

    if (signals.weakDescription) score += 500;
    if (signals.shortTitle) score += 300;

    return score;
  }

  // 第二层：机会类排序
  if (signals.weakDescription) {
    score += 2000;
    if (rule.prioritizeWeakDescription) score += 200;
  }

  if (signals.shortTitle) {
    score += 1500;
  }

  if (signals.staleContent) {
    score += 800;
  }

  if (signals.softOpportunity) {
    score += 300;
  }

  // 同层内：分数低的更靠前
  score += Math.max(0, 100 - product.seoScore) * 10;

  // 新品只做轻微微调，永不压过核心问题
  if (rule.prioritizeNewProducts && signals.recentlyUpdated) {
    score += 20;
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
    impactLevel?: ImpactLevel;
    whyItMatters?: string[];
    outcomeText?: string;
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
      const optimizationReasons =
        Array.isArray(product.optimizationReasons) &&
        product.optimizationReasons.length > 0
          ? product.optimizationReasons
          : getOptimizationReasons(product, rule);

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

      const severity =
        product.severity || getSeverityFromReasons(optimizationReasons);

      const primaryIssue =
        product.primaryIssue || getPrimaryIssueFromReasons(optimizationReasons);

     return {
  ...product,
  optimizationReasons,
  decisionSignals,
  priorityScore,
  severity,
  primaryIssue,
  impact:
    product.impact ||
    buildImpactText(
      primaryIssue,
      product,
      decisionSignals,
      optimizationReasons,
    ),
  impactLevel:
    product.impactLevel ||
    buildImpactLevel(primaryIssue, product, decisionSignals),
  whyItMatters:
    product.whyItMatters ||
    buildWhyItMatters(primaryIssue, product, decisionSignals),
  outcomeText:
    product.outcomeText ||
    buildOutcomeText(primaryIssue, product, decisionSignals),
  recommendedAction:
    product.recommendedAction ||
    buildRecommendedAction(primaryIssue, decisionSignals),
  estimatedLift:
    product.estimatedLift ||
    buildEstimatedLift(primaryIssue),
  ctaLabel:
    product.ctaLabel ||
    buildCtaLabel(primaryIssue, severity, true),
};
    })
    .filter((product) => product.optimizationReasons.length > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "critical" ? -1 : 1;
      }

      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }

      return a.seoScore - b.seoScore;
    })
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