export type FeedPilotActionDecision =
  | "apply_safe_fix"
  | "review_suggestion"
  | "monitor"
  | "blocked_by_plan";

export type FeedPilotResultType =
  | "APPLIED"
  | "SUGGESTION_ONLY"
  | "NO_CRITICAL_ISSUE_WITH_REPORT";

export type SafeFixPlan = "free" | "starter" | "growth";

export type SafeFixDecision = {
  issueCode: string;
  actionDecision: FeedPilotActionDecision;
  resultType: FeedPilotResultType;
  safeAutoFix: boolean;
  requiresMerchantReview: boolean;
  planRequired?: SafeFixPlan;
  usageConsumed: boolean;
  reason: string;
};

type SafeFixDecisionOptions = {
  plan?: SafeFixPlan;
  automation?: boolean;
};

type ProposedFixValueInput = {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
};

type ProposedFixValueResult = {
  valid: boolean;
  reason?: string;
};

const SAFE_AUTO_FIX_ISSUES = new Set([
  "TITLE_TOO_SHORT",
  "TITLE_TOO_LONG",
  "TITLE_GENERIC",
  "DESCRIPTION_TOO_SHORT",
  "DESCRIPTION_THIN",
  "DESCRIPTION_MARKETING_HEAVY_FACT_LIGHT",
]);

const SUGGESTION_ONLY_ISSUES = new Set([
  "AI_COPY_PRESENT_BUT_DATA_WEAK",
  "MATERIAL_INFO_MISSING",
  "SIZE_OR_SPEC_INFO_MISSING",
  "USE_CASE_MISSING",
  "TARGET_CUSTOMER_MISSING",
  "CARE_INSTRUCTION_MISSING",
  "COMPATIBILITY_INFO_MISSING",
  "INGREDIENT_OR_COMPONENT_INFO_MISSING",
  "IMAGE_ALT_MISSING",
  "IMAGE_ALT_GENERIC",
  "SEO_TITLE_MISSING",
  "META_DESCRIPTION_MISSING",
  "HANDLE_TOO_GENERIC",
  "TAGS_MISSING",
  "TAGS_THIN",
  "PRODUCT_TYPE_MISSING",
  "VENDOR_MISSING",
]);

const MONITOR_ONLY_ISSUES = new Set([
  "CATALOG_COMPLETENESS_LOW",
  "FEED_READINESS_LOW",
  "SEARCH_CONTEXT_WEAK",
  "AI_SEARCH_READINESS_WEAK",
]);

const SENSITIVE_COMMERCE_ISSUE_PATTERNS = [
  /PRICE/,
  /INVENTORY/,
  /SKU/,
  /BARCODE/,
  /VENDOR/,
  /PRODUCT_TYPE/,
  /TAX/,
  /SHIPPING/,
  /PUBLISH/,
  /STATUS/,
];

const GENERIC_VALUES = new Set([
  "product",
  "new product",
  "best product",
  "great product",
  "high quality product",
  "item",
  "untitled",
  "title",
  "description",
  "n/a",
]);

const TEXT_LENGTH_LIMITS: Record<string, { min: number; max: number }> = {
  title: { min: 10, max: 140 },
  description: { min: 40, max: 5000 },
};

function normalizeIssueCode(issueCode: string) {
  return issueCode.trim().toUpperCase();
}

function isGenericText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return GENERIC_VALUES.has(normalized);
}

