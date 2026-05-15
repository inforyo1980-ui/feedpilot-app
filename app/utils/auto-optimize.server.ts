import prisma from "../db.server";
import { getGrowthAutomationRule } from "./growth-automation.server";
import {
  buildOptimizationQueue,
  buildFocusInstruction,
} from "./growth-automation.shared";

type AdminLike = any;

type AutoProduct = {
  id: string;
  title: string;
  descriptionHtml: string;
  seoScore: number;
  status?: string;
  updatedAt?: string | Date | null;
};

function calculateSeoScore(title: string, description: string) {
  let score = 20;

  const cleanTitle = (title || "").trim();
  const cleanDescription = (description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const titleWords = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const uniqueTitleWords = new Set(titleWords);
  const keywordCount = titleWords.length;
  const uniqueKeywordCount = uniqueTitleWords.size;

  if (cleanTitle.length >= 25) score += 8;
  if (cleanTitle.length >= 40) score += 8;
  if (cleanTitle.length >= 60) score += 6;

  if (cleanDescription.length >= 80) score += 8;
  if (cleanDescription.length >= 160) score += 8;
  if (cleanDescription.length >= 300) score += 6;

  if (keywordCount >= 4) score += 6;
  if (keywordCount >= 7) score += 4;
  if (uniqueKeywordCount >= 4) score += 6;
  if (uniqueKeywordCount >= 7) score += 4;

  const conversionWords = [
    "premium",
    "ultimate",
    "ideal",
    "perfect",
    "durable",
    "lightweight",
    "comfortable",
    "performance",
    "high-performance",
    "versatile",
  ];

  const conversionHits = conversionWords.filter(
    (w) => cleanTitle.toLowerCase().includes(w) || cleanDescription.includes(w),
  ).length;
  score += Math.min(conversionHits * 2, 8);

  const categoryWords = [
    "snowboard",
    "gift card",
    "all-mountain",
    "winter",
    "terrain",
    "digital",
    "delivery",
  ];

  const categoryHits = categoryWords.filter(
    (w) => cleanTitle.toLowerCase().includes(w) || cleanDescription.includes(w),
  ).length;
  score += Math.min(categoryHits * 2, 8);

  if (cleanTitle.length < 20) score -= 12;
  if (cleanDescription.length < 50) score -= 12;

  const repetitionPenalty = keywordCount - uniqueKeywordCount;
  if (repetitionPenalty >= 2) score -= repetitionPenalty * 2;

  if (cleanDescription.length > 0 && cleanDescription.length < 120) score -= 4;

  return Math.max(10, Math.min(score, 95));
}

function normalizeBaseTitle(title: string) {
  return (title || "")
    .replace(
      /\s+\|\s+(Search-Ready|Conversion-Ready|Growth-Ready|Optimized for Search|High-Performance Option)$/i,
      "",
    )
    .trim();
}

function getTitleSuffix(focusMode: string) {
  if (focusMode === "seo") return "Search-Ready";
  if (focusMode === "conversion") return "Conversion-Ready";
  return "Growth-Ready";
}

function buildOptimizedContent(
  title: string,
  descriptionHtml: string,
  focusMode: string,
) {
  const baseTitle = normalizeBaseTitle(title);
  const suffix = getTitleSuffix(focusMode);

  const optimizedTitle =
    baseTitle.length < 55 ? `${baseTitle} | ${suffix}` : baseTitle;

  const plainDescription = (descriptionHtml || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const focusInstruction = buildFocusInstruction(focusMode);

  const benefits =
    focusMode === "seo"
      ? [
          "Improved keyword targeting",
          "Stronger search discoverability",
          "Better catalog visibility",
        ]
      : focusMode === "conversion"
      ? [
          "More persuasive product positioning",
          "Stronger buyer intent messaging",
          "Improved conversion clarity",
        ]
      : [
          "Improved search visibility",
          "Stronger buyer intent",
          "Better content performance",
        ];

  let optimizedDescription = plainDescription;

  if (!optimizedDescription) {
    optimizedDescription =
      "This product is designed to deliver reliable performance and stronger buyer appeal.";
  }

  if (!/Key benefits:/i.test(optimizedDescription)) {
    optimizedDescription = `${optimizedDescription}

Key benefits:
- ${benefits[0]}
- ${benefits[1]}
- ${benefits[2]}`;
  }

  if (!new RegExp(focusInstruction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(optimizedDescription)) {
    optimizedDescription = `${optimizedDescription}

Optimization focus:
${focusInstruction}`;
  }

  return {
    optimizedTitle,
    optimizedDescription,
  };
}

export async function runRuleBasedAutoOptimize({
  admin,
  product,
  focusMode,
}: {
  admin: AdminLike;
  product: AutoProduct;
  focusMode: string;
}) {
  const currentTitle = (product.title || "").trim();
  const currentDescription = (product.descriptionHtml || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const alreadyOptimizedTitle =
    /\|\s+(Search-Ready|Conversion-Ready|Growth-Ready)$/i.test(currentTitle);

  const alreadyOptimizedDescription =
    /Key benefits:/i.test(currentDescription) &&
    /Optimization focus:/i.test(currentDescription);

  if (alreadyOptimizedTitle && alreadyOptimizedDescription) {
    return {
      skipped: true,
      reason: "Already optimized by rule-based formatter",
      productId: product.id,
    };
  }

  const { optimizedTitle, optimizedDescription } = buildOptimizedContent(
    product.title,
    product.descriptionHtml,
    focusMode,
  );

  const noMeaningfulTitleChange =
    optimizedTitle.trim() === (product.title || "").trim();

  const normalizedOriginalDescription = (product.descriptionHtml || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizedOptimizedDescription = (optimizedDescription || "")
    .replace(/\s+/g, " ")
    .trim();

  const noMeaningfulDescriptionChange =
    normalizedOriginalDescription === normalizedOptimizedDescription;

  if (noMeaningfulTitleChange && noMeaningfulDescriptionChange) {
    return {
      skipped: true,
      reason: "No meaningful auto-optimization change generated",
      productId: product.id,
    };
  }

  const response = await admin.graphql(
    `#graphql
      mutation productUpdate($input: ProductUpdateInput!) {
        productUpdate(product: $input) {
          product {
            id
            title
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: {
          id: product.id,
          title: optimizedTitle,
          descriptionHtml: optimizedDescription,
        },
      },
    },
  );

  const result = await response.json();
  const userErrors = result?.data?.productUpdate?.userErrors || [];

  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e: any) => e.message).join(", "));
  }

  const scoreBefore = product.seoScore;
  const scoreAfter = calculateSeoScore(optimizedTitle, optimizedDescription);

  await prisma.optimizationHistory.create({
    data: {
      productId: product.id,
      originalTitle: product.title,
      optimizedTitle,
      scoreBefore,
      scoreAfter,
      source: "auto",
    },
  });

  return {
    success: true,
    productId: product.id,
    originalTitle: product.title,
    appliedTitle: optimizedTitle,
    scoreBefore,
    scoreAfter,
  };
}

export async function runAutoOptimizeIfNeeded({
  shopDomain,
  admin,
}: {
  shopDomain: string;
  admin: AdminLike;
}) {
  console.log("AUTO CHECK start:", shopDomain);

  const settings = await prisma.autoOptimizeSettings.findUnique({
    where: { shopDomain },
  });

  console.log("AUTO CHECK settings:", settings);

  if (!settings) {
    console.log("AUTO CHECK skipped: settings not found");
    return { ran: false, reason: "settings not found" };
  }

  if (!settings.enabled) {
    console.log("AUTO CHECK skipped: disabled");
    return { ran: false, reason: "disabled" };
  }

  if (settings.mode !== "auto") {
    console.log("AUTO CHECK skipped: mode is not auto");
    return { ran: false, reason: "mode is not auto" };
  }

  const growthRule = await getGrowthAutomationRule(shopDomain);
  console.log("AUTO CHECK growthRule:", growthRule);

  const now = new Date();
  const frequencyDays = growthRule.runFrequencyDays || 7;

  if (settings.lastRunAt) {
    const diff = now.getTime() - settings.lastRunAt.getTime();
    const days = diff / (1000 * 60 * 60 * 24);

    console.log("AUTO CHECK days since last run:", days);

    if (days < frequencyDays) {
      console.log("AUTO CHECK skipped: less than runFrequencyDays");
      return { ran: false, reason: "not due yet" };
    }
  }

  console.log("AUTO CHECK running...");

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

  const json = await response.json();

  const products: AutoProduct[] =
    json?.data?.products?.edges?.map((e: any) => {
      const node = e?.node;
      return {
        id: node?.id ?? "",
        title: node?.title ?? "",
        descriptionHtml: node?.descriptionHtml ?? "",
        status: node?.status ?? "",
        updatedAt: node?.updatedAt ?? null,
        seoScore: calculateSeoScore(
          node?.title ?? "",
          node?.descriptionHtml ?? "",
        ),
      };
    }) ?? [];

  console.log("AUTO CHECK product count:", products.length);

  const activeProducts = products.filter((p) => p.status === "ACTIVE");
  console.log("AUTO CHECK active product count:", activeProducts.length);
  // 🔥 COOLDOWN FILTER (7 days)


const filteredProducts = [];
const autoCooldownDays = 7;

for (const product of activeProducts) {
  // 只对“自动优化”做硬冷却，控制成本
  const lastAutoOptimization = await prisma.optimizationHistory.findFirst({
    where: {
      productId: product.id,
      source: "auto",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastAutoOptimization) {
    filteredProducts.push(product);
    continue;
  }

  const daysSinceLastAutoOptimize =
    (now.getTime() - new Date(lastAutoOptimization.createdAt).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysSinceLastAutoOptimize >= autoCooldownDays) {
    filteredProducts.push(product);
    continue;
  }

  console.log("AUTO CHECK cooldown skipped product:", product.title, {
    skipped: true,
    reason: "Auto cooldown active",
    productId: product.id,
    daysSinceLastAutoOptimize,
    autoCooldownDays,
  });
}
  const queue = buildOptimizationQueue(filteredProducts, growthRule);

console.log("AUTO CHECK rule snapshot:", {
  optimizeBelowScore: growthRule.optimizeBelowScore,
  optimizeShortTitle: growthRule.optimizeShortTitle,
  optimizeWeakDescription: growthRule.optimizeWeakDescription,
  optimizeNewProductsOnly: growthRule.optimizeNewProductsOnly,
  maxProductsPerRun: growthRule.maxProductsPerRun,
});

console.log(
  "AUTO CHECK product diagnostics:",
  activeProducts.map((p) => ({
    title: p.title,
    score: p.seoScore,
    updatedAt: p.updatedAt,
  })),
);

console.log("AUTO CHECK queue length:", queue.length);
console.log(
  "AUTO CHECK queue titles:",
  queue.map((p: any) => ({
    title: p.title,
    score: p.seoScore,
    reasons: p.optimizationReasons,
    priorityScore: p.priorityScore,
  })),
);

  const targets = queue.slice(0, growthRule.maxProductsPerRun || 3);

  if (targets.length === 0) {
  console.log("AUTO CHECK completed: no eligible products");
  return {
    ran: false,
    reason: "no eligible products",
    reviewedCount: activeProducts.length,
    targetCount: 0,
    successCount: 0,
  };
}

  let successCount = 0;
  let skippedCount = 0;

  for (const product of targets) {
    try {
      const result = await runRuleBasedAutoOptimize({
        admin,
        product,
        focusMode: growthRule.focusMode,
      });

      if (result?.success) {
        successCount += 1;
        console.log("AUTO CHECK optimized:", product.title);
      } else {
        skippedCount += 1;
        console.log("AUTO CHECK skipped product:", product.title, result);
      }
    } catch (error) {
      skippedCount += 1;
      console.error("AUTO CHECK failed product:", product.title, error);
    }
  }

  const updated = await prisma.autoOptimizeSettings.update({
    where: { shopDomain },
    data: { lastRunAt: now },
  });

  console.log("AUTO CHECK completed, lastRunAt:", updated.lastRunAt);

  return {
    ran: true,
    reviewedCount: activeProducts.length,
    targetCount: targets.length,
    successCount,
    skippedCount,
    lastRunAt: updated.lastRunAt,
  };
}