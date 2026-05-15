import type { Billing } from "@shopify/shopify-api";

export type PlanType = "free" | "starter" | "growth";

const STARTER_PLAN = "Starter Plan";
const GROWTH_PLAN = "Growth Plan";

/**
 * 获取当前店铺的订阅计划
 */
export async function getPlan(billing: any) {
  const hasGrowth = await billing.check({
    plans: [GROWTH_PLAN],
  });

  if (hasGrowth?.hasActivePayment) return "growth";

  const hasStarter = await billing.check({
    plans: [STARTER_PLAN],
  });

  if (hasStarter?.hasActivePayment) return "starter";

  return "free";
}