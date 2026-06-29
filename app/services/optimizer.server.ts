import { calculateSeoScore } from "../utils/dashboard.server";
import { applyOptimizedTitleAndRecord } from "./optimization-apply.server";

export type ProductGrowthResultType =
  | "APPLIED"
  | "SUGGESTION_ONLY"
  | "NO_CRITICAL_ISSUE_WITH_REPORT";

export type ProductGrowthReport = {
  resultType: ProductGrowthResultType;
  productId: string;
  usageConsumed: boolean;
  summary: string;
  issues: string[];
  suggestions: string[];
  seoScoreBefore: number;
  seoScoreAfter: number;
  canApplySafely: boolean;
};

type OptimizeProductArgs = {
  admin: any;
  shopDomain: string;
  productId: string;
  title: string;
  description: string;
  seoScoreBefore?: number | null;
  source: "manual" | "automation";
  decisionMode?: "suggest" | "auto";
  allowAppliedWrite?: boolean;
};

export async function optimizeProductWithAI({
  admin,
  shopDomain,
  productId,
  title,
  description,
  seoScoreBefore,
  source,
  decisionMode = "suggest",
  allowAppliedWrite = true,
}: OptimizeProductArgs) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!productId) {
    throw new Error("Missing productId");
  }

  const { default: OpenAI } = await import("openai");
  const undici = await import("undici");

  const proxyUrl = process.env.OPENAI_PROXY_URL;

  const client = new OpenAI({
    apiKey,
    timeout: 120000,
    maxRetries: 1,
    fetchOptions: proxyUrl
      ? {
          dispatcher: new undici.ProxyAgent(proxyUrl),
        }
      : undefined,
  });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a senior ecommerce copywriter and SEO expert. You must return ONLY valid JSON. Do not use markdown. Do not use code fences. Do not add explanations.",
      },
      {
        role: "user",
        content: `
Optimize this Shopify product for SEO and conversion.

Return ONLY valid JSON in exactly this format:
{
  "title": "string",
  "description": "string",
  "tags": "string",
  "score_before": 0,
  "score_after": 0,
  "impact_summary": "string"
}

Rules:
- title: improved product title for better SEO and conversion
- description: persuasive product description in clear retail English
- tags: comma-separated keywords
- score_before: integer from 0 to 100
- score_after: integer from 0 to 100
- impact_summary: one short sentence explaining expected improvement
- no markdown
- no explanations
- no extra text before or after JSON

Product:
Title: ${title}
Description: ${description}
        `,
      },
    ],
  });

  const result = completion.choices[0]?.message?.content?.trim() || "";

  const cleanedResult = result
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: any;

  try {
    parsed = JSON.parse(cleanedResult);
  } catch {
    throw new Error(`AI returned invalid JSON: ${result}`);
  }

  const titleAfter = parsed.title || title;
  const descriptionAfter = parsed.description || description;
  const resolvedSeoScoreBefore =
    typeof seoScoreBefore === "number" && Number.isFinite(seoScoreBefore)
      ? seoScoreBefore
      : calculateSeoScore(title, description);
  const seoScoreAfter = calculateSeoScore(titleAfter, descriptionAfter);
  console.log("SEO SCORE CHECK:", {
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
  });

  const hasImprovement = seoScoreAfter > resolvedSeoScoreBefore;
  const report: ProductGrowthReport = {
    resultType: hasImprovement
      ? "SUGGESTION_ONLY"
      : "NO_CRITICAL_ISSUE_WITH_REPORT",
    productId,
    usageConsumed: false,
    summary: hasImprovement
      ? parsed.impact_summary ||
        "FeedPilot found a product growth opportunity for merchant review."
      : "No critical product growth issue was found, but FeedPilot generated a readiness report.",
    issues: hasImprovement
      ? ["Listing content may have SEO visibility or completeness opportunities."]
      : [],
    suggestions: hasImprovement
      ? ["Review the suggested title and description before applying changes."]
      : ["Keep monitoring this product for future feed readiness signals."],
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
    canApplySafely: hasImprovement,
  };

  if (!hasImprovement) {
    console.log("⛔ SKIP: no critical issue");

    return {
      ok: true,
      applied: false,
      recorded: false,
      skipped: true,
      reason: "no_critical_issue_with_report",
      status: "no_critical_issue_with_report",
      resultType: report.resultType,
      report,
      usageConsumed: false,
      productId,
      seoScoreBefore: resolvedSeoScoreBefore,
      seoScoreAfter,
    };
  }

  if (!allowAppliedWrite) {
    return {
      ok: false,
      applied: false,
      recorded: false,
      blocked: true,
      error: "Free limit reached. Upgrade to Starter.",
      code: "FREE_LIMIT_REACHED",
      upgradeUrl: "/app/upgrade?reason=free_limit",
      resultType: "SUGGESTION_ONLY",
      report,
      usageConsumed: false,
      productId,
      seoScoreBefore: resolvedSeoScoreBefore,
      seoScoreAfter,
    };
  }

  const appliedResult = await applyOptimizedTitleAndRecord({
    admin,
    shopDomain,
    productId,
    titleBefore: title,
    titleAfter,
    descriptionBefore: description,
    descriptionAfter,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
    whyText: parsed.impact_summary || "",
    outcomeText: parsed.impact_summary || "",
    actionText:
      source === "automation"
        ? "Automatically optimized by FeedPilot Growth automation"
        : "Optimized by FeedPilot AI",
    rawIssuesJson: JSON.stringify([]),
    rawDecisionJson: JSON.stringify(parsed),
    source,
    decisionMode,
  });

  const writeApplied = Boolean(appliedResult?.ok && appliedResult?.history?.id);

  if (!writeApplied) {
    return {
      ok: false,
      applied: false,
      recorded: false,
      userErrors: appliedResult?.userErrors ?? [],
      resultType: report.resultType,
      report,
      usageConsumed: false,
      productId,
      seoScoreBefore: resolvedSeoScoreBefore,
      seoScoreAfter,
    };
  }

  report.resultType = "APPLIED";
  report.usageConsumed = true;
  report.summary =
    parsed.impact_summary ||
    "FeedPilot safely applied product visibility improvements.";

  return {
    ok: true,
    applied: true,
    recorded: true,
    history: appliedResult?.history ?? null,
    product: appliedResult?.product ?? null,
    resultType: report.resultType,
    report,
    usageConsumed: report.usageConsumed,
    productId,
    originalTitle: title,
    appliedTitle: titleAfter,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
  };
}
