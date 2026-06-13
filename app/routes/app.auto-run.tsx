import { authenticate } from "../shopify.server";
import db from "../db.server";
import { optimizeProductWithAI } from "../services/optimizer.server";

const AUTO_RUN_COOLDOWN_DAYS = 7;
const MAX_AUTO_PRODUCTS = 2;

function buildCooldownResult(lastRunAt: Date, now: Date) {
  const nextRunAt = new Date(lastRunAt);
  nextRunAt.setDate(nextRunAt.getDate() + AUTO_RUN_COOLDOWN_DAYS);

  const remainingMs = Math.max(nextRunAt.getTime() - now.getTime(), 0);
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));

  return {
    status: "cooldown",
    ran: false,
    reason: "cooldown",
    lastRunAt: lastRunAt.toISOString(),
    nextRunAt: nextRunAt.toISOString(),
    remainingHours,
    runFrequencyDays: AUTO_RUN_COOLDOWN_DAYS,
    message: `Priority optimization is available again in ${remainingHours} hour${
      remainingHours === 1 ? "" : "s"
    }.`,
  };
}

export const loader = async ({ request }: any) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // ======================
    // 1️⃣ settings
    // ======================
    let settings = await db.autoOptimizeSettings.findUnique({
      where: { shopDomain: shop },
    });

    if (!settings) {
      settings = await db.autoOptimizeSettings.create({
        data: {
          shopDomain: shop,
          enabled: true,
          lastRunAt: null,
        },
      });
    }

    if (!settings.enabled) {
      return Response.json({
        result: {
          status: "disabled",
          ran: false,
          reason: "disabled",
          message: "Auto optimization is disabled in settings.",
        },
      });
    }

    // ======================
    // 2️⃣ 冷却
    // ======================
   const now = new Date();

console.log("AUTO RUN SHOP:", shop);
console.log("AUTO RUN SETTINGS lastRunAt:", settings.lastRunAt);

if (settings.lastRunAt !== null) {
  const lastRunAt = new Date(settings.lastRunAt);
  const diffMs = now.getTime() - lastRunAt.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);

  console.log("AUTO RUN COOLDOWN DAYS:", days);

  if (days < AUTO_RUN_COOLDOWN_DAYS) {
    return Response.json({
      result: buildCooldownResult(lastRunAt, now),
    });
  }
}

    // ======================
    // 3️⃣ 获取 snapshot
    // ======================
    const response = await admin.graphql(`
  query AutoRunProducts {
    products(first: 20) {
      nodes {
        id
        title
        descriptionHtml
      }
    }
  }
`);

const json = await response.json();
const products = json.data?.products?.nodes || [];

const snapshot = {
  products: products.map((p: any) => ({
    id: p.id,
    title: p.title,
    descriptionHtml: p.descriptionHtml || "",
    seoScore: 10,
    optimizationReasons: ["autoDetectedLowVisibility"],
  })),
};

    if (!snapshot?.products || snapshot.products.length === 0) {
      return Response.json({
        result: {
          status: "no_products",
          ran: false,
          reason: "no_products",
          message: "No products were found for priority optimization.",
        },
      });
    }

    // ======================
    // 4️⃣ 🔥 queue（核心）
    // ======================
    const queue = snapshot.products.filter((p: any) => {
      if (p.optimizationReasons?.length > 0) return true;
      if (typeof p.seoScore === "number" && p.seoScore < 80) return true;
      if (!p.title || p.title.length < 20) return true;
      if (!p.descriptionHtml || p.descriptionHtml.length < 50) return true;
      return false;
    });

    console.log("AUTO RUN QUEUE:", queue.length);

    if (queue.length === 0) {
      return Response.json({
        result: {
          status: "no_opportunities",
          ran: false,
          reason: "no_opportunities",
          checkedCount: snapshot.products.length,
          message: "No eligible priority optimization opportunities were found.",
        },
      });
    }

    // ======================
    // 5️⃣ 🔥 调用统一AI优化
    // ======================
    let successCount = 0;

   const targets = queue
  .sort((a: any, b: any) => {
    const scoreA = typeof a.seoScore === "number" ? a.seoScore : 999;
    const scoreB = typeof b.seoScore === "number" ? b.seoScore : 999;
    return scoreA - scoreB;
  })
  .slice(0, MAX_AUTO_PRODUCTS);

  console.log(
  "AUTO RUN TARGETS:",
  targets.map((p: any) => ({
    title: p.title,
    seoScore: p.seoScore,
    reasons: p.optimizationReasons,
  })),
);

    for (const product of targets) {
      try {
        const result = await optimizeProductWithAI({
  admin,
  shopDomain: shop,
  productId: product.id,
  title: product.title,
  description: product.descriptionHtml || "",
  seoScoreBefore: product.seoScore,
  source: "automation",
  decisionMode: "auto",
});

if (!result?.skipped) {
  successCount++;
}
      } catch (err) {
        console.error("AUTO RUN AI ERROR:", err);
      }
    }

    // ======================
    // 6️⃣ 更新 lastRunAt
    // ======================
   if (successCount > 0) {
  await db.autoOptimizeSettings.update({
    where: { shopDomain: shop },
    data: { lastRunAt: now },
  });
}

    // ======================
    // 7️⃣ 返回
    // ======================
    if (successCount === 0) {
      return Response.json({
        result: {
          status: "no_changes",
          ran: true,
          reason: "no_changes",
          successCount,
          checkedCount: snapshot.products.length,
          targetCount: targets.length,
          message: "Priority optimization ran, but no product changes were needed.",
        },
      });
    }

    return Response.json({
      result: {
        status: "optimized",
        ran: true,
        reason: "optimized",
        successCount,
        optimizedCount: successCount,
        checkedCount: snapshot.products.length,
        targetCount: targets.length,
        message: `Optimized ${successCount} product${
          successCount === 1 ? "" : "s"
        }.`,
      },
    });

  } catch (error: any) {
    console.error("AUTO RUN ERROR:", error);

    return Response.json(
      {
        result: {
          status: "server_error",
          ran: false,
          reason: "server_error",
          message: error?.message || "Auto optimization failed.",
        },
      },
      { status: 500 }
    );
  }
};

