import type {
  FeedPilotActionDecision,
  FeedPilotResultType,
  SafeFixPlan,
} from "../utils/safeFixPolicy";
import type { GrowthIssueCategory } from "../utils/productGrowthClassifier";

export type ProductGrowthOpportunityLevel =
  | "high"
  | "medium"
  | "low"
  | "healthy";

export type ProductGrowthSnapshot = {
  id?: string;
  shop?: string;
  productId: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  imageCount?: number;
  imagesMissingAltCount?: number;
  variantsCount?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  compareAtPricePresent?: boolean;
  inventorySignal?: "available" | "unavailable" | "unknown";
  handle?: string;
  seoTitle?: string;
  metaDescription?: string;
  seoHealthScore?: number;
  completenessScore?: number;
  feedReadinessScore?: number;
  conversionReadinessScore?: number;
  opportunityLevel: ProductGrowthOpportunityLevel;
  issues: unknown[];
  recommendedActions: string[];
  scannedAt: string | Date;
};

export type ProductGrowthOpportunityCategory =
  | GrowthIssueCategory
  | "conversion";

export type ProductGrowthOpportunity = {
  id?: string;
  shop?: string;
  productId: string;
  productTitle: string;
  issueCode: string;
  category: ProductGrowthOpportunityCategory;
  priority: "high" | "medium" | "low";
  title: string;
  explanation: string;
  whyItMatters: string;
  recommendedAction: string;
  actionType: FeedPilotActionDecision;
  safeAutoFix: boolean;
  requiresMerchantReview: boolean;
  planRequired?: SafeFixPlan;
  status?: "open" | "applied" | "dismissed" | "monitoring";
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type OptimizationAction = {
  id?: string;
  shop?: string;
  productId: string;
  productTitle?: string;
  actionType:
    | "applied_fix"
    | "suggestion_created"
    | "healthy_report"
    | "automation_scan"
    | "skipped_for_safety";
  source:
    | "manual_optimize_now"
    | "weekly_monitoring"
    | "growth_queue"
    | "automation";
  issueCode?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  fieldChanged?: string | null;
  resultType: FeedPilotResultType;
  usageConsumed: boolean;
  safeAutoFix: boolean;
  requiresMerchantReview: boolean;
  summary: string;
  createdAt?: string | Date;
};

// Future TODO: add Prisma persistence models for these V2 concepts in a
// dedicated migration task. Issue #9 intentionally keeps this as a typed,
// PostgreSQL-compatible data foundation without changing the schema.