export function isSensitiveCommerceIssue(issueCode: string) {
  const normalized = normalizeIssueCode(issueCode);
  return SENSITIVE_COMMERCE_ISSUE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

export function isSuggestionOnlyIssue(issueCode: string) {
  const normalized = normalizeIssueCode(issueCode);
  return (
    SUGGESTION_ONLY_ISSUES.has(normalized) ||
    isSensitiveCommerceIssue(normalized)
  );
}

export function isMonitorOnlyIssue(issueCode: string) {
  return MONITOR_ONLY_ISSUES.has(normalizeIssueCode(issueCode));
}

export function canAutoApplyIssue(issueCode: string, plan: SafeFixPlan) {
  const normalized = normalizeIssueCode(issueCode);

  if (plan === "free") return false;
  if (isMonitorOnlyIssue(normalized) || isSuggestionOnlyIssue(normalized)) {
    return false;
  }

  return SAFE_AUTO_FIX_ISSUES.has(normalized);
}

export function getSafeFixDecision(
  issueCode: string,
  options: SafeFixDecisionOptions = {},
): SafeFixDecision {
  const normalized = normalizeIssueCode(issueCode);
  const plan = options.plan ?? "free";

  if (isMonitorOnlyIssue(normalized)) {
    return {
      issueCode: normalized,
      actionDecision: "monitor",
      resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
      safeAutoFix: false,
      requiresMerchantReview: false,
      usageConsumed: false,
      reason:
        "This issue is a monitoring signal and should be reported without applying catalog changes.",
    };
  }

  if (isSuggestionOnlyIssue(normalized)) {
    return {
      issueCode: normalized,
      actionDecision: "review_suggestion",
      resultType: "SUGGESTION_ONLY",
      safeAutoFix: false,
      requiresMerchantReview: true,
      usageConsumed: false,
      reason:
        "This issue can affect commerce-critical product data or needs merchant judgment, so it is saved for review.",
    };
  }

  if (!SAFE_AUTO_FIX_ISSUES.has(normalized)) {
    return {
      issueCode: normalized,
      actionDecision: "review_suggestion",
      resultType: "SUGGESTION_ONLY",
      safeAutoFix: false,
      requiresMerchantReview: true,
      usageConsumed: false,
      reason:
        "This issue is not on the conservative safe-fix allowlist, so it requires merchant review.",
    };
  }

  if (!canAutoApplyIssue(normalized, plan)) {
    return {
      issueCode: normalized,
      actionDecision: "blocked_by_plan",
      resultType: "SUGGESTION_ONLY",
      safeAutoFix: false,
      requiresMerchantReview: true,
      planRequired: "starter",
      usageConsumed: false,
      reason:
        "This safe fix requires an eligible paid plan before FeedPilot applies a catalog write.",
    };
  }

  return {
    issueCode: normalized,
    actionDecision: "apply_safe_fix",
    resultType: "APPLIED",
    safeAutoFix: true,
    requiresMerchantReview: false,
    planRequired: options.automation ? "growth" : plan,
    usageConsumed: plan === "free",
    reason: options.automation
      ? "Growth automation may apply this conservative title or description fix through an existing supported write path."
      : "This issue is eligible for a conservative safe fix through an existing supported write path.",
  };
}

export function validateProposedFixValue({
  field,
  oldValue,
  newValue,
}: ProposedFixValueInput): ProposedFixValueResult {
  const fieldKey = field.trim().toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(TEXT_LENGTH_LIMITS, fieldKey)) {
    return {
      valid: false,
      reason:
        "Only supported title and description safe-fix fields can be validated.",
    };
  }

  if (typeof newValue !== "string" || !newValue.trim()) {
    return {
      valid: false,
      reason: "The proposed safe-fix value must be non-empty.",
    };
  }

  const proposed = newValue.trim();
  const current = typeof oldValue === "string" ? oldValue.trim() : "";

  if (proposed === current) {
    return {
      valid: false,
      reason: "The proposed safe-fix value must differ from the current value.",
    };
  }

  if (isGenericText(proposed)) {
    return {
      valid: false,
      reason: "The proposed safe-fix value is too generic for merchant value.",
    };
  }

  const limits = TEXT_LENGTH_LIMITS[fieldKey];
  if (proposed.length < limits.min || proposed.length > limits.max) {
    return {
      valid: false,
      reason: `The proposed ${fieldKey} must be between ${limits.min} and ${limits.max} characters.`,
    };
  }

  return { valid: true };
}
