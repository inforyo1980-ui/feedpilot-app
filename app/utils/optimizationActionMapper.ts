import type { OptimizationAction } from "../types/productGrowth";
import type { FeedPilotResultType } from "./safeFixPolicy";

type OptimizationActionBaseInput = {
  id?: string;
  shop?: string;
  productId: string;
  productTitle?: string;
  issueCode?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  fieldChanged?: string | null;
  summary?: string;
  createdAt?: string | Date;
};

type AutomationScanInput = Omit<OptimizationActionBaseInput, "issueCode"> & {
  issueCode?: string;
  safeAutoFix?: boolean;
  requiresMerchantReview?: boolean;
};

function buildOptimizationAction(
  input: OptimizationActionBaseInput & {
    actionType: OptimizationAction["actionType"];
    source: OptimizationAction["source"];
    resultType: FeedPilotResultType;
    usageConsumed: boolean;
    safeAutoFix: boolean;
    requiresMerchantReview: boolean;
    fallbackSummary: string;
  },
): OptimizationAction {
  return {
    id: input.id,
    shop: input.shop,
    productId: input.productId,
    productTitle: input.productTitle,
    actionType: input.actionType,
    source: input.source,
    issueCode: input.issueCode,
    beforeValue: input.beforeValue,
    afterValue: input.afterValue,
    fieldChanged: input.fieldChanged,
    resultType: input.resultType,
    usageConsumed: input.usageConsumed,
    safeAutoFix: input.safeAutoFix,
    requiresMerchantReview: input.requiresMerchantReview,
    summary: input.summary ?? input.fallbackSummary,
    createdAt: input.createdAt,
  };
}

export function mapAppliedOptimizationAction(
  input: OptimizationActionBaseInput & { usageConsumed?: boolean },
): OptimizationAction {
  return buildOptimizationAction({
    ...input,
    actionType: "applied_fix",
    source: "manual_optimize_now",
    resultType: "APPLIED",
    usageConsumed: input.usageConsumed ?? true,
    safeAutoFix: true,
    requiresMerchantReview: false,
    fallbackSummary:
      "Applied a conservative FeedPilot safe fix through an existing supported write path.",
  });
}

export function mapSuggestionOnlyOptimizationAction(
  input: OptimizationActionBaseInput,
): OptimizationAction {
  return buildOptimizationAction({
    ...input,
    actionType: "suggestion_created",
    source: "manual_optimize_now",
    resultType: "SUGGESTION_ONLY",
    usageConsumed: false,
    safeAutoFix: false,
    requiresMerchantReview: true,
    fallbackSummary:
      "Created a review suggestion because the opportunity needs merchant judgment or is not safe to auto-apply.",
  });
}

export function mapHealthyReportOptimizationAction(
  input: OptimizationActionBaseInput,
): OptimizationAction {
  return buildOptimizationAction({
    ...input,
    actionType: "healthy_report",
    source: "manual_optimize_now",
    resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
    usageConsumed: false,
    safeAutoFix: false,
    requiresMerchantReview: false,
    fallbackSummary:
      "Returned a product growth report with no critical issue requiring an automatic write.",
  });
}

export function mapAutomationScanOptimizationAction(
  input: AutomationScanInput,
): OptimizationAction {
  return buildOptimizationAction({
    ...input,
    actionType: "automation_scan",
    source: "weekly_monitoring",
    resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
    usageConsumed: false,
    safeAutoFix: input.safeAutoFix ?? false,
    requiresMerchantReview: input.requiresMerchantReview ?? false,
    fallbackSummary:
      "Recorded a Growth monitoring scan signal without changing Shopify product data.",
  });
}

export function mapSkippedForSafetyOptimizationAction(
  input: OptimizationActionBaseInput,
): OptimizationAction {
  return buildOptimizationAction({
    ...input,
    actionType: "skipped_for_safety",
    source: "automation",
    resultType: "SUGGESTION_ONLY",
    usageConsumed: false,
    safeAutoFix: false,
    requiresMerchantReview: true,
    fallbackSummary:
      "Skipped an automatic change because the issue affects sensitive commerce data or needs merchant review.",
  });
}

// Future TODO: persist these V2 action objects behind a dedicated schema and
// migration task. For now, OptimizationHistory remains the current database
// record and this mapper does not change Shopify writes or plan behavior.
