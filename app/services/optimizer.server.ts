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
  decisionMode?: string;
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

  return {
    skipped: true,
    productId,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
  };
}
  await applyOptimizedTitleAndRecord({
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

  return {
    productId,
    originalTitle: title,
    appliedTitle: titleAfter,
    seoScoreBefore: resolvedSeoScoreBefore,
    seoScoreAfter,
  };
}
