import { calculateSeoScore } from "../utils/dashboard.server";
import { applyOptimizedTitleAndRecord } from "./optimization-apply.server";

type OptimizeProductArgs = {
  admin: any;
  shopDomain: string;
  productId: string;
  title: string;
  description: string;
  seoScoreBefore?: number | null;
  source: "manual" | "automation";
  decisionMode?: "suggest" | "auto";
  canApply?: boolean;
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
  canApply = true,
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

  const buildGrowthReport = ({
    resultType,
    summary,
    recommendedAction,
    upgradeRequired = false,
  }: {
    resultType: "APPLIED" | "SUGGESTION_ONLY" | "NO_CRITICAL_ISSUE_WITH_REPORT";
    summary: string;
    recommendedAction: string;
    upgradeRequired?: boolean;
  }) => ({
    resultType,
    productId,
    summary,
    impactSummary: parsed.impact_summary || summary,
    recommendedAction,
    upgradeRequired,
    usageConsumed: resultType === "APPLIED",
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
    suggestedTitle: titleAfter,
    suggestedDescription: descriptionAfter,
  });

  if (seoScoreAfter <= resolvedSeoScoreBefore) {
    console.log("⛔ SKIP: no improvement");

    const growthReport = buildGrowthReport({
      resultType: "NO_CRITICAL_ISSUE_WITH_REPORT",
      summary:
        "FeedPilot reviewed this product and did not find a safe critical improvement to apply automatically.",
      recommendedAction:
        "Keep monitoring this product. Review the suggested copy only if it matches your merchandising strategy.",
    });

    return {
      ok: true,
      resultType: growthReport.resultType,
      growthReport,
      usageConsumed: false,
      applied: false,
      recorded: false,
      skipped: true,
      reason: "no_improvement",
      status: "no_improvement",
      productId,
      seoScoreBefore: resolvedSeoScoreBefore,
      seoScoreAfter,
    };
  }

  if (!canApply) {
    const growthReport = buildGrowthReport({
      resultType: "SUGGESTION_ONLY",
      summary:
        "FeedPilot found a product growth opportunity, but applying the safe fix requires an upgraded plan.",
      recommendedAction:
        "Upgrade to Starter to apply this optimization manually, or use Growth for ongoing safe automation.",
      upgradeRequired: true,
    });

    return {
      ok: true,
      resultType: growthReport.resultType,
      growthReport,
      usageConsumed: false,
      applied: false,
      recorded: false,
      skipped: true,
      reason: "upgrade_required",
      status: "upgrade_required",
      code: "FREE_LIMIT_REACHED",
      upgradeUrl: "/app/upgrade?reason=free_limit",
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

  const growthReport = buildGrowthReport({
    resultType: "APPLIED",
    summary: "FeedPilot applied a safe product SEO improvement.",
    recommendedAction:
      "Review the updated product in Shopify and monitor the internal visibility score over time.",
  });

  return {
    ok: true,
    resultType: growthReport.resultType,
    growthReport,
    usageConsumed: true,
    applied: true,
    recorded: Boolean(appliedResult?.history?.id),
    history: appliedResult?.history ?? null,
    product: appliedResult?.product ?? null,
    productId,
    originalTitle: title,
    appliedTitle: titleAfter,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
  };
}
