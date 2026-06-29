import { authenticate } from "../shopify.server";
import db from "../db.server";
import { optimizeProductWithAI } from "../services/optimizer.server";
import { getPlanWithDevOverride } from "../utils/plan.server";
import {
  buildGrowthAutomationReport,
  productHasSafeGrowthAutomationFix,
  scanGrowthAutomationProducts,
} from "../utils/growthAutomationReport";

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
    message: `Weekly monitoring is available again in ${remainingHours} hour${
      remainingHours === 1 ? "" : "s"
    }.`,
  };
}

export const loader = async ({ request }: any) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const plan = await getPlanWithDevOverride(request, billing);

  if (plan !== "growth") {
    return Response.json(
      {
        result: {
          status: "locked",
          ran: false,
          reason: "growth_plan_required",
          message:
            "Weekly monitoring is available on the Growth plan. Upgrade to enable safe auto-fix and automation reports.",
        },
      },
      { status: 403 },
    );
  }

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
        productType
        vendor
        tags
        images(first: 3) {
          nodes {
            altText
            url
          }
        }
        variants(first: 3) {
          nodes {
            price
            inventoryQuantity
          }
        }
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
        productType: p.productType || "",
        vendor: p.vendor || "",
        tags: p.tags || [],
        images: p.images?.nodes || [],
        variants: p.variants?.nodes || [],
        seoScore: 10,
        optimizationReasons: ["autoDetectedLowVisibility"],
      })),
    };

    const baseReport = buildGrowthAutomationReport({
      products: snapshot.products,
    });

    if (!snapshot?.products || snapshot.products.length === 0) {
      return Response.json({
        result: {
          status: "no_products",
          ran: false,
          reason: "no_products",
          report: buildGrowthAutomationReport({ products: [] }),
          message: "No products were found for weekly monitoring.",
        },
      });
    }

    // ======================
    // 4️⃣ 🔥 queue（核心）
    // ======================
    const scans = scanGrowthAutomationProducts(snapshot.products);
    const queue = snapshot.products.filter((p: any, index: number) => {
      const scan = scans[index];
      return scan ? productHasSafeGrowthAutomationFix(scan) : false;
    });

    console.log("AUTO RUN QUEUE:", queue.length);

    if (queue.length === 0) {
      await db.autoOptimizeSettings.update({
        where: { shopDomain: shop },
        data: { lastRunAt: now },
      });

      return Response.json({
        result: {
          status: baseReport.status,
          ran: true,
          reason: baseReport.status,
          checkedCount: snapshot.products.length,
          report: baseReport,
          message: baseReport.summary,
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
    await db.autoOptimizeSettings.update({
      where: { shopDomain: shop },
      data: { lastRunAt: now },
    });

    // ======================
    // 7️⃣ 返回
    // ======================
    if (successCount === 0) {
      return Response.json({
        result: {
          status: baseReport.status,
          ran: true,
          reason: baseReport.status,
          successCount,
          checkedCount: snapshot.products.length,
          targetCount: targets.length,
          report: baseReport,
          message: baseReport.summary,
        },
      });
    }

    const completedReport = buildGrowthAutomationReport({
      products: snapshot.products,
      fixesApplied: successCount,
    });

    return Response.json({
      result: {
        status: completedReport.status,
        ran: true,
        reason: completedReport.status,
        successCount,
        optimizedCount: successCount,
        checkedCount: snapshot.products.length,
        targetCount: targets.length,
        report: completedReport,
        message: completedReport.summary,
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
          report: buildGrowthAutomationReport({ products: [], failed: true }),
          message: error?.message || "Weekly monitoring failed.",
        },
      },
      { status: 500 },
    );
  }
};
