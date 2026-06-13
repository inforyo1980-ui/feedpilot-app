import type { Billing } from "@shopify/shopify-api";

export type PlanType = "free" | "starter" | "growth";

const STARTER_PLAN = "Starter Plan";
const GROWTH_PLAN = "Growth Plan";
export const DEV_PLAN_COOKIE = "feedpilot_dev_plan";

export function isDevPlanOverrideEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function isPlanType(value: string): value is PlanType {
  return value === "free" || value === "starter" || value === "growth";
}

export function getDevPlanOverride(request: Request): PlanType | null {
  if (!isDevPlanOverrideEnabled()) return null;

  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split("=");
      return [name, decodeURIComponent(valueParts.join("="))];
    }),
  );

  const plan = cookies[DEV_PLAN_COOKIE];
  return plan && isPlanType(plan) ? plan : null;
}

export async function getPlanWithDevOverride(request: Request, billing: any) {
  const realPlan = await getPlan(billing);
  return getDevPlanOverride(request) ?? realPlan;
}

export function buildDevPlanCookie(plan: PlanType | null) {
  const parts = [
    `${DEV_PLAN_COOKIE}=${plan ?? ""}`,
    "Path=/app",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (!plan) {
    parts.push("Max-Age=0");
  } else {
    parts.push("Max-Age=2592000");
  }

  return parts.join("; ");
}

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
