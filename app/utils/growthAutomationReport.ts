import {
  classifyProductGrowthIssues,
  type GrowthIssue,
  type ProductGrowthProductInput,
  type ProductGrowthScanResult,
} from "./productGrowthClassifier";
import { canAutoApplyIssue } from "./safeFixPolicy";

export type GrowthAutomationReportStatus =
  | "completed"
  | "completed_with_suggestions"
  | "no_critical_issues"
  | "failed";

export type GrowthAutomationReport = {
  status: GrowthAutomationReportStatus;
  productsChecked: number;
  issuesFound: number;
  criticalIssues: number;
  warnings: number;
  opportunities: number;
  fixesApplied: number;
  suggestionsCreated: number;
  skippedForSafety: number;
  summary: string;
  topIssues: Array<{
    code: string;
    title: string;
    severity: GrowthIssue["severity"];
    field?: string;
    productTitle?: string;
    recommendedAction: string;
  }>;
};

type BuildGrowthAutomationReportInput = {
  products: ProductGrowthProductInput[];
  fixesApplied?: number;
  failed?: boolean;
};

const SAFE_AUTO_FIX_FIELDS = new Set(["title", "description"]);

export function isSafeGrowthAutomationIssue(issue: GrowthIssue) {
  return Boolean(
    issue.field &&
    SAFE_AUTO_FIX_FIELDS.has(issue.field) &&
    canAutoApplyIssue(issue.code, "growth"),
  );
}

export function scanGrowthAutomationProducts(
  products: ProductGrowthProductInput[],
) {
  return products.map((product) => classifyProductGrowthIssues(product));
}

export function productHasSafeGrowthAutomationFix(
  scan: ProductGrowthScanResult,
) {
  return scan.issues.some(isSafeGrowthAutomationIssue);
}

export function buildGrowthAutomationReport({
  products,
  fixesApplied = 0,
  failed = false,
}: BuildGrowthAutomationReportInput): GrowthAutomationReport {
  const scans = scanGrowthAutomationProducts(products);
  const issues = scans.flatMap((scan) =>
    scan.issues.map((issue) => ({ issue, productTitle: scan.productTitle })),
  );
  const suggestions = issues.filter(
    ({ issue }) => !isSafeGrowthAutomationIssue(issue),
  );
  const skippedForSafety = suggestions.filter(({ issue }) =>
    [
      "image",
      "productType",
      "vendor",
      "tags",
      "price",
      "inventory",
      "images.alt",
    ].includes(issue.field || ""),
  ).length;
  const criticalIssues = issues.filter(
    ({ issue }) => issue.severity === "critical",
  ).length;
  const warnings = issues.filter(
    ({ issue }) => issue.severity === "warning",
  ).length;
  const opportunities = issues.filter(
    ({ issue }) => issue.severity === "opportunity",
  ).length;
  const suggestionsCreated = suggestions.length;

  const status: GrowthAutomationReportStatus = failed
    ? "failed"
    : issues.length === 0 || criticalIssues === 0
      ? "no_critical_issues"
      : fixesApplied > 0 && suggestionsCreated === 0
        ? "completed"
        : "completed_with_suggestions";

  return {
    status,
    productsChecked: products.length,
    issuesFound: issues.length,
    criticalIssues,
    warnings,
    opportunities,
    fixesApplied,
    suggestionsCreated,
    skippedForSafety,
    summary: buildGrowthAutomationSummary({
      status,
      productsChecked: products.length,
      issuesFound: issues.length,
      fixesApplied,
      suggestionsCreated,
      skippedForSafety,
    }),
    topIssues: issues.slice(0, 5).map(({ issue, productTitle }) => ({
      code: issue.code,
      title: issue.title,
      severity: issue.severity,
      field: issue.field,
      productTitle,
      recommendedAction: issue.recommendedAction,
    })),
  };
}

function buildGrowthAutomationSummary(input: {
  status: GrowthAutomationReportStatus;
  productsChecked: number;
  issuesFound: number;
  fixesApplied: number;
  suggestionsCreated: number;
  skippedForSafety: number;
}) {
  if (input.status === "failed") {
    return "Weekly monitoring could not complete. No catalog changes were applied.";
  }

  if (input.status === "no_critical_issues") {
    return `Weekly monitoring checked ${input.productsChecked} products and found no critical issues. FeedPilot will keep monitoring SEO, visibility, and product data signals.`;
  }

  if (input.fixesApplied > 0) {
    return `Weekly monitoring checked ${input.productsChecked} products, applied ${input.fixesApplied} safe fix${input.fixesApplied === 1 ? "" : "es"}, and saved ${input.suggestionsCreated} suggestion${input.suggestionsCreated === 1 ? "" : "s"} for review.`;
  }

  return `Weekly monitoring checked ${input.productsChecked} products and found ${input.issuesFound} issue${input.issuesFound === 1 ? "" : "s"}. Riskier changes were saved as suggestions for merchant review.`;
}
