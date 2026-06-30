import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { Link, useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect, useMemo, useState } from "react";
import prisma from "../db.server";
import {
  getDevPlanOverride,
  getPlan,
  getPlanWithDevOverride,
  isDevPlanOverrideEnabled,
} from "../utils/plan.server";
import {
  calculateSeoScore,
  getEnhancedDashboardData,
  type ProductScanResult,
} from "../utils/dashboard.server";

import { applyOptimizedTitleAndRecord } from "../services/optimization-apply.server";
import { OptimizationHistoryPanel } from "../components/OptimizationHistoryPanel";
import { StatCard } from "../components/StatCard";
import { optimizeProductWithAI } from "../services/optimizer.server";
import type { GrowthOpportunity } from "../utils/growthOpportunityQueue";
const FREE_OPTIMIZATION_LIMIT = 2;
const FREE_OPTIMIZATION_WINDOW_DAYS = 7;

const STATUS_THEME = {
  free: {
    accent: "#6b7280",
    softBg: "#f3f4f6",
    softBorder: "#e5e7eb",
    statusBg: "#f3f4f6",
    statusText: "#4b5563",
    statusBorder: "#d1d5db",
  },
  starter: {
    accent: "#2563eb",
    softBg: "#eff6ff",
    softBorder: "#bfdbfe",
    statusBg: "#eff6ff",
    statusText: "#1d4ed8",
    statusBorder: "#bfdbfe",
  },
  growth: {
    accent: "#059669",
    softBg: "#ecfdf5",
    softBorder: "#a7f3d0",
    statusBg: "#ecfdf5",
    statusText: "#047857",
    statusBorder: "#a7f3d0",
  },
} as const;

