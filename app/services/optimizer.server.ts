import { calculateSeoScore } from "../utils/dashboard.server";
import { applyOptimizedTitleAndRecord } from "./optimization-apply.server";

export type OptimizeResultType =
  | "APPLIED"
  | "SUGGESTION_ONLY"
  | "NO_CRITICAL_ISSUE_WITH_REPORT";

export type GrowthIssue = {
  code: string;
  severity: "critical" | "warning" | "opportunity" | "healthy";
  title: string;
  explanation: string;
  recommendedAction?: string;
};

export type ProductGrowthReport = {
  resultType: OptimizeResultType;
  productId: string;
  productTitle: string;
  summary: string;
  checkedAreas: string[];
  issues: GrowthIssue[];
  appliedActions?: string[];
  suggestedActions?: string[];
  usageConsumed: boolean;
};

const CHECKED_AREAS = [
  "Title quality",
  "Description quality",
  "SEO/meta opportunity",
  "Image alt text opportunity",
  "Product type completeness",
  "Vendor completeness",
  "Tags completeness",
  "Product feed / Google Shopping readiness",
];

function stripHtml(value: string) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGrowthIssues(title: string, description: string): GrowthIssue[] {
  const cleanTitle = (title || "").trim();
  const cleanDescription = stripHtml(description);
  const issues: GrowthIssue[] = [];

  if (cleanTitle.length < 40) {
    issues.push({
      code: "TITLE_TOO_SHORT",
      severity: cleanTitle.length < 20 ? "warning" : "opportunity",
      title: "Title can carry stronger search intent",
      explanation:
        "FeedPilot checked the product title and found room to add more buyer-focused context for search and browsing.",
      recommendedAction:
        "Review the title for primary keywords, product type, and a clear shopper benefit before publishing.",
    });
  }

  if (cleanDescription.length < 120) {
    issues.push({
      code: "DESCRIPTION_WEAK",
      severity: cleanDescription.length < 50 ? "warning" : "opportunity",
      title: "Description could better support conversion",
      explanation:
        "The description is short or light on detail, which can reduce SEO context and shopper confidence.",
      recommendedAction:
        "Add benefit-led copy, use cases, product details, and concise selling points.",
    });
  }

  issues.push(
    {
      code: "META_FIELDS_REVIEW",
      severity: "opportunity",
      title: "SEO metadata should be reviewed",
      explanation:
        "Manual optimization currently writes only the supported title and description fields, so meta fields are reported as a safe review opportunity.",
      recommendedAction:
        "Check SEO title and meta description in Shopify before deciding whether to publish metadata changes.",
    },
    {
      code: "FEED_READINESS_REVIEW",
      severity: "opportunity",
      title: "Feed readiness signals need merchant review",
      explanation:
        "Image alt text, product type, vendor, and tags affect catalog completeness and Google Shopping readiness, but automatic writes are safer after merchant review.",
      recommendedAction:
        "Confirm images, product type, vendor, and tags are complete and accurate for this product.",
    },
  );

  return issues;
}

function buildGrowthReport(input: {
  resultType: OptimizeResultType;
  productId: string;
  productTitle: string;
  title: string;
  description: string;
  appliedActions?: string[];
  usageConsumed: boolean;
}): ProductGrowthReport {
  const issues = buildGrowthIssues(input.title, input.description);
  const suggestedActions = issues
    .map((issue) => issue.recommendedAction)
    .filter((action): action is string => Boolean(action));

  const summary =
    input.resultType === "APPLIED"
      ? `FeedPilot applied ${input.appliedActions?.length || 1} safe SEO improvement and recorded it in optimization history.`
      : issues.some((issue) => issue.severity === "warning")
        ? `FeedPilot checked this product and found ${issues.length} growth opportunities. No automatic change was applied because these fields should be reviewed before publishing.`
        : "This product looks reasonably healthy. FeedPilot checked core visibility signals and found no critical issue requiring an automatic write.";

  return {
    resultType: input.resultType,
    productId: input.productId,
    productTitle: input.productTitle,
    summary,
    checkedAreas: CHECKED_AREAS,
    issues,
    appliedActions: input.appliedActions,
    suggestedActions,
    usageConsumed: input.usageConsumed,
  };
}

type OptimizeProductArgs = {
  admin: any;
  shopDomain: string;
  productId: string;
  title: string;
  description: string;
  seoScoreBefore?: number | null;
  source: "manual" | "automation";
  decisionMode?: "suggest" | "auto";
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

  if (seoScoreAfter <= resolvedSeoScoreBefore) {
    console.log("⛔ SKIP: no improvement");

    const growthReport = buildGrowthReport({
      resultType:
        seoScoreAfter >= 75
          ? "NO_CRITICAL_ISSUE_WITH_REPORT"
          : "SUGGESTION_ONLY",
      productId,
      productTitle: title,
      title,
      description,
      usageConsumed: false,
    });

    return {
      ok: true,
      applied: false,
      recorded: false,
      skipped: true,
      reason: "no_improvement",
      status: "no_improvement",
      productId,
      seoScoreBefore: resolvedSeoScoreBefore,
      seoScoreAfter,
      resultType: growthReport.resultType,
      growthReport,
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
    productId,
    productTitle: title,
    title: titleAfter,
    description: descriptionAfter,
    appliedActions: ["Updated title and description with FeedPilot AI"],
    usageConsumed: true,
  });

  return {
    ok: true,
    applied: true,
    recorded: Boolean(appliedResult?.history?.id),
    history: appliedResult?.history ?? null,
    product: appliedResult?.product ?? null,
    productId,
    originalTitle: title,
    appliedTitle: titleAfter,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
    resultType: growthReport.resultType,
    growthReport,
  };
}
