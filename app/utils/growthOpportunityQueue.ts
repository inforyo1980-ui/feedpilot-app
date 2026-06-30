import {
  classifyProductGrowthIssues,
  type GrowthIssue,
  type GrowthIssueCategory,
  type ProductGrowthProductInput,
} from "./productGrowthClassifier";

export type GrowthOpportunityPriority = "high" | "medium" | "low";

export type GrowthOpportunityActionType =
  | "apply_safe_fix"
  | "review_suggestion"
  | "monitor"
  | "upgrade_required";

export type GrowthOpportunityPlan = "free" | "starter" | "growth";

export type GrowthOpportunity = {
  id: string;
  productId: string;
  productTitle: string;
  issueCode: string;
  category: GrowthIssueCategory | "conversion";
  priority: GrowthOpportunityPriority;
  scoreImpact?: number;
  title: string;
  explanation: string;
  whyItMatters: string;
  recommendedAction: string;
  actionType: GrowthOpportunityActionType;
  safeAutoFix: boolean;
  planRequired?: GrowthOpportunityPlan;
};

type QueueProductInput = ProductGrowthProductInput & {
  id?: unknown;
  title?: unknown;
  seoScore?: unknown;
};

const HIGH_PRIORITY_CODES = new Set([
  "DESCRIPTION_MISSING",
  "PRODUCT_IMAGE_MISSING",
  "PRICE_MISSING",
  "FEED_PRICE_GAP",
  "FEED_IMAGE_GAP",
]);

const MEDIUM_PRIORITY_CODES = new Set([
  "TAGS_MISSING",
  "TAGS_THIN",
  "IMAGE_ALT_MISSING",
  "TITLE_MISSING",
  "TITLE_TOO_LONG",
  "DESCRIPTION_TOO_SHORT",
]);

const LOW_PRIORITY_CODES = new Set([
  "TITLE_TOO_SHORT",
  "DESCRIPTION_THIN",
  "COMPARE_AT_PRICE_OPPORTUNITY",
]);

const SCORE_IMPACT_BY_PRIORITY: Record<GrowthOpportunityPriority, number> = {
  high: 30,
  medium: 18,
  low: 8,
};

function toText(value: unknown, fallback = "Untitled product") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function hasIssue(issues: GrowthIssue[], code: string) {
  return issues.some((issue) => issue.code === code);
}

function getPriority(
  issue: GrowthIssue,
  issues: GrowthIssue[],
  scores: { feedReadinessScore: number; completenessScore: number },
): GrowthOpportunityPriority {
  if (issue.severity === "critical" || HIGH_PRIORITY_CODES.has(issue.code)) {
    return "high";
  }

  if (
    (issue.code === "FEED_PRODUCT_TYPE_GAP" &&
      hasIssue(issues, "PRODUCT_TYPE_MISSING")) ||
    (issue.code === "FEED_VENDOR_GAP" && hasIssue(issues, "VENDOR_MISSING"))
  ) {
    return "high";
  }

  if (scores.feedReadinessScore < 60 || scores.completenessScore < 60) {
    return "high";
  }

  if (issue.severity === "warning" || MEDIUM_PRIORITY_CODES.has(issue.code)) {
    return "medium";
  }

  if (LOW_PRIORITY_CODES.has(issue.code) || issue.severity === "opportunity") {
    return "low";
  }

  return "low";
}

function getWhyItMatters(issue: GrowthIssue) {
  switch (issue.category) {
    case "seo":
      return "Addressing this may improve visibility readiness and make the product easier to understand in search and storefront contexts.";
    case "content":
      return "Clearer product content may improve product context and can make merchant review easier before applying changes.";
    case "image":
      return "Image completeness can reduce missed product data gaps and may improve catalog readiness for merchandising workflows.";
    case "catalog_data":
      return "More complete catalog data can help catalog organization and make review of product growth gaps easier.";
    case "feed_readiness":
      return "Resolving this feed readiness signal can reduce missed product data gaps before feed or merchandising workflows rely on the item.";
    case "pricing":
      return "Pricing signals need careful merchant review because FeedPilot should not auto-change sensitive commerce data.";
    case "inventory":
      return "Inventory signals can make review easier when merchants assess whether a product is ready for growth workflows.";
    default:
      return "Reviewing this can reduce missed product data gaps and may improve catalog completeness.";
  }
}

function getActionType(
  issue: GrowthIssue,
  plan: GrowthOpportunityPlan,
): GrowthOpportunityActionType {
  if (plan === "free") return "upgrade_required";
  if (issue.safeAutoFix) return "apply_safe_fix";
  return "review_suggestion";
}

function getPlanRequired(
  issue: GrowthIssue,
  plan: GrowthOpportunityPlan,
): GrowthOpportunityPlan | undefined {
  if (plan === "free") return "starter";
  if (plan === "starter" && issue.safeAutoFix) return "starter";
  if (plan === "growth" && issue.safeAutoFix) return "growth";
  return undefined;
}

function compareOpportunities(a: GrowthOpportunity, b: GrowthOpportunity) {
  const priorityRank: Record<GrowthOpportunityPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  if (priorityRank[b.priority] !== priorityRank[a.priority]) {
    return priorityRank[b.priority] - priorityRank[a.priority];
  }

  return (
    (b.scoreImpact ?? 0) - (a.scoreImpact ?? 0) ||
    a.productTitle.localeCompare(b.productTitle) ||
    a.issueCode.localeCompare(b.issueCode)
  );
}

export function buildGrowthOpportunityQueue(
  products: QueueProductInput[],
  plan: GrowthOpportunityPlan,
  limit = 10,
): GrowthOpportunity[] {
  const opportunities = products.flatMap((product) => {
    const scan = classifyProductGrowthIssues(product);
    const productId = toText(scan.productId || product.id, "unknown-product");
    const productTitle = toText(scan.productTitle || product.title);

    return scan.issues.map((issue) => {
      const priority = getPriority(issue, scan.issues, {
        feedReadinessScore: scan.feedReadinessScore,
        completenessScore: scan.completenessScore,
      });
      const scoreImpact = SCORE_IMPACT_BY_PRIORITY[priority];

      return {
        id: `${productId}:${issue.code}`,
        productId,
        productTitle,
        issueCode: issue.code,
        category: issue.category,
        priority,
        scoreImpact,
        title: issue.title,
        explanation: issue.explanation,
        whyItMatters: getWhyItMatters(issue),
        recommendedAction:
          plan === "growth" && issue.safeAutoFix
            ? `${issue.recommendedAction} Growth can include this safe fix in weekly monitoring and automation reports.`
            : issue.recommendedAction,
        actionType: getActionType(issue, plan),
        safeAutoFix: Boolean(issue.safeAutoFix),
        planRequired: getPlanRequired(issue, plan),
      } satisfies GrowthOpportunity;
    });
  });

  return opportunities.sort(compareOpportunities).slice(0, limit);
}