function buildRevenueStats(
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

function mapHistoryForRevenueStats(
  items: Array<{
    seoScoreBefore?: number | null;
    seoScoreAfter?: number | null;
  }>,
) {
  return items
    .filter(
      (item) =>
        typeof item.seoScoreBefore === "number" &&
        typeof item.seoScoreAfter === "number",
    )
    .map((item) => ({
      scoreBefore: item.seoScoreBefore as number,
      scoreAfter: item.seoScoreAfter as number,
    }));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);

  const growthRule = {
    optimizeBelowScore: 85,
    optimizeShortTitle: true,
    optimizeWeakDescription: true,
    optimizeNewProductsOnly: false,
    prioritizeLowScore: true,
    prioritizeNewProducts: false,
    prioritizeWeakDescription: true,
    maxProductsPerRun: 10,
    runMode: "suggest",
    runFrequencyDays: 7,
    focusMode: "balanced",
  };

  const response = await admin.graphql(`
    #graphql
    query {
      products(first: 30, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            status
            handle
            descriptionHtml
            updatedAt
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  const rawProducts =
    data?.data?.products?.edges?.map((item: any) => {
      const node = item?.node;
      return {
        id: node?.id ?? "",
        title: node?.title ?? "",
        status: node?.status ?? "",
        handle: node?.handle ?? "",
        descriptionHtml: node?.descriptionHtml ?? "",
        updatedAt: node?.updatedAt ?? null,
        price: node?.variants?.edges?.[0]?.node?.price ?? "0.00",
      };
    }) ?? [];

  const history = await prisma.optimizationHistory.findMany({
    where: {
      shopDomain: session.shop,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyHistory = await prisma.optimizationHistory.findMany({
    where: {
      shopDomain: session.shop,
      createdAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allTimeHistory = await prisma.optimizationHistory.findMany({
    where: {
      shopDomain: session.shop,
    },
    orderBy: { createdAt: "desc" },
  });

  const revenueStats = buildRevenueStats(
    mapHistoryForRevenueStats(monthlyHistory),
  );

  const allTimeRevenueStats = buildRevenueStats(
    mapHistoryForRevenueStats(allTimeHistory),
  );

  const previousHistory = history.slice(7, 14);
  const previousStats = buildRevenueStats(
    mapHistoryForRevenueStats(previousHistory),
  );

  const improvementTrend =
    revenueStats.avgImprovement - (previousStats.avgImprovement || 0);

  const plan = await getPlanWithDevOverride(request, billing);
  const devPlanOverride = getDevPlanOverride(request);

  const freeWindowStart = new Date();
  freeWindowStart.setDate(
    freeWindowStart.getDate() - FREE_OPTIMIZATION_WINDOW_DAYS,
  );

  const manualOptimizationCount =
    plan === "free"
      ? await prisma.optimizationHistory.count({
          where: {
            shopDomain: session.shop,
            source: "manual",
            status: "applied",
            createdAt: {
              gte: freeWindowStart,
            },
          },
        })
      : 0;

  const freeRemaining =
    plan === "free"
      ? Math.max(FREE_OPTIMIZATION_LIMIT - manualOptimizationCount, 0)
      : null;

  const freeLimitReached =
    plan === "free" && manualOptimizationCount >= FREE_OPTIMIZATION_LIMIT;

  const dashboard = await getEnhancedDashboardData(
    session.shop,
    rawProducts,
    growthRule,
    allTimeHistory,
    plan,
  );

  return Response.json({
    snapshot: dashboard,
    weeklyInsight: dashboard.weeklyInsight,
    optimizationHistory: dashboard.optimizationHistory,
    history,
    revenueStats,
    allTimeRevenueStats,
    improvementTrend,
    plan,
    devPlanOverride,
    isDevPlanSwitcherEnabled: isDevPlanOverrideEnabled(),
    freeRemaining,
    manualOptimizationCount,
    freeLimitReached,
    growthRule,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, billing, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const description = String(formData.get("description") ?? "");
  const apiKey = process.env.OPENAI_API_KEY;

  const plan = await getPlan(billing);

  let freeQuotaExhausted = false;

  if (plan === "free") {
    const freeWindowStart = new Date();
    freeWindowStart.setDate(
      freeWindowStart.getDate() - FREE_OPTIMIZATION_WINDOW_DAYS,
    );

    const manualOptimizationCount = await prisma.optimizationHistory.count({
      where: {
        shopDomain: session.shop,
        source: "manual",
        status: "applied",
        createdAt: {
          gte: freeWindowStart,
        },
      },
    });

    if (manualOptimizationCount >= FREE_OPTIMIZATION_LIMIT) {
      freeQuotaExhausted = true;
    }
  }

  if (!apiKey) {
    console.error("Manual optimization failed: missing OPENAI_API_KEY", {
      shopDomain: session.shop,
      productId,
    });

    const growthReport = {
      resultType: "SUGGESTION_ONLY",
      productId,
      summary:
        "FeedPilot could not generate a per-run growth report because AI configuration is missing.",
      impactSummary: "AI configuration is missing.",
      recommendedAction:
        "Configure OPENAI_API_KEY, then run Scan Products again.",
      upgradeRequired: false,
      usageConsumed: false,
    };

    return Response.json(
      {
        error: "Missing OPENAI_API_KEY",
        resultType: growthReport.resultType,
        growthReport,
        usageConsumed: false,
      },
      { status: 400 },
    );
  }

  if (!productId) {
    console.error("Manual optimization failed: missing productId", {
      shopDomain: session.shop,
      formDataKeys: Array.from(formData.keys()),
    });

    const growthReport = {
      resultType: "SUGGESTION_ONLY",
      productId,
      summary:
        "FeedPilot could not inspect this product because the product ID was missing.",
      impactSummary: "Product ID was missing.",
      recommendedAction:
        "Refresh the dashboard and run Scan Products from a listed product.",
      upgradeRequired: false,
      usageConsumed: false,
    };

    return Response.json(
      {
        error: "Missing productId",
        resultType: growthReport.resultType,
        growthReport,
        usageConsumed: false,
      },
      { status: 400 },
    );
  }

  try {
    const result = await optimizeProductWithAI({
      admin,
      shopDomain: session.shop,
      productId,
      title,
      description,
      source: "manual",
      decisionMode: "suggest",
      canApply: !freeQuotaExhausted,
    });

    return Response.json(result);
  } catch (error: any) {
    console.error("Manual optimization failed", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      shopDomain: session.shop,
      productId,
      titleLength: title.length,
      descriptionLength: description.length,
    });

    const growthReport = {
      resultType: "SUGGESTION_ONLY",
      productId,
      summary: "FeedPilot could not complete this optimization run safely.",
      impactSummary: error?.message || "Optimization failed",
      recommendedAction:
        "Try again. If the issue continues, review this product manually before applying changes.",
      upgradeRequired: false,
      usageConsumed: false,
    };

    return Response.json(
      {
        error: error?.message || "Optimization failed",
        resultType: growthReport.resultType,
        growthReport,
        usageConsumed: false,
      },
      { status: 400 },
    );
  }
};

type ScanResultType =
  | "APPLIED"
  | "SUGGESTION_ONLY"
  | "NO_CRITICAL_ISSUE_WITH_REPORT";

type ManualGrowthReport = {
  resultType?: ScanResultType;
  summary?: string;
  recommendedAction?: string;
  upgradeRequired?: boolean;
  usageConsumed?: boolean;
};

type ManualScanResult = {
  resultType: ScanResultType;
  usageConsumed: boolean;
  safeFixApplied: boolean;
  growthReport: ManualGrowthReport;
  product: ProductScanResult | null;
};

const SCAN_TOAST_DURATION_MS = 5600;

function getIssueSignal(product?: ProductScanResult | null) {
  if (!product) return "Catalog readiness gap detected";

  const queueIssue = product.issues?.[0];
  const reasons = product.optimizationReasons ?? [];
  const signals = product.decisionSignals;

  if (
    product.primaryIssue === "weakDescription" ||
    reasons.includes("weakDescription")
  ) {
    return "Weak product description";
  }
  if (product.primaryIssue === "lowScore" || reasons.includes("lowScore")) {
    return "Low SEO readiness score";
  }
  if (product.primaryIssue === "shortTitle" || reasons.includes("shortTitle")) {
    return "Short product title";
  }
  if (
    product.primaryIssue === "staleContent" ||
    reasons.includes("staleContent")
  ) {
    return "Catalog content may need review";
  }
  if (signals?.weakDescription) return "Weak product description";
  if (signals?.lowScore) return "Low SEO readiness score";
  if (signals?.shortTitle) return "Short product title";
  if (queueIssue?.toLowerCase().includes("description"))
    return "Weak product description";
  if (queueIssue?.toLowerCase().includes("keyword"))
    return "Low SEO readiness score";
  if (queueIssue?.toLowerCase().includes("title")) return "Short product title";

  return "Catalog readiness gap detected";
}

function getWhyItMatters(product?: ProductScanResult | null) {
  const issue = getIssueSignal(product);
  if (issue === "Weak product description") {
    return "Weak product descriptions can make it harder for shoppers and search systems to understand the product.";
  }
  if (issue === "Low SEO readiness score") {
    return "Low SEO readiness means this product should be reviewed before higher-priority merchandising or ad work.";
  }
  if (issue === "Short product title") {
    return "Thin title signals can make product context harder to review and organize across the catalog.";
  }
  return (
    product?.whyItMatters?.[0] ??
    "Incomplete product data can reduce catalog readiness for filtering, review, and discovery."
  );
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function buildHeroStatusLabel(plan: "free" | "starter" | "growth") {
  if (plan === "growth") return "Active";
  if (plan === "starter") return "Starter";
  return "Free";
}

function buildHeroSubtitleByPlan(plan: "free" | "starter" | "growth") {
  if (plan === "growth") {
    return "Weekly monitoring is active for SEO, visibility, and product data gaps.";
  }
  if (plan === "starter") {
    return "Manual product growth fixes are active. Weekly monitoring is available on Growth.";
  }
  return "FeedPilot scans your Shopify catalog for SEO, visibility, product data gaps, and catalog readiness signals, then separates supported safe fixes from review-only suggestions and weekly monitoring.";
}

function getImpactLevelTone(label: string) {
  if (label.toLowerCase().includes("high")) {
    return {
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (label.toLowerCase().includes("medium")) {
    return {
      color: "#b45309",
      bg: "#fff7ed",
      border: "#fed7aa",
    };
  }

  return {
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#e5e7eb",
  };
}

function buildStarterSuccessText(count: number) {
  return `${count} product${count > 1 ? "s" : ""} optimized successfully`;
}

function buildGrowthSuccessText(count: number) {
  return `Weekly monitoring applied ${count} safe fix${count === 1 ? "" : "es"}`;
}

type GrowthAutomationReport = {
  status:
    | "completed"
    | "completed_with_suggestions"
    | "no_critical_issues"
    | "failed";
  productsChecked: number;
  issuesFound: number;
  criticalIssues: number;
  warnings: number;
  opportunities: number;
  fixesApplied: number;
  suggestionsCreated: number;
  skippedForSafety: number;
  summary: string;
  topIssues: Array<{ title: string; severity: string; productTitle?: string }>;
};

type GrowthAutoRunStatus =
  | {
      status: "checking";
      message: string;
    }
  | {
      status:
        | "cooldown"
        | "disabled"
        | "no_products"
        | "no_opportunities"
        | "no_changes"
        | "optimized"
        | "completed"
        | "completed_with_suggestions"
        | "no_critical_issues"
        | "failed"
        | "locked"
        | "server_error";
      message?: string;
      optimizedCount?: number;
      successCount?: number;
      nextRunAt?: string;
      remainingHours?: number;
      runFrequencyDays?: number;
      report?: GrowthAutomationReport;
    };

function formatAutoRunDate(value?: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildGrowthAutoRunMessage(status: GrowthAutoRunStatus) {
  if (status.status === "checking") return status.message;

  if (
    status.status === "optimized" ||
    status.status === "completed" ||
    status.status === "completed_with_suggestions"
  ) {
    const count = status.optimizedCount ?? status.successCount ?? 0;
    return buildGrowthSuccessText(count);
  }

  if (status.status === "cooldown") {
    const nextRunAt = formatAutoRunDate(status.nextRunAt);
    return nextRunAt
      ? `Weekly cooldown active. Next optimization available on ${nextRunAt}.`
      : status.message ||
          "Weekly cooldown active. FeedPilot is still monitoring your catalog.";
  }

  if (status.status === "no_products") {
    return "No eligible products were found for the weekly monitoring check.";
  }

  if (status.status === "no_opportunities") {
    return "No priority growth opportunities were found right now; the catalog health report is available below.";
  }

  if (status.status === "no_critical_issues") {
    return (
      status.report?.summary ||
      "Weekly monitoring checked your catalog and found no critical issues."
    );
  }

  if (status.status === "no_changes") {
    return "Weekly monitoring ran and produced a report with no safe automatic fixes needed.";
  }

  if (status.status === "disabled") {
    return status.message || "Auto optimization is disabled in settings.";
  }

  if (status.status === "locked") {
    return (
      status.message ||
      "Weekly monitoring is available on the Growth plan. Upgrade to enable safe auto-fix and automation reports."
    );
  }

  return status.message || "Weekly monitoring failed. Please try again.";
}

function getGrowthAutoRunTone(status: GrowthAutoRunStatus["status"]) {
  if (
    status === "optimized" ||
    status === "completed" ||
    status === "completed_with_suggestions" ||
    status === "no_critical_issues"
  ) {
    return {
      background: "#ecfdf5",
      border: "#a7f3d0",
      color: "#065f46",
    };
  }

  if (status === "server_error") {
    return {
      background: "#fef2f2",
      border: "#fecaca",
      color: "#991b1b",
    };
  }

  return {
    background: "#f9fafb",
    border: "#e5e7eb",
    color: "#374151",
  };
}
function MiniReportMetric(props: { label: string; value: number | string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.62)",
        border: "1px solid rgba(16, 185, 129, 0.18)",
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#047857" }}>
        {props.label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{props.value}</div>
    </div>
  );
}

export default function Index() {
  const {
    snapshot,
    weeklyInsight,
    optimizationHistory,
    allTimeRevenueStats,
    improvementTrend,
    growthRule,
    freeRemaining,
    freeLimitReached,
    plan,
    devPlanOverride,
    isDevPlanSwitcherEnabled,
  } = useLoaderData<typeof loader>();

  const theme =
    STATUS_THEME[plan as "free" | "starter" | "growth"] || STATUS_THEME.free;

  const products = snapshot.products;
  const navigate = useNavigate();

  const goToUpgrade = (reason: string) => {
    navigate(`/app/upgrade?reason=${reason}&source=index`);
  };

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [lastSuccessNotice, setLastSuccessNotice] = useState<string | null>(
    null,
  );
  const [optimizingId, setOptimizingId] = useState("");
  const [starterOptimizing, setStarterOptimizing] = useState(false);
  const [starterOptimized, setStarterOptimized] = useState(false);
  const [emptyRunMessage, setEmptyRunMessage] = useState("");
  const [, setManualScanResult] = useState<ManualScanResult | null>(null);
  const [growthAutoRunStatus, setGrowthAutoRunStatus] =
    useState<GrowthAutoRunStatus | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<null | {
    title: string;
    message: string;
    primaryLabel: string;
    reason: string;
  }>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const openUpgradeModal = (
    title: string,
    message: string,
    primaryLabel: string,
    reason: string,
  ) => {
    setUpgradeModal({
      title,
      message,
      primaryLabel,
      reason,
    });
  };

  const closeUpgradeModal = () => {
    setUpgradeModal(null);
  };

  const buildMainOptimizePostUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("index", "");
    return `${url.pathname}${url.search}`;
  };

  const getGrowthReport = (data: any) => data?.growthReport ?? null;

  const isReportOnlyResponse = (data: any) =>
    data?.resultType === "SUGGESTION_ONLY" ||
    data?.resultType === "NO_CRITICAL_ISSUE_WITH_REPORT";

  const isAppliedAndRecordedResponse = (data: any) =>
    data?.resultType === "APPLIED" &&
    data?.applied === true &&
    data?.recorded === true;

  const showManualGrowthReport = (
    data: any,
    product: ProductScanResult | null = null,
  ) => {
    const existingGrowthReport = getGrowthReport(data);
    const isAppliedAndRecorded = isAppliedAndRecordedResponse(data);
    const resultType: ScanResultType =
      data?.resultType === "APPLIED" ||
      data?.resultType === "SUGGESTION_ONLY" ||
      data?.resultType === "NO_CRITICAL_ISSUE_WITH_REPORT"
        ? data.resultType
        : isAppliedAndRecorded
          ? "APPLIED"
          : "SUGGESTION_ONLY";
    const fallbackGrowthReport: ManualGrowthReport = {
      resultType,
      usageConsumed: resultType === "APPLIED" && isAppliedAndRecorded,
      summary:
        resultType === "NO_CRITICAL_ISSUE_WITH_REPORT"
          ? "No critical safe-fix issue found in this scan."
          : resultType === "APPLIED"
            ? "FeedPilot applied a supported safe fix for the selected product."
            : "FeedPilot found a product growth gap for the selected product.",
      recommendedAction:
        resultType === "NO_CRITICAL_ISSUE_WITH_REPORT"
          ? "FeedPilot can continue monitoring for product data, SEO, and visibility readiness gaps."
          : resultType === "APPLIED"
            ? "Review the refreshed product history and quota details after this safe fix."
            : "Review the issue signal and upgrade when ready to apply supported safe fixes.",
    };
    const growthReport = existingGrowthReport ?? fallbackGrowthReport;

    setManualScanResult({
      resultType: (data?.resultType ||
        growthReport.resultType) as ScanResultType,
      usageConsumed:
        resultType === "APPLIED" &&
        isAppliedAndRecorded &&
        Boolean(data?.usageConsumed || growthReport.usageConsumed),
      safeFixApplied: resultType === "APPLIED" && isAppliedAndRecorded,
      growthReport,
      product,
    });
    setEmptyRunMessage("");

    return growthReport;
  };

  const handleDevPlanSwitch = async (
    selectedPlanOrEmpty: "" | "free" | "starter" | "growth",
  ) => {
    try {
      const response = await fetch("/app/dev-plan", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ plan: selectedPlanOrEmpty }).toString(),
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Plan switch failed.");
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      setToast({ message: "Dev plan switch failed", type: "error" });
      setTimeout(() => setToast(null), 2500);
    }
  };

  const runGrowthAutoRun = async (source: "auto" | "manual") => {
    setGrowthAutoRunStatus({
      status: "checking",
      message:
        source === "manual"
          ? "Running weekly monitoring check..."
          : "Checking weekly monitoring status...",
    });

    try {
      const res = await fetch("/app/auto-run", {
        method: "GET",
        credentials: "same-origin",
      });
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Auto optimization returned an invalid response.");
      }

      const result = data?.result;
      const status: GrowthAutoRunStatus = {
        status: (result?.status ||
          result?.reason ||
          "server_error") as GrowthAutoRunStatus["status"],
        message: result?.message,
        optimizedCount: result?.optimizedCount,
        successCount: result?.successCount,
        nextRunAt: result?.nextRunAt,
        remainingHours: result?.remainingHours,
        runFrequencyDays: result?.runFrequencyDays,
        report: result?.report,
      };

      setGrowthAutoRunStatus(status);

      const message = buildGrowthAutoRunMessage(status);
      setToast({
        message,
        type:
          status.status === "optimized" ||
          status.status === "completed" ||
          status.status === "completed_with_suggestions" ||
          status.status === "no_critical_issues"
            ? "success"
            : status.status === "server_error"
              ? "error"
              : "info",
      });

      if (
        status.status === "optimized" ||
        status.status === "completed" ||
        status.status === "completed_with_suggestions"
      ) {
        setLastSuccessNotice(`${message}. View the result in history below.`);
        window.sessionStorage.setItem(
          "feedpilotLastSuccess",
          `${message}. View the result in history below.`,
        );
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setTimeout(() => setToast(null), SCAN_TOAST_DURATION_MS);
      }
    } catch (error: any) {
      console.error("AUTO RUN FETCH ERROR:", error);
      const status: GrowthAutoRunStatus = {
        status: "server_error",
        message: error?.message || "Priority optimization failed.",
      };
      setGrowthAutoRunStatus(status);
      setToast({
        message: buildGrowthAutoRunMessage(status),
        type: "error",
      });
      setTimeout(() => setToast(null), SCAN_TOAST_DURATION_MS);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedSuccess = window.sessionStorage.getItem("feedpilotLastSuccess");
    if (storedSuccess) {
      setLastSuccessNotice(storedSuccess);
      window.sessionStorage.removeItem("feedpilotLastSuccess");
    }

    const url = new URL(window.location.href);

    if (url.searchParams.get("billing") === "success") {
      setToast({ message: "Plan activated", type: "success" });

      url.searchParams.delete("billing");
      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );

      setTimeout(() => {
        setToast(null);
      }, 2500);
    }
  }, []);

  useEffect(() => {
    if (plan !== "growth") return;
    if (devPlanOverride) return;
    runGrowthAutoRun("auto");
  }, [devPlanOverride, plan]);

  const topOpportunities = useMemo(() => {
    const critical = snapshot.topPriorityOpportunities.filter(
      (p) => p.severity === "critical",
    );

    const highImpact = snapshot.topPriorityOpportunities.filter(
      (p) =>
        p.severity === "opportunity" && p.primaryIssue !== "softOpportunity",
    );

    return [...critical.slice(0, 1), ...highImpact.slice(0, 2)];
  }, [snapshot]);

  const growthOpportunityQueue = useMemo(() => {
    return snapshot.growthOpportunityQueue ?? [];
  }, [snapshot]);

  const opportunityCount = useMemo(() => {
    return snapshot.opportunityCount;
  }, [snapshot]);

  const criticalCount = useMemo(() => {
    return snapshot.criticalCount;
  }, [snapshot]);

  const healthyCount = useMemo(() => {
    return snapshot.healthyCount;
  }, [snapshot]);

  const freeTopOpportunity = useMemo(() => {
    return (
      topOpportunities[0] ??
      snapshot.topPriorityOpportunities[0] ??
      snapshot.products.find(
        (product: ProductScanResult) => product.optimizationReasons.length > 0,
      ) ??
      null
    );
  }, [snapshot.products, snapshot.topPriorityOpportunities, topOpportunities]);

  const visibleQueueItems =
    plan === "free"
      ? growthOpportunityQueue.slice(0, 3)
      : growthOpportunityQueue;

  const appliedThisWeek = weeklyInsight?.appliedCount ?? 0;
  const automationCount = weeklyInsight?.automatedCount ?? 0;

  const handleOptimizeAll = async () => {
    if (plan === "free") {
      openUpgradeModal(
        freeLimitReached
          ? "Free limit reached"
          : "Upgrade to optimize your catalog",
        freeLimitReached
          ? "You still have product growth issues waiting. Upgrade to Starter to see all issues and apply more fixes, or choose Growth for weekly monitoring and safe auto-fix."
          : "Free helps you discover product growth gaps. Upgrade to Starter for full issue visibility and more manual fixes, or choose Growth for weekly monitoring and safe auto-fix.",
        freeLimitReached ? "Upgrade to Starter" : "See paid plans",
        "batch_limit",
      );
      return;
    }

    if (plan === "starter") {
      openUpgradeModal(
        "Starter is manual only",
        "Upgrade to Growth so FeedPilot can monitor your catalog weekly and safely fix approved issue types for you.",
        "Upgrade to Growth",
        "starter_batch_to_growth",
      );
      return;
    }

    await runGrowthAutoRun("manual");
  };

  const getQueueActionLabel = (actionType: string) => {
    if (actionType === "apply_safe_fix") return "Apply Safe Fix";
    if (actionType === "review_suggestion") return "Review Suggestion";
    if (actionType === "monitor") return "Monitor";
    return "Upgrade to Act";
  };

  const getQueuePriorityStyle = (priority: string) => {
    if (priority === "high") {
      return { background: "#fff1f0", border: "#ffa39e", color: "#a8071a" };
    }
    if (priority === "medium") {
      return { background: "#fff7e6", border: "#ffd591", color: "#ad6800" };
    }
    return { background: "#f6ffed", border: "#b7eb8f", color: "#237804" };
  };

  const renderCompactOpportunityCard = (
    product: any,
    index: number,
    onOptimize: (product: any) => void | Promise<void>,
  ) => {
    const isCritical = product?.severity === "critical";

    return (
      <div
        key={product.id}
        style={{
          padding: "16px 0",
          borderBottom: "1px solid #eee",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            {isCritical && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#fff1f0",
                  border: "1px solid #ffa39e",
                  color: "#cf1322",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Critical
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {index + 1}. {product.title}
            </div>

            <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              SEO Score: <b style={{ color: "#111" }}>{product.seoScore}</b>
            </div>

            <div style={{ marginTop: 6, color: "#a00", marginBottom: 8 }}>
              <b>Issue signal:</b> {getIssueSignal(product)}
            </div>

            <div style={{ marginTop: 8, color: "#0a7" }}>
              <b>Why it matters:</b> {getWhyItMatters(product)}
            </div>
          </div>

          <button
            type="button"
            disabled={optimizingId === product.id}
            style={{
              marginTop: 4,
              padding: "8px 14px",
              borderRadius: 8,
              border: isCritical ? "1px solid #ffa39e" : "1px solid #ccc",
              background:
                optimizingId === product.id
                  ? "#f3f3f3"
                  : isCritical
                    ? "#fff1f0"
                    : "#fff",
              cursor: optimizingId === product.id ? "not-allowed" : "pointer",
              opacity: optimizingId === product.id ? 0.7 : 1,
              fontWeight: 700,
              color: isCritical ? "#a8071a" : "#111",
            }}
            onClick={() => onOptimize(product)}
          >
            {optimizingId === product.id
              ? "Reviewing..."
              : "Review Opportunity"}
          </button>
        </div>
      </div>
    );
  };

  const growthAutoRunTone = growthAutoRunStatus
    ? getGrowthAutoRunTone(growthAutoRunStatus.status)
    : null;

  return (
    <div style={{ padding: 24, background: "#f6f7f8", minHeight: "100vh" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            padding: "12px 16px",
            borderRadius: 10,
            background:
              toast.type === "success"
                ? "#ecfdf5"
                : toast.type === "error"
                  ? "#fef2f2"
                  : "#f3f4f6",
            color:
              toast.type === "success"
                ? "#065f46"
                : toast.type === "error"
                  ? "#991b1b"
                  : "#111827",
            border:
              toast.type === "success"
                ? "1px solid #6ee7b7"
                : toast.type === "error"
                  ? "1px solid #fecaca"
                  : "1px solid #e5e7eb",
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          FeedPilot SEO & Product Growth Control Center
        </div>

        <h1
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: 30,
            lineHeight: 1.15,
            fontWeight: 800,
          }}
        >
          Find product growth gaps before they limit product visibility.
        </h1>

        <p
          style={{
            color: "#6b7280",
            margin: 0,
            fontSize: 15,
            maxWidth: 760,
            lineHeight: 1.7,
          }}
        >
          {buildHeroSubtitleByPlan(plan)}
        </p>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: 22,
          borderRadius: 16,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div>
            {plan !== "growth" && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  marginBottom: 12,
                  background: theme.statusBg,
                  border: `1px solid ${theme.statusBorder}`,
                  color: theme.statusText,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <span>{buildHeroStatusLabel(plan)}</span>
              </div>
            )}

            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              {plan === "growth"
                ? "Weekly monitoring is active"
                : plan === "starter"
                  ? "Review and apply manual safe fixes"
                  : "Scan product growth gaps"}
            </div>

            <div style={{ fontSize: 14, color: "#666", marginBottom: 14 }}>
              {plan === "growth"
                ? "Weekly monitoring is active for SEO, visibility, and product data gaps."
                : plan === "starter"
                  ? "Review product growth opportunities and safely apply supported fixes manually."
                  : "Scan SEO, visibility, product data, and catalog readiness gaps before deciding what to fix or monitor."}
            </div>
            {plan !== "growth" && (
              <div
                style={{
                  color: "#b91c1c",
                  fontWeight: 600,
                  marginTop: 8,
                }}
              >
                {plan === "starter"
                  ? "Automation is still off."
                  : "Free helps you discover hidden product growth gaps before upgrading."}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {plan === "free" && (
                <>
                  <button
                    type="button"
                    disabled={starterOptimizing}
                    onClick={async () => {
                      setStarterOptimizing(true);
                      setStarterOptimized(false);

                      const queue = snapshot.products.filter(
                        (p: ProductScanResult) =>
                          p.optimizationReasons.length > 0,
                      );

                      if (queue.length === 0) {
                        setEmptyRunMessage(
                          `No critical safe-fix issue found in this scan.
FeedPilot can continue monitoring for product data, SEO, and visibility readiness gaps.`,
                        );
                        setManualScanResult({
                          resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
                          usageConsumed: false,
                          safeFixApplied: false,
                          growthReport: {
                            summary:
                              "No critical safe-fix issue found in this scan.",
                            recommendedAction:
                              "FeedPilot can continue monitoring for product data, SEO, and visibility readiness gaps.",
                          },
                          product: null,
                        });
                        setStarterOptimizing(false);
                        return;
                      }

                      const product = queue[0];
                      setOptimizingId(product.id);

                      const formData = new FormData();
                      formData.append("title", product.title);
                      formData.append("productId", product.id);
                      formData.append(
                        "description",
                        product.descriptionHtml || "",
                      );

                      const controller = new AbortController();
                      const timeoutId = window.setTimeout(
                        () => controller.abort(),
                        30000,
                      );

                      try {
                        const res = await fetch(buildMainOptimizePostUrl(), {
                          method: "POST",
                          body: formData,
                          signal: controller.signal,
                        });

                        const data = await res.json().catch(() => null);

                        if (res.ok) {
                          if (isReportOnlyResponse(data)) {
                            const growthReport = showManualGrowthReport(
                              data,
                              product,
                            );
                            setToast({
                              message: growthReport?.upgradeRequired
                                ? "Upgrade required to apply this recommendation. Scans and suggestions do not consume applied-fix quota."
                                : "FeedPilot returned a report. Scans and suggestions do not consume applied-fix quota.",
                              type: "info",
                            });
                            setTimeout(
                              () => setToast(null),
                              SCAN_TOAST_DURATION_MS,
                            );
                            return;
                          }

                          if (!isAppliedAndRecordedResponse(data)) {
                            showManualGrowthReport(data, product);
                            setToast({
                              message:
                                "FeedPilot returned a report. Scans and suggestions do not consume applied-fix quota.",
                              type: "info",
                            });
                            setTimeout(
                              () => setToast(null),
                              SCAN_TOAST_DURATION_MS,
                            );
                            return;
                          }

                          showManualGrowthReport(data, product);
                          setManualScanResult(
                            (current) =>
                              current ?? {
                                resultType: "APPLIED",
                                usageConsumed: true,
                                safeFixApplied: true,
                                growthReport: data?.growthReport ?? {
                                  summary:
                                    "A supported safe fix was applied to this product.",
                                  recommendedAction:
                                    "Review the applied fix in history and continue scanning for product growth gaps.",
                                },
                                product,
                              },
                          );
                          setToast({
                            message:
                              "Free safe fix applied successfully. Free applied safe fix quota consumed: Yes.",
                            type: "success",
                          });
                          setStarterOptimized(true);
                          setLastSuccessNotice(
                            "Safe fix applied. Refreshing quota and history now.",
                          );
                          window.sessionStorage.setItem(
                            "feedpilotLastSuccess",
                            "Safe fix applied. Free applied safe fix quota and history were refreshed.",
                          );
                          setTimeout(() => window.location.reload(), 1200);
                        } else {
                          setToast({
                            message:
                              data?.error ||
                              "Optimization failed. Please try again.",
                            type: "error",
                          });
                          setTimeout(() => setToast(null), 2000);
                        }
                      } catch (error) {
                        console.error(error);
                        setToast({
                          message:
                            (error as Error)?.name === "AbortError"
                              ? "Optimization timed out. Please try again."
                              : "Optimization failed. Please try again.",
                          type: "error",
                        });
                        setTimeout(() => setToast(null), 2000);
                      } finally {
                        window.clearTimeout(timeoutId);
                        setOptimizingId("");
                        setStarterOptimizing(false);
                      }
                    }}
                    style={{
                      padding: "14px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      cursor: starterOptimizing ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      fontSize: 15,
                      opacity: starterOptimizing ? 0.7 : 1,
                    }}
                  >
                    {starterOptimizing
                      ? "Scanning..."
                      : freeLimitReached
                        ? "Upgrade to Starter"
                        : "Scan Products"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setToast({
                        message: `Free plan includes ${FREE_OPTIMIZATION_LIMIT} applied safe fixes every ${FREE_OPTIMIZATION_WINDOW_DAYS} days. Scans, suggestions, and healthy reports do not consume quota. You have ${freeRemaining}/${FREE_OPTIMIZATION_LIMIT} applied safe fixes left in this window.`,
                        type: "info",
                      });
                      setTimeout(() => setToast(null), 2600);
                    }}
                    style={{
                      padding: "14px 20px",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      background: "#fff",
                      color: "#111",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    Free applied safe fixes left: {freeRemaining}/
                    {FREE_OPTIMIZATION_LIMIT}
                  </button>
                </>
              )}

              {plan === "starter" && (
                <>
                  <button
                    type="button"
                    disabled={starterOptimizing}
                    onClick={async () => {
                      setStarterOptimizing(true);
                      setStarterOptimized(false);

                      const queue = snapshot.products.filter(
                        (p: ProductScanResult) =>
                          p.optimizationReasons.length > 0,
                      );

                      if (queue.length === 0) {
                        setEmptyRunMessage(
                          `No critical safe-fix issue found in this scan.
FeedPilot can continue monitoring for product data, SEO, and visibility readiness gaps.`,
                        );
                        setManualScanResult({
                          resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
                          usageConsumed: false,
                          safeFixApplied: false,
                          growthReport: {
                            summary:
                              "No critical safe-fix issue found in this scan.",
                            recommendedAction:
                              "FeedPilot can continue monitoring for product data, SEO, and visibility readiness gaps.",
                          },
                          product: null,
                        });
                        setStarterOptimizing(false);
                        return;
                      }

                      const product = queue[0];
                      setOptimizingId(product.id);

                      const formData = new FormData();
                      formData.append("title", product.title);
                      formData.append("productId", product.id);
                      formData.append(
                        "description",
                        product.descriptionHtml || "",
                      );

                      const controller = new AbortController();
                      const timeoutId = window.setTimeout(
                        () => controller.abort(),
                        30000,
                      );

                      try {
                        const res = await fetch(buildMainOptimizePostUrl(), {
                          method: "POST",
                          body: formData,
                          signal: controller.signal,
                        });
                        const data = await res.json().catch(() => null);

                        if (res.ok) {
                          if (isReportOnlyResponse(data)) {
                            const growthReport = showManualGrowthReport(
                              data,
                              product,
                            );
                            setToast({
                              message: growthReport?.upgradeRequired
                                ? "Upgrade required to apply this recommendation. No safe fix was applied."
                                : "FeedPilot returned a report. No safe fix was applied.",
                              type: "info",
                            });
                            setTimeout(
                              () => setToast(null),
                              SCAN_TOAST_DURATION_MS,
                            );
                            return;
                          }

                          if (!isAppliedAndRecordedResponse(data)) {
                            showManualGrowthReport(data, product);
                            setToast({
                              message:
                                "FeedPilot returned a report. No safe fix was applied.",
                              type: "info",
                            });
                            setTimeout(
                              () => setToast(null),
                              SCAN_TOAST_DURATION_MS,
                            );
                            return;
                          }

                          showManualGrowthReport(data, product);
                          setManualScanResult(
                            (current) =>
                              current ?? {
                                resultType: "APPLIED",
                                usageConsumed: Boolean(data?.usageConsumed),
                                safeFixApplied: true,
                                growthReport: data?.growthReport ?? {
                                  summary:
                                    "A supported safe fix was applied to this product.",
                                  recommendedAction:
                                    "Review the applied fix in history and continue scanning for product growth gaps.",
                                },
                                product,
                              },
                          );
                          const successCount = 1;
                          const message = buildStarterSuccessText(successCount);
                          setToast({ message, type: "success" });
                          setStarterOptimized(true);
                          setLastSuccessNotice(
                            `${message}. View the result in history below.`,
                          );
                          window.sessionStorage.setItem(
                            "feedpilotLastSuccess",
                            `${message}. Quota and history were refreshed.`,
                          );
                          setTimeout(() => window.location.reload(), 1200);
                        } else {
                          setToast({
                            message:
                              data?.error ||
                              "Optimization failed. Please try again.",
                            type: "error",
                          });
                          setTimeout(() => setToast(null), 2000);
                        }
                      } catch (error) {
                        console.error(error);
                        setToast({
                          message:
                            (error as Error)?.name === "AbortError"
                              ? "Optimization timed out. Please try again."
                              : "Optimization failed. Please try again.",
                          type: "error",
                        });
                        setTimeout(() => setToast(null), 2000);
                      } finally {
                        window.clearTimeout(timeoutId);
                        setOptimizingId("");
                        setStarterOptimizing(false);
                      }
                    }}
                    style={{
                      padding: "14px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      cursor: starterOptimizing ? "not-allowed" : "pointer",
                      fontWeight: 800,
                      fontSize: 15,
                      opacity: starterOptimizing ? 0.7 : 1,
                    }}
                  >
                    {starterOptimizing ? "Scanning..." : "Scan Products"}
                  </button>

                  <button
                    type="button"
                    onClick={() => goToUpgrade("starter_to_growth")}
                    style={{
                      padding: "14px 20px",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      background: "#fff",
                      color: "#111",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    Enable Weekly Monitoring ($19/mo)
                  </button>
                </>
              )}

              {plan === "growth" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const historySection = document.getElementById(
                        "optimization-history",
                      );
                      if (historySection) {
                        historySection.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      } else {
                        setToast({
                          message: "Viewing recent optimization activity",
                          type: "info",
                        });
                        setTimeout(() => setToast(null), 1800);
                      }
                    }}
                    style={{
                      padding: "14px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "#111",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    View Growth Fix History
                  </button>

                  <button
                    type="button"
                    onClick={() => goToUpgrade("manage_plan")}
                    style={{
                      padding: "14px 20px",
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      background: "#fff",
                      color: "#111",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    Manage Plan
                  </button>
                </>
              )}
            </div>

            {plan !== "growth" && (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {plan === "starter"
                  ? "Manual product growth fixes are active. Weekly monitoring is available on Growth."
                  : freeLimitReached
                    ? `You have used your free applied safe fix allowance. Scans, suggestions, and healthy reports still do not consume quota. Upgrade for full issue visibility and manual safe fixes.`
                    : `You can apply ${FREE_OPTIMIZATION_LIMIT} safe manual fixes every ${FREE_OPTIMIZATION_WINDOW_DAYS} days. Scans, suggestions, and healthy reports do not consume quota. Upgrade for full issue visibility, manual fixes, and weekly monitoring.`}
              </div>
            )}
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: "#fff",
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
              Weekly Monitoring
            </div>

            {plan === "growth" ? (
              <>
                <div
                  style={{
                    fontSize: 18,
                    color: "#111",
                    fontWeight: 700,
                  }}
                >
                  Active
                </div>
                {automationCount > 0 && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
                    Improved {automationCount}{" "}
                    {pluralize(automationCount, "product", "products")} this week
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 13,
                    color:
                      plan === "starter"
                        ? STATUS_THEME.starter.accent
                        : "#6b7280",
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  Locked on {plan === "starter" ? "Starter" : "Free"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#4b5563",
                    lineHeight: 1.6,
                    marginBottom: 12,
                  }}
                >
                  Growth monitors your catalog every week, applies supported safe
                  fixes when confidence is high, and records review-only
                  suggestions when automation is risky.
                </div>
                <button
                  type="button"
                  onClick={() => goToUpgrade("weekly_monitoring_teaser")}
                  style={{
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  Upgrade to Growth
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {plan === "free" && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          {opportunityCount > 0 ? (
            <>
              <b>Scan result: {opportunityCount} product growth gaps found.</b>{" "}
              {freeTopOpportunity && (
                <>
                  Top issue: {getIssueSignal(freeTopOpportunity)} on{" "}
                  {freeTopOpportunity.title}.{" "}
                </>
              )}
              Scans, suggestions, and healthy reports do not consume quota.
              Applied safe fixes consume quota only when FeedPilot safely
              applies a fix. Upgrade to unlock full issue visibility, manual
              safe fixes, and weekly monitoring.
            </>
          ) : (
            <>
              <b>Scan result: No critical safe-fix issue found today.</b>{" "}
              FeedPilot can continue monitoring product data, SEO, and
              visibility readiness gaps with Growth.
            </>
          )}
        </div>
      )}

      {plan === "starter" && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 12,
            background: STATUS_THEME.starter.softBg,
            border: `1px solid ${STATUS_THEME.starter.softBorder}`,
            color: STATUS_THEME.starter.accent,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <b>Starter is active.</b> Manual product growth fixes are unlocked.
          Upgrade to Growth when you want FeedPilot to continue improving your
          catalog in the background every week.
        </div>
      )}

      {loading && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          Scanning {progress} products...
        </div>
      )}

      {done && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            border: "1px solid #cfe9d6",
            borderRadius: 12,
            background: "#f3fff6",
            color: "#0a7",
            fontWeight: 600,
          }}
        >
          {successCount > 0
            ? `Batch growth fix completed. Applied safe fixes to ${successCount} products.`
            : "Batch scan finished with a report and no safe automatic fixes needed."}
        </div>
      )}

      {emptyRunMessage && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            border: "1px solid #dbeafe",
            borderRadius: 12,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontWeight: 600,
            whiteSpace: "pre-line",
          }}
        >
          {emptyRunMessage}
        </div>
      )}

      {lastSuccessNotice && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            border: "1px solid #86efac",
            borderRadius: 12,
            background: "#ecfdf5",
            color: "#166534",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {lastSuccessNotice}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard
          label="Products Checked"
          value={products.length}
          hint="Products included in the current catalog scan"
        />

        <StatCard
          label="Visibility Issues"
          value={criticalCount}
          hint="SEO, data, or visibility gaps needing review"
        />

        <StatCard
          label="Growth Opportunities"
          value={opportunityCount}
          hint="Safe product growth opportunities found in the catalog"
        />

        <StatCard
          label="Visibility Trend"
          value={
            allTimeRevenueStats.avgImprovement > 40
              ? "+40+"
              : `${allTimeRevenueStats.avgImprovement >= 0 ? "+" : ""}${
                  allTimeRevenueStats.avgImprovement
                }`
          }
          hint="Internal visibility score trend from applied fixes"
        />
      </div>
      <div
        style={{
          marginBottom: 22,
          padding: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
          Safe Fix Policy
        </div>

        <div style={{ fontSize: 14, color: "#444", lineHeight: 1.7 }}>
          FeedPilot separates supported safe fixes from review-only suggestions,
          so product data is not changed blindly.
          {plan === "growth" && appliedThisWeek > 0
            ? ` ${appliedThisWeek} supported safe ${pluralize(
                appliedThisWeek,
                "fix was",
                "fixes were",
              )} applied this week.`
            : ""}
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: 18,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              Top Growth Opportunities
            </h2>
            <p style={{ color: "#666", marginTop: 0, marginBottom: 0 }}>
              {plan === "growth"
                ? "FeedPilot is monitoring these high-impact SEO and product growth signals."
                : plan === "starter"
                  ? "These products have the highest-priority safe suggestions waiting for review."
                  : "These products show visibility, SEO, or catalog completeness gaps."}
            </p>
          </div>

          <div style={{ fontSize: 13, color: "#666" }}>
            Highest-priority growth opportunity queue
          </div>
        </div>

        {topOpportunities.length === 0 ? (
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 10,
              background: "#fafafa",
              color: "#666",
            }}
          >
            No urgent growth opportunities found. Your report is still available
            through catalog health and history.
          </div>
        ) : (
          topOpportunities.map((product, index) =>
            renderCompactOpportunityCard(product, index, async (product) => {
              if (plan === "free") {
                openUpgradeModal(
                  "This product has a visibility readiness gap",
                  "FeedPilot found a weak listing that can be improved now. Free lets you discover the issue, but optimization requires a paid plan. Upgrade to Starter to fix it manually, or Growth to let FeedPilot keep improving products automatically.",
                  "Unlock optimization",
                  "single_optimize_free",
                );
                return;
              }

              if (plan === "starter") {
                setToast({
                  message: "Starter manual optimization in progress",
                  type: "info",
                });
                setTimeout(() => setToast(null), 2200);
              }

              setOptimizingId(product.id);

              const formData = new FormData();
              formData.append("title", product.title);
              formData.append("productId", product.id);
              formData.append("description", product.descriptionHtml || "");

              try {
                const res = await fetch("?index", {
                  method: "POST",
                  body: formData,
                });

                const data = await res.json().catch(() => null);

                if (res.ok && isReportOnlyResponse(data)) {
                  const growthReport = showManualGrowthReport(data, product);
                  setToast({
                    message: growthReport?.upgradeRequired
                      ? "Upgrade required to apply this recommendation. No safe fix was applied."
                      : "FeedPilot returned a report. No safe fix was applied.",
                    type: "info",
                  });
                  setTimeout(() => setToast(null), SCAN_TOAST_DURATION_MS);
                  return;
                }

                if (res.ok && isAppliedAndRecordedResponse(data)) {
                  const message =
                    plan === "growth"
                      ? "Priority product optimized successfully"
                      : "Starter optimization completed successfully";
                  setToast({ message, type: "success" });
                  setLastSuccessNotice(
                    `${message}. View the result in history below.`,
                  );
                  window.sessionStorage.setItem(
                    "feedpilotLastSuccess",
                    `${message}. View the result in history below.`,
                  );
                  setTimeout(() => {
                    window.location.reload();
                  }, 800);
                } else {
                  showManualGrowthReport(data);
                  setToast({
                    message: data?.error || "Optimization failed",
                    type: "error",
                  });
                  setTimeout(() => setToast(null), 2000);
                }
              } catch (error) {
                console.error(error);
                setToast({ message: "Network error", type: "error" });
                setTimeout(() => setToast(null), 2000);
              } finally {
                setOptimizingId("");
              }
            }),
          )
        )}
      </div>

      {plan !== "growth" && (
        <div
          style={{
            marginBottom: 22,
            padding: 14,
            borderRadius: 10,
            background:
              plan === "starter" ? STATUS_THEME.starter.softBg : "#f9fafb",
            border: `1px solid ${
              plan === "starter" ? STATUS_THEME.starter.softBorder : "#e5e7eb"
            }`,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            {plan === "starter"
              ? "Manual fixes stop when you stop."
              : "You can discover gaps before deciding what to fix."}
          </div>

          <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
            {plan === "starter"
              ? "Upgrade to Growth for weekly monitoring, safe auto-fix, reports, and automation history."
              : "Start with Starter for manual product growth fixes, then use Growth for weekly monitoring."}
          </div>

          <button
            onClick={() => goToUpgrade("opportunity_block")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {plan === "starter" ? "Upgrade to Growth" : "View paid plans"}
          </button>
        </div>
      )}

      <div
        style={{
          marginBottom: 22,
          padding: 18,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>
          Growth Opportunity Queue
        </h2>
        <p style={{ color: "#666", marginTop: 0 }}>
          Prioritized product issues that may affect visibility, catalog
          readiness, or buying-decision clarity.
        </p>

        {visibleQueueItems.length === 0 ? (
          <div
            style={{
              padding: 12,
              background: "#fafafa",
              borderRadius: 8,
              color: "#666",
            }}
          >
            No priority queue items found. Keep monitoring for new product
            growth gaps.
          </div>
        ) : (
          visibleQueueItems.map((item: GrowthOpportunity) => {
            const priorityStyle = getQueuePriorityStyle(item.priority);
            return (
              <div
                key={item.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span
                    style={{
                      alignSelf: "flex-start",
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${priorityStyle.border}`,
                      background: priorityStyle.background,
                      color: priorityStyle.color,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.priority}
                  </span>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {item.productTitle}
                    </div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {item.title}
                    </div>
                    <div style={{ color: "#555", marginBottom: 8 }}>
                      <b>Why it matters:</b> {item.whyItMatters}
                    </div>
                    <div style={{ color: "#0f766e", marginBottom: 8 }}>
                      <b>Recommended action:</b> {item.recommendedAction}
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {getQueueActionLabel(item.actionType)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {plan === "free" &&
          growthOpportunityQueue.length > visibleQueueItems.length && (
            <div style={{ marginTop: 12, fontSize: 13, color: "#6b7280" }}>
              Showing the top {visibleQueueItems.length} queue items. Upgrade
              for full issue visibility, manual safe fixes, and weekly
              monitoring.
            </div>
          )}
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: 18,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>
          Product SEO & Catalog Health
        </h2>
        <p style={{ color: "#666", marginTop: 0, marginBottom: 14 }}>
          Products are grouped by SEO health, visibility signals, and catalog
          completeness readiness.
        </p>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Healthy</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#237804" }}>
              {healthyCount}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Opportunities</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#d48806" }}>
              {opportunityCount}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: "#666" }}>Critical</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#cf1322" }}>
              {criticalCount}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (plan === "free") {
              openUpgradeModal(
                "Upgrade required to optimize all priority products",
                "Free helps you discover weak listings, but optimizing multiple products is a paid workflow. Upgrade to Starter for manual optimization or Growth for automatic ongoing optimization.",
                "Upgrade now",
                "batch_unlock",
              );
              return;
            }

            handleOptimizeAll();
          }}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {plan === "free"
            ? "Upgrade to apply priority fixes"
            : plan === "starter"
              ? "Apply Priority Fixes"
              : "Run Weekly Monitoring Check"}
        </button>

        {plan === "growth" && growthAutoRunStatus && growthAutoRunTone && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              background: growthAutoRunTone.background,
              border: `1px solid ${growthAutoRunTone.border}`,
              color: growthAutoRunTone.color,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4 }}>
              {growthAutoRunStatus.status === "checking"
                ? "Checking weekly monitoring"
                : growthAutoRunStatus.status === "optimized" ||
                    growthAutoRunStatus.status === "completed" ||
                    growthAutoRunStatus.status ===
                      "completed_with_suggestions" ||
                    growthAutoRunStatus.status === "no_critical_issues"
                  ? "Weekly monitoring complete"
                  : growthAutoRunStatus.status === "cooldown"
                    ? "Weekly monitoring on cooldown"
                    : growthAutoRunStatus.status === "server_error" ||
                        growthAutoRunStatus.status === "failed"
                      ? "Weekly monitoring error"
                      : growthAutoRunStatus.status === "locked"
                        ? "Growth plan required"
                        : "Weekly monitoring status"}
            </div>
            <div>{buildGrowthAutoRunMessage(growthAutoRunStatus)}</div>
            {"report" in growthAutoRunStatus && growthAutoRunStatus.report && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <MiniReportMetric
                  label="Products checked"
                  value={growthAutoRunStatus.report.productsChecked}
                />
                <MiniReportMetric
                  label="Issues found"
                  value={growthAutoRunStatus.report.issuesFound}
                />
                <MiniReportMetric
                  label="Safe fixes applied"
                  value={growthAutoRunStatus.report.fixesApplied}
                />
                <MiniReportMetric
                  label="Suggestions waiting"
                  value={growthAutoRunStatus.report.suggestionsCreated}
                />
                <MiniReportMetric
                  label="Skipped for safety"
                  value={growthAutoRunStatus.report.skippedForSafety}
                />
                <MiniReportMetric
                  label="No critical issues"
                  value={
                    growthAutoRunStatus.report.criticalIssues === 0
                      ? "Yes"
                      : "No"
                  }
                />
              </div>
            )}
            {growthAutoRunStatus.status === "cooldown" && (
              <div style={{ marginTop: 4 }}>
                Next available:{" "}
                {formatAutoRunDate(growthAutoRunStatus.nextRunAt)}
                {typeof growthAutoRunStatus.remainingHours === "number"
                  ? ` (${growthAutoRunStatus.remainingHours} hours remaining)`
                  : ""}
              </div>
            )}
          </div>
        )}
      </div>

      <div id="optimization-history">
        <OptimizationHistoryPanel
          plan={plan}
          weeklyInsight={weeklyInsight}
          optimizationHistory={optimizationHistory}
        />
      </div>

      {plan === "starter" && (
        <div
          style={{
            marginTop: 16,
            borderRadius: 18,
            padding: 18,
            background: STATUS_THEME.starter.softBg,
            border: `1px solid ${STATUS_THEME.starter.softBorder}`,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
            Keep improvements running every week
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#4b5563",
              lineHeight: 1.6,
              marginBottom: 12,
              maxWidth: 760,
            }}
          >
            Manual product growth fixes are working. Growth adds weekly
            monitoring, safe auto-fix, and an automation history.
          </div>
          <button
            onClick={() => goToUpgrade("post_insight_cta")}
            style={{
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              background: "#16a34a",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Start Weekly Monitoring ($19/mo)
          </button>
        </div>
      )}

      {plan === "growth" && (
        <div
          style={{
            marginTop: 24,
            borderRadius: 18,
            padding: 22,
            background: "#ffffff",
            border: `1px solid ${STATUS_THEME.growth.softBorder}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: STATUS_THEME.growth.accent,
              marginBottom: 6,
              letterSpacing: "0.05em",
            }}
          >
            GROWTH PLAN
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111827",
              lineHeight: 1.3,
            }}
          >
            Auto optimization is active.
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              color: "#6b7280",
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            Manage billing or adjust automation rules.
          </div>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => goToUpgrade("footer_growth_card")}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Manage Plan
            </button>

            <Link
              to="/app/settings"
              style={{
                display: "inline-block",
                padding: "12px 18px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                background: "#fff",
                textDecoration: "none",
                color: "#111827",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Automation Settings
            </Link>
          </div>
        </div>
      )}

      {isDevPlanSwitcherEnabled && (
        <div
          style={{
            marginTop: 24,
            marginLeft: "auto",
            maxWidth: 420,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 14,
            background: "#fff",
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
            Dev Plan Switcher
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#6b7280",
            }}
          >
            Development only. Does not change Shopify billing.
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {(["free", "starter", "growth"] as const).map((devPlan) => {
              const isActive = devPlanOverride === devPlan;
              return (
                <button
                  key={devPlan}
                  type="button"
                  onClick={() => handleDevPlanSwitch(devPlan)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: isActive
                      ? "1px solid #111827"
                      : "1px solid #d1d5db",
                    background: isActive ? "#111827" : "#fff",
                    color: isActive ? "#fff" : "#111827",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {devPlan}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleDevPlanSwitch("")}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear override
            </button>
          </div>
        </div>
      )}

      {upgradeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={closeUpgradeModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 18,
              padding: 24,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {upgradeModal.title}
            </div>

            <div style={{ marginTop: 10, color: "#666" }}>
              {upgradeModal.message}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => goToUpgrade(upgradeModal.reason)}
                style={{
                  padding: "10px 16px",
                  background: "#111",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {upgradeModal.primaryLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              width: 420,
            }}
          >
            <h3>You still have product growth issues waiting</h3>

            <p style={{ marginTop: 12 }}>
              You have fixed your first visibility issues, but more products
              still need improvement.
            </p>

            <p style={{ marginTop: 8 }}>
              Free includes 2 applied manual fixes every 7 days. Upgrade to
              Starter to see all issues and apply more fixes.
            </p>

            <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
              <button
                onClick={() => navigate("/app/upgrade")}
                style={{
                  background: "#111",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                }}
              >
                Upgrade to Starter
              </button>

              <button
                onClick={() => setShowUpgradeModal(false)}
                style={{
                  background: "#fff",
                  border: "1px solid #ccc",
                  padding: "10px 16px",
                  borderRadius: 8,
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (args) => {
  return boundary.headers(args);
};
